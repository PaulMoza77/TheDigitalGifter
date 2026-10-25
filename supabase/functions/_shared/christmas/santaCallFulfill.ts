import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { asString, generatePublicToken, sha256Hex } from "./crypto.ts";
import { sendSantaCallReadyEmail } from "./santaCallEmail.ts";
import type { SantaCallLanguage } from "./santaCallPersonality.ts";

function waitUntil(promise: Promise<unknown>) {
  const runtime = (globalThis as { EdgeRuntime?: { waitUntil?: (value: Promise<unknown>) => void } })
    .EdgeRuntime;
  if (runtime && typeof runtime.waitUntil === "function") {
    runtime.waitUntil(promise);
    return;
  }
  void promise;
}

/**
 * After Stripe payment: activate entitlement, mint opaque access token (hash stored), email link.
 * Idempotent across webhook retries — reuses existing ready entitlement token only via email resend path.
 */
export async function fulfillSantaVoiceCallOrder(input: {
  service: SupabaseClient;
  orderId: string;
  forceResendEmail?: boolean;
}): Promise<{ ok: boolean; reason?: string; accessToken?: string }> {
  const { data: order } = await input.service
    .from("christmas_orders")
    .select("id,payment_status,product_key,email,metadata,amount_cents,currency,locale")
    .eq("id", input.orderId)
    .maybeSingle();

  if (!order) return { ok: false, reason: "missing_order" };
  if (asString(order.product_key) !== "christmas_santa_voice_call") {
    return { ok: false, reason: "wrong_product" };
  }
  if (asString(order.payment_status) !== "paid") {
    return { ok: false, reason: "payment_required" };
  }

  const { data: profile } = await input.service
    .from("christmas_santa_call_profiles")
    .select("id,language")
    .eq("order_id", input.orderId)
    .maybeSingle();
  if (!profile) return { ok: false, reason: "missing_profile" };

  const { data: existing } = await input.service
    .from("christmas_santa_call_entitlements")
    .select("id,status,expires_at,email_sent_at,access_token_hash")
    .eq("order_id", input.orderId)
    .maybeSingle();

  // Fresh token only when creating / recovering pending entitlements.
  // For already-ready entitlements without plaintext token, admin must reissue.
  let accessToken = "";
  const meta = (order.metadata || {}) as Record<string, unknown>;
  const cachedHint = asString(meta.santa_call_token_hint);

  if (existing && ["ready", "in_progress", "completed"].includes(asString(existing.status)) && !input.forceResendEmail) {
    if (cachedHint && (await sha256Hex(cachedHint)) === asString(existing.access_token_hash)) {
      accessToken = cachedHint;
    } else if (existing.email_sent_at && !input.forceResendEmail) {
      return { ok: true, reason: "already_activated" };
    }
  }

  // QA / pre-minted pending entitlements: reuse opaque token hint so Safari links stay valid.
  if (!accessToken && cachedHint) {
    accessToken = cachedHint;
  }

  if (!accessToken) {
    accessToken = generatePublicToken() + generatePublicToken();
  }
  const tokenHash = await sha256Hex(accessToken);
  const ttlDays = Number(Deno.env.get("CHRISTMAS_SANTA_CALL_TTL_DAYS") || "30") || 30;

  const { data: activated, error } = await input.service.rpc("activate_christmas_santa_call_entitlement", {
    p_order_id: input.orderId,
    p_access_token_hash: tokenHash,
    p_ttl_days: ttlDays,
  });
  if (error) {
    console.error("activate_christmas_santa_call_entitlement", error.message);
    return { ok: false, reason: error.message };
  }
  const result = (activated || {}) as Record<string, unknown>;
  if (result.ok !== true) {
    return { ok: false, reason: asString(result.reason) || "activate_failed" };
  }

  await input.service
    .from("christmas_orders")
    .update({
      metadata: {
        ...meta,
        // Soft hint for idempotent email retries — auth gate remains token hash.
        santa_call_token_hint: accessToken,
      },
    })
    .eq("id", input.orderId);

  const email = asString(order.email);
  const language = (
    asString(profile.language) === "ro" || asString(order.locale).toLowerCase().startsWith("ro") ? "ro" : "en"
  ) as SantaCallLanguage;
  const expiresAt = asString(result.expires_at) || new Date(Date.now() + ttlDays * 86400000).toISOString();

  if (email) {
    waitUntil(
      sendSantaCallReadyEmail({
        service: input.service,
        orderId: input.orderId,
        email,
        accessToken,
        language,
        expiresAt,
        resend: Boolean(input.forceResendEmail),
        amountCents: Number(order.amount_cents) || undefined,
        currency: asString(order.currency) || undefined,
      }).catch((err) => console.error("santa call email failed", err)),
    );
  }

  await input.service.from("christmas_santa_call_events").insert({
    entitlement_id: asString(result.entitlement_id) || null,
    order_id: input.orderId,
    event_name: "entitlement_activated",
    event_payload: { expires_at: expiresAt },
  });

  return { ok: true, accessToken };
}

