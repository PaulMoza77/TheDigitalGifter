import { jsonResponse } from "../_shared/cors.ts";
import { getServiceClient } from "../_shared/supabase.ts";
import { verifyStripeSignature } from "../_shared/stripe.ts";
import { mvpProduct } from "../_shared/mvpProduct.ts";
import { validatePaidStripeSession } from "../_shared/stripePayment.ts";
import { kickFulfillmentWorker } from "../_shared/access.ts";

function header(name: string, req: Request) {
  return req.headers.get(name) || req.headers.get(name.toLowerCase()) || "";
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
      const amountTotal = typeof obj.amount_total === "number"
        ? obj.amount_total
        : Number(obj.amount_total);
      const paidCheck = validatePaidStripeSession({
        paymentStatus: String(obj.payment_status || ""),
        amountTotal: Number.isFinite(amountTotal) ? amountTotal : null,
        currency: String(obj.currency || ""),
        metadataSku: String(metadata.sku || ""),
        expectedAmountCents: mvpProduct.amountCents,
        expectedCurrency: mvpProduct.currency,
        expectedSku: mvpProduct.sku,
      });
      if (!paidCheck.ok) {
        return jsonResponse({ error: paidCheck.error, received: false }, 400);
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
        enqueue_job?: boolean;
        order?: { generation_id?: string; id?: string };
      };

      // Fast ack. Generation runs on the persistent job queue, never here.
      if (claimed?.enqueue_job) {
        kickFulfillmentWorker("stripe-webhook");
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
