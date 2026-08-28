import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { asString, isUuid } from "./crypto.ts";

export type V3CheckoutAttribution = {
  funnelSessionId?: string | null;
  funnelVersion?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmContent?: string | null;
  utmTerm?: string | null;
  campaignId?: string | null;
  adsetId?: string | null;
  adId?: string | null;
  creativeId?: string | null;
  deviceType?: string | null;
  isTest?: boolean;
};

/** Server-confirmed Stripe Checkout Session (ui_mode=elements) for a V3 order. */
export async function recordV3CheckoutSessionCreated(
  service: SupabaseClient,
  input: {
    orderId: string;
    stripeSessionId: string;
    amountCents: number;
    attribution: V3CheckoutAttribution;
  },
): Promise<void> {
  const sessionId = asString(input.attribution.funnelSessionId);
  if (!isUuid(sessionId) || !input.orderId) return;
  const creativeRaw = asString(input.attribution.creativeId) || asString(input.attribution.utmContent);
  const creativeId = creativeRaw ? creativeRaw.replace(/-FINAL$/i, "").slice(0, 120) : null;
  await service.rpc("record_pet_v3_funnel_event", {
    p_event_name: "v3_checkout_session_created",
    p_funnel_session_id: sessionId,
    p_idempotency_key: `v3_checkout_session_created:${input.orderId}`,
    p_species: "cat",
    p_pathname: "/pet/cat-v3",
    p_amount_cents: Math.round(input.amountCents),
    p_device_type: asString(input.attribution.deviceType) || null,
    p_funnel_version: asString(input.attribution.funnelVersion) || "v3",
    p_utm_source: asString(input.attribution.utmSource) || null,
    p_utm_medium: asString(input.attribution.utmMedium) || null,
    p_utm_campaign: asString(input.attribution.utmCampaign) || null,
    p_utm_content: asString(input.attribution.utmContent) || null,
    p_utm_term: asString(input.attribution.utmTerm) || null,
    p_campaign_id: asString(input.attribution.campaignId) || null,
    p_adset_id: asString(input.attribution.adsetId) || null,
    p_ad_id: asString(input.attribution.adId) || null,
    p_creative_id: creativeId,
    p_is_test: Boolean(input.attribution.isTest),
    p_stripe_checkout_session_id: asString(input.stripeSessionId).slice(0, 200),
    p_displayed_price_cents: Math.round(input.amountCents),
  });
}
