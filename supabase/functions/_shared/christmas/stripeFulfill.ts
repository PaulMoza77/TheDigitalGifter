import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { CHRISTMAS_PRODUCT_TYPE } from "./constants.ts";
import { asInt, asString, isUuid } from "./crypto.ts";

function waitUntil(promise: Promise<unknown>) {
  const runtime = (globalThis as { EdgeRuntime?: { waitUntil?: (value: Promise<unknown>) => void } }).EdgeRuntime;
  if (runtime && typeof runtime.waitUntil === "function") {
    runtime.waitUntil(promise);
    return;
  }
  void promise;
}

export function isChristmasCheckoutMetadata(metadata: Record<string, unknown>): boolean {
  return (
    asString(metadata.product_type) === CHRISTMAS_PRODUCT_TYPE ||
    asString(metadata.sku).startsWith("christmas-")
  );
}

export async function invokeChristmasGenerate(orderId: string) {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return;
  await fetch(`${url.replace(/\/$/, "")}/functions/v1/christmas-generate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      apikey: key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ order_id: orderId }),
  });
}

export function enqueueChristmasGenerate(orderId: string) {
  waitUntil(
    invokeChristmasGenerate(orderId).catch((err) => {
      console.error("christmas-generate enqueue failed", err);
    }),
  );
}

export async function handleChristmasStripeEvent(input: {
  service: SupabaseClient;
  eventId: string;
  eventType: string;
  obj: Record<string, unknown>;
  metadata: Record<string, unknown>;
}): Promise<Response | null> {
  if (!isChristmasCheckoutMetadata(input.metadata)) return null;
  if (input.eventType === "invoice.paid") {
    await input.service.from("processed_stripe_events").insert({
      event_id: input.eventId,
      event_type: input.eventType,
      result: { status: "ignored", reason: "christmas_one_time_ignores_invoice" },
    });
    return new Response(JSON.stringify({ ok: true, status: "ignored" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const paymentStatus = asString(input.obj.payment_status);
  if (input.eventType !== "checkout.session.completed" || paymentStatus !== "paid") {
    await input.service.from("processed_stripe_events").insert({
      event_id: input.eventId,
      event_type: input.eventType,
      stripe_session_id: asString(input.obj.id),
      result: { status: "ignored_unpaid", payment_status: paymentStatus },
    });
    return new Response(JSON.stringify({ ok: true, status: "ignored_unpaid" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const orderId = isUuid(input.metadata.christmas_order_id)
    ? asString(input.metadata.christmas_order_id)
    : null;
  if (!orderId) {
    return new Response(JSON.stringify({ error: "christmas_order_id missing from Stripe metadata" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { data, error } = await input.service.rpc("fulfill_christmas_order_payment", {
    p_event_id: input.eventId,
    p_session_id: asString(input.obj.id),
    p_event_type: input.eventType,
    p_payment_status: paymentStatus || "paid",
    p_payment_intent_id: asString(input.obj.payment_intent),
    p_amount_cents: input.obj.amount_total == null ? null : asInt(input.obj.amount_total),
    p_currency: asString(input.obj.currency) || "usd",
    p_order_id: orderId,
  });
  if (error) throw error;

  const result = data as { status?: string; should_enqueue?: boolean };
  if (result?.should_enqueue) enqueueChristmasGenerate(orderId);

  const sessionId = asString(input.metadata.funnel_session_id);
  if (isUuid(sessionId)) {
    await input.service.rpc("record_christmas_v2_funnel_event", {
      p_event_name: "christmas_v2_purchase",
      p_funnel_session_id: sessionId,
      p_idempotency_key: `christmas_v2_purchase:${orderId}`,
      p_amount_cents: asInt(input.obj.amount_total),
      p_product: asString(input.metadata.sku),
      p_pathname: "/christmas-ai-photos",
    });
  }

  return new Response(JSON.stringify({ ok: true, ...result }), {
    headers: { "Content-Type": "application/json" },
  });
}
