import { PET_PRODUCT_SKU } from "@/features/pet/types";

export const TDG_META_PIXEL_ID = "1581639566935542";

type Fbq = ((...args: unknown[]) => void) & { loaded?: boolean };

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
  "event_source_url",
] as const;

type FbqWindow = Window & { fbq?: Fbq; _fbq?: Fbq };

function pixel(): Fbq | null {
  if (typeof window === "undefined") return null;
  const fbq = (window as FbqWindow).fbq;
  return typeof fbq === "function" ? fbq : null;
}

function once(key: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (window.sessionStorage.getItem(key) === "1") return false;
    window.sessionStorage.setItem(key, "1");
    return true;
  } catch {
    return true;
  }
}

export function sanitizedEventSourceUrl(
  href: string,
  originFallback = "https://www.thedigitalgifter.com",
): string {
  try {
    const url = new URL(href, originFallback);
    return `${url.origin}${url.pathname}`;
  } catch {
    return `${originFallback.replace(/\/$/, "")}/`;
  }
}

export function buildMetaCustomData(input: {
  valueCents: number;
  orderId?: string;
  numItems?: number;
}): Record<string, unknown> {
  const value = Number(input.valueCents) / 100;
  const data: Record<string, unknown> = {
    content_ids: [PET_PRODUCT_SKU],
    content_type: "product",
    value,
    currency: "USD",
    num_items: input.numItems ?? 1,
  };
  if (input.orderId) data.order_id = input.orderId;
  return data;
}

export function metaCustomDataHasForbiddenFields(data: Record<string, unknown>): boolean {
  if (FORBIDDEN_CUSTOM_KEYS.some((key) => key in data)) return true;
  const json = JSON.stringify(data);
  return /https?:\/\//i.test(json) || /@/.test(json);
}

function track(event: string, data: Record<string, unknown>, eventId?: string) {
  if (metaCustomDataHasForbiddenFields(data)) return;
  const fbq = pixel();
  if (!fbq) return;
  if (eventId) fbq("track", event, data, { eventID: eventId });
  else fbq("track", event, data);
}

export function trackMetaSpaPageView(pathname: string) {
  if (!pathname) return;
  pixel()?.("track", "PageView");
}

export function trackMetaViewContent(input: { valueCents: number; onceKey: string }) {
  if (!Number.isFinite(input.valueCents) || input.valueCents <= 0) return;
  if (!once(input.onceKey)) return;
  track("ViewContent", buildMetaCustomData({ valueCents: input.valueCents }));
}

export function trackMetaInitiateCheckout(input: {
  eventId: string;
  valueCents: number;
  orderId?: string;
}) {
  if (!input.eventId) return;
  if (!Number.isFinite(input.valueCents) || input.valueCents <= 0) return;
  if (!once(`tdg.meta.initiateCheckout.${input.eventId}`)) return;
  track(
    "InitiateCheckout",
    buildMetaCustomData({ valueCents: input.valueCents, orderId: input.orderId }),
    input.eventId,
  );
}

export function trackMetaPurchaseOnce(input: {
  eventId: string;
  amountCents: number;
  orderId: string;
  paidAt?: string | null;
}) {
  if (!input.eventId || !input.orderId) return;
  if (!input.paidAt) return;
  if (!Number.isFinite(input.amountCents) || input.amountCents <= 0) return;
  if (!once(`tdg.meta.purchase.${input.eventId}`)) return;
  track(
    "Purchase",
    buildMetaCustomData({
      valueCents: input.amountCents,
      orderId: input.orderId,
    }),
    input.eventId,
  );
}
