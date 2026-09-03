/**
 * Server-side V2 checkout session recording (authoritative, not client beacon).
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { asString, isUuid } from "./crypto.ts";

export type V2CheckoutAttribution = {
  funnelSessionId?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmContent?: string | null;
  utmTerm?: string | null;
  campaignId?: string | null;
  adsetId?: string | null;
  adId?: string | null;
  deviceType?: string | null;
  species?: string | null;
  isTest?: boolean;
};

/** Record first-party v2_checkout_session_created after Stripe session attach. */
export async function recordV2CheckoutSessionCreated(
  service: SupabaseClient,
  input: {
    orderId: string;
    stripeSessionId: string;
    amountCents: number;
    attribution: V2CheckoutAttribution;
  },
): Promise<void> {
  const sessionId = asString(input.attribution.funnelSessionId);
  if (!isUuid(sessionId) || !input.orderId) return;
  const speciesRaw = asString(input.attribution.species);
  const species = speciesRaw === "cat" || speciesRaw === "other" || speciesRaw === "dog" ? speciesRaw : "dog";
  const pathname = `/pet/${species}-v2`;
  try {
    await service.rpc("record_pet_v2_funnel_event", {
      p_event_name: "v2_checkout_session_created",
      p_funnel_session_id: sessionId,
      p_idempotency_key: `v2_checkout_session_created:${input.orderId}`,
      p_species: species,
      p_pathname: pathname,
      p_amount_cents: Math.round(input.amountCents),
      p_device_type: asString(input.attribution.deviceType) || null,
      p_utm_source: asString(input.attribution.utmSource) || null,
      p_utm_medium: asString(input.attribution.utmMedium) || null,
      p_utm_campaign: asString(input.attribution.utmCampaign) || null,
      p_utm_content: asString(input.attribution.utmContent) || null,
      p_utm_term: asString(input.attribution.utmTerm) || null,
      p_campaign_id: asString(input.attribution.campaignId) || null,
      p_adset_id: asString(input.attribution.adsetId) || null,
      p_ad_id: asString(input.attribution.adId) || null,
      p_is_test: Boolean(input.attribution.isTest),
      p_environment: "production",
      p_has_meta_click: false,
      p_referrer_host: null,
      p_client_event_id: null,
    });
  } catch {
    /* never block checkout on analytics */
  }
}
