import { PLANNER_PRODUCT_KEY } from "./commerce";
import { plannerPurchaseEventId } from "./analyticsPrivacy";

type Fbq = ((...args: unknown[]) => void) & { loaded?: boolean };

function pixel(): Fbq | null {
  if (typeof window === "undefined") return null;
  const fbq = (window as Window & { fbq?: Fbq }).fbq;
  return typeof fbq === "function" ? fbq : null;
}

export function trackPlannerMetaInitiateCheckout(orderId: string, amountCents: number, currency: string) {
  const fbq = pixel();
  if (!fbq || amountCents <= 0) return;
  fbq(
    "track",
    "InitiateCheckout",
    {
      currency: (currency || "usd").toUpperCase(),
      value: amountCents / 100,
      content_ids: [PLANNER_PRODUCT_KEY],
      content_type: "product",
    },
    { eventID: `xmas_planner_ic_${orderId}` },
  );
}

export function trackPlannerMetaPurchase(orderId: string, amountCents: number, currency: string) {
  const fbq = pixel();
  if (!fbq || amountCents <= 0) return;
  const eventId = plannerPurchaseEventId(orderId);
  try {
    if (window.sessionStorage.getItem(eventId) === "1") return;
    window.sessionStorage.setItem(eventId, "1");
  } catch {
    /* continue */
  }
  fbq(
    "track",
    "Purchase",
    {
      currency: (currency || "usd").toUpperCase(),
      value: amountCents / 100,
      content_ids: [PLANNER_PRODUCT_KEY],
      content_type: "product",
      order_id: orderId,
    },
    { eventID: eventId },
  );
}
