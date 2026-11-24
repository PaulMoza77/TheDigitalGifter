/**
 * Dedicated Stripe TEST webhook for Our Christmas Story.
 * Verifies STRIPE_TEST_WEBHOOK_SECRET only. Never uses LIVE STRIPE_WEBHOOK_SECRET.
 * Rejects livemode events and non-story metadata.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";
import { asString, isUuid } from "../_shared/christmas/crypto.ts";
import { STORY_CURRENCY, STORY_PRICE_CENTS, STORY_PRODUCT_KEY } from "../_shared/christmas/storyLifecycle.ts";
import { isStoryStripeTestMeta } from "../_shared/christmas/storyStripe.ts";

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
  const signed = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${timestamp}.${rawBody}`),
  );
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

  const obj = ((event.data as Record<string, unknown> | undefined)?.object || {}) as Record<
    string,
    unknown
  >;
  const metadata = (obj.metadata || {}) as Record<string, unknown>;

  if (!isStoryStripeTestMeta(metadata)) {
    return json({ ok: false, code: "not_story_test_product" }, 400);
  }
  if (asString(metadata.product_key) !== STORY_PRODUCT_KEY) {
    return json({ ok: false, code: "product_mismatch" }, 400);
  }

  const orderId =
    asString(metadata.christmas_story_order_id) || asString(metadata.christmas_order_id);
  if (!isUuid(orderId)) return json({ error: "christmas_story_order_id required" }, 400);

  // Expired / failed async payments — never mark PAID.
  if (
    eventType === "checkout.session.expired" ||
    eventType === "checkout.session.async_payment_failed"
  ) {
    const { data: alreadyExpire } = await service
      .from("processed_stripe_events")
      .select("event_id")
      .eq("event_id", eventId)
      .maybeSingle();
    if (alreadyExpire) return json({ ok: true, status: "already_processed", event_id: eventId });

    await service
      .from("christmas_story_orders")
      .update({
        payment_status: eventType.endsWith("expired") ? "expired" : "failed",
        status: "FAILED",
        failed_reason: eventType,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId)
      .eq("payment_status", "pending");

    await service.from("processed_stripe_events").insert({
      event_id: eventId,
      event_type: eventType,
      stripe_session_id: asString(obj.id) || null,
      result: { status: "not_paid", product: "christmas_story", order_id: orderId },
    });
    return json({ ok: true, status: "not_paid", order_id: orderId, type: eventType });
  }

  // Handle checkout completion + async payment success
  if (
    eventType !== "checkout.session.completed" &&
    eventType !== "checkout.session.async_payment_succeeded"
  ) {
    // only mark processed after successful handling of payment events.
    return json({ ok: true, status: "ignored", type: eventType });
  }

  const amountTotal = Number(obj.amount_total ?? STORY_PRICE_CENTS);
  const currency = asString(obj.currency || STORY_CURRENCY).toLowerCase();
  const sessionId = asString(obj.id);
  const paymentIntent =
    typeof obj.payment_intent === "string"
      ? obj.payment_intent
      : asString((obj.payment_intent as { id?: string } | undefined)?.id);

  const { data: fulfill, error } = await service.rpc("christmas_story_fulfill_payment", {
    p_order_id: orderId,
    p_stripe_session_id: sessionId,
    p_stripe_payment_intent_id: paymentIntent,
    p_amount_cents: amountTotal,
    p_currency: currency,
    p_stripe_event_id: eventId,
  });
  if (error) {
    console.error("[story-stripe-test-webhook]", error.message);
    return json({ ok: false, code: "fulfill_failed" }, 500);
  }

  const result = (fulfill || {}) as Record<string, unknown>;
  if (result.ok !== true) {
    return json({ ok: false, code: result.code || "fulfill_rejected" }, 409);
  }

  await service.from("processed_stripe_events").insert({
    event_id: eventId,
    event_type: eventType,
    stripe_session_id: sessionId || null,
    result: { status: result.code, product: "christmas_story", order_id: orderId },
  });

  // Advance into content pipeline (idempotent-ish; transition RPC enforces legality)
  if (result.code === "paid") {
    try {
      await service.rpc("christmas_story_transition_order", {
        p_order_id: orderId,
        p_to: "CONTENT_PENDING",
        p_actor: "stripe_test_webhook",
        p_metadata: { stripe_event_id: eventId },
      });
      await service.rpc("christmas_story_transition_order", {
        p_order_id: orderId,
        p_to: "GENERATING",
        p_actor: "stripe_test_webhook",
        p_metadata: {},
      });
      // Seed jobs: mock story + manual song + ffmpeg film queue
      await service.from("christmas_story_jobs").insert([
        { order_id: orderId, job_type: "story", provider: "mock", status: "ready" },
        { order_id: orderId, job_type: "song", provider: "manual", status: "awaiting_manual" },
        { order_id: orderId, job_type: "film", provider: "ffmpeg", status: "queued" },
      ]);
      await service.rpc("christmas_story_transition_order", {
        p_order_id: orderId,
        p_to: "REVIEW_REQUIRED",
        p_actor: "stripe_test_webhook",
        p_metadata: { note: "awaiting_manual_song_and_film" },
      });
    } catch (e) {
      console.error(
        "[story-stripe-test-webhook] post-pay transitions",
        e instanceof Error ? e.message : "error",
      );
    }
  }

  return json({ ok: true, status: result.code, order_id: orderId, event_id: eventId });
});
