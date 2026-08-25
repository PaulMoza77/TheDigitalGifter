import { shouldTrackPetBeginCheckout } from "../pet/funnelAnalytics";
import { trackPetV2Event } from "./analytics";
import type { PetV2Species } from "./types";

export type V2CheckoutResult = {
  status?: string | null;
  sessionId?: string | null;
  checkoutUrl?: string | null;
  clientSecret?: string | null;
  eventId?: string;
  orderId: string;
  chargedAmountCents?: number;
  amountCents?: number;
};

/** First-party V2 initiate checkout — only after Stripe session is created/opened. */
export function trackV2BeginCheckout(input: {
  species: PetV2Species;
  result: V2CheckoutResult;
  fallbackAmountCents?: number | null;
}): boolean {
  if (!shouldTrackPetBeginCheckout(input.result)) return false;
  const amountCents =
    input.result.chargedAmountCents ??
    input.result.amountCents ??
    input.fallbackAmountCents ??
    null;
  if (!amountCents || amountCents <= 0) return false;

  trackPetV2Event({
    eventName: "v2_begin_checkout",
    species: input.species,
    amountCents,
    attemptId: input.result.orderId,
  });
  return true;
}
