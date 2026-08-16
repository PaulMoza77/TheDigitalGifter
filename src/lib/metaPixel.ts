import { PET_PRICE_CENTS, PET_PRODUCT_SKU } from "@/features/pet/types";

type Fbq = (...args: unknown[]) => void;

function pixel(): Fbq | null {
  if (typeof window === "undefined") return null;
  const fbq = (window as Window & { fbq?: Fbq }).fbq;
  return typeof fbq === "function" ? fbq : null;
}

export function trackMetaViewContent() {
  pixel()?.("track", "ViewContent", {
    content_ids: [PET_PRODUCT_SKU],
    content_type: "product",
    value: PET_PRICE_CENTS / 100,
    currency: "USD",
  });
}

export function trackMetaInitiateCheckout(eventId: string) {
  pixel()?.("track", "InitiateCheckout", {
    content_ids: [PET_PRODUCT_SKU],
    content_type: "product",
    value: PET_PRICE_CENTS / 100,
    currency: "USD",
    num_items: 1,
  }, { eventID: eventId });
}

export function trackMetaPurchaseOnce(eventId: string, amountCents: number = PET_PRICE_CENTS) {
  if (typeof window === "undefined" || !eventId) return;
  const key = `tdg.meta.purchase.${eventId}`;
  try {
    if (window.sessionStorage.getItem(key) === "1") return;
    window.sessionStorage.setItem(key, "1");
  } catch {
    /* private mode */
  }
  pixel()?.("track", "Purchase", {
    content_ids: [PET_PRODUCT_SKU],
    content_type: "product",
    value: amountCents / 100,
    currency: "USD",
    num_items: 1,
  }, { eventID: eventId });
}
