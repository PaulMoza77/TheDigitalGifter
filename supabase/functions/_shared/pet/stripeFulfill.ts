import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { PET_PRICE_CENTS, siteOrigin } from "./constants.ts";
import { asString, asInt, isUuid } from "./crypto.ts";
import { stripeFulfillmentDecision } from "./guards.ts";
import { parseMetaCapiClickIds, sanitizeMetaClickId, sendMetaCapiPurchase } from "./meta.ts";
import { recordPetFunnelPurchase } from "./funnelEvents.ts";

export function isPetCheckoutMetadata(metadata: Record<string, unknown>): boolean {
  return asString(metadata.sku) === "pet-secret-life-12" || asString(metadata.product_type) === "pet_secret_life";
}

const STALE_RUNNING_MS = 150_000;
const HELD_SKIP_ERRORS = /billing_required/;

function waitUntil(promise: Promise<unknown>) {
  const runtime = (globalThis as { EdgeRuntime?: { waitUntil?: (value: Promise<unknown>) => void } }).EdgeRuntime;
  if (runtime && typeof runtime.waitUntil === "function") {
    runtime.waitUntil(promise);
    return;
  }
  void promise;
}

export async function invokePetGenerate(orderId: string) {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return;
  await fetch(`${url.replace(/\/$/, "")}/functions/v1/pet-generate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      apikey: key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ order_id: orderId }),
  });
}

export function enqueuePetGenerate(orderId: string) {
  waitUntil(
    invokePetGenerate(orderId).catch((err) => {
      console.error("pet-generate enqueue failed", err);
    }),
  );
}

export async function enqueuePetGenerateIfStalled(input: {
  service: SupabaseClient;
  orderId: string;
  orderStatus: string;
  paidAt: string | null;
}): Promise<boolean> {
  if (!input.paidAt) return false;
  if (!["paid", "generating", "partial_failure"].includes(input.orderStatus)) return false;
  const { data: job } = await input.service
    .from("pet_generation_jobs")
    .select("status, claimed_at, last_error")
    .eq("order_id", input.orderId)
    .maybeSingle();
  if (!job) return false;
  const status = String(job.status || "");
  const lastError = String(job.last_error || "");
  if (status === "held" && HELD_SKIP_ERRORS.test(lastError)) return false;
  const claimedAt = job.claimed_at ? new Date(String(job.claimed_at)).getTime() : 0;
  const staleRunning = status === "running" && claimedAt > 0 && Date.now() - claimedAt > STALE_RUNNING_MS;
  if (!["queued", "held", "failed"].includes(status) && !staleRunning) return false;
  enqueuePetGenerate(input.orderId);
  return true;
}

type SessionAttribution = {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  campaign_id: string | null;
  adset_id: string | null;
  ad_id: string | null;
  has_meta_click: boolean;
  referrer_host: string | null;
  device_type: string | null;
  fbc: string | null;
  fbp: string | null;
};

function attributionFromStripeMetadata(metadata: Record<string, unknown>): SessionAttribution {
  const click = parseMetaCapiClickIds(metadata);
  return {
    utm_source: asString(metadata.utm_source) || null,
    utm_medium: asString(metadata.utm_medium) || null,
    utm_campaign: asString(metadata.utm_campaign) || null,
    utm_content: asString(metadata.utm_content) || null,
    utm_term: asString(metadata.utm_term) || null,
    campaign_id: asString(metadata.campaign_id) || null,
    adset_id: asString(metadata.adset_id) || null,
    ad_id: asString(metadata.ad_id) || null,
    has_meta_click: click.hasMetaClick || asString(metadata.has_meta_click) === "1",
    referrer_host: asString(metadata.referrer_host) || null,
    device_type: asString(metadata.device_type) || null,
    fbc: click.fbc,
    fbp: click.fbp,
  };
}

async function loadV2SessionAttribution(
  service: SupabaseClient,
  sessionId: string,
): Promise<Partial<SessionAttribution> | null> {
  const { data } = await service
    .from("pet_v2_funnel_events")
    .select(
      "utm_source, utm_medium, utm_campaign, utm_content, utm_term, campaign_id, adset_id, ad_id, has_meta_click, referrer_host, device_type",
    )
    .eq("funnel_session_id", sessionId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return {
    utm_source: asString(data.utm_source) || null,
    utm_medium: asString(data.utm_medium) || null,
    utm_campaign: asString(data.utm_campaign) || null,
    utm_content: asString(data.utm_content) || null,
    utm_term: asString(data.utm_term) || null,
    campaign_id: asString(data.campaign_id) || null,
    adset_id: asString(data.adset_id) || null,
    ad_id: asString(data.ad_id) || null,
    has_meta_click: data.has_meta_click === true,
    referrer_host: asString(data.referrer_host) || null,
    device_type: asString(data.device_type) || null,
  };
}

async function loadV3SessionClickIds(
  service: SupabaseClient,
  sessionId: string,
): Promise<{ fbc: string | null; fbp: string | null; has_meta_click: boolean }> {
  const { data } = await service
    .from("pet_v3_funnel_events")
    .select("fbc, fbp, has_meta_click")
    .eq("funnel_session_id", sessionId)
    .order("created_at", { ascending: true })
    .limit(5);
  const rows = Array.isArray(data) ? data : [];
  let fbc: string | null = null;
  let fbp: string | null = null;
  let hasMetaClick = false;
  for (const row of rows) {
    fbc = fbc || sanitizeMetaClickId(row.fbc);
    fbp = fbp || sanitizeMetaClickId(row.fbp);
    if (row.has_meta_click === true) hasMetaClick = true;
  }
  return { fbc, fbp, has_meta_click: hasMetaClick || Boolean(fbc) };
}

function mergeAttribution(
  primary: SessionAttribution,
  fallback: Partial<SessionAttribution> | null,
): SessionAttribution {
  if (!fallback) return primary;
  return {
    utm_source: primary.utm_source || fallback.utm_source || null,
    utm_medium: primary.utm_medium || fallback.utm_medium || null,
    utm_campaign: primary.utm_campaign || fallback.utm_campaign || null,
    utm_content: primary.utm_content || fallback.utm_content || null,
    utm_term: primary.utm_term || fallback.utm_term || null,
    campaign_id: primary.campaign_id || fallback.campaign_id || null,
    adset_id: primary.adset_id || fallback.adset_id || null,
    ad_id: primary.ad_id || fallback.ad_id || null,
    has_meta_click: primary.has_meta_click || fallback.has_meta_click === true,
    referrer_host: primary.referrer_host || fallback.referrer_host || null,
    device_type: primary.device_type || fallback.device_type || null,
    fbc: primary.fbc || fallback.fbc || null,
    fbp: primary.fbp || fallback.fbp || null,
  };
}

export async function handlePetStripeEvent(input: {
  service: SupabaseClient;
  eventId: string;
  eventType: string;
  obj: Record<string, unknown>;
  metadata: Record<string, unknown>;
}): Promise<Response | null> {
  if (!isPetCheckoutMetadata(input.metadata) && input.eventType !== "invoice.paid") {
    return null;
  }
  if (!isPetCheckoutMetadata(input.metadata) && input.eventType === "invoice.paid") {
    return null;
  }

  const decision = stripeFulfillmentDecision({
    eventType: input.eventType,
    productType: asString(input.metadata.product_type),
    sku: asString(input.metadata.sku),
    mode: asString(input.obj.mode),
    paymentStatus: asString(input.obj.payment_status),
  });

  if (decision.reason === "invoice_ignored" || input.eventType === "invoice.paid") {
    await input.service.from("processed_stripe_events").insert({
      event_id: input.eventId,
      event_type: input.eventType,
      result: { status: "ignored", reason: "pet_one_time_ignores_invoice" },
    });
    return new Response(JSON.stringify({ ok: true, status: "ignored", reason: "pet_invoice" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  if (decision.reason === "not_pet") return null;

  if (!decision.fulfill) {
    await input.service.from("processed_stripe_events").insert({
      event_id: input.eventId,
      event_type: input.eventType,
      stripe_session_id: asString(input.obj.id),
      result: { status: "ignored_unpaid", payment_status: asString(input.obj.payment_status) },
    });
    return new Response(JSON.stringify({ ok: true, status: "ignored_unpaid" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const orderId = isUuid(input.metadata.pet_order_id) ? asString(input.metadata.pet_order_id) : null;
  if (!orderId) {
    return new Response(JSON.stringify({ error: "pet_order_id missing from Stripe metadata" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { data, error } = await input.service.rpc("fulfill_pet_order_payment", {
    p_event_id: input.eventId,
    p_session_id: asString(input.obj.id),
    p_event_type: input.eventType,
    p_payment_status: asString(input.obj.payment_status) || "paid",
    p_payment_intent_id: asString(input.obj.payment_intent),
    p_amount_cents: input.obj.amount_total == null ? PET_PRICE_CENTS : asInt(input.obj.amount_total),
    p_currency: asString(input.obj.currency) || "usd",
    p_order_id: orderId,
  });
  if (error) throw error;

  const result = data as {
    status?: string;
    should_enqueue?: boolean;
    already_paid?: boolean;
    meta_event_id?: string;
    pet_order_id?: string;
  };

  if (result?.status === "fulfilled" || result?.status === "already_paid") {
    const { data: order } = await input.service
      .from("pet_orders")
      .select("id, email, species, meta_event_id, meta_purchase_sent_at, amount_cents, charged_amount_cents")
      .eq("id", orderId)
      .maybeSingle();
    if (order) {
      const charged = Number(order.charged_amount_cents ?? order.amount_cents ?? PET_PRICE_CENTS);
      if (charged > 0) {
        let attr = attributionFromStripeMetadata(input.metadata);
        const sessionId = asString(input.metadata.funnel_session_id);
        const funnelVariant = asString(input.metadata.funnel_variant);

        if (funnelVariant === "v2" && isUuid(sessionId)) {
          const fromLanding = await loadV2SessionAttribution(input.service, sessionId);
          attr = mergeAttribution(attr, fromLanding);
        }
        if (funnelVariant === "v3" && isUuid(sessionId)) {
          const fromV3 = await loadV3SessionClickIds(input.service, sessionId);
          attr = mergeAttribution(attr, fromV3);
        }

        await recordPetFunnelPurchase(input.service, {
          orderId: order.id,
          amountCents: charged,
          species: asString(order.species),
        });
        if (funnelVariant === "v2") {
          const species = asString(order.species);
          const pathSpecies = species === "cat" || species === "other" ? species : "dog";
          if (isUuid(sessionId)) {
            await input.service.rpc("record_pet_v2_funnel_event", {
              p_event_name: "v2_purchase",
              p_funnel_session_id: sessionId,
              p_idempotency_key: `v2_purchase:${order.id}`,
              p_species: species,
              p_pathname: `/pet/${pathSpecies}-v2`,
              p_amount_cents: charged,
              p_utm_source: attr.utm_source,
              p_utm_medium: attr.utm_medium,
              p_utm_campaign: attr.utm_campaign,
              p_utm_content: attr.utm_content,
              p_utm_term: attr.utm_term,
              p_campaign_id: attr.campaign_id,
              p_adset_id: attr.adset_id,
              p_ad_id: attr.ad_id,
              p_device_type: attr.device_type,
              p_has_meta_click: attr.has_meta_click,
              p_referrer_host: attr.referrer_host,
            });
          }
        }
        if (funnelVariant === "v3") {
          if (isUuid(sessionId)) {
            const creativeRaw = asString(input.metadata.creative_id) || attr.utm_content;
            const creativeId = creativeRaw ? creativeRaw.replace(/-FINAL$/i, "").slice(0, 120) : null;
            await input.service.rpc("record_pet_v3_funnel_event", {
              p_event_name: "v3_purchase",
              p_funnel_session_id: sessionId,
              p_idempotency_key: `v3_purchase:${order.id}`,
              p_species: "cat",
              p_pathname: "/pet/cat-v3",
              p_amount_cents: charged,
              p_funnel_version: asString(input.metadata.funnel_version) || "v3",
              p_utm_source: attr.utm_source,
              p_utm_medium: attr.utm_medium,
              p_utm_campaign: attr.utm_campaign,
              p_utm_content: attr.utm_content,
              p_utm_term: attr.utm_term,
              p_campaign_id: attr.campaign_id,
              p_adset_id: attr.adset_id,
              p_ad_id: attr.ad_id,
              p_creative_id: creativeId,
              p_has_meta_click: attr.has_meta_click,
              p_fbc: attr.fbc,
              p_fbp: attr.fbp,
            });
          }
        }
        if (!order.meta_purchase_sent_at) {
          const capi = await sendMetaCapiPurchase({
            eventId: order.meta_event_id,
            orderId: order.id,
            email: order.email,
            alreadySentAt: order.meta_purchase_sent_at,
            sourceUrl: `${siteOrigin()}/pet/order`,
            amountCents: charged,
            fbc: attr.fbc,
            fbp: attr.fbp,
          });
          if (capi.sent) {
            await input.service
              .from("pet_orders")
              .update({ meta_purchase_sent_at: new Date().toISOString() })
              .eq("id", orderId);
          }
        }
      }
    }
  }

  if (result?.should_enqueue) {
    enqueuePetGenerate(orderId);
    if (asString(input.metadata.funnel_variant) === "v2") {
      const sessionId = asString(input.metadata.funnel_session_id);
      const species = asString(input.metadata.species) || "dog";
      const pathSpecies = species === "cat" || species === "other" ? species : "dog";
      if (isUuid(sessionId)) {
        await input.service.rpc("record_pet_v2_funnel_event", {
          p_event_name: "v2_paid_generation_started",
          p_funnel_session_id: sessionId,
          p_idempotency_key: `v2_paid_generation_started:${orderId}`,
          p_species: species,
          p_pathname: `/pet/${pathSpecies}-v2`,
        });
      }
    }
  }

  return new Response(JSON.stringify({ ok: true, result }), {
    headers: { "Content-Type": "application/json" },
  });
}
