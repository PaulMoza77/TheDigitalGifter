/**
 * Send-a-Gift Meta CAPI Purchase — same event_id contract as browser Pixel:
 * send_a_gift_purchase_{orderId}
 *
 * Reuses Pet CAPI transport helpers but never Pet SKU / Pet event ids.
 */
import {
  buildMetaCapiUserData,
  hashCustomerEmailForMeta,
  metaCustomDataHasForbiddenFields,
  parseMetaCapiClickIds,
  sanitizedEventSourceUrl,
  TDG_META_PIXEL_ID,
} from "../pet/meta.ts";
import { asString } from "./crypto.ts";
import { SEND_A_GIFT_PRODUCT_KEY } from "./sendAGift.ts";

export function sendAGiftMetaPurchaseEventId(orderId: string): string {
  return `send_a_gift_purchase_${asString(orderId)}`;
}

export function sendAGiftMetaInitiateCheckoutEventId(orderId: string): string {
  return `send_a_gift_ic_${asString(orderId)}`;
}

function pixelId(): string {
  return asString(
    Deno.env.get("META_PIXEL_ID") || Deno.env.get("FACEBOOK_PIXEL_ID") || TDG_META_PIXEL_ID,
  );
}

function capiToken(): string {
  return asString(Deno.env.get("META_CAPI_ACCESS_TOKEN") || Deno.env.get("META_ACCESS_TOKEN"));
}

function siteOrigin(): string {
  return asString(Deno.env.get("SITE_ORIGIN") || Deno.env.get("PUBLIC_SITE_URL") || "https://thedigitalgifter.com");
}

async function postMetaCapi(
  payload: Record<string, unknown>,
  options?: { testEventCode?: string | null },
): Promise<{ sent: boolean; reason?: string; eventsReceived?: number }> {
  const id = pixelId();
  const token = capiToken();
  if (!id || !token) return { sent: false, reason: "unconfigured" };

  const testCode =
    asString(options?.testEventCode) || asString(Deno.env.get("META_TEST_EVENT_CODE"));
  const body: Record<string, unknown> = { ...payload };
  if (testCode) body.test_event_code = testCode;

  const url = `https://graph.facebook.com/v21.0/${id}/events`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Meta CAPI failed (${res.status}): ${text.slice(0, 180)}`);
  }
  let eventsReceived: number | undefined;
  try {
    const parsed = JSON.parse(text) as { events_received?: number };
    if (typeof parsed.events_received === "number") eventsReceived = parsed.events_received;
  } catch {
    /* empty body ok */
  }
  return { sent: true, eventsReceived };
}

function customData(input: {
  amountCents: number;
  orderId: string;
  packageKey?: string;
  currency?: string;
}): Record<string, unknown> {
  const value = input.amountCents / 100;
  const currency = (input.currency || "USD").toUpperCase();
  const contentId = input.packageKey
    ? `${SEND_A_GIFT_PRODUCT_KEY}:${input.packageKey}`
    : SEND_A_GIFT_PRODUCT_KEY;
  return {
    currency,
    value,
    content_ids: [contentId],
    content_type: "product",
    contents: [{ id: contentId, quantity: 1, item_price: value }],
    num_items: 1,
    order_id: input.orderId,
  };
}

/** Idempotent: alreadySentAt or empty/non-positive amount → no send. */
export async function sendSendAGiftMetaCapiPurchase(input: {
  orderId: string;
  amountCents: number;
  currency?: string;
  packageKey?: string;
  email?: string | null;
  alreadySentAt?: string | null;
  alreadyEventId?: string | null;
  fbc?: string | null;
  fbp?: string | null;
  clientIpAddress?: string | null;
  clientUserAgent?: string | null;
  sourceUrl?: string;
  testEventCode?: string | null;
}): Promise<{ sent: boolean; reason?: string; eventId: string; eventsReceived?: number }> {
  const eventId = sendAGiftMetaPurchaseEventId(input.orderId);
  if (input.alreadySentAt || (input.alreadyEventId && input.alreadyEventId === eventId)) {
    return { sent: false, reason: "duplicate", eventId };
  }
  if (!input.orderId || !Number.isFinite(input.amountCents) || input.amountCents <= 0) {
    return { sent: false, reason: "not_paid", eventId };
  }

  const hashedEmail = await hashCustomerEmailForMeta(input.email);
  const data = customData({
    amountCents: input.amountCents,
    orderId: input.orderId,
    packageKey: input.packageKey,
    currency: input.currency,
  });
  if (metaCustomDataHasForbiddenFields(data)) {
    return { sent: false, reason: "unsafe_custom_data", eventId };
  }

  const clicks = parseMetaCapiClickIds({ fbc: input.fbc, fbp: input.fbp });
  const userData = buildMetaCapiUserData({
    em: hashedEmail,
    fbc: clicks.fbc,
    fbp: clicks.fbp,
    clientIpAddress: input.clientIpAddress,
    clientUserAgent: input.clientUserAgent,
  });

  try {
    const result = await postMetaCapi(
      {
        data: [
          {
            event_name: "Purchase",
            event_time: Math.floor(Date.now() / 1000),
            event_id: eventId,
            action_source: "website",
            event_source_url: sanitizedEventSourceUrl(
              input.sourceUrl || `${siteOrigin()}/send-a-gift`,
            ),
            user_data: userData,
            custom_data: data,
          },
        ],
      },
      { testEventCode: input.testEventCode },
    );
    return { ...result, eventId };
  } catch (err) {
    return {
      sent: false,
      reason: err instanceof Error ? err.message.slice(0, 120) : "capi_error",
      eventId,
    };
  }
}
