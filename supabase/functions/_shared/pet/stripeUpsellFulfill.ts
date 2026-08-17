import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { asString, asInt, isUuid } from "./crypto.ts";
import { invokePetGenerate } from "./stripeFulfill.ts";

export function isPetUpsellMetadata(metadata: Record<string, unknown>): boolean {
  return asString(metadata.product_type) === "pet_upsell";
}

export async function handlePetUpsellStripeEvent(input: {
  service: SupabaseClient;
  eventId: string;
  eventType: string;
  obj: Record<string, unknown>;
  metadata: Record<string, unknown>;
}): Promise<Response | null> {
  if (!isPetUpsellMetadata(input.metadata)) return null;

  if (input.eventType === "invoice.paid") {
    await input.service.from("processed_stripe_events").insert({
      event_id: input.eventId,
      event_type: input.eventType,
      result: { status: "ignored", reason: "pet_upsell_invoice" },
    });
    return new Response(JSON.stringify({ ok: true, status: "ignored", reason: "pet_upsell_invoice" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const paymentStatus = asString(input.obj.payment_status);
  const mode = asString(input.obj.mode);
  const paid =
    input.eventType === "checkout.session.async_payment_succeeded" ||
    (input.eventType === "checkout.session.completed" &&
      (paymentStatus === "paid" || paymentStatus === "no_payment_required") &&
      (!mode || mode === "payment"));

  if (!paid) {
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

  const upsellId = isUuid(input.metadata.pet_upsell_id) ? asString(input.metadata.pet_upsell_id) : null;
  if (!upsellId) {
    return new Response(JSON.stringify({ error: "pet_upsell_id missing from Stripe metadata" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { data, error } = await input.service.rpc("fulfill_pet_upsell_payment", {
    p_event_id: input.eventId,
    p_session_id: asString(input.obj.id),
    p_event_type: input.eventType,
    p_payment_status: asString(input.obj.payment_status) || "paid",
    p_payment_intent_id: asString(input.obj.payment_intent),
    p_amount_cents: input.obj.amount_total == null ? 0 : asInt(input.obj.amount_total),
    p_currency: asString(input.obj.currency) || "usd",
    p_upsell_id: upsellId,
  });
  if (error) throw error;

  const result = data as {
    status?: string;
    should_enqueue?: boolean;
    pet_order_id?: string;
    upsell_key?: string;
  };

  if (result?.should_enqueue && result.pet_order_id) {
    const metadata = input.metadata;
    const sceneKeysRaw = asString(metadata.scene_keys);
    let sceneKeys: string[] | undefined;
    if (sceneKeysRaw) {
      try {
        const parsed = JSON.parse(sceneKeysRaw);
        if (Array.isArray(parsed)) {
          sceneKeys = parsed.map((item) => asString(item)).filter(Boolean);
        }
      } catch {
        sceneKeys = sceneKeysRaw.split(",").map((item) => item.trim()).filter(Boolean);
      }
    }
    await invokePetGenerateWithScenes(result.pet_order_id, sceneKeys);
  }

  return new Response(JSON.stringify({ ok: true, result }), {
    headers: { "Content-Type": "application/json" },
  });
}

async function invokePetGenerateWithScenes(orderId: string, sceneKeys?: string[]) {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    await invokePetGenerate(orderId);
    return;
  }
  await fetch(`${url.replace(/\/$/, "")}/functions/v1/pet-generate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      apikey: key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      order_id: orderId,
      scene_keys: sceneKeys?.length ? sceneKeys : undefined,
    }),
  });
}
