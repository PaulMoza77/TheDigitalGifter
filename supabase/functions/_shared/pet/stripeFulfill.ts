import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { PET_PRICE_CENTS, siteOrigin } from "./constants.ts";
import { asString, asInt, isUuid } from "./crypto.ts";
import { stripeFulfillmentDecision } from "./guards.ts";
import { sendMetaCapiPurchase } from "./meta.ts";
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
        await recordPetFunnelPurchase(input.service, {
          orderId: order.id,
          amountCents: charged,
          species: asString(order.species),
        });
        if (asString(input.metadata.funnel_variant) === "v2") {
          const sessionId = asString(input.metadata.funnel_session_id);
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
            });
          }
        }
        if (asString(input.metadata.funnel_variant) === "v3") {
          const sessionId = asString(input.metadata.funnel_session_id);
          if (isUuid(sessionId)) {
            const creativeRaw = asString(input.metadata.creative_id) || asString(input.metadata.utm_content);
            const creativeId = creativeRaw ? creativeRaw.replace(/-FINAL$/i, "").slice(0, 120) : null;
            await input.service.rpc("record_pet_v3_funnel_event", {
              p_event_name: "v3_purchase",
              p_funnel_session_id: sessionId,
              p_idempotency_key: `v3_purchase:${order.id}`,
              p_species: "cat",
              p_pathname: "/pet/cat-v3",
              p_amount_cents: charged,
              p_funnel_version: asString(input.metadata.funnel_version) || "v3",
              p_utm_source: asString(input.metadata.utm_source) || null,
              p_utm_medium: asString(input.metadata.utm_medium) || null,
              p_utm_campaign: asString(input.metadata.utm_campaign) || null,
              p_utm_content: asString(input.metadata.utm_content) || null,
              p_utm_term: asString(input.metadata.utm_term) || null,
              p_campaign_id: asString(input.metadata.campaign_id) || null,
              p_adset_id: asString(input.metadata.adset_id) || null,
              p_ad_id: asString(input.metadata.ad_id) || null,
              p_creative_id: creativeId,
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
  }

  return new Response(JSON.stringify({ ok: true, result }), {
    headers: { "Content-Type": "application/json" },
  });
}
