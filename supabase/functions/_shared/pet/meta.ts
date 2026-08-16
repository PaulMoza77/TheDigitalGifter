import { PET_PRICE_CENTS, PET_SKU } from "./constants.ts";
import { sha256Hex } from "./crypto.ts";
import { metaPurchaseShouldEmit } from "./guards.ts";

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

export async function sendMetaCapiPurchase(input: {
  eventId: string;
  email?: string | null;
  alreadySentAt?: string | null;
  eventTime?: number;
  sourceUrl?: string;
}): Promise<{ sent: boolean; reason?: string }> {
  if (!metaPurchaseShouldEmit({ alreadySentAt: input.alreadySentAt ?? null, eventId: input.eventId })) {
    return { sent: false, reason: "duplicate" };
  }

  const pixelId = asString(Deno.env.get("META_PIXEL_ID") || Deno.env.get("FACEBOOK_PIXEL_ID") || "1673980440653322");
  const token = asString(Deno.env.get("META_CAPI_ACCESS_TOKEN") || Deno.env.get("META_ACCESS_TOKEN"));
  if (!pixelId || !token) {
    return { sent: false, reason: "unconfigured" };
  }

  const hashedEmail = input.email ? await hashIdentifier(input.email) : null;
  const payload = {
    data: [
      {
        event_name: "Purchase",
        event_time: input.eventTime || Math.floor(Date.now() / 1000),
        event_id: input.eventId,
        action_source: "website",
        event_source_url: input.sourceUrl || undefined,
        user_data: hashedEmail ? { em: [hashedEmail] } : {},
        custom_data: {
          currency: "USD",
          value: PET_PRICE_CENTS / 100,
          content_ids: [PET_SKU],
          content_type: "product",
          contents: [{ id: PET_SKU, quantity: 1, item_price: 59.0 }],
        },
      },
    ],
  };

  const testCode = asString(Deno.env.get("META_TEST_EVENT_CODE"));
  const url = new URL(`https://graph.facebook.com/v21.0/${pixelId}/events`);
  url.searchParams.set("access_token", token);
  if (testCode) url.searchParams.set("test_event_code", testCode);

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Meta CAPI failed (${res.status}): ${text.slice(0, 180)}`);
  }
  return { sent: true };
}
