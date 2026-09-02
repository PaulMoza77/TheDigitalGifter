/**
 * Christmas Stripe fulfill helpers (Deno-friendly pure + service client usage).
 * Pet fulfill path remains untouched.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

export const CHRISTMAS_PRODUCT_FAMILY = "christmas";

export function isChristmasCheckoutMetadata(metadata: Record<string, unknown>): boolean {
  const family = String(metadata.product_family ?? "").trim();
  const productType = String(metadata.product_type ?? "").trim();
  return family === CHRISTMAS_PRODUCT_FAMILY || productType === "christmas";
}

function asString(value: unknown): string {
  return String(value ?? "").trim();
}

function asInt(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function isUuid(value: unknown): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    asString(value),
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
      result: { status: "ignored_unpaid", payment_status: paymentStatus, product_family: "christmas" },
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

  const amountTotal = asInt(input.obj.amount_total);
  const currency = asString(input.obj.currency) || "usd";
  const sessionId = asString(input.obj.id);
  const paymentIntent = asString(input.obj.payment_intent);

  const { data, error } = await input.service.rpc("fulfill_christmas_order_payment", {
    p_order_id: orderId,
    p_stripe_session_id: sessionId,
    p_stripe_payment_intent_id: paymentIntent || null,
    p_amount_cents: amountTotal,
    p_currency: currency,
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
    stripe_session_id: sessionId,
    result: { ...result, product_family: "christmas" },
  });

  // Enqueue generation only after verified paid transition (or already paid replay).
  if (result.ok === true && (result.status === "paid" || result.status === "already_paid")) {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (url && key && result.status === "paid") {
      const runtime = (globalThis as {
        EdgeRuntime?: { waitUntil?: (value: Promise<unknown>) => void };
      }).EdgeRuntime;
      const task = fetch(`${url.replace(/\/$/, "")}/functions/v1/christmas-generate`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          apikey: key,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ order_id: orderId }),
      }).catch((err) => console.error("christmas-generate enqueue failed", err));
      if (runtime?.waitUntil) runtime.waitUntil(task);
      else void task;
    }
  }

  return new Response(JSON.stringify({ ok: true, christmas: result }), {
    headers: { "Content-Type": "application/json" },
  });
}
