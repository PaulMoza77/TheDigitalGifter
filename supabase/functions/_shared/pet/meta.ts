import { PET_SKU, siteOrigin } from "./constants.ts";
import { sha256Hex } from "./crypto.ts";
import { metaPurchaseShouldEmit } from "./guards.ts";

export const TDG_META_PIXEL_ID = "1581639566935542";

function asString(value: unknown): string {
  return String(value ?? "").trim();
}

export async function hashIdentifier(value: string): Promise<string | null> {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  return sha256Hex(normalized);
}

export function petPurchaseEventId(orderId: string): string {
  return `pet_purchase_${orderId}`;
}

export function petInitiateCheckoutEventId(orderId: string): string {
  return `pet_ic_${orderId}`;
}

export function petMetaCheckoutFields(order: {
  id: string;
  amount_cents?: unknown;
  charged_amount_cents?: unknown;
}) {
  const amountCents = Number(order.amount_cents);
  const charged = Number(order.charged_amount_cents ?? order.amount_cents);
  return {
    eventId: petInitiateCheckoutEventId(order.id),
    purchaseEventId: petPurchaseEventId(order.id),
    amountCents,
    chargedAmountCents: Number.isFinite(charged) ? charged : amountCents,
    currency: "usd" as const,
    sku: PET_SKU,
  };
}

export function sanitizedEventSourceUrl(href?: string | null): string {
  const origin = siteOrigin();
  if (!href) return `${origin}/pet`;
  try {
    const url = new URL(href, origin);
    return `${url.origin}${url.pathname}`;
  } catch {
    return `${origin}/pet`;
  }
}

const FORBIDDEN_CUSTOM_KEYS = [
  "email",
  "em",
  "token",
  "publicToken",
  "public_token",
  "photoUrl",
  "photo_url",
  "imageUrl",
  "image_url",
];

export function metaCustomDataHasForbiddenFields(data: Record<string, unknown>): boolean {
  if (FORBIDDEN_CUSTOM_KEYS.some((key) => key in data)) return true;
  const json = JSON.stringify(data);
  return /https?:\/\//i.test(json) || /@/.test(json);
}

function pixelId(): string {
  return asString(Deno.env.get("META_PIXEL_ID") || Deno.env.get("FACEBOOK_PIXEL_ID") || TDG_META_PIXEL_ID);
}

function capiToken(): string {
  // Read only from Edge Function secrets. Never log this value.
  return asString(Deno.env.get("META_CAPI_ACCESS_TOKEN") || Deno.env.get("META_ACCESS_TOKEN"));
}

async function postMetaCapi(payload: Record<string, unknown>): Promise<{ sent: boolean; reason?: string }> {
  const id = pixelId();
  const token = capiToken();
  if (!id || !token) return { sent: false, reason: "unconfigured" };

  const testCode = asString(Deno.env.get("META_TEST_EVENT_CODE"));
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
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Meta CAPI failed (${res.status}): ${text.slice(0, 180)}`);
  }
  return { sent: true };
}

function customData(input: { amountCents: number; orderId?: string }): Record<string, unknown> {
  const value = input.amountCents / 100;
  const data: Record<string, unknown> = {
    currency: "USD",
    value,
    content_ids: [PET_SKU],
    content_type: "product",
    contents: [{ id: PET_SKU, quantity: 1, item_price: value }],
    num_items: 1,
  };
  if (input.orderId) data.order_id = input.orderId;
  return data;
}

export async function sendMetaCapiPurchase(input: {
  eventId: string;
  orderId?: string;
  email?: string | null;
  alreadySentAt?: string | null;
  eventTime?: number;
  sourceUrl?: string;
  amountCents?: number;
}): Promise<{ sent: boolean; reason?: string }> {
  if (!metaPurchaseShouldEmit({ alreadySentAt: input.alreadySentAt ?? null, eventId: input.eventId })) {
    return { sent: false, reason: "duplicate" };
  }
  if (!input.eventId || input.amountCents == null || input.amountCents <= 0) {
    return { sent: false, reason: "not_paid" };
  }

  const hashedEmail = input.email ? await hashIdentifier(input.email) : null;
  const data = customData({ amountCents: input.amountCents, orderId: input.orderId });
  if (metaCustomDataHasForbiddenFields(data)) {
    return { sent: false, reason: "unsafe_custom_data" };
  }

  return postMetaCapi({
    data: [
      {
        event_name: "Purchase",
        event_time: input.eventTime || Math.floor(Date.now() / 1000),
        event_id: input.eventId,
        action_source: "website",
        event_source_url: sanitizedEventSourceUrl(input.sourceUrl || `${siteOrigin()}/pet/order`),
        user_data: hashedEmail ? { em: [hashedEmail] } : {},
        custom_data: data,
      },
    ],
  });
}

export async function sendMetaCapiInitiateCheckout(input: {
  eventId: string;
  orderId: string;
  email?: string | null;
  amountCents: number;
}): Promise<{ sent: boolean; reason?: string }> {
  if (!input.eventId || !input.orderId || input.amountCents <= 0) {
    return { sent: false, reason: "invalid" };
  }
  const hashedEmail = input.email ? await hashIdentifier(input.email) : null;
  const data = customData({ amountCents: input.amountCents, orderId: input.orderId });
  if (metaCustomDataHasForbiddenFields(data)) {
    return { sent: false, reason: "unsafe_custom_data" };
  }
  try {
    return await postMetaCapi({
      data: [
        {
          event_name: "InitiateCheckout",
          event_time: Math.floor(Date.now() / 1000),
          event_id: input.eventId,
          action_source: "website",
          event_source_url: sanitizedEventSourceUrl(`${siteOrigin()}/pet/checkout`),
          user_data: hashedEmail ? { em: [hashedEmail] } : {},
          custom_data: data,
        },
      ],
    });
  } catch {
    return { sent: false, reason: "capi_error" };
  }
}
