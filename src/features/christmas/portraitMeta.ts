type Fbq = ((...args: unknown[]) => void) & { loaded?: boolean };

function pixel(): Fbq | null {
  if (typeof window === "undefined") return null;
  const fbq = (window as Window & { fbq?: Fbq }).fbq;
  return typeof fbq === "function" ? fbq : null;
}

/** Browser Purchase only after the server has marked the portrait order paid. */
export function trackChristmasPortraitPurchase(input: {
  orderId: string;
  productKey: string;
  amountCents: number;
  currency: string;
  paidAt?: string | null;
}) {
  const fbq = pixel();
  if (!fbq || !input.orderId || !input.paidAt) return;
  if (!Number.isFinite(input.amountCents) || input.amountCents <= 0) return;
  const eventId = `xmas_portrait_purchase_${input.orderId}`;
  try {
    if (window.sessionStorage.getItem(eventId) === "1") return;
    window.sessionStorage.setItem(eventId, "1");
  } catch {
    /* Dedup is best-effort when storage is blocked. */
  }
  fbq(
    "track",
    "Purchase",
    {
      currency: (input.currency || "eur").toUpperCase(),
      value: input.amountCents / 100,
      content_ids: [input.productKey],
      content_type: "product",
      order_id: input.orderId,
    },
    { eventID: eventId },
  );
}
