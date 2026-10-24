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

/** V3 bootstrap placeholder — never send to Meta CAPI or GA4 as a real customer email. */
export function isCheckoutPlaceholderEmail(email: string | null | undefined): boolean {
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized) return false;
  return /^pending\+[a-z0-9_-]*@checkout\.thedigitalgifter\.com$/i.test(normalized);
}

/** Hash only validated real customer emails; omit placeholders and empty values. */
export async function hashCustomerEmailForMeta(email: string | null | undefined): Promise<string | null> {
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized || isCheckoutPlaceholderEmail(normalized)) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return null;
  return hashIdentifier(normalized);
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

/** Meta `_fbc` / `_fbp` look like `fb.1.<ts>.<id>`. Never log these values. */
export function sanitizeMetaClickId(value: unknown): string | null {
  const raw = asString(value);
  if (!raw || raw.length > 200) return null;
  if (!raw.startsWith("fb.")) return null;
  if (/[<>@\s]/.test(raw)) return null;
  if (!raw.includes(".")) return null;
  return raw;
}

export type MetaCapiClickIds = {
  fbc: string | null;
  fbp: string | null;
  hasMetaClick: boolean;
};

export function parseMetaCapiClickIds(raw: unknown): MetaCapiClickIds {
  const row = raw && typeof raw === "object" && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : {};
  const fbc = sanitizeMetaClickId(row.fbc ?? row.meta_fbc);
  const fbp = sanitizeMetaClickId(row.fbp ?? row.meta_fbp);
  const hasMetaClick =
    row.hasMetaClick === true ||
    row.has_meta_click === true ||
    Boolean(fbc);
  return { fbc, fbp, hasMetaClick };
}

export function buildMetaCapiUserData(input: {
  em?: string | null;
  fbc?: string | null;
  fbp?: string | null;
  clientIpAddress?: string | null;
  clientUserAgent?: string | null;
}): Record<string, unknown> {
  const userData: Record<string, unknown> = {};
  if (input.em) userData.em = [input.em];
  const fbc = sanitizeMetaClickId(input.fbc);
  const fbp = sanitizeMetaClickId(input.fbp);
  if (fbc) userData.fbc = fbc;
  if (fbp) userData.fbp = fbp;
  const ip = asString(input.clientIpAddress);
  if (ip && ip.length <= 64) userData.client_ip_address = ip;
  const ua = asString(input.clientUserAgent);
  if (ua && ua.length <= 512) userData.client_user_agent = ua.slice(0, 512);
  return userData;
}

function pixelId(): string {
  return asString(Deno.env.get("META_PIXEL_ID") || Deno.env.get("FACEBOOK_PIXEL_ID") || TDG_META_PIXEL_ID);
}

function capiToken(): string {
  // Read only from Edge Function secrets. Never log this value.
  return asString(Deno.env.get("META_CAPI_ACCESS_TOKEN") || Deno.env.get("META_ACCESS_TOKEN"));
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
    /* Meta may return an empty body on some successes */
  }
  return { sent: true, eventsReceived };
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
  fbc?: string | null;
  fbp?: string | null;
  clientIpAddress?: string | null;
  clientUserAgent?: string | null;
  /** When set, routes to Meta Test Events only (never production Ads metrics). */
  testEventCode?: string | null;
}): Promise<{ sent: boolean; reason?: string; eventsReceived?: number }> {
  if (!metaPurchaseShouldEmit({ alreadySentAt: input.alreadySentAt ?? null, eventId: input.eventId })) {
    return { sent: false, reason: "duplicate" };
  }
  if (!input.eventId || input.amountCents == null || input.amountCents <= 0) {
    return { sent: false, reason: "not_paid" };
  }

  const hashedEmail = await hashCustomerEmailForMeta(input.email);
  const data = customData({ amountCents: input.amountCents, orderId: input.orderId });
  if (metaCustomDataHasForbiddenFields(data)) {
    return { sent: false, reason: "unsafe_custom_data" };
  }

  const userData = buildMetaCapiUserData({
    em: hashedEmail,
    fbc: input.fbc,
    fbp: input.fbp,
    clientIpAddress: input.clientIpAddress,
    clientUserAgent: input.clientUserAgent,
  });

  return postMetaCapi(
    {
      data: [
        {
          event_name: "Purchase",
          event_time: input.eventTime || Math.floor(Date.now() / 1000),
          event_id: input.eventId,
          action_source: "website",
          event_source_url: sanitizedEventSourceUrl(input.sourceUrl || `${siteOrigin()}/pet/order`),
          user_data: userData,
          custom_data: data,
        },
      ],
    },
    { testEventCode: input.testEventCode },
  );
}

/** Production Meta dataset id used for CAPI (never log tokens). */
export function metaCapiPixelId(): string {
  return pixelId();
}

export function metaTestEventCodeConfigured(): boolean {
  return Boolean(asString(Deno.env.get("META_TEST_EVENT_CODE")));
}

export async function sendMetaCapiInitiateCheckout(input: {
  eventId: string;
  orderId: string;
  email?: string | null;
  amountCents: number;
  fbc?: string | null;
  fbp?: string | null;
  sourceUrl?: string;
}): Promise<{ sent: boolean; reason?: string }> {
  if (!input.eventId || !input.orderId || input.amountCents <= 0) {
    return { sent: false, reason: "invalid" };
  }
  const hashedEmail = await hashCustomerEmailForMeta(input.email);
  const data = customData({ amountCents: input.amountCents, orderId: input.orderId });
  if (metaCustomDataHasForbiddenFields(data)) {
    return { sent: false, reason: "unsafe_custom_data" };
  }
  const userData = buildMetaCapiUserData({
    em: hashedEmail,
    fbc: input.fbc,
    fbp: input.fbp,
  });
  try {
    return await postMetaCapi({
      data: [
        {
          event_name: "InitiateCheckout",
          event_time: Math.floor(Date.now() / 1000),
          event_id: input.eventId,
          action_source: "website",
          event_source_url: sanitizedEventSourceUrl(
            input.sourceUrl || `${siteOrigin()}/pet/checkout`,
          ),
          user_data: userData,
          custom_data: data,
        },
      ],
    });
  } catch {
    return { sent: false, reason: "capi_error" };
  }
}
