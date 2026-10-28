/**
 * Santa Voice Call runtime API:
 * resolve | start | heartbeat | end | mint (provider credentials)
 * Admin: resend_email | revoke | reissue | stats (requires admin JWT)
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";
import { asString, isUuid, sha256Hex } from "../_shared/christmas/crypto.ts";
import {
  fulfillSantaVoiceCallExtensionOrder,
  fulfillSantaVoiceCallOrder,
} from "../_shared/christmas/santaCallFulfill.ts";
import {
  estimateCallCostUsd,
  mintSantaCallCredentials,
  resolveSantaCallProvider,
  santaCallKillSwitchActive,
  type SantaCallProviderId,
} from "../_shared/christmas/santaCallProviders.ts";
import {
  isSantaStripeTestOrderMeta,
  resolveSantaStripeCredentials,
  resolveSantaStripeModeEnv,
  stripeFormPost,
  stripeGet,
  type SantaStripeMode,
} from "../_shared/christmas/santaStripe.ts";
import {
  normalizeSantaCallMarket,
  resolveSantaCallCharge,
  type SantaCallMarket,
} from "../_shared/christmas/santaCallPricing.ts";
import { assertRateLimit, clientIp } from "../_shared/rateLimit.ts";

const INITIAL_SECONDS = 180;
const INITIAL_PRODUCT_KEY = "christmas_santa_voice_call";
const INITIAL_PRICING_KEY = "xmas_santa_voice_call";
const EXTENSION_SECONDS = 300;
const EXTENSION_PRODUCT_KEY = "christmas_santa_voice_call_extension";
const EXTENSION_PRICING_KEY = "xmas_santa_voice_call_extension";

function timingSafeEqual(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function qaSecretOk(req: Request): boolean {
  const expected = asString(Deno.env.get("CHRISTMAS_SANTA_CALL_QA_SECRET"));
  if (!expected || expected.length < 16) return false;
  const got = asString(req.headers.get("x-santa-qa-secret"));
  return timingSafeEqual(got, expected);
}

/** Parent iPhone QA page token (expiring). Distinct from automation X-Santa-QA-Secret. */
function qaPageAccessOk(req: Request, body: Record<string, unknown>): boolean {
  const expected = asString(Deno.env.get("CHRISTMAS_SANTA_CALL_QA_PAGE_TOKEN"));
  if (!expected || expected.length < 16) return false;
  const expiresRaw = asString(Deno.env.get("CHRISTMAS_SANTA_CALL_QA_PAGE_EXPIRES_AT"));
  if (expiresRaw) {
    const exp = Date.parse(expiresRaw);
    if (!Number.isFinite(exp) || Date.now() > exp) return false;
  }
  const got = asString(req.headers.get("x-santa-qa-page-access")) || asString(body.page_access) ||
    asString(body.access);
  return timingSafeEqual(got, expected);
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

function siteOrigin(): string {
  return (
    Deno.env.get("SITE_URL") ||
    Deno.env.get("PUBLIC_SITE_URL") ||
    "https://www.thedigitalgifter.com"
  ).replace(/\/$/, "");
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function serviceClient() {
  const url = Deno.env.get("SUPABASE_URL") || "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  return createClient(url, key, { auth: { persistSession: false } });
}

async function requireAdmin(req: Request): Promise<boolean> {
  const auth = req.headers.get("Authorization") || "";
  const jwt = auth.replace(/^Bearer\s+/i, "").trim();
  if (!jwt) return false;
  const url = Deno.env.get("SUPABASE_URL") || "";
  const anon = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const userClient = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false },
  });
  const { data: userData } = await userClient.auth.getUser();
  const email = asString(userData.user?.email).toLowerCase();
  if (!email) return false;
  const service = serviceClient();
  const { data } = await service.from("admin_users").select("email").eq("email", email).maybeSingle();
  return Boolean(data?.email);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const action = asString(body.action);
    const service = serviceClient();
    const ip = clientIp(req);

    if (
      santaCallKillSwitchActive() &&
      !["stats", "resolve", "confirm_checkout", "poll_extension"].includes(action)
    ) {
      // resolve/confirm still allowed so paid Safari returns can recover entitlements
      return json({ error: "Santa Call is temporarily disabled", code: "kill_switch" }, 503);
    }

    if (action === "resolve") {
      const token = asString(body.access_token);
      if (!token || token.length < 24) return json({ ok: false, code: "invalid_token" }, 400);
      const ok = await assertRateLimit(service, `santa_call_resolve:${ip}`, 60, 60);
      if (!ok) return json({ error: "rate_limited", code: "rate_limited" }, 429);
      const hash = await sha256Hex(token);
      const { data, error } = await service.rpc("resolve_christmas_santa_call_access", {
        p_access_token_hash: hash,
      });
      if (error) return json({ error: error.message }, 500);
      return json(data);
    }

    if (action === "start") {
      const token = asString(body.access_token);
      if (!token) return json({ error: "access_token required", code: "invalid_token" }, 400);
      const ok = await assertRateLimit(service, `santa_call_start:${ip}`, 10, 60);
      if (!ok) return json({ error: "rate_limited", code: "rate_limited" }, 429);
      if (santaCallKillSwitchActive()) {
        return json({ error: "Santa Call is temporarily disabled", code: "kill_switch" }, 503);
      }

      const hash = await sha256Hex(token);
      const fingerprint = asString(body.client_fingerprint) || null;
      const fingerprintHash = fingerprint ? await sha256Hex(fingerprint) : null;

      const { data: resolved } = await service.rpc("resolve_christmas_santa_call_access", {
        p_access_token_hash: hash,
      });
      const resolvedObj = (resolved || {}) as Record<string, unknown>;
      if (resolvedObj.ok !== true) return json(resolvedObj, 403);

      const provider = resolveSantaCallProvider(asString(body.provider) || asString(resolvedObj.provider_preference));
      const { data: began, error: beginError } = await service.rpc("begin_christmas_santa_call_session", {
        p_access_token_hash: hash,
        p_provider: provider,
        p_client_fingerprint_hash: fingerprintHash,
        p_provider_session_id: null,
      });
      if (beginError) return json({ error: beginError.message }, 500);
      const beganObj = (began || {}) as Record<string, unknown>;
      if (beganObj.ok !== true) return json(beganObj, 409);

      const resumeMode = beganObj.resume_mode === true;
      const child = {
        childFirstName: asString(beganObj.child_first_name) || asString(resolvedObj.child_first_name),
        language: (asString(beganObj.language) || asString(resolvedObj.language) || "en") as "en" | "ro",
        age: beganObj.age == null ? null : Number(beganObj.age),
        christmasWish: asString(beganObj.christmas_wish) || null,
        hobbies: asString(beganObj.hobbies) || null,
        petName: asString(beganObj.pet_name) || null,
        positiveDetail: asString(beganObj.positive_detail) || null,
        resumeSummary: resumeMode ? asString(beganObj.resume_summary) || null : null,
        resumeMode,
      };

      const remaining = Number(beganObj.remaining_seconds || resolvedObj.remaining_seconds || 180);
      const mint = await mintSantaCallCredentials({
        provider,
        child,
        remainingSeconds: remaining,
        resumeMode,
        safetyIdentifier: await sha256Hex(`santa-call:${asString(beganObj.order_id)}`),
      });
      if (!mint.ok) {
        await service.rpc("end_christmas_santa_call_session", {
          p_session_id: beganObj.session_id,
          p_access_token_hash: hash,
          p_seconds_elapsed: 0,
          p_reason: "provider_mint_failed",
          p_keep_remaining: true,
          p_error_code: mint.code,
        });
        return json({ error: mint.message, code: mint.code }, 503);
      }

      await service
        .from("christmas_santa_call_sessions")
        .update({
          provider_session_id: mint.creds.clientSecret.slice(0, 64),
          status: "connecting",
        })
        .eq("id", beganObj.session_id);

      return json({
        ok: true,
        sessionId: beganObj.session_id,
        remainingSeconds: remaining,
        resumed: beganObj.resumed === true,
        resumeMode,
        provider: mint.creds.provider,
        clientSecret: mint.creds.clientSecret,
        model: mint.creds.model,
        bootstrap: mint.creds.bootstrap,
        childFirstName: child.childFirstName,
        language: child.language,
        killSwitch: false,
      });
    }

    if (action === "heartbeat") {
      const token = asString(body.access_token);
      const sessionId = asString(body.session_id);
      if (!token || !isUuid(sessionId)) return json({ error: "invalid_request" }, 400);
      const hash = await sha256Hex(token);
      const seconds = Math.max(0, Math.min(600, Number(body.seconds_elapsed) || 0));
      const { data, error } = await service.rpc("heartbeat_christmas_santa_call_session", {
        p_session_id: sessionId,
        p_access_token_hash: hash,
        p_seconds_elapsed: seconds,
        p_ui_status: asString(body.ui_status) || null,
      });
      if (error) return json({ error: error.message }, 500);
      const result = (data || {}) as Record<string, unknown>;

      // At wrap-up window, optionally remint is client-driven; server only signals.
      return json(result);
    }

    if (action === "end") {
      const token = asString(body.access_token);
      const sessionId = asString(body.session_id);
      if (!token || !isUuid(sessionId)) return json({ error: "invalid_request" }, 400);
      const hash = await sha256Hex(token);
      const seconds = Math.max(0, Math.min(600, Number(body.seconds_elapsed) || 0));
      const provider = (asString(body.provider) || "openai_realtime") as SantaCallProviderId;
      const estimate = estimateCallCostUsd({ provider, seconds });
      const reason = asString(body.reason) || "user_hangup";
      const { data, error } = await service.rpc("end_christmas_santa_call_session", {
        p_session_id: sessionId,
        p_access_token_hash: hash,
        p_seconds_elapsed: seconds,
        p_reason: reason,
        p_keep_remaining: body.keep_remaining === true,
        p_error_code: asString(body.error_code) || null,
        p_cost_usd: estimate.costUsd,
        p_cost_metadata: { ...estimate, client: body.cost_metadata || {} },
      });
      if (error) return json({ error: error.message }, 500);

      const endResult = (data || {}) as Record<string, unknown>;
      // Minimal resume notes only — never full transcript / audio.
      if (endResult.extension_available === true || reason === "duration_limit") {
        const summary = asString(body.resume_summary).slice(0, 600);
        if (summary) {
          await service.rpc("save_christmas_santa_call_resume_context", {
            p_access_token_hash: hash,
            p_summary: summary,
            p_language: asString(body.resume_language) || null,
          });
        }
      }
      return json(endResult);
    }

    if (action === "save_resume") {
      const token = asString(body.access_token);
      if (!token) return json({ error: "access_token required", code: "invalid_token" }, 400);
      const hash = await sha256Hex(token);
      const { data, error } = await service.rpc("save_christmas_santa_call_resume_context", {
        p_access_token_hash: hash,
        p_summary: asString(body.resume_summary).slice(0, 600),
        p_language: asString(body.resume_language) || null,
      });
      if (error) return json({ error: error.message }, 500);
      return json(data);
    }

    if (action === "create_extension_checkout") {
      const token = asString(body.access_token);
      if (!token) return json({ error: "access_token required", code: "invalid_token" }, 400);
      const ok = await assertRateLimit(service, `santa_call_ext_checkout:${ip}`, 8, 60);
      if (!ok) return json({ error: "rate_limited", code: "rate_limited" }, 429);
      if (santaCallKillSwitchActive()) {
        return json({ error: "Santa Call is temporarily disabled", code: "kill_switch" }, 503);
      }

      const hash = await sha256Hex(token);
      const { data: resolved } = await service.rpc("resolve_christmas_santa_call_access", {
        p_access_token_hash: hash,
      });
      const resolvedObj = (resolved || {}) as Record<string, unknown>;
      if (resolvedObj.code !== "awaiting_extension" && resolvedObj.extension_available !== true) {
        return json(
          { ok: false, code: asString(resolvedObj.code) || "extension_unavailable" },
          403,
        );
      }
      const entitlementId = asString(resolvedObj.entitlement_id);
      if (!isUuid(entitlementId)) {
        return json({ ok: false, code: "missing_entitlement" }, 400);
      }

      const { data: ent } = await service
        .from("christmas_santa_call_entitlements")
        .select("id,order_id")
        .eq("id", entitlementId)
        .maybeSingle();
      const parentOrderId = asString(ent?.order_id);
      const { data: parentOrder } = parentOrderId
        ? await service
            .from("christmas_orders")
            .select("email,locale,currency,amount_cents,metadata,commercial_snapshot")
            .eq("id", parentOrderId)
            .maybeSingle()
        : { data: null };
      const parentMeta = (parentOrder?.metadata || {}) as Record<string, unknown>;
      const parentSnap = (parentOrder?.commercial_snapshot || {}) as Record<string, unknown>;
      // Extension inherits parent market — never silent currency switch after initial checkout.
      const market: SantaCallMarket = normalizeSantaCallMarket(
        parentMeta.santa_call_market ||
          parentMeta.market ||
          parentSnap.santa_call_market ||
          parentSnap.market ||
          parentOrder?.currency ||
          "ro",
      );
      const charge = resolveSantaCallCharge({
        market,
        kind: "extension",
        clientAmountCents: body.amount_cents,
        clientCurrency: body.currency,
      });
      if (!charge.ok) {
        return json({ ok: false, code: charge.code, message: charge.message }, 409);
      }
      const amountCents = charge.amountCents;
      const currency = charge.currency;

      const parentStripeMode: SantaStripeMode = isSantaStripeTestOrderMeta(parentMeta) ||
          resolveSantaStripeModeEnv() === "test"
        ? "test"
        : "live";

      // Commercial LIVE extension checkout stays gated — QA uses TEST path only while LIVE_PRODUCTS empty.
      if (parentStripeMode === "live") {
        const liveAllow = asString(Deno.env.get("CHRISTMAS_LIVE_PRODUCTS"))
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        if (!liveAllow.includes(INITIAL_PRODUCT_KEY)) {
          return json({
            ok: false,
            code: "live_extension_disabled",
            message: "Santa LIVE extension checkout is disabled. Use TEST isolation for QA.",
          }, 403);
        }
      }

      const stripe = resolveSantaStripeCredentials(parentStripeMode);
      if (!stripe.ok) return json({ ok: false, code: stripe.code, message: stripe.message }, 503);
      const { creds } = stripe;

      const email = asString(parentOrder?.email).toLowerCase();
      const qaBase = asString(Deno.env.get("CHRISTMAS_SANTA_CALL_QA_ORIGIN")) ||
        `${siteOrigin()}/_qa/santa-private`;
      const returnBase =
        asString(body.success_url) ||
        (creds.mode === "test"
          ? `${qaBase.replace(/\/$/, "")}/santa/call/${encodeURIComponent(token)}?extension=return`
          : `${siteOrigin()}/santa/call/${encodeURIComponent(token)}?extension=return`);

      const { data: extOrder, error: orderError } = await service
        .from("christmas_orders")
        .insert({
          public_token_hash: await sha256Hex(`ext:${entitlementId}:${crypto.randomUUID()}`),
          product_key: EXTENSION_PRODUCT_KEY,
          payment_status: "pending",
          fulfillment_status: "not_started",
          email: email || null,
          email_normalized: email || null,
          locale: asString(parentOrder?.locale) || asString(resolvedObj.language) || "ro",
          amount_cents: amountCents,
          currency,
          package_key: "extension_5min",
          pricing_key: EXTENSION_PRICING_KEY,
          charged_amount_cents: amountCents,
          sku: EXTENSION_PRICING_KEY,
          commercial_snapshot: {
            commercial_key: EXTENSION_PRICING_KEY,
            amount_cents: amountCents,
            currency,
            market,
            santa_call_market: market,
            seconds: EXTENSION_SECONDS,
            stripe_mode: creds.mode,
          },
          metadata: {
            source: "santa_call_extension",
            parent_entitlement_id: entitlementId,
            parent_order_id: parentOrderId || null,
            access_token_hint_hash: hash.slice(0, 16),
            stripe_mode: creds.mode,
            santa_qa: creds.mode === "test",
            market,
            santa_call_market: market,
          },
        })
        .select("id")
        .single();
      if (orderError || !extOrder) {
        console.error("extension order insert", orderError?.message);
        return json({ ok: false, code: "order_create_failed" }, 500);
      }

      const useCustom = Boolean(creds.publishableKey);
      const params = new URLSearchParams();
      params.set("mode", "payment");
      if (useCustom) {
        params.set("ui_mode", "custom");
        const returnUrl = returnBase.includes("{CHECKOUT_SESSION_ID}")
          ? returnBase
          : `${returnBase}${returnBase.includes("?") ? "&" : "?"}session_id={CHECKOUT_SESSION_ID}`;
        params.set("return_url", returnUrl);
      } else {
        // Hosted Checkout UI — no publishable key required; Safari-friendly redirect.
        params.set(
          "success_url",
          returnBase.includes("{CHECKOUT_SESSION_ID}")
            ? returnBase
            : `${returnBase}${returnBase.includes("?") ? "&" : "?"}session_id={CHECKOUT_SESSION_ID}`,
        );
        params.set(
          "cancel_url",
          `${returnBase}${returnBase.includes("?") ? "&" : "?"}extension=cancel`,
        );
      }
      if (email) params.set("customer_email", email);
      params.set("line_items[0][quantity]", "1");
      params.set("line_items[0][price_data][currency]", currency);
      params.set("line_items[0][price_data][unit_amount]", String(amountCents));
      params.set("line_items[0][price_data][product_data][name]", "Santa Call +5 minutes");
      params.set("metadata[product_family]", "christmas");
      params.set("metadata[product_type]", "christmas");
      params.set("metadata[product_key]", EXTENSION_PRODUCT_KEY);
      params.set("metadata[package_key]", "extension_5min");
      params.set("metadata[commercial_key]", EXTENSION_PRICING_KEY);
      params.set("metadata[sku]", EXTENSION_PRICING_KEY);
      params.set("metadata[christmas_order_id]", extOrder.id);
      params.set("metadata[parent_entitlement_id]", entitlementId);
      params.set("metadata[stripe_mode]", creds.mode);
      params.set("metadata[santa_qa]", creds.mode === "test" ? "true" : "false");
      params.set("metadata[santa_call_market]", market);
      params.set("metadata[market]", market);

      const stripeRes = await stripeFormPost(creds.secretKey, "/checkout/sessions", params);
      if (!stripeRes.ok) {
        console.error("stripe extension checkout", stripeRes.status, JSON.stringify(stripeRes.body).slice(0, 400));
        return json({ ok: false, code: "stripe_session_failed", stripe_mode: creds.mode }, 502);
      }
      const clientSecret = asString(stripeRes.body.client_secret);
      const checkoutUrl = asString(stripeRes.body.url);
      const sessionId = asString(stripeRes.body.id);
      const livemode = stripeRes.body.livemode === true;
      if (!sessionId || (useCustom && !clientSecret) || (!useCustom && !checkoutUrl)) {
        return json({ ok: false, code: "stripe_session_failed" }, 502);
      }
      if (creds.mode === "test" && livemode) {
        return json({ ok: false, code: "stripe_mode_mismatch", message: "Expected TEST session" }, 502);
      }
      if (creds.mode === "live" && !livemode) {
        return json({ ok: false, code: "stripe_mode_mismatch", message: "Expected LIVE session" }, 502);
      }

      await service
        .from("christmas_orders")
        .update({ stripe_checkout_session_id: sessionId })
        .eq("id", extOrder.id);

      return json({
        ok: true,
        orderId: extOrder.id,
        stripeMode: creds.mode,
        livemode,
        checkoutMode: useCustom ? "custom" : "hosted",
        clientSecret: clientSecret || null,
        publishableKey: creds.publishableKey,
        checkoutUrl: checkoutUrl || null,
        amountCents,
        currency,
        market,
        extensionSeconds: EXTENSION_SECONDS,
      });
    }

    // Protected QA-only: create initial Stripe TEST Checkout (RO/US market map).
    // Automation: X-Santa-QA-Secret. Parent iPhone QA: X-Santa-QA-Page-Access / page_access.
    if (action === "create_qa_checkout" || action === "create_parent_test_checkout") {
      const parentPage = action === "create_parent_test_checkout" || qaPageAccessOk(req, body as Record<string, unknown>);
      const automation = qaSecretOk(req);
      if (!automation && !qaPageAccessOk(req, body as Record<string, unknown>)) {
        return json({ error: "forbidden", code: "qa_forbidden" }, 403);
      }
      if (resolveSantaStripeModeEnv() !== "test") {
        return json({ ok: false, code: "qa_requires_test_mode" }, 403);
      }
      const ok = await assertRateLimit(
        service,
        parentPage && !automation ? `santa_call_parent_qa:${ip}` : `santa_call_qa_checkout:${ip}`,
        parentPage && !automation ? 8 : 6,
        60,
      );
      if (!ok) return json({ error: "rate_limited", code: "rate_limited" }, 429);

      const stripe = resolveSantaStripeCredentials("test");
      if (!stripe.ok) return json({ ok: false, code: stripe.code, message: stripe.message }, 503);
      const { creds } = stripe;

      const childFirstName = asString(body.child_first_name) || "Andrei";
      const language = asString(body.language) === "en" ? "en" : "ro";
      const market = normalizeSantaCallMarket(
        body.market || body.santa_market || body.currency || (language === "en" ? "us" : "ro"),
      );
      const charge = resolveSantaCallCharge({
        market,
        kind: "initial",
        clientAmountCents: body.amount_cents,
        clientCurrency: body.currency,
      });
      if (!charge.ok) {
        return json({ ok: false, code: charge.code, message: charge.message }, 409);
      }
      const email = (asString(body.email) || "santa-qa@thedigitalgifter.invalid").toLowerCase();
      if (action === "create_parent_test_checkout" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return json({ ok: false, code: "email_required" }, 400);
      }
      const accessToken = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
      const tokenHash = await sha256Hex(accessToken);
      const qaBase = (asString(Deno.env.get("CHRISTMAS_SANTA_CALL_QA_CALL_ORIGIN")) ||
        asString(Deno.env.get("CHRISTMAS_SANTA_CALL_QA_ORIGIN")) ||
        `${siteOrigin()}/_qa/santa-qa`).replace(/\/$/, "");
      const pageAccess = asString(req.headers.get("x-santa-qa-page-access")) || asString(body.page_access) ||
        asString(body.access);
      const accessQs = pageAccess ? `&access=${encodeURIComponent(pageAccess)}` : "";
      const successUrl =
        asString(body.success_url) ||
        `${qaBase}/santa/call/${encodeURIComponent(accessToken)}?checkout=success${accessQs}&session_id={CHECKOUT_SESSION_ID}`;
      const cancelUrl =
        asString(body.cancel_url) ||
        `${qaBase}/christmas/santa-call?checkout=cancel${accessQs}`;

      const { data: order, error: orderError } = await service
        .from("christmas_orders")
        .insert({
          public_token_hash: await sha256Hex(`qa:${crypto.randomUUID()}`),
          product_key: INITIAL_PRODUCT_KEY,
          payment_status: "pending",
          fulfillment_status: "not_started",
          email,
          email_normalized: email,
          locale: language,
          amount_cents: charge.amountCents,
          currency: charge.currency,
          package_key: "single",
          pricing_key: INITIAL_PRICING_KEY,
          charged_amount_cents: charge.amountCents,
          sku: INITIAL_PRICING_KEY,
          commercial_snapshot: {
            commercial_key: INITIAL_PRICING_KEY,
            amount_cents: charge.amountCents,
            currency: charge.currency,
            market: charge.market,
            santa_call_market: charge.market,
            stripe_mode: "test",
          },
          metadata: {
            source: "santa_call_qa_checkout",
            stripe_mode: "test",
            santa_qa: true,
            santa_call_token_hint: accessToken,
            market: charge.market,
            santa_call_market: charge.market,
          },
        })
        .select("id")
        .single();
      if (orderError || !order) {
        console.error("qa order insert", orderError?.message);
        return json({ ok: false, code: "order_create_failed" }, 500);
      }

      const { data: profile, error: profileError } = await service
        .from("christmas_santa_call_profiles")
        .insert({
          order_id: order.id,
          child_first_name: childFirstName.slice(0, 40),
          language,
          age: body.age == null ? 7 : Number(body.age),
          christmas_wish: asString(body.christmas_wish).slice(0, 160) || "un tren",
          hobbies: asString(body.hobbies).slice(0, 120) || "dinozauri",
          positive_detail: asString(body.positive_detail).slice(0, 160) || "a fost bun cu bunica",
          guardian_consent: true,
          consent_version: "santa_call_v2_2026_10",
          consented_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (profileError || !profile) {
        return json({ ok: false, code: "profile_create_failed" }, 500);
      }

      await service.from("christmas_santa_call_entitlements").insert({
        order_id: order.id,
        profile_id: profile.id,
        access_token_hash: tokenHash,
        status: "pending_payment",
        expires_at: new Date(Date.now() + 14 * 86400000).toISOString(),
        remaining_seconds: INITIAL_SECONDS,
        max_duration_seconds: INITIAL_SECONDS,
      });

      const useCustom = Boolean(creds.publishableKey);
      const params = new URLSearchParams();
      params.set("mode", "payment");
      if (useCustom) {
        params.set("ui_mode", "custom");
        params.set("return_url", successUrl.includes("{CHECKOUT_SESSION_ID}") ? successUrl : `${successUrl}&session_id={CHECKOUT_SESSION_ID}`);
      } else {
        params.set("success_url", successUrl);
        params.set("cancel_url", cancelUrl);
      }
      params.set("customer_email", email);
      params.set("line_items[0][quantity]", "1");
      params.set("line_items[0][price_data][currency]", charge.currency);
      params.set("line_items[0][price_data][unit_amount]", String(charge.amountCents));
      params.set("line_items[0][price_data][product_data][name]", "Call Santa Claus — QA TEST");
      params.set("metadata[product_family]", "christmas");
      params.set("metadata[product_type]", "christmas");
      params.set("metadata[product_key]", INITIAL_PRODUCT_KEY);
      params.set("metadata[package_key]", "single");
      params.set("metadata[commercial_key]", INITIAL_PRICING_KEY);
      params.set("metadata[sku]", INITIAL_PRICING_KEY);
      params.set("metadata[christmas_order_id]", order.id);
      params.set("metadata[stripe_mode]", "test");
      params.set("metadata[santa_qa]", "true");
      params.set("metadata[santa_call_market]", charge.market);
      params.set("metadata[market]", charge.market);

      const stripeRes = await stripeFormPost(creds.secretKey, "/checkout/sessions", params);
      if (!stripeRes.ok) {
        console.error("stripe qa checkout", stripeRes.status, JSON.stringify(stripeRes.body).slice(0, 400));
        return json({ ok: false, code: "stripe_session_failed" }, 502);
      }
      const sessionId = asString(stripeRes.body.id);
      const checkoutUrl = asString(stripeRes.body.url);
      const clientSecret = asString(stripeRes.body.client_secret);
      if (!sessionId || stripeRes.body.livemode === true) {
        return json({ ok: false, code: "stripe_mode_mismatch" }, 502);
      }
      await service.from("christmas_orders").update({ stripe_checkout_session_id: sessionId }).eq("id", order.id);

      return json({
        ok: true,
        orderId: order.id,
        stripeMode: "test",
        livemode: false,
        checkoutMode: useCustom ? "custom" : "hosted",
        checkoutUrl: checkoutUrl || null,
        clientSecret: clientSecret || null,
        publishableKey: creds.publishableKey,
        amountCents: charge.amountCents,
        currency: charge.currency,
        market: charge.market,
        accessToken,
        callPath: `/santa/call/${accessToken}`,
      });
    }

    // Protected QA-only: jump a paid TEST entitlement to awaiting_extension without waiting 180s.
    // Does NOT grant free minutes, does NOT skip Stripe, does NOT change commercial max_duration.
    if (action === "qa_force_awaiting_extension") {
      if (!qaSecretOk(req)) return json({ error: "forbidden", code: "qa_forbidden" }, 403);
      if (resolveSantaStripeModeEnv() !== "test") {
        return json({ ok: false, code: "qa_requires_test_mode" }, 403);
      }
      const token = asString(body.access_token);
      if (!token) return json({ error: "access_token required", code: "invalid_token" }, 400);
      const ok = await assertRateLimit(service, `santa_call_qa_force_ext:${ip}`, 10, 60);
      if (!ok) return json({ error: "rate_limited", code: "rate_limited" }, 429);

      const hash = await sha256Hex(token);
      const { data: ent, error: entErr } = await service
        .from("christmas_santa_call_entitlements")
        .select("id,status,remaining_seconds,order_id")
        .eq("access_token_hash", hash)
        .maybeSingle();
      if (entErr || !ent) return json({ ok: false, code: "invalid_token" }, 404);

      const { data: extRows } = await service
        .from("christmas_santa_call_extensions")
        .select("id")
        .eq("entitlement_id", ent.id)
        .limit(1);
      if (extRows && extRows.length > 0) {
        return json({ ok: false, code: "extension_already_purchased" }, 403);
      }

      // Close any active session as duration_limit so UI matches a real timer end.
      await service
        .from("christmas_santa_call_sessions")
        .update({
          status: "completed",
          ended_at: new Date().toISOString(),
          end_reason: "duration_limit",
          updated_at: new Date().toISOString(),
        })
        .eq("entitlement_id", ent.id)
        .in("status", ["connecting", "connected", "listening", "speaking", "reconnecting"]);

      const summary =
        asString(body.resume_summary).slice(0, 600) ||
        "Talked about Christmas. Continue warmly without re-greeting.";
      const { data: saved, error: saveErr } = await service.rpc("save_christmas_santa_call_resume_context", {
        p_access_token_hash: hash,
        p_summary: summary,
        p_language: asString(body.resume_language) || "ro",
      });
      if (saveErr) console.error("qa_force resume", saveErr.message);

      const { error: updErr } = await service
        .from("christmas_santa_call_entitlements")
        .update({
          status: "awaiting_extension",
          remaining_seconds: 0,
          updated_at: new Date().toISOString(),
        })
        .eq("id", ent.id);
      if (updErr) return json({ ok: false, code: "force_awaiting_failed", message: updErr.message }, 500);

      const { data: resolved } = await service.rpc("resolve_christmas_santa_call_access", {
        p_access_token_hash: hash,
      });
      return json({
        ok: true,
        forced: true,
        previous_status: ent.status,
        previous_remaining: ent.remaining_seconds,
        resume_saved: Boolean(saved),
        resolve: resolved,
      });
    }

    // Stripe TEST webhook → main DB Santa fulfill only (never uses LIVE webhook secret).
    if (action === "stripe_test_webhook") {
      const testWhsec = asString(Deno.env.get("STRIPE_TEST_WEBHOOK_SECRET"));
      if (!testWhsec.startsWith("whsec_")) {
        return json({ error: "STRIPE_TEST_WEBHOOK_SECRET missing", code: "test_webhook_unconfigured" }, 503);
      }
      // E2E / relay: signed payload provided as JSON { payload, stripe_signature } or raw_body.
      // Direct Stripe Dashboard delivery uses dedicated function santa-call-stripe-test-webhook.
      const payloadText = asString(body.raw_body) ||
        (body.payload != null ? JSON.stringify(body.payload) : "");
      const signature = asString(req.headers.get("stripe-signature")) || asString(body.stripe_signature);
      if (!payloadText || !signature) return json({ error: "missing payload/signature" }, 400);
      const verified = await verifyStripeTestSignature(payloadText, signature, testWhsec);
      if (!verified) return json({ error: "Invalid Stripe TEST signature" }, 400);

      const event = (body.payload && typeof body.payload === "object"
        ? body.payload
        : JSON.parse(payloadText)) as Record<string, unknown>;
      if (event.livemode === true) {
        return json({ ok: false, code: "live_event_rejected_on_test_webhook" }, 400);
      }
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
        productKey !== INITIAL_PRODUCT_KEY &&
        productKey !== EXTENSION_PRODUCT_KEY
      ) {
        return json({ ok: false, code: "not_santa_product" }, 400);
      }
      if (asString(metadata.stripe_mode).toLowerCase() !== "test" && metadata.santa_qa !== true && metadata.santa_qa !== "true") {
        return json({ ok: false, code: "missing_test_stamp" }, 400);
      }

      const { data: ord } = await service
        .from("christmas_orders")
        .select("id,payment_status,product_key,metadata,amount_cents")
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
            result: { status: "ignored_unpaid", payment_status: paymentStatus },
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

        let fulfillResult: Record<string, unknown> = {};
        if (productKey === EXTENSION_PRODUCT_KEY) {
          const out = await fulfillSantaVoiceCallExtensionOrder({
            service,
            orderId,
            stripeCheckoutSessionId: asString(obj.id),
            stripePaymentIntentId: asString(obj.payment_intent),
          });
          fulfillResult = out as unknown as Record<string, unknown>;
        } else {
          const out = await fulfillSantaVoiceCallOrder({ service, orderId });
          fulfillResult = out as unknown as Record<string, unknown>;
        }

        await service.from("processed_stripe_events").insert({
          event_id: eventId,
          event_type: eventType,
          stripe_session_id: asString(obj.id),
          result: { status: "santa_test_fulfilled", product_key: productKey, fulfill: fulfillResult },
        });
        return json({ ok: true, status: "fulfilled", fulfill: fulfillResult, event_id: eventId });
      }

      await service.from("processed_stripe_events").insert({
        event_id: eventId,
        event_type: eventType,
        result: { status: "ignored_event_type" },
      });
      return json({ ok: true, status: "ignored_event_type" });
    }

    if (action === "poll_extension") {
      const token = asString(body.access_token);
      if (!token) return json({ error: "access_token required", code: "invalid_token" }, 400);
      const hash = await sha256Hex(token);
      const { data: resolved } = await service.rpc("resolve_christmas_santa_call_access", {
        p_access_token_hash: hash,
      });
      return json(resolved);
    }

    /**
     * Safari return recovery: verify Checkout Session with Stripe server-side and fulfill
     * if paid. Idempotent with webhook. Never trusts client "success" alone.
     * Covers initial + extension TEST/LIVE using the parent order's stripe_mode stamp.
     */
    if (action === "confirm_checkout") {
      const token = asString(body.access_token);
      if (!token || token.length < 24) return json({ ok: false, code: "invalid_token" }, 400);
      const okRl = await assertRateLimit(service, `santa_call_confirm:${ip}`, 30, 60);
      if (!okRl) return json({ error: "rate_limited", code: "rate_limited" }, 429);

      const hash = await sha256Hex(token);
      const { data: ent } = await service
        .from("christmas_santa_call_entitlements")
        .select("id,status,order_id,remaining_seconds")
        .eq("access_token_hash", hash)
        .maybeSingle();
      if (!ent) return json({ ok: false, code: "invalid_token" }, 404);

      // Already usable — no Stripe round-trip required.
      if (["ready", "in_progress"].includes(asString(ent.status)) && Number(ent.remaining_seconds) > 0) {
        const { data: resolved } = await service.rpc("resolve_christmas_santa_call_access", {
          p_access_token_hash: hash,
        });
        return json({ ok: true, status: "already_ready", resolve: resolved });
      }

      const sessionIdHint = asString(body.session_id) || asString(body.checkout_session_id);

      // Prefer the entitlement's own order; for extensions also accept the paid extension session.
      let orderId = asString(ent.order_id);
      let { data: order } = await service
        .from("christmas_orders")
        .select("id,payment_status,product_key,metadata,amount_cents,currency,stripe_checkout_session_id")
        .eq("id", orderId)
        .maybeSingle();
      if (!order) return json({ ok: false, code: "missing_order" }, 404);

      // Extension return: session_id may belong to a child extension order.
      if (sessionIdHint.startsWith("cs_")) {
        const { data: bySession } = await service
          .from("christmas_orders")
          .select("id,payment_status,product_key,metadata,amount_cents,currency,stripe_checkout_session_id")
          .eq("stripe_checkout_session_id", sessionIdHint)
          .maybeSingle();
        if (bySession) {
          const meta = (bySession.metadata || {}) as Record<string, unknown>;
          const parentEnt = asString(meta.parent_entitlement_id);
          if (
            asString(bySession.product_key) === EXTENSION_PRODUCT_KEY &&
            parentEnt &&
            parentEnt === asString(ent.id)
          ) {
            order = bySession;
            orderId = asString(bySession.id);
          } else if (asString(bySession.id) === asString(ent.order_id)) {
            order = bySession;
            orderId = asString(bySession.id);
          }
        }
      }

      const ordMeta = (order.metadata || {}) as Record<string, unknown>;
      const stripeMode: SantaStripeMode =
        isSantaStripeTestOrderMeta(ordMeta) || resolveSantaStripeModeEnv() === "test" ? "test" : "live";
      const stripe = resolveSantaStripeCredentials(stripeMode);
      if (!stripe.ok) return json({ ok: false, code: stripe.code, message: stripe.message }, 503);

      const sessionId = sessionIdHint.startsWith("cs_")
        ? sessionIdHint
        : asString(order.stripe_checkout_session_id);
      if (!sessionId.startsWith("cs_")) {
        return json({ ok: false, code: "missing_checkout_session", status: asString(ent.status) }, 409);
      }

      const retrieved = await stripeGet(stripe.creds.secretKey, `/checkout/sessions/${encodeURIComponent(sessionId)}`);
      if (!retrieved.ok) {
        return json({ ok: false, code: "stripe_session_retrieve_failed", status: retrieved.status }, 502);
      }
      const session = retrieved.body;
      if (stripeMode === "test" && session.livemode === true) {
        return json({ ok: false, code: "stripe_mode_mismatch" }, 403);
      }
      if (stripeMode === "live" && session.livemode !== true) {
        return json({ ok: false, code: "stripe_mode_mismatch" }, 403);
      }

      const meta = (session.metadata || {}) as Record<string, unknown>;
      const metaOrderId = asString(meta.christmas_order_id);
      if (metaOrderId && metaOrderId !== orderId) {
        return json({ ok: false, code: "session_order_mismatch" }, 403);
      }
      const paymentStatus = asString(session.payment_status);
      if (paymentStatus !== "paid" && paymentStatus !== "no_payment_required") {
        const { data: resolved } = await service.rpc("resolve_christmas_santa_call_access", {
          p_access_token_hash: hash,
        });
        return json({
          ok: false,
          code: "payment_not_completed",
          payment_status: paymentStatus || "unknown",
          stripe_status: asString(session.status),
          resolve: resolved,
        });
      }

      // Mark paid then fulfill (idempotent with webhook path).
      if (asString(order.payment_status) !== "paid") {
        await service
          .from("christmas_orders")
          .update({
            payment_status: "paid",
            paid_at: new Date().toISOString(),
            stripe_checkout_session_id: sessionId,
            stripe_payment_intent_id: asString(session.payment_intent) || null,
            charged_amount_cents: Number(session.amount_total) || order.amount_cents,
          })
          .eq("id", orderId);
      }

      const productKey = asString(order.product_key) || asString(meta.product_key);
      let fulfillResult: Record<string, unknown> = {};
      if (productKey === EXTENSION_PRODUCT_KEY) {
        fulfillResult = await fulfillSantaVoiceCallExtensionOrder({
          service,
          orderId,
          stripeCheckoutSessionId: sessionId,
          stripePaymentIntentId: asString(session.payment_intent),
        }) as unknown as Record<string, unknown>;
      } else {
        fulfillResult = await fulfillSantaVoiceCallOrder({ service, orderId }) as unknown as Record<string, unknown>;
      }

      const { data: resolved } = await service.rpc("resolve_christmas_santa_call_access", {
        p_access_token_hash: hash,
      });
      const resolvedObj = (resolved || {}) as Record<string, unknown>;
      return json({
        ok: resolvedObj.ok === true,
        status: "reconciled",
        fulfill: fulfillResult,
        resolve: resolved,
        stripe_session_id: sessionId,
        stripe_mode: stripeMode,
      }, resolvedObj.ok === true || resolvedObj.code === "awaiting_extension" ? 200 : 409);
    }

    // Internal: fulfill extension (service role) — webhook also calls shared fulfill directly.
    if (action === "fulfill_extension") {
      const orderId = asString(body.order_id);
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
      const auth = req.headers.get("Authorization") || "";
      if (!auth.includes(serviceKey) || !isUuid(orderId)) {
        return json({ error: "forbidden" }, 403);
      }
      const out = await fulfillSantaVoiceCallExtensionOrder({ service, orderId });
      return json(out, out.ok ? 200 : 400);
    }

    if (action === "stats") {
      if (!(await requireAdmin(req))) return json({ error: "forbidden" }, 403);
      const { data: ents } = await service
        .from("christmas_santa_call_entitlements")
        .select("id,status,remaining_seconds,max_duration_seconds,order_id,created_at");
      const { data: sessions } = await service
        .from("christmas_santa_call_sessions")
        .select("id,status,seconds_used,cost_usd,error_code,created_at,order_id");
      const { data: orders } = await service
        .from("christmas_orders")
        .select("id,payment_status,amount_cents,currency,created_at")
        .eq("product_key", "christmas_santa_voice_call");

      const list = ents || [];
      const sess = sessions || [];
      const ords = orders || [];
      const paid = ords.filter((o) => o.payment_status === "paid");
      const refunded = ords.filter((o) => o.payment_status === "refunded");
      const gross = paid.reduce((s, o) => s + (Number(o.amount_cents) || 0), 0);
      const aiCost = sess.reduce((s, row) => s + (Number(row.cost_usd) || 0), 0);
      const usedSeconds = sess.reduce((s, row) => s + (Number(row.seconds_used) || 0), 0);

      return json({
        ok: true,
        orders: ords.length,
        paidOrders: paid.length,
        refundedOrders: refunded.length,
        entitlements: {
          ready: list.filter((e) => e.status === "ready").length,
          in_progress: list.filter((e) => e.status === "in_progress").length,
          completed: list.filter((e) => e.status === "completed").length,
          failed: list.filter((e) => e.status === "failed").length,
          expired: list.filter((e) => e.status === "expired").length,
          revoked: list.filter((e) => e.status === "revoked" || e.status === "refunded").length,
        },
        secondsUsed: usedSeconds,
        aiCostUsd: Number(aiCost.toFixed(4)),
        grossRevenueMinor: gross,
        currencyHint: paid[0]?.currency || "ron",
        recentErrors: sess
          .filter((s) => s.error_code)
          .slice(0, 20)
          .map((s) => ({ id: s.id, error_code: s.error_code, created_at: s.created_at })),
        productEnabled: !santaCallKillSwitchActive(),
      });
    }

    if (action === "resend_email" || action === "revoke" || action === "reissue") {
      if (!(await requireAdmin(req))) return json({ error: "forbidden" }, 403);
      const orderId = asString(body.order_id);
      if (!isUuid(orderId)) return json({ error: "order_id required" }, 400);

      if (action === "revoke") {
        const { data } = await service.rpc("revoke_christmas_santa_call_entitlement", {
          p_order_id: orderId,
          p_reason: asString(body.reason) || "admin_revoke",
        });
        return json(data);
      }

      if (action === "reissue") {
        const token = asString(body.access_token) || crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
        const hash = await sha256Hex(token);
        const { data } = await service.rpc("reissue_christmas_santa_call_access", {
          p_order_id: orderId,
          p_access_token_hash: hash,
          p_ttl_days: Number(body.ttl_days) || 30,
        });
        const result = (data || {}) as Record<string, unknown>;
        if (result.ok === true) {
          const { data: ord } = await service.from("christmas_orders").select("metadata").eq("id", orderId).maybeSingle();
          const meta = (ord?.metadata || {}) as Record<string, unknown>;
          await service
            .from("christmas_orders")
            .update({ metadata: { ...meta, santa_call_token_hint: token } })
            .eq("id", orderId);
          if (body.send_email !== false) {
            await fulfillSantaVoiceCallOrder({ service, orderId, forceResendEmail: true });
          }
          return json({ ...result, accessToken: token });
        }
        return json(result, 400);
      }

      const out = await fulfillSantaVoiceCallOrder({ service, orderId, forceResendEmail: true });
      return json(out, out.ok ? 200 : 400);
    }

    // Internal webhook/fulfill enqueue
    if (action === "fulfill") {
      const orderId = asString(body.order_id);
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
      const auth = req.headers.get("Authorization") || "";
      if (!auth.includes(serviceKey) || !isUuid(orderId)) {
        return json({ error: "forbidden" }, 403);
      }
      const out = await fulfillSantaVoiceCallOrder({ service, orderId });
      return json(out, out.ok ? 200 : 400);
    }

    return json({ error: "unknown_action" }, 400);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("christmas-santa-call", message);
    return json({ error: message }, 500);
  }
});
