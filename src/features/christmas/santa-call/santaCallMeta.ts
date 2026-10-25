/**
 * Consent-aware Meta Pixel helpers for Santa Call.
 * Never send child PII, call tokens, or emails. Purchase only after confirmed payment,
 * deduped by order id (Stripe redirect + webhook retries).
 */
import { readCookieConsent } from "@/lib/cookieConsent";
import { SANTA_CALL_PRODUCT_KEY } from "./santaCallTypes";

type Fbq = ((...args: unknown[]) => void) & { loaded?: boolean };

function pixel(): Fbq | null {
  if (typeof window === "undefined") return null;
  if (readCookieConsent() !== "granted") return null;
  const fbq = (window as Window & { fbq?: Fbq }).fbq;
  return typeof fbq === "function" ? fbq : null;
}

function once(key: string): boolean {
  try {
    if (window.sessionStorage.getItem(key) === "1") return false;
    window.sessionStorage.setItem(key, "1");
    return true;
  } catch {
    return true;
  }
}

export function santaCallPurchaseEventId(orderId: string) {
  return `xmas_santa_call_purchase_${orderId}`;
}

export function trackSantaCallMetaViewContent(amountCents: number, currency: string) {
  const fbq = pixel();
  if (!fbq || amountCents <= 0) return;
  if (!once("tdg.meta.santa_call.view_content")) return;
  fbq("track", "ViewContent", {
    currency: (currency || "ron").toUpperCase(),
    value: amountCents / 100,
    content_ids: [SANTA_CALL_PRODUCT_KEY],
    content_type: "product",
  });
}

export function trackSantaCallMetaInitiateCheckout(input: {
  orderId: string;
  amountCents: number;
  currency: string;
}) {
  const fbq = pixel();
  if (!fbq || input.amountCents <= 0 || !input.orderId) return;
  if (!once(`tdg.meta.santa_call.ic.${input.orderId}`)) return;
  fbq(
    "track",
    "InitiateCheckout",
    {
      currency: (input.currency || "ron").toUpperCase(),
      value: input.amountCents / 100,
      content_ids: [SANTA_CALL_PRODUCT_KEY],
      content_type: "product",
    },
    { eventID: `xmas_santa_call_ic_${input.orderId}` },
  );
}

/** Fire only after payment confirmed (success page / paid order), never on bare redirect. */
export function trackSantaCallMetaPurchase(input: {
  orderId: string;
  amountCents: number;
  currency: string;
}) {
  const fbq = pixel();
  if (!fbq || input.amountCents <= 0 || !input.orderId) return;
  const eventId = santaCallPurchaseEventId(input.orderId);
  if (!once(eventId)) return;
  fbq(
    "track",
    "Purchase",
    {
      currency: (input.currency || "ron").toUpperCase(),
      value: input.amountCents / 100,
      content_ids: [SANTA_CALL_PRODUCT_KEY],
      content_type: "product",
      order_id: input.orderId,
    },
    { eventID: eventId },
  );
}
