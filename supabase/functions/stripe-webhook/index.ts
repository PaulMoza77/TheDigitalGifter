import { jsonResponse } from "../_shared/cors.ts";
import { getServiceClient } from "../_shared/supabase.ts";
import { verifyStripeSignature } from "../_shared/stripe.ts";
import { mvpProduct } from "../_shared/mvpProduct.ts";

function header(name: string, req: Request) {
  return req.headers.get(name) || req.headers.get(name.toLowerCase()) || "";
}

async function invokeFulfill(orderId: string, generationId: string) {
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const secret = Deno.env.get("FULFILLMENT_SECRET") || "";
  if (!url || !anon) throw new Error("Missing SUPABASE_URL/ANON");

  const res = await fetch(`${url}/functions/v1/fulfill-paid-order`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anon,
      Authorization: `Bearer ${anon}`,
      "x-fulfillment-secret": secret,
    },
    body: JSON.stringify({ order_id: orderId, generation_id: generationId }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `fulfill-paid-order failed (${res.status})`);
  }
  return data;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!secret) return jsonResponse({ error: "STRIPE_WEBHOOK_SECRET is not configured." }, 503);

  const payload = await req.text();
  const signature = header("stripe-signature", req);
  const verified = await verifyStripeSignature({ payload, header: signature, secret });
  if (!verified.ok) {
    return jsonResponse({ error: verified.error }, 400);
  }

  let event: {
    id?: string;
    type?: string;
    data?: { object?: Record<string, unknown> };
  };
  try {
    event = JSON.parse(payload);
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  const type = String(event.type || "");
  const obj = (event.data?.object || {}) as Record<string, unknown>;
  const metadata = (obj.metadata || {}) as Record<string, string>;

  const service = getServiceClient();

  try {
    if (type === "checkout.session.completed" || type === "checkout.session.async_payment_succeeded") {
      const paymentStatus = String(obj.payment_status || "");
      if (type === "checkout.session.completed" && paymentStatus && paymentStatus !== "paid") {
        return jsonResponse({ received: true, ignored: "unpaid_session" });
      }

      const orderId = String(metadata.order_id || obj.client_reference_id || "").trim();
      if (!orderId) return jsonResponse({ error: "order_id missing from session metadata" }, 400);

      const sessionId = String(obj.id || "");
      const paymentIntent = typeof obj.payment_intent === "string"
        ? obj.payment_intent
        : String((obj.payment_intent as { id?: string } | undefined)?.id || "");

      const { data, error } = await service.rpc("claim_mvp_order_paid", {
        p_order_id: orderId,
        p_event_id: String(event.id || ""),
        p_event_type: type,
        p_session_id: sessionId,
        p_payment_intent_id: paymentIntent,
      });
      if (error) throw error;

      const claimed = data as {
        kind?: string;
        should_start_generation?: boolean;
        order?: { generation_id?: string; id?: string };
      };

      if (claimed?.should_start_generation) {
        const generationId = String(claimed.order?.generation_id || metadata.generation_id || "");
        if (!generationId) throw new Error("generation_id missing after paid claim");
        await invokeFulfill(orderId, generationId);
      }

      return jsonResponse({ received: true, kind: claimed?.kind || "ok" });
    }

    if (type === "charge.refunded" || type === "refund.created") {
      const paymentIntent = String(
        obj.payment_intent || (obj as { payment_intent?: string }).payment_intent || "",
      );
      if (paymentIntent) {
        await service
          .from("mvp_orders")
          .update({ status: "refunded", updated_at: new Date().toISOString() })
          .eq("stripe_payment_intent_id", paymentIntent);
      }
      await service.from("stripe_webhook_events").upsert({
        event_id: String(event.id || crypto.randomUUID()),
        event_type: type,
      });
      return jsonResponse({ received: true, kind: "refunded" });
    }

    return jsonResponse({ received: true, ignored: type, maxAttempts: mvpProduct.maxGenerationAttempts });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: message }, 500);
  }
});
