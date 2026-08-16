import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { PET_PRICE_CENTS, siteOrigin } from "./constants.ts";
import { asString, asInt, isUuid } from "./crypto.ts";
import { stripeFulfillmentDecision } from "./guards.ts";
import { sendMetaCapiPurchase } from "./meta.ts";

export function isPetCheckoutMetadata(metadata: Record<string, unknown>): boolean {
  return asString(metadata.sku) === "pet-secret-life-12" || asString(metadata.product_type) === "pet_secret_life";
}

async function invokePetGenerate(orderId: string) {
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
    p_amount_cents: asInt(input.obj.amount_total) || PET_PRICE_CENTS,
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
      .select("id, email, meta_event_id, meta_purchase_sent_at")
      .eq("id", orderId)
      .maybeSingle();
    if (order && !order.meta_purchase_sent_at) {
      const capi = await sendMetaCapiPurchase({
        eventId: order.meta_event_id,
        email: order.email,
        alreadySentAt: order.meta_purchase_sent_at,
        sourceUrl: `${siteOrigin()}/pet/order`,
      });
      if (capi.sent) {
        await input.service
          .from("pet_orders")
          .update({ meta_purchase_sent_at: new Date().toISOString() })
          .eq("id", orderId);
      }
    }
  }

  if (result?.should_enqueue) {
    await invokePetGenerate(orderId);
  }

  return new Response(JSON.stringify({ ok: true, result }), {
    headers: { "Content-Type": "application/json" },
  });
}
