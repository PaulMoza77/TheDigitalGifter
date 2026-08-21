import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { asString, isUuid } from "./crypto.ts";

const ALLOWED_EVENTS = new Set([
  "landing_view",
  "pet_name_submitted",
  "photo_upload_completed",
  "order_review_viewed",
  "initiate_checkout",
  "purchase",
  "photo_upload_started",
  "pet_details_completed",
  "checkout_error",
]);

type Attribution = {
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
  utm_term?: string | null;
  campaign_id?: string | null;
  adset_id?: string | null;
  ad_id?: string | null;
};

export async function recordPetFunnelEvent(
  service: SupabaseClient,
  input: {
    eventName: string;
    funnelSessionId?: string | null;
    orderId?: string | null;
    idempotencyKey: string;
    species?: string | null;
    deviceType?: string | null;
    pathname?: string | null;
    amountCents?: number | null;
    attribution?: Attribution | null;
  },
): Promise<void> {
  try {
    if (!ALLOWED_EVENTS.has(input.eventName)) return;
    const sessionId = isUuid(input.funnelSessionId)
      ? asString(input.funnelSessionId)
      : isUuid(input.orderId)
        ? asString(input.orderId)
        : null;
    if (!sessionId) return;
    const attr = input.attribution || {};
    await service.rpc("record_pet_funnel_event", {
      p_event_name: input.eventName,
      p_funnel_session_id: sessionId,
      p_idempotency_key: input.idempotencyKey,
      p_order_id: isUuid(input.orderId) ? input.orderId : null,
      p_species: input.species,
      p_utm_source: attr.utm_source ?? null,
      p_utm_medium: attr.utm_medium ?? null,
      p_utm_campaign: attr.utm_campaign ?? null,
      p_utm_content: attr.utm_content ?? null,
      p_utm_term: attr.utm_term ?? null,
      p_campaign_id: attr.campaign_id ?? null,
      p_adset_id: attr.adset_id ?? null,
      p_ad_id: attr.ad_id ?? null,
      p_device_type: input.deviceType ?? null,
      p_pathname: input.pathname ?? null,
      p_amount_cents: input.amountCents ?? null,
    });
  } catch {
    // Analytics must never fail checkout or fulfillment.
  }
}

export function parseCheckoutAttribution(value: unknown): Attribution {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const row = value as Record<string, unknown>;
  const pick = (key: keyof Attribution) => {
    const raw = asString(row[key]);
    return raw || null;
  };
  return {
    utm_source: pick("utm_source"),
    utm_medium: pick("utm_medium"),
    utm_campaign: pick("utm_campaign"),
    utm_content: pick("utm_content"),
    utm_term: pick("utm_term"),
    campaign_id: pick("campaign_id"),
    adset_id: pick("adset_id"),
    ad_id: pick("ad_id"),
  };
}

export async function recordPetFunnelInitiateCheckout(
  service: SupabaseClient,
  input: {
    orderId: string;
    amountCents: number;
    species?: string | null;
    funnelSessionId?: string | null;
    deviceType?: string | null;
    attribution?: Attribution | null;
  },
) {
  if (!input.orderId || !Number.isFinite(input.amountCents) || input.amountCents <= 0) return;
  await recordPetFunnelEvent(service, {
    eventName: "initiate_checkout",
    funnelSessionId: input.funnelSessionId,
    orderId: input.orderId,
    idempotencyKey: `order:${input.orderId}:initiate_checkout`,
    species: input.species,
    deviceType: input.deviceType,
    pathname: "/pet/checkout",
    amountCents: input.amountCents,
    attribution: input.attribution,
  });
}

export async function recordPetFunnelPurchase(
  service: SupabaseClient,
  input: {
    orderId: string;
    amountCents: number;
    species?: string | null;
  },
) {
  if (!input.orderId || !Number.isFinite(input.amountCents) || input.amountCents <= 0) return;
  try {
    const { data: prior } = await service
      .from("pet_funnel_events")
      .select("funnel_session_id, utm_source, utm_medium, utm_campaign, utm_content, utm_term, campaign_id, adset_id, ad_id, device_type, species")
      .eq("order_id", input.orderId)
      .eq("event_name", "initiate_checkout")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    await recordPetFunnelEvent(service, {
      eventName: "purchase",
      funnelSessionId: prior?.funnel_session_id || input.orderId,
      orderId: input.orderId,
      idempotencyKey: `order:${input.orderId}:purchase`,
      species: input.species || prior?.species,
      deviceType: prior?.device_type,
      pathname: "/pet/order",
      amountCents: input.amountCents,
      attribution: prior
        ? {
            utm_source: prior.utm_source,
            utm_medium: prior.utm_medium,
            utm_campaign: prior.utm_campaign,
            utm_content: prior.utm_content,
            utm_term: prior.utm_term,
            campaign_id: prior.campaign_id,
            adset_id: prior.adset_id,
            ad_id: prior.ad_id,
          }
        : null,
    });
  } catch {
    await recordPetFunnelEvent(service, {
      eventName: "purchase",
      funnelSessionId: input.orderId,
      orderId: input.orderId,
      idempotencyKey: `order:${input.orderId}:purchase`,
      species: input.species,
      pathname: "/pet/order",
      amountCents: input.amountCents,
    });
  }
}
