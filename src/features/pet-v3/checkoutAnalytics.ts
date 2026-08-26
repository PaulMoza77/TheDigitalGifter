import { shouldTrackPetBeginCheckout } from "../pet/funnelAnalytics";
import { trackPetV3Event } from "./analytics";

export type V3CheckoutResult = {
  status?: string | null;
  sessionId?: string | null;
  checkoutUrl?: string | null;
  clientSecret?: string | null;
  eventId?: string;
  orderId: string;
  chargedAmountCents?: number;
  amountCents?: number;
};

/** Embedded payment form became visible and usable — once per session. */
export function trackV3CheckoutViewed(): void {
  trackPetV3Event({ eventName: "v3_checkout_viewed" });
}

/**
 * First-party V3 initiate checkout — only after meaningful payment interaction
 * (PaymentElement focus/change or Pay button), not when the form renders.
 */
export function trackV3BeginCheckoutOnInteraction(input: {
  result: V3CheckoutResult;
  fallbackAmountCents?: number | null;
}): boolean {
  if (!shouldTrackPetBeginCheckout(input.result)) return false;
  const amountCents =
    input.result.chargedAmountCents ??
    input.result.amountCents ??
    input.fallbackAmountCents ??
    null;
  if (!amountCents || amountCents <= 0) return false;

  trackPetV3Event({
    eventName: "v3_begin_checkout",
    amountCents,
    attemptId: input.result.orderId,
  });
  return true;
}

/** @deprecated Use trackV3BeginCheckoutOnInteraction after payment interaction. Kept for tests. */
export function trackV3BeginCheckout(input: {
  result: V3CheckoutResult;
  fallbackAmountCents?: number | null;
}): boolean {
  return trackV3BeginCheckoutOnInteraction(input);
}
