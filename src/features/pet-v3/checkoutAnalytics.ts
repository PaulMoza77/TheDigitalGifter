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

/** First-party V3 initiate checkout — only after Stripe session is created/opened. */
export function trackV3BeginCheckout(input: {
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
