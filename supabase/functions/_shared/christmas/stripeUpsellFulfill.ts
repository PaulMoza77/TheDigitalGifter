/**
 * Suite portrait AOV Stripe fulfill (CHRISTMAS-039).
 * Routes christmas_upsell checkout sessions to fulfill_christmas_upsell_payment
 * then enqueues extra image/style generation (or queues video).
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { asInt, asString, isUuid } from "./crypto.ts";
import {
  CHRISTMAS_UPSELL_PRODUCT_TYPE,
  isChristmasUpsellMetadata,
  isPortraitAovPackageKey,
} from "./upsells.ts";

function waitUntil(promise: Promise<unknown>) {
  const runtime = (globalThis as { EdgeRuntime?: { waitUntil?: (value: Promise<unknown>) => void } })
    .EdgeRuntime;
  if (runtime && typeof runtime.waitUntil === "function") {
    runtime.waitUntil(promise);
    return;
  }
  void promise;
}

async function invokePortraitUpsellFulfill(upsellId: string) {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return;
  await fetch(`${url.replace(/\/$/, "")}/functions/v1/christmas-photo-generate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      apikey: key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ upsell_id: upsellId }),
  });
}

export { isChristmasUpsellMetadata };

export function enqueueChristmasUpsellFulfill(upsellId: string) {
  waitUntil(
    invokePortraitUpsellFulfill(upsellId).catch((err) => {
      console.error("christmas upsell fulfill enqueue failed", err);
    }),
  );
}

async function recordUpsellPurchaseEvent(input: {
  service: SupabaseClient;
  parentOrderId: string;
  upsellId: string;
  productKey: string;
  packageKey: string;
  amountCents: number | null;
  funnelSessionId: string | null;
}) {
  if (!isUuid(input.funnelSessionId || "")) return;
  try {
    await input.service.from("christmas_funnel_events").insert({
      event_name: "upsell_purchase",
      funnel_session_id: input.funnelSessionId,
      idempotency_key: `upsell_purchase:${input.upsellId}`,
      product_key: input.productKey,
      package_key: input.packageKey,
      order_id: input.parentOrderId,
      amount_cents: input.amountCents,
      environment: "production",
      is_test: false,
      metadata: {
        upsell_id: input.upsellId,
        kind: "portrait_aov",
        product_type: CHRISTMAS_UPSELL_PRODUCT_TYPE,
      },
    });
  } catch {
    /* analytics must never fail fulfill */
  }
}

export async function handleChristmasUpsellStripeEvent(input: {
  service: SupabaseClient;
  eventId: string;
  eventType: string;
  obj: Record<string, unknown>;
  metadata: Record<string, unknown>;
}): Promise<Response | null> {
  if (!isChristmasUpsellMetadata(input.metadata)) return null;

  if (input.eventType === "invoice.paid") {
    await input.service.from("processed_stripe_events").insert({
      event_id: input.eventId,
      event_type: input.eventType,
      result: { status: "ignored", reason: "christmas_upsell_invoice" },
    });
    return new Response(JSON.stringify({ ok: true, status: "ignored", reason: "christmas_upsell_invoice" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  if (
    input.eventType !== "checkout.session.completed" &&
    input.eventType !== "checkout.session.async_payment_succeeded"
  ) {
    return null;
  }

  const paymentStatus = asString(input.obj.payment_status);
  if (paymentStatus && paymentStatus !== "paid" && paymentStatus !== "no_payment_required") {
    await input.service.from("processed_stripe_events").insert({
      event_id: input.eventId,
      event_type: input.eventType,
      stripe_session_id: asString(input.obj.id),
      result: { status: "ignored_unpaid", payment_status: paymentStatus, christmas_upsell: true },
    });
    return new Response(JSON.stringify({ ok: true, status: "ignored_unpaid" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const upsellId = isUuid(input.metadata.christmas_upsell_id)
    ? asString(input.metadata.christmas_upsell_id)
    : null;
  if (!upsellId) {
    return new Response(JSON.stringify({ error: "christmas_upsell_id missing from Stripe metadata" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const packageKey = asString(input.metadata.package_key);
  if (packageKey && !isPortraitAovPackageKey(packageKey)) {
    return new Response(JSON.stringify({ error: "invalid_upsell_package", code: "not_v2_pack" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { data, error } = await input.service.rpc("fulfill_christmas_upsell_payment", {
    p_upsell_id: upsellId,
    p_stripe_session_id: asString(input.obj.id),
    p_stripe_payment_intent_id: asString(input.obj.payment_intent) || null,
    p_amount_cents: asInt(input.obj.amount_total),
    p_currency: asString(input.obj.currency) || "usd",
    p_stripe_event_id: input.eventId,
  });
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const result = (data || {}) as Record<string, unknown>;
  await input.service.from("processed_stripe_events").insert({
    event_id: input.eventId,
    event_type: input.eventType,
    stripe_session_id: asString(input.obj.id),
    result: { ...result, product_type: CHRISTMAS_UPSELL_PRODUCT_TYPE },
  });

  if (result.ok === true && (result.status === "paid" || result.should_enqueue === true)) {
    enqueueChristmasUpsellFulfill(upsellId);
    await recordUpsellPurchaseEvent({
      service: input.service,
      parentOrderId: asString(result.parent_order_id) || asString(input.metadata.parent_order_id),
      upsellId,
      productKey: asString(result.product_key) || asString(input.metadata.product_key),
      packageKey: asString(result.package_key) || packageKey,
      amountCents: asInt(input.obj.amount_total),
      funnelSessionId: asString(input.metadata.funnel_session_id) || null,
    });
  }

  return new Response(JSON.stringify({ ok: true, christmas_upsell: result }), {
    headers: { "Content-Type": "application/json" },
  });
}
