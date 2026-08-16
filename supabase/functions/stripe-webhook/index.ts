import { optionsResponse, jsonResponse } from "../_shared/cors.ts";
import { getServiceClient } from "../_shared/supabase.ts";

type StripeEvent = {
  id?: string;
  type?: string;
  data?: { object?: Record<string, unknown> };
};

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const left = enc.encode(a);
  const right = enc.encode(b);
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i++) diff |= left[i] ^ right[i];
  return diff === 0;
}

async function verifyStripeSignature(rawBody: string, header: string, secret: string): Promise<boolean> {
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
  if (!timestamp || signatures.length === 0) return false;

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  const skew = Math.abs(Date.now() / 1000 - ts);
  if (skew > 60 * 5) return false;

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
  return signatures.some((signature) => timingSafeEqual(digest, signature));
}

function asString(value: unknown): string {
  return String(value ?? "").trim();
}

function asInt(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function asUuid(value: unknown): string | null {
  const s = asString(value);
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)
    ? s
    : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    if (!secret) {
      return jsonResponse({ error: "STRIPE_WEBHOOK_SECRET is not configured" }, 503);
    }

    const rawBody = await req.text();
    const signature = req.headers.get("stripe-signature") || "";
    const verified = await verifyStripeSignature(rawBody, signature, secret);
    if (!verified) return jsonResponse({ error: "Invalid Stripe signature" }, 400);

    const event = JSON.parse(rawBody) as StripeEvent;
    const eventId = asString(event.id);
    const eventType = asString(event.type);
    if (!eventId) return jsonResponse({ error: "Missing event id" }, 400);

    const service = getServiceClient();
    const { data: already } = await service
      .from("processed_stripe_events")
      .select("event_id, result")
      .eq("event_id", eventId)
      .maybeSingle();
    if (already) {
      return jsonResponse({ ok: true, status: "already_processed", event_id: eventId });
    }

    const obj = (event.data?.object || {}) as Record<string, unknown>;
    const metadata = (obj.metadata || {}) as Record<string, unknown>;

    if (eventType === "checkout.session.completed") {
      const sessionId = asString(obj.id);
      const mode = asString(obj.mode) || "payment";
      const details = (obj.customer_details || {}) as { email?: string };
      const email = asString(obj.customer_email || details.email || metadata.email);
      const userId = asUuid(metadata.user_id);
      const pack = asString(metadata.pack || metadata.plan || metadata.price_key);
      const productType = asString(metadata.product_type) || (mode === "subscription" ? "subscription" : "credits");
      const credits = asInt(metadata.credits);
      const amountCents = asInt(obj.amount_total);
      const currency = asString(obj.currency) || "eur";
      const generationId = asString(metadata.generation_id);

      const { data, error } = await service.rpc("fulfill_paid_checkout", {
        p_event_id: eventId,
        p_session_id: sessionId,
        p_event_type: eventType,
        p_email: email,
        p_user_id: userId,
        p_pack: pack,
        p_product_type: productType,
        p_credits: credits,
        p_amount_cents: amountCents,
        p_currency: currency,
        p_mode: mode,
        p_customer_id: asString(obj.customer),
        p_subscription_id: asString(obj.subscription),
        p_generation_id: asUuid(generationId),
        p_metadata: metadata,
      });
      if (error) throw error;
      return jsonResponse({ ok: true, result: data });
    }

    if (eventType === "invoice.paid") {
      const billingReason = asString(obj.billing_reason);
      if (billingReason && billingReason !== "subscription_cycle") {
        await service.from("processed_stripe_events").insert({
          event_id: eventId,
          event_type: eventType,
          result: { status: "ignored", billing_reason: billingReason },
        });
        return jsonResponse({ ok: true, status: "ignored" });
      }

      const parent = (obj.parent as { subscription_details?: { metadata?: Record<string, unknown> } } | undefined)
        ?.subscription_details?.metadata;
      const invoiceMeta = {
        ...(obj.subscription_details as { metadata?: Record<string, unknown> } | undefined)?.metadata,
        ...((obj.lines as { data?: Array<{ metadata?: Record<string, unknown> }> } | undefined)?.data?.[0]?.metadata || {}),
        ...(parent || {}),
      } as Record<string, unknown>;
      const email = asString(obj.customer_email || invoiceMeta.email);
      const credits = asInt(invoiceMeta.credits);
      const { data, error } = await service.rpc("fulfill_paid_checkout", {
        p_event_id: eventId,
        p_session_id: asString(obj.id),
        p_event_type: eventType,
        p_email: email,
        p_user_id: asUuid(invoiceMeta.user_id),
        p_pack: asString(invoiceMeta.plan || invoiceMeta.pack),
        p_product_type: "subscription",
        p_credits: credits,
        p_amount_cents: asInt(obj.amount_paid),
        p_currency: asString(obj.currency) || "eur",
        p_mode: "subscription",
        p_customer_id: asString(obj.customer),
        p_subscription_id: asString(obj.subscription),
        p_generation_id: null,
        p_metadata: invoiceMeta,
      });
      if (error) throw error;
      return jsonResponse({ ok: true, result: data });
    }

    await service.from("processed_stripe_events").insert({
      event_id: eventId,
      event_type: eventType,
      result: { status: "ignored" },
    });
    return jsonResponse({ ok: true, status: "ignored", type: eventType });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: message }, 500);
  }
});
