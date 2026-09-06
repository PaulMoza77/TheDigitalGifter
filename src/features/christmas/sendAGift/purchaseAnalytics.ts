/**
 * Send-a-Gift purchase analytics contract (GA4 + Meta).
 * Privacy: never include names, emails, gift messages, tokens, or card data.
 * Replay-safe via once keys. Meta Pixel + CAPI share identical event_id builders.
 */

import { trackEvent } from "@/lib/analytics";
import { trackMetaInitiateCheckout, trackMetaPurchaseOnce } from "@/lib/metaPixel";
import { SEND_A_GIFT_PRODUCT_KEY } from "./packageComposition";

const GA4_ONCE_PREFIX = "tdg.ga4.send_a_gift";

function oncePersistent(key: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (window.localStorage.getItem(key) === "1") return false;
    window.localStorage.setItem(key, "1");
    return true;
  } catch {
    return true;
  }
}

function onceSession(key: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (window.sessionStorage.getItem(key) === "1") return false;
    window.sessionStorage.setItem(key, "1");
    return true;
  } catch {
    return true;
  }
}

/** Shared Meta event ids — Pixel and CAPI must use these exact strings. */
export function sendAGiftMetaPurchaseEventId(orderId: string): string {
  return `send_a_gift_purchase_${orderId}`;
}

export function sendAGiftMetaInitiateCheckoutEventId(orderId: string): string {
  return `send_a_gift_ic_${orderId}`;
}

export function buildSendAGiftGa4PurchasePayload(input: {
  orderId: string;
  amountCents: number;
  currency?: string;
  packageKey: string;
}) {
  const currency = (input.currency || "usd").toUpperCase();
  const value = Number(input.amountCents) / 100;
  return {
    transaction_id: input.orderId,
    value,
    currency,
    items: [
      {
        item_id: `${SEND_A_GIFT_PRODUCT_KEY}:${input.packageKey}`,
        item_name: "Send a Gift",
        item_category: SEND_A_GIFT_PRODUCT_KEY,
        item_variant: input.packageKey,
        price: value,
        quantity: 1,
      },
    ],
  };
}

export function trackSendAGiftGa4Purchase(input: {
  orderId: string;
  amountCents: number;
  currency?: string;
  packageKey: string;
  paidAt?: string | null;
}): boolean {
  if (!input.orderId || !input.paidAt) return false;
  if (!Number.isFinite(input.amountCents) || input.amountCents <= 0) return false;
  const onceKey = `${GA4_ONCE_PREFIX}.purchase.${input.orderId}`;
  if (!oncePersistent(onceKey)) return false;
  try {
    trackEvent("purchase", buildSendAGiftGa4PurchasePayload(input));
  } catch {
    return false;
  }
  return true;
}

export function trackSendAGiftMetaInitiateCheckout(input: {
  orderId: string;
  amountCents: number;
}): boolean {
  if (!input.orderId) return false;
  if (!Number.isFinite(input.amountCents) || input.amountCents <= 0) return false;
  const eventId = sendAGiftMetaInitiateCheckoutEventId(input.orderId);
  if (!onceSession(`tdg.meta.send_a_gift.ic.${eventId}`)) return false;
  trackMetaInitiateCheckout({
    eventId,
    valueCents: input.amountCents,
    orderId: input.orderId,
  });
  return true;
}

export function trackSendAGiftMetaPurchase(input: {
  orderId: string;
  amountCents: number;
  paidAt?: string | null;
}): boolean {
  if (!input.orderId || !input.paidAt) return false;
  if (!Number.isFinite(input.amountCents) || input.amountCents <= 0) return false;
  const eventId = sendAGiftMetaPurchaseEventId(input.orderId);
  trackMetaPurchaseOnce({
    eventId,
    amountCents: input.amountCents,
    orderId: input.orderId,
    paidAt: input.paidAt,
  });
  return true;
}

/** CAPI payload builder — same event_id as Pixel Purchase. */
export function buildSendAGiftCapiPurchase(input: {
  orderId: string;
  amountCents: number;
  currency?: string;
}) {
  return {
    event_name: "Purchase",
    event_id: sendAGiftMetaPurchaseEventId(input.orderId),
    custom_data: {
      value: Number(input.amountCents) / 100,
      currency: (input.currency || "usd").toUpperCase(),
      content_ids: [SEND_A_GIFT_PRODUCT_KEY],
      content_type: "product",
      order_id: input.orderId,
    },
  };
}
