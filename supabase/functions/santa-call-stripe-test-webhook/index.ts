/**
 * Dedicated Stripe TEST webhook for Santa Call QA.
 * Verifies STRIPE_TEST_WEBHOOK_SECRET only. Never uses LIVE STRIPE_WEBHOOK_SECRET.
 * Fulfills only orders stamped stripe_mode=test / santa_qa on the main DB.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";
import { asString, isUuid } from "../_shared/christmas/crypto.ts";
import {
  fulfillSantaVoiceCallExtensionOrder,
  fulfillSantaVoiceCallOrder,
} from "../_shared/christmas/santaCallFulfill.ts";
import { isSantaStripeTestOrderMeta } from "../_shared/christmas/santaStripe.ts";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function verifyStripeTestSignature(rawBody: string, header: string, secret: string): Promise<boolean> {
  const parts = Object.fromEntries(
    header.split(",").map((item) => {
      const [k, ...rest] = item.split("=");
      return [k.trim(), rest.join("=").trim()];
    }),
  );
  const timestamp = parts.t;
  const signatures = header
    .split(",")
    .filter((item) => item.trim().startsWith("v1="))
    .map((item) => item.trim().slice(3));
  if (!timestamp || !signatures.length) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${rawBody}`));
  const digest = toHex(signed);
  return signatures.some((s) => s.length === digest.length && s === digest);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const testWhsec = asString(Deno.env.get("STRIPE_TEST_WEBHOOK_SECRET"));
  if (!testWhsec.startsWith("whsec_")) {
    return json({ error: "STRIPE_TEST_WEBHOOK_SECRET missing" }, 503);
  }

  const rawBody = await req.text();
  const signature = req.headers.get("stripe-signature") || "";
  if (!(await verifyStripeTestSignature(rawBody, signature, testWhsec))) {
    return json({ error: "Invalid Stripe TEST signature" }, 400);
  }

  const event = JSON.parse(rawBody) as Record<string, unknown>;
  if (event.livemode === true) {
    return json({ ok: false, code: "live_event_rejected" }, 400);
  }

  const url = Deno.env.get("SUPABASE_URL") || "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SERVICE_ROLE_KEY") || "";
  const service = createClient(url, key, { auth: { persistSession: false } });

  const eventId = asString(event.id);
  const eventType = asString(event.type);
  if (!eventId) return json({ error: "missing event id" }, 400);

  const { data: already } = await service
    .from("processed_stripe_events")
    .select("event_id")
    .eq("event_id", eventId)
    .maybeSingle();
  if (already) return json({ ok: true, status: "already_processed", event_id: eventId });

  const obj = ((event.data as Record<string, unknown> | undefined)?.object || {}) as Record<string, unknown>;
  const metadata = (obj.metadata || {}) as Record<string, unknown>;
  const productKey = asString(metadata.product_key);
  const orderId = asString(metadata.christmas_order_id);
  if (!isUuid(orderId)) return json({ error: "christmas_order_id required" }, 400);
  if (
    productKey !== "christmas_santa_voice_call" &&
    productKey !== "christmas_santa_voice_call_extension"
  ) {
    return json({ ok: false, code: "not_santa_product" }, 400);
  }
  if (
    asString(metadata.stripe_mode).toLowerCase() !== "test" &&
    metadata.santa_qa !== true &&
    metadata.santa_qa !== "true"
  ) {
    return json({ ok: false, code: "missing_test_stamp" }, 400);
  }

  const { data: ord } = await service
    .from("christmas_orders")
    .select("id,metadata,amount_cents")
    .eq("id", orderId)
    .maybeSingle();
  if (!ord) return json({ error: "missing_order" }, 404);
  const ordMeta = (ord.metadata || {}) as Record<string, unknown>;
  if (!isSantaStripeTestOrderMeta(ordMeta) && asString(ordMeta.stripe_mode) !== "test") {
    return json({ ok: false, code: "order_not_test_mode" }, 403);
  }

  if (
    eventType === "checkout.session.completed" ||
    eventType === "checkout.session.async_payment_succeeded"
  ) {
    const paymentStatus = asString(obj.payment_status);
    if (paymentStatus && paymentStatus !== "paid" && paymentStatus !== "no_payment_required") {
      await service.from("processed_stripe_events").insert({
        event_id: eventId,
        event_type: eventType,
        stripe_session_id: asString(obj.id),
        result: { status: "ignored_unpaid" },
      });
      return json({ ok: true, status: "ignored_unpaid" });
    }

    await service
      .from("christmas_orders")
      .update({
        payment_status: "paid",
        paid_at: new Date().toISOString(),
        stripe_checkout_session_id: asString(obj.id) || null,
        stripe_payment_intent_id: asString(obj.payment_intent) || null,
        charged_amount_cents: Number(obj.amount_total) || ord.amount_cents,
      })
      .eq("id", orderId);

    const fulfill =
      productKey === "christmas_santa_voice_call_extension"
        ? await fulfillSantaVoiceCallExtensionOrder({
          service,
          orderId,
          stripeCheckoutSessionId: asString(obj.id),
          stripePaymentIntentId: asString(obj.payment_intent),
        })
        : await fulfillSantaVoiceCallOrder({ service, orderId });

    await service.from("processed_stripe_events").insert({
      event_id: eventId,
      event_type: eventType,
      stripe_session_id: asString(obj.id),
      result: { status: "santa_test_fulfilled", fulfill },
    });
    return json({ ok: true, status: "fulfilled", fulfill, event_id: eventId });
  }

  await service.from("processed_stripe_events").insert({
    event_id: eventId,
    event_type: eventType,
    result: { status: "ignored_event_type" },
  });
  return json({ ok: true, status: "ignored_event_type" });
});
