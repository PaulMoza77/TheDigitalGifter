/**
 * Christmas Stripe fulfill: routes V2 prototype vs commerce foundation by metadata.
 * - Commerce (product_family=christmas): fulfill_christmas_order_payment + christmas-photo-generate
 * - V2 (sku christmas-* / product_type): fulfill_christmas_v2_order_payment + christmas-generate
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { CHRISTMAS_PRODUCT_TYPE } from "./constants.ts";
import { asInt, asString, isUuid } from "./crypto.ts";

export const CHRISTMAS_PRODUCT_FAMILY = "christmas";

function waitUntil(promise: Promise<unknown>) {
  const runtime = (globalThis as { EdgeRuntime?: { waitUntil?: (value: Promise<unknown>) => void } })
    .EdgeRuntime;
  if (runtime && typeof runtime.waitUntil === "function") {
    runtime.waitUntil(promise);
    return;
  }
  void promise;
}

export function isChristmasCheckoutMetadata(metadata: Record<string, unknown>): boolean {
  const family = asString(metadata.product_family);
  const productType = asString(metadata.product_type);
  const sku = asString(metadata.sku);
  return (
    family === CHRISTMAS_PRODUCT_FAMILY ||
    productType === CHRISTMAS_PRODUCT_TYPE ||
    productType === "christmas" ||
    sku.startsWith("christmas-") ||
    sku.startsWith("xmas_")
  );
}

function isCommerceChristmasMetadata(metadata: Record<string, unknown>): boolean {
  return asString(metadata.product_family) === CHRISTMAS_PRODUCT_FAMILY;
}

async function invokeFunction(name: string, orderId: string) {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return;
  await fetch(`${url.replace(/\/$/, "")}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      apikey: key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ order_id: orderId }),
  });
}

export function enqueueChristmasGenerate(
  orderId: string,
  mode: "commerce" | "v2" | "santa" = "v2",
) {
  const fn =
    mode === "santa"
      ? "christmas-santa-generate"
      : mode === "commerce"
        ? "christmas-photo-generate"
        : "christmas-generate";
  waitUntil(
    invokeFunction(fn, orderId).catch((err) => {
      console.error(`${fn} enqueue failed`, err);
    }),
  );
}


/** Opens for Gift Tree packages — authoritative server mapping (ignore client amounts). */
export function giftTreeOpensForPackage(packageKey: string): number {
  if (packageKey === "open_five" || packageKey === "open_5") return 5;
  if (packageKey === "open_another") return 1;
  return 0;
}

/**
 * Idempotent grant for Gift Tree purchases. Safe to call on webhook retries
 * (RPC uses p_source_ref uniqueness).
 */
