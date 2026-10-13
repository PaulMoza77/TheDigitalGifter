import { optionsResponse, jsonResponse } from "../_shared/cors.ts";
import { getServiceClient, readJson } from "../_shared/supabase.ts";
import {
  MEMORIES_PHOTO_MAX_BYTES,
  MEMORIES_PLANS,
  MEMORIES_PRODUCT_FAMILY,
  MEMORIES_PRODUCT_TYPE,
  MEMORIES_SIGNED_UPLOAD_SECONDS,
  MEMORIES_SOURCE_BUCKET,
  chargingAllowed,
  isMemoriesPlanKey,
  memoriesCommercialMode,
  memoriesEnabled,
  siteOrigin,
  stripePriceIdForPlan,
  type MemoriesPlanKey,
} from "../_shared/memories/constants.ts";
import { sendMemoriesEarlyAccessEmail } from "../_shared/memories/email.ts";
import {
  asInt,
  asString,
  encryptPublicToken,
  extensionFromContentType,
  generatePublicToken,
  isUuid,
  sha256Hex,
} from "../_shared/christmas/crypto.ts";

type Body = Record<string, unknown>;

const STRIPE_API_VERSION = "2025-03-31.basil";
const ALLOWED_PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function apiError(code: string, message: string, status = 400, extra: Record<string, unknown> = {}) {
  return jsonResponse({ error: message, code, ...extra }, status);
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

function publicPlans() {
  return Object.values(MEMORIES_PLANS).map((plan) => ({
    key: plan.key,
    sku: plan.sku,
    name: plan.name,
    amountCents: plan.amountCents,
    priceDisplay: plan.priceDisplay,
    badge: plan.badge,
    tagline: plan.tagline,
    monthlyAnimations: plan.monthlyAnimations,
    features: [...plan.features],
    stripePriceConfigured: Boolean(stripePriceIdForPlan(plan.key)),
  }));
}

async function ensureSession(
  service: ReturnType<typeof getServiceClient>,
  clientSessionId: string,
  attribution: Record<string, string | null> = {},
) {
  if (!isUuid(clientSessionId)) throw new Error("invalid_session");
  const { data: existing } = await service
    .from("memories_funnel_sessions")
    .select("*")
    .eq("client_session_id", clientSessionId)
    .maybeSingle();
  if (existing) return existing;

  const { data, error } = await service
    .from("memories_funnel_sessions")
    .insert({
      client_session_id: clientSessionId,
      step: "landing",
      utm_source: attribution.utm_source,
      utm_medium: attribution.utm_medium,
      utm_campaign: attribution.utm_campaign,
      utm_content: attribution.utm_content,
      utm_term: attribution.utm_term,
      campaign_id: attribution.campaign_id,
      adset_id: attribution.adset_id,
      ad_id: attribution.ad_id,
      referrer_host: attribution.referrer_host,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

async function upsertCustomer(
  service: ReturnType<typeof getServiceClient>,
  input: {
    email: string;
    fullName?: string | null;
    marketingOptIn: boolean;
    processingConsent: boolean;
    authorityAck: boolean;
  },
) {
  const email = asString(input.email);
  const emailNormalized = normalizeEmail(email);
  if (!isValidEmail(emailNormalized)) throw new Error("invalid_email");
  if (!input.processingConsent) throw new Error("processing_consent_required");
  if (!input.authorityAck) throw new Error("authority_ack_required");

  const { data: existing } = await service
    .from("memories_customers")
    .select("*")
    .eq("email_normalized", emailNormalized)
    .maybeSingle();

  const now = new Date().toISOString();
  if (existing) {
    const { data, error } = await service
      .from("memories_customers")
      .update({
        email,
        full_name: input.fullName || existing.full_name,
        marketing_opt_in: input.marketingOptIn,
        processing_consent_at: existing.processing_consent_at || now,
        authority_ack_at: existing.authority_ack_at || now,
        updated_at: now,
      })
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  const { data, error } = await service
    .from("memories_customers")
    .insert({
      email,
      email_normalized: emailNormalized,
      full_name: input.fullName || null,
      marketing_opt_in: input.marketingOptIn,
      processing_consent_at: now,
      authority_ack_at: now,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST") return apiError("method_not_allowed", "Method not allowed", 405);

  try {
    if (!memoriesEnabled()) {
      return apiError("memories_disabled", "Memories funnel is temporarily disabled", 503);
    }

    const body = await readJson<Body>(req);
    const action = asString(body.action);
    const service = getServiceClient();
    const mode = memoriesCommercialMode();

    if (action === "config") {
      return jsonResponse({
        ok: true,
        enabled: true,
        commercialMode: mode,
        chargingEnabled: chargingAllowed(mode),
        earlyAccess: true,
        productAvailable: false,
        plans: publicPlans(),
        disclosures: {
          earlyAccess: "Early Access — Product in Development",
          immediate:
            mode === "waitlist"
              ? "You join the early-access waitlist. No payment is collected."
              : "You receive early-access membership status and billing portal access. AI generation is not available yet.",
          billing:
            mode === "waitlist"
              ? "Recurring billing is not active in waitlist mode."
              : "Recurring monthly billing begins when Stripe confirms a successful checkout under an approved commercial mode.",
          cancellation: "Cancel anytime via the Stripe billing portal once subscribed.",
          refunds: "Refunds follow Stripe and applicable consumer rights; contact support@thedigitalgifter.com.",
        },
      });
    }

    if (action === "upsert_session") {
      const clientSessionId = asString(body.client_session_id || body.funnel_session_id);
      const session = await ensureSession(service, clientSessionId, {
        utm_source: asString(body.utm_source) || null,
        utm_medium: asString(body.utm_medium) || null,
        utm_campaign: asString(body.utm_campaign) || null,
        utm_content: asString(body.utm_content) || null,
        utm_term: asString(body.utm_term) || null,
        campaign_id: asString(body.campaign_id) || null,
        adset_id: asString(body.adset_id) || null,
        ad_id: asString(body.ad_id) || null,
        referrer_host: asString(body.referrer_host) || null,
      });
      const step = asString(body.step);
      if (step) {
        await service
          .from("memories_funnel_sessions")
          .update({ step, updated_at: new Date().toISOString() })
          .eq("id", session.id);
      }
      return jsonResponse({ ok: true, sessionId: session.id, clientSessionId });
    }

    if (action === "create_upload_url") {
      const clientSessionId = asString(body.client_session_id || body.funnel_session_id);
      const session = await ensureSession(service, clientSessionId);
      const contentType = asString(body.content_type).toLowerCase();
      const fileName = asString(body.file_name) || "photo.jpg";
      const byteSize = asInt(body.byte_size);
      if (!ALLOWED_PHOTO_TYPES.has(contentType)) {
        return apiError("invalid_type", "Only JPEG, PNG, and WebP images are allowed");
      }
      if (byteSize <= 0 || byteSize > MEMORIES_PHOTO_MAX_BYTES) {
        return apiError("invalid_size", "Image must be between 1 byte and 15MB");
      }

      const publicToken = generatePublicToken();
      const tokenHash = await sha256Hex(publicToken);
      const ext = extensionFromContentType(contentType);
      const objectPath = `${session.id}/${crypto.randomUUID()}.${ext}`;

      const { data: upload, error } = await service
        .from("memories_uploads")
        .insert({
          session_id: session.id,
          public_token_hash: tokenHash,
          bucket: MEMORIES_SOURCE_BUCKET,
          object_path: objectPath,
          content_type: contentType,
          file_name: fileName.slice(0, 180),
          byte_size: byteSize,
          status: "pending",
        })
        .select("id")
        .single();
      if (error) throw error;

      const { data: signed, error: signError } = await service.storage
        .from(MEMORIES_SOURCE_BUCKET)
        .createSignedUploadUrl(objectPath);
      if (signError || !signed) {
        return apiError("sign_failed", signError?.message || "Could not create upload URL", 502);
      }

      await service
        .from("memories_funnel_sessions")
        .update({ step: "create", updated_at: new Date().toISOString() })
        .eq("id", session.id);

      return jsonResponse({
        ok: true,
        uploadId: upload.id,
        publicToken,
        bucket: MEMORIES_SOURCE_BUCKET,
        path: objectPath,
        signedUrl: signed.signedUrl,
        token: signed.token,
        expiresIn: MEMORIES_SIGNED_UPLOAD_SECONDS,
      });
    }

    if (action === "confirm_upload") {
      const uploadId = asString(body.upload_id);
      const publicToken = asString(body.public_token);
      if (!isUuid(uploadId) || !publicToken) return apiError("invalid_request", "upload_id and public_token required");
      const hash = await sha256Hex(publicToken);
      const { data: upload, error } = await service
        .from("memories_uploads")
        .select("*")
        .eq("id", uploadId)
        .eq("public_token_hash", hash)
        .maybeSingle();
      if (error) throw error;
      if (!upload) return apiError("not_found", "Upload not found", 404);

      const { error: updErr } = await service
        .from("memories_uploads")
        .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
        .eq("id", uploadId);
      if (updErr) throw updErr;
      return jsonResponse({ ok: true, uploadId });
    }

    if (action === "remove_upload") {
      const uploadId = asString(body.upload_id);
      const publicToken = asString(body.public_token);
      const hash = await sha256Hex(publicToken);
      const { data: upload } = await service
        .from("memories_uploads")
        .select("*")
        .eq("id", uploadId)
        .eq("public_token_hash", hash)
        .maybeSingle();
      if (!upload) return apiError("not_found", "Upload not found", 404);
      await service.storage.from(upload.bucket).remove([upload.object_path]).catch(() => undefined);
      await service
        .from("memories_uploads")
        .update({ status: "deleted", deleted_at: new Date().toISOString() })
        .eq("id", upload.id);
      return jsonResponse({ ok: true });
    }

    if (action === "submit_email") {
      const clientSessionId = asString(body.client_session_id || body.funnel_session_id);
      const session = await ensureSession(service, clientSessionId);
      const customer = await upsertCustomer(service, {
        email: asString(body.email),
        fullName: asString(body.full_name) || null,
        marketingOptIn: body.marketing_opt_in === true,
        processingConsent: body.processing_consent === true,
        authorityAck: body.authority_ack === true,
      });

      await service
        .from("memories_funnel_sessions")
        .update({
          customer_id: customer.id,
          step: "email",
          updated_at: new Date().toISOString(),
        })
        .eq("id", session.id);

      await service
        .from("memories_uploads")
        .update({ customer_id: customer.id })
        .eq("session_id", session.id)
        .is("customer_id", null);

      return jsonResponse({
        ok: true,
        customerId: customer.id,
        email: customer.email,
      });
    }

    if (action === "select_plan") {
      const clientSessionId = asString(body.client_session_id || body.funnel_session_id);
      const planKey = asString(body.plan_key);
      if (!isMemoriesPlanKey(planKey)) return apiError("invalid_plan", "Invalid plan");
      const session = await ensureSession(service, clientSessionId);
      if (!session.customer_id) return apiError("email_required", "Submit email before selecting a plan");

      await service
        .from("memories_funnel_sessions")
        .update({
          selected_plan_key: planKey,
          step: "plans",
          updated_at: new Date().toISOString(),
        })
        .eq("id", session.id);

      return jsonResponse({ ok: true, planKey, plan: MEMORIES_PLANS[planKey] });
    }

    if (action === "join_waitlist" || (action === "create_checkout" && !chargingAllowed(mode))) {
      const clientSessionId = asString(body.client_session_id || body.funnel_session_id);
      const planKeyRaw = asString(body.plan_key);
      const planKey = isMemoriesPlanKey(planKeyRaw) ? planKeyRaw : null;
      const session = await ensureSession(service, clientSessionId);
      if (!session.customer_id) return apiError("email_required", "Submit email first");

      const { data: customer } = await service
        .from("memories_customers")
        .select("*")
        .eq("id", session.customer_id)
        .single();
      if (!customer) return apiError("customer_missing", "Customer not found", 404);

      const publicToken = generatePublicToken();
      const tokenHash = await sha256Hex(publicToken);
      const plan = planKey ? MEMORIES_PLANS[planKey] : MEMORIES_PLANS.plus;

      const { data: order, error } = await service
        .from("memories_orders")
        .insert({
          public_token_hash: tokenHash,
          public_token_ciphertext: await encryptPublicToken(publicToken),
          session_id: session.id,
          customer_id: customer.id,
          email: customer.email,
          email_normalized: customer.email_normalized,
          plan_key: plan.key,
          plan_sku: plan.sku,
          amount_cents: plan.amountCents,
          currency: "usd",
          status: "waitlisted",
          payment_status: "unpaid",
          commercial_mode: mode,
          fulfillment_status: "waitlisted",
          is_test: true,
          is_live_charge: false,
          utm_source: session.utm_source,
          utm_medium: session.utm_medium,
          utm_campaign: session.utm_campaign,
        })
        .select("*")
        .single();
      if (error) throw error;

      await service.from("memories_waitlist").upsert(
        {
          customer_id: customer.id,
          session_id: session.id,
          plan_key: plan.key,
          email_normalized: customer.email_normalized,
          source: "memories_funnel",
        },
        { onConflict: "email_normalized" },
      );

      await service
        .from("memories_funnel_sessions")
        .update({ step: "waitlist", updated_at: new Date().toISOString() })
        .eq("id", session.id);

      await sendMemoriesEarlyAccessEmail({
        service,
        email: customer.email,
        customerId: customer.id,
        orderId: order.id,
        planKey: plan.key,
        mode,
      }).catch(() => undefined);

      return jsonResponse({
        ok: true,
        mode: "waitlist",
        charged: false,
        orderId: order.id,
        publicToken,
        successUrl: `${siteOrigin()}/memories/success?token=${encodeURIComponent(publicToken)}&mode=waitlist`,
      });
    }

    if (action === "create_checkout") {
      const clientSessionId = asString(body.client_session_id || body.funnel_session_id);
      const planKey = asString(body.plan_key);
      if (!isMemoriesPlanKey(planKey)) return apiError("invalid_plan", "Invalid plan");
      const plan = MEMORIES_PLANS[planKey as MemoriesPlanKey];
      const priceId = stripePriceIdForPlan(plan.key);
      if (!priceId) {
        return apiError(
          "price_unconfigured",
          "Stripe Price ID is not configured for this plan. Keep waitlist mode or set MEMORIES_STRIPE_PRICE_* secrets.",
          503,
        );
      }

      const stripeKey = asString(Deno.env.get("STRIPE_SECRET_KEY"));
      if (!stripeKey) return apiError("stripe_unconfigured", "STRIPE_SECRET_KEY is not configured", 503);
      if (mode === "paid_early_access" && stripeKey.startsWith("sk_test_")) {
        return apiError(
          "live_key_required",
          "paid_early_access requires a live Stripe secret key after founder approval",
          503,
        );
      }
      if (mode === "test" && !stripeKey.startsWith("sk_test_")) {
        return apiError("test_key_required", "test commercial mode requires a Stripe test secret key", 503);
      }

      const session = await ensureSession(service, clientSessionId);
      if (!session.customer_id) return apiError("email_required", "Submit email first");
      const { data: customer } = await service
        .from("memories_customers")
        .select("*")
        .eq("id", session.customer_id)
        .single();
      if (!customer) return apiError("customer_missing", "Customer not found", 404);

      const idempotencyKey = asString(body.idempotency_key) || `memories_${session.id}_${plan.key}`;
      const publicToken = generatePublicToken();
      const tokenHash = await sha256Hex(publicToken);

      const { data: order, error } = await service
        .from("memories_orders")
        .insert({
          public_token_hash: tokenHash,
          public_token_ciphertext: await encryptPublicToken(publicToken),
          session_id: session.id,
          customer_id: customer.id,
          email: customer.email,
          email_normalized: customer.email_normalized,
          plan_key: plan.key,
          plan_sku: plan.sku,
          amount_cents: plan.amountCents,
          currency: "usd",
          status: "awaiting_payment",
          payment_status: "pending",
          commercial_mode: mode,
          stripe_price_id: priceId,
          fulfillment_status: "early_access_pending",
          is_test: mode === "test",
          is_live_charge: mode === "paid_early_access",
          utm_source: session.utm_source,
          utm_medium: session.utm_medium,
          utm_campaign: session.utm_campaign,
        })
        .select("*")
        .single();
      if (error) throw error;

      let stripeCustomerId = asString(customer.stripe_customer_id);
      if (!stripeCustomerId) {
        const params = new URLSearchParams();
        params.set("email", customer.email);
        params.set("metadata[product_family]", MEMORIES_PRODUCT_FAMILY);
        params.set("metadata[memories_customer_id]", customer.id);
        const custRes = await fetch("https://api.stripe.com/v1/customers", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${stripeKey}`,
            "Stripe-Version": STRIPE_API_VERSION,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: params,
        });
        const custJson = await custRes.json();
        if (!custRes.ok) {
          return apiError("stripe_customer_failed", custJson.error?.message || "Stripe customer error", 502);
        }
        stripeCustomerId = asString(custJson.id);
        await service
          .from("memories_customers")
          .update({ stripe_customer_id: stripeCustomerId, updated_at: new Date().toISOString() })
          .eq("id", customer.id);
      }

      const successUrl = `${siteOrigin()}/memories/success?token=${encodeURIComponent(publicToken)}&session_id={CHECKOUT_SESSION_ID}`;
      const cancelUrl = `${siteOrigin()}/memories/plans?checkout=canceled`;
      const params = new URLSearchParams();
      params.set("mode", "subscription");
      params.set("customer", stripeCustomerId);
      params.set("line_items[0][price]", priceId);
      params.set("line_items[0][quantity]", "1");
      params.set("success_url", successUrl);
      params.set("cancel_url", cancelUrl);
      params.set("client_reference_id", order.id);
      params.set("metadata[product_family]", MEMORIES_PRODUCT_FAMILY);
      params.set("metadata[product_type]", MEMORIES_PRODUCT_TYPE);
      params.set("metadata[order_id]", order.id);
      params.set("metadata[plan_key]", plan.key);
      params.set("metadata[sku]", plan.sku);
      params.set("metadata[amount_cents]", String(plan.amountCents));
      params.set("metadata[commercial_mode]", mode);
      params.set("subscription_data[metadata][product_family]", MEMORIES_PRODUCT_FAMILY);
      params.set("subscription_data[metadata][product_type]", MEMORIES_PRODUCT_TYPE);
      params.set("subscription_data[metadata][order_id]", order.id);
      params.set("subscription_data[metadata][plan_key]", plan.key);
      params.set("subscription_data[metadata][sku]", plan.sku);
      params.set("allow_promotion_codes", "false");

      const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${stripeKey}`,
          "Stripe-Version": STRIPE_API_VERSION,
          "Content-Type": "application/x-www-form-urlencoded",
          "Idempotency-Key": idempotencyKey.slice(0, 255),
        },
        body: params,
      });
      const sessionJson = await stripeRes.json();
      if (!stripeRes.ok) {
        await service
          .from("memories_orders")
          .update({ status: "failed", last_error: sessionJson.error?.message || "checkout_failed" })
          .eq("id", order.id);
        return apiError("checkout_failed", sessionJson.error?.message || "Stripe checkout failed", 502);
      }

      await service
        .from("memories_orders")
        .update({
          stripe_checkout_session_id: asString(sessionJson.id),
          stripe_customer_id: stripeCustomerId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", order.id);

      await service
        .from("memories_funnel_sessions")
        .update({ step: "checkout", updated_at: new Date().toISOString() })
        .eq("id", session.id);

      return jsonResponse({
        ok: true,
        mode,
        charged: true,
        orderId: order.id,
        publicToken,
        checkoutSessionId: sessionJson.id,
        url: sessionJson.url,
      });
    }

    if (action === "order_status") {
      const publicToken = asString(body.public_token || body.token);
      if (!publicToken) return apiError("token_required", "token required");
      const hash = await sha256Hex(publicToken);
      const { data: order, error } = await service
        .from("memories_orders")
        .select(
          "id, plan_key, plan_sku, amount_cents, currency, status, payment_status, commercial_mode, fulfillment_status, paid_at, stripe_subscription_id, is_test, is_live_charge, created_at",
        )
        .eq("public_token_hash", hash)
        .maybeSingle();
      if (error) throw error;
      if (!order) return apiError("not_found", "Order not found", 404);

      let subscription = null;
      if (order.stripe_subscription_id) {
        const { data: sub } = await service
          .from("memories_subscriptions")
          .select(
            "status, cancel_at_period_end, current_period_end, amount_cents, currency, is_test, is_live_charge",
          )
          .eq("stripe_subscription_id", order.stripe_subscription_id)
          .maybeSingle();
        subscription = sub;
      }

      return jsonResponse({
        ok: true,
        order,
        subscription,
        productAvailable: false,
        // Never treat redirect alone as paid
        paymentVerified: order.payment_status === "paid" && Boolean(order.paid_at),
      });
    }

    if (action === "billing_portal") {
      const publicToken = asString(body.public_token || body.token);
      const hash = await sha256Hex(publicToken);
      const { data: order } = await service
        .from("memories_orders")
        .select("stripe_customer_id")
        .eq("public_token_hash", hash)
        .maybeSingle();
      if (!order?.stripe_customer_id) return apiError("no_customer", "No Stripe customer on this order", 404);
      const stripeKey = asString(Deno.env.get("STRIPE_SECRET_KEY"));
      if (!stripeKey) return apiError("stripe_unconfigured", "STRIPE_SECRET_KEY is not configured", 503);
      const params = new URLSearchParams();
      params.set("customer", order.stripe_customer_id);
      params.set("return_url", `${siteOrigin()}/memories/success?token=${encodeURIComponent(publicToken)}`);
      const portalRes = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${stripeKey}`,
          "Stripe-Version": STRIPE_API_VERSION,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params,
      });
      const portalJson = await portalRes.json();
      if (!portalRes.ok) {
        return apiError("portal_failed", portalJson.error?.message || "Billing portal failed", 502);
      }
      return jsonResponse({ ok: true, url: portalJson.url });
    }

    if (action === "cancel_subscription") {
      const publicToken = asString(body.public_token || body.token);
      const hash = await sha256Hex(publicToken);
      const { data: order } = await service
        .from("memories_orders")
        .select("id, stripe_subscription_id")
        .eq("public_token_hash", hash)
        .maybeSingle();
      if (!order?.stripe_subscription_id) {
        return apiError("no_subscription", "No subscription on this order", 404);
      }
      const stripeKey = asString(Deno.env.get("STRIPE_SECRET_KEY"));
      if (!stripeKey) return apiError("stripe_unconfigured", "STRIPE_SECRET_KEY is not configured", 503);
      const params = new URLSearchParams();
      params.set("cancel_at_period_end", "true");
      const stripeRes = await fetch(
        `https://api.stripe.com/v1/subscriptions/${order.stripe_subscription_id}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${stripeKey}`,
            "Stripe-Version": STRIPE_API_VERSION,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: params,
        },
      );
      const sub = await stripeRes.json();
      if (!stripeRes.ok) return apiError("cancel_failed", sub.error?.message || "Cancel failed", 502);
      await service
        .from("memories_subscriptions")
        .update({
          cancel_at_period_end: true,
          status: asString(sub.status) || "active",
          updated_at: new Date().toISOString(),
        })
        .eq("stripe_subscription_id", order.stripe_subscription_id);
      return jsonResponse({
        ok: true,
        status: sub.status,
        cancel_at_period_end: true,
        current_period_end: sub.current_period_end
          ? new Date(sub.current_period_end * 1000).toISOString()
          : null,
      });
    }

    return apiError("unknown_action", `Unknown action: ${action || "(none)"}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === "invalid_email") return apiError("invalid_email", "Enter a valid email address");
    if (message === "processing_consent_required") {
      return apiError("processing_consent_required", "Consent to process uploaded materials is required");
    }
    if (message === "authority_ack_required") {
      return apiError(
        "authority_ack_required",
        "You must acknowledge that you have authority to upload and use these materials",
      );
    }
    if (message === "invalid_session") return apiError("invalid_session", "Invalid funnel session");
    return apiError("server_error", message, 500);
  }
});
