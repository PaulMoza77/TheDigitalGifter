import { petFunnelApi } from "../pet/supabaseApi";
import { getMetaCapiClickIds } from "../pet/metaCookies";
import { PET_V3_SPECIES } from "./types";
import { trackFunnelBeginCheckout } from "../pet/funnelAnalytics";

let inFlight: Promise<void> | null = null;
let sentForOrder: string | null = null;

/** Idempotent V3 begin checkout: first-party event, browser Pixel, GA4, and server CAPI. */
export function fireV3InitiateCheckoutOnce(input: {
  orderId: string;
  publicToken: string;
  eventId: string;
  amountCents: number;
}): void {
  if (!input.orderId || !input.publicToken || !input.eventId || input.amountCents <= 0) return;
  if (sentForOrder === input.orderId) return;

  trackFunnelBeginCheckout({
    eventId: input.eventId,
    valueCents: input.amountCents,
    orderId: input.orderId,
    species: PET_V3_SPECIES,
  });

  if (inFlight) return;
  sentForOrder = input.orderId;
  const metaClick = getMetaCapiClickIds();
  inFlight = petFunnelApi
    .recordV3InitiateCheckout({
      orderId: input.orderId,
      publicToken: input.publicToken,
      eventId: input.eventId,
      fbc: metaClick.fbc,
      fbp: metaClick.fbp,
    })
    .then(() => undefined)
    .catch(() => undefined)
    .finally(() => {
      inFlight = null;
    });
}

/** Test-only reset */
export function resetV3InitiateCheckoutOnceForTests(): void {
  inFlight = null;
  sentForOrder = null;
}