/**
 * After Stripe payment for +5 min extension: grant exactly 300s once (idempotent).
 */
export async function fulfillSantaVoiceCallExtensionOrder(input: {
  service: SupabaseClient;
  orderId: string;
  stripeCheckoutSessionId?: string | null;
  stripePaymentIntentId?: string | null;
}): Promise<{ ok: boolean; reason?: string; remaining_seconds?: number }> {
  const { data: order } = await input.service
    .from("christmas_orders")
    .select("id,payment_status,product_key,metadata")
    .eq("id", input.orderId)
    .maybeSingle();

  if (!order) return { ok: false, reason: "missing_order" };
  if (asString(order.product_key) !== "christmas_santa_voice_call_extension") {
    return { ok: false, reason: "wrong_product" };
  }
  if (asString(order.payment_status) !== "paid") {
    return { ok: false, reason: "payment_required" };
  }

  const meta = (order.metadata || {}) as Record<string, unknown>;
  const entitlementId = asString(meta.parent_entitlement_id) || asString(meta.entitlement_id);
  if (!entitlementId) return { ok: false, reason: "missing_entitlement" };

  const { data: activated, error } = await input.service.rpc("activate_christmas_santa_call_extension", {
    p_entitlement_id: entitlementId,
    p_order_id: input.orderId,
    p_seconds: 300,
    p_stripe_checkout_session_id: input.stripeCheckoutSessionId || null,
    p_stripe_payment_intent_id: input.stripePaymentIntentId || null,
  });
  if (error) {
    console.error("activate_christmas_santa_call_extension", error.message);
    return { ok: false, reason: error.message };
  }
  const result = (activated || {}) as Record<string, unknown>;
  if (result.ok !== true) {
    return { ok: false, reason: asString(result.reason) || "activate_failed" };
  }

  await input.service.from("christmas_santa_call_events").insert({
    entitlement_id: entitlementId,
    order_id: input.orderId,
    event_name: "extension_activated",
    event_payload: {
      remaining_seconds: result.remaining_seconds,
      reason: result.reason || "activated",
    },
  });

  return {
    ok: true,
    reason: asString(result.reason) || "activated",
    remaining_seconds: Number(result.remaining_seconds) || 300,
  };
}

export async function revokeSantaVoiceCallForRefund(input: {
  service: SupabaseClient;
  orderId: string;
}): Promise<void> {
  const { data: order } = await input.service
    .from("christmas_orders")
    .select("product_key")
    .eq("id", input.orderId)
    .maybeSingle();
  if (asString(order?.product_key) === "christmas_santa_voice_call_extension") {
    // Extension refund: do not revoke the parent call entitlement; mark extension order only.
    await input.service
      .from("christmas_orders")
      .update({ fulfillment_status: "failed" })
      .eq("id", input.orderId);
    return;
  }
  await input.service.rpc("revoke_christmas_santa_call_entitlement", {
    p_order_id: input.orderId,
    p_reason: "refunded",
  });
}
