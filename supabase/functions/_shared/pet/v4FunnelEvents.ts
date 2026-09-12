/**
 * Server-side V4 checkout session recording (authoritative, not client beacon).
 * Only records after a real Stripe session is created for a user-initiated checkout.
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { asString, isUuid } from "./crypto.ts";

export type V4CheckoutAttribution = {
  funnelSessionId?: string | null;
  visitorId?: string | null;
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
  fbc?: string | null;
  fbp?: string | null;
};

export async function recordV4CheckoutSessionCreated(
  service: SupabaseClient,
  input: {
    orderId: string;
    stripeSessionId: string;
    amountCents: number;
    attribution: V4CheckoutAttribution;
  },
): Promise<void> {
  const sessionId = asString(input.attribution.funnelSessionId);
  if (!isUuid(sessionId) || !input.orderId) return;
  const speciesRaw = asString(input.attribution.species);
  const species = speciesRaw === "cat" || speciesRaw === "other" || speciesRaw === "dog" ? speciesRaw : "dog";
  const pathname = `/pet/${species}-v4`;
  try {
    await service.rpc("record_pet_v4_funnel_event", {
      p_event_name: "v4_checkout_session_created",
      p_funnel_session_id: sessionId,
      p_idempotency_key: `v4_checkout_session_created:${input.orderId}`,
      p_visitor_id: isUuid(asString(input.attribution.visitorId) || "")
        ? asString(input.attribution.visitorId)
        : null,
      p_species: species,
      p_pathname: pathname,
      p_amount_cents: Math.round(input.amountCents),
      p_device_type: asString(input.attribution.deviceType) || null,
      p_utm_source: asString(input.attribution.utmSource) || null,
      p_utm_medium: asString(input.attribution.utmMedium) || null,
      p_utm_campaign: asString(input.attribution.utmCampaign) || null,
      p_utm_content: asString(input.attribution.utmContent) || null,
      p_utm_term: asString(input.attribution.utmTerm) || null,
      p_campaign_id: asString(input.attribution.campaignId) || "120253729468900170",
      p_adset_id: asString(input.attribution.adsetId) || null,
      p_ad_id: asString(input.attribution.adId) || null,
      p_has_meta_click: Boolean(asString(input.attribution.fbc)),
      p_fbc: asString(input.attribution.fbc) || null,
      p_fbp: asString(input.attribution.fbp) || null,
      p_is_test: Boolean(input.attribution.isTest),
      p_funnel_variant: "v4_sales",
      p_funnel_version: "v4",
      p_cta_location: "checkout",
      p_stripe_checkout_session_id: asString(input.stripeSessionId) || null,
    });
  } catch (error) {
    console.error("recordV4CheckoutSessionCreated failed", error);
  }
}