export async function reconcileChristmasGiftTreeOpens(input: {
  service: SupabaseClient;
  eventId: string;
  obj: Record<string, unknown>;
  metadata: Record<string, unknown>;
}): Promise<{ granted: boolean; opens: number; orderId: string | null }> {
  const productKey = asString(input.metadata.product_key);
  if (productKey !== "christmas_gift_tree") {
    return { granted: false, opens: 0, orderId: null };
  }
  const packageKey = asString(input.metadata.package_key);
  const opens = giftTreeOpensForPackage(packageKey);
  if (opens <= 0) return { granted: false, opens: 0, orderId: null };

  const orderId =
    asString(input.metadata.christmas_order_id) ||
    asString(input.metadata.order_id) ||
    null;

  let userId: string | null = asString(input.metadata.user_id) || null;
  let guestHash = asString(input.metadata.guest_token_hash) || null;
  let email = asString(input.metadata.email) || null;

  if (orderId) {
    const { data: ord } = await input.service
      .from("christmas_orders")
      .select("user_id,email,metadata")
      .eq("id", orderId)
      .maybeSingle();
    if (ord) {
      userId = ord.user_id || userId;
      email = asString(ord.email) || email;
      const meta = (ord.metadata || {}) as Record<string, unknown>;
      guestHash = asString(meta.guest_token_hash) || guestHash;
    }
  }

  const sessionId = asString(input.obj.id);
  const sourceRef = orderId ? `stripe_order:${orderId}` : `stripe_session:${sessionId || input.eventId}`;

  await input.service.rpc("christmas_gift_tree_grant_opens", {
    p_season_year: 2026,
    p_opens: opens,
    p_source: "purchase",
    p_source_ref: sourceRef,
    p_user_id: userId,
    p_guest_token_hash: guestHash,
    p_email_normalized: email ? email.trim().toLowerCase() : null,
    p_metadata: {
      package_key: packageKey,
      stripe_session_id: sessionId,
      christmas_order_id: orderId,
      stripe_event_id: input.eventId,
      reconcile: true,
    },
  });

  return { granted: true, opens, orderId };
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

  const commerce = isCommerceChristmasMetadata(input.metadata);

  if (commerce) {
    if (
      input.eventType !== "checkout.session.completed" &&
      input.eventType !== "checkout.session.async_payment_succeeded"
    ) {
      return null;
    }
  } else if (input.eventType !== "checkout.session.completed") {
    return null;
  }

  const paymentStatus = asString(input.obj.payment_status);
  if (paymentStatus && paymentStatus !== "paid" && paymentStatus !== "no_payment_required") {
    await input.service.from("processed_stripe_events").insert({
      event_id: input.eventId,
      event_type: input.eventType,
      stripe_session_id: asString(input.obj.id),
      result: { status: "ignored_unpaid", payment_status: paymentStatus, commerce },
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

  if (commerce) {
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

    if (result.ok === true && result.status === "paid") {
      const productKey = asString(input.metadata.product_key);
      const packageKey = asString(input.metadata.package_key);

      // Gift Tree: grant opens BEFORE marking processed so retries can recover.
      // Never enqueue photo/video generation for gift-tree packs.
      if (productKey === "christmas_gift_tree") {
        await reconcileChristmasGiftTreeOpens({
          service: input.service,
          eventId: input.eventId,
          obj: input.obj,
          metadata: {
            ...input.metadata,
            christmas_order_id: orderId,
            package_key: packageKey,
            product_key: productKey,
          },
        });
      } else {
        // Consume Gift Tree percent-off entitlement after successful payment (not on checkout open).
        {
          const { data: ordMeta } = await input.service
            .from("christmas_orders")
            .select("metadata")
            .eq("id", orderId)
            .maybeSingle();
          const meta = (ordMeta?.metadata || {}) as Record<string, unknown>;
          const entId =
            asString(input.metadata.gift_tree_entitlement_id) ||
            asString(meta.gift_tree_entitlement_id);
          if (entId) {
            await input.service
              .from("christmas_reward_entitlements")
              .update({
                redeemed_at: new Date().toISOString(),
                status: "redeemed",
                metadata: {
                  redeemed_via: "stripe_webhook",
                  christmas_order_id: orderId,
                  stripe_session_id: sessionId,
                },
              })
              .eq("id", entId)
              .is("redeemed_at", null);
          }
        }
        let mode: "commerce" | "santa" = "commerce";
        if (productKey === "christmas_santa_video") {
          mode = "santa";
        } else if (!productKey) {
          const { data: ord } = await input.service
            .from("christmas_orders")
            .select("product_key")
            .eq("id", orderId)
            .maybeSingle();
          if (asString(ord?.product_key) === "christmas_santa_video") mode = "santa";
        }
        enqueueChristmasGenerate(orderId, mode);
      }
    }

    await input.service.from("processed_stripe_events").insert({
      event_id: input.eventId,
      event_type: input.eventType,
      stripe_session_id: sessionId,
      result: { ...result, product_family: "christmas" },
    });

    return new Response(JSON.stringify({ ok: true, christmas: result }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // V2 prototype path (quarantined tables)
  const { data, error } = await input.service.rpc("fulfill_christmas_v2_order_payment", {
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
  if (result?.should_enqueue) enqueueChristmasGenerate(orderId, "v2");

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
