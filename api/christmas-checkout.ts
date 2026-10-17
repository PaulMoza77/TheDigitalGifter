/**
 * Mozas origin port of Planner checkout.
 * The Contabo edge worker boots but has no STRIPE_SECRET_KEY, so session
 * creation for christmas_planner_2026 runs here. Other Christmas products stay
 * behind CHRISTMAS_CHECKOUT_ENABLED and are not opened by this handler.
 * Amounts come from christmas_packages. Client amount and currency are ignored.
 */
import { createHash, randomUUID } from "node:crypto";
import type { NodeApiRequest, NodeApiResponse } from "./_lib/nodeHandler";
import { getAuthUser, getServiceClient } from "./_lib/christmas/supabaseClient";
import {
  isPlannerProductKey,
  PLANNER_PRODUCT_KEY,
  plannerSafeCheckoutSuccessUrl,
  resolvePlannerCheckoutFromRows,
} from "../supabase/functions/_shared/christmas/plannerCommerce";

type Body = {
  product_key?: string;
  package_key?: string;
  email?: string;
  amount_cents?: number;
  currency?: string;
  locale?: string;
  success_url?: string;
  landing_path?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  affiliate_ref?: string;
  campaign_id?: string;
  adset_id?: string;
  ad_id?: string;
  funnel_session_id?: string;
  existing_order_id?: string;
  guest_token?: string;
  addon_keys?: string[];
};

function asString(value: unknown): string {
  return String(value ?? "").trim();
}

function flagOn(name: string): boolean {
  const raw = asString(process.env[name]).toLowerCase();
  return raw === "true" || raw === "1" || raw === "on";
}

function siteOrigin(): string {
  return asString(process.env.SITE_URL || process.env.PUBLIC_APP_URL || process.env.VITE_APP_URL || "https://www.thedigitalgifter.com").replace(/\/$/, "");
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function setCors(res: NodeApiResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "authorization, x-client-info, apikey, content-type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("X-TDG-Checkout", "origin");
}

function parseBody(req: NodeApiRequest): Body {
  const raw = req.body;
  if (!raw) return {};
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as Body;
    } catch {
      return {};
    }
  }
  if (typeof raw === "object") return raw as Body;
  return {};
}

export default async function handler(req: NodeApiRequest, res: NodeApiResponse) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).send("ok");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const body = parseBody(req);
    const productKey = asString(body.product_key);
    if (!productKey) return res.status(400).json({ error: "product_key required" });
    if (!isPlannerProductKey(productKey)) {
      if (!flagOn("CHRISTMAS_CHECKOUT_ENABLED")) {
        return res.status(403).json({ error: "Christmas checkout is not enabled", code: "checkout_disabled" });
      }
      return res.status(403).json({
        error: "This product checkout stays on the edge worker until its fulfillment gate passes.",
        code: "origin_checkout_not_enabled",
      });
    }

    const service = getServiceClient();
    const { user } = await getAuthUser(String(req.headers.authorization || ""));
    if (!user?.id) {
      return res.status(401).json({ error: "Sign in required to purchase the Planner.", code: "auth_required" });
    }

    const { data: plannerProduct, error: productError } = await service
      .from("christmas_products")
      .select("id, product_key, name, active, metadata")
      .eq("product_key", PLANNER_PRODUCT_KEY)
      .maybeSingle();
    if (productError) throw productError;
    if (!plannerProduct) return res.status(400).json({ error: "Unknown Christmas Planner product.", code: "unknown_product" });

    const { data: plannerPackages, error: pkgError } = await service
      .from("christmas_packages")
      .select("*")
      .eq("product_id", plannerProduct.id);
    if (pkgError) throw pkgError;

    const plan = resolvePlannerCheckoutFromRows({
      product: plannerProduct,
      packages: plannerPackages || [],
      packageKey: asString(body.package_key) || "founding_pass",
      addonKeys: Array.isArray(body.addon_keys) ? body.addon_keys.map((key) => String(key)) : [],
      clientAmountCents: body.amount_cents,
      clientCurrency: body.currency,
      christmasCheckoutEnabled: true,
    });
    if (!plan.ok) {
      const status = plan.code === "checkout_disabled" ? 403 : 400;
      return res.status(status).json({ error: plan.message, code: plan.code });
    }

    const stripeSecret = asString(process.env.STRIPE_SECRET_KEY);
    const publishable = asString(process.env.STRIPE_PUBLISHABLE_KEY);
    if (!stripeSecret || !publishable) {
      return res.status(503).json({ error: "Stripe is not configured" });
    }

    const email = (asString(body.email) || asString(user.email)).toLowerCase();
    const successUrl = plannerSafeCheckoutSuccessUrl(asString(body.success_url) || asString(body.landing_path), siteOrigin());
    const publicToken = randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "");
    const tokenHash = sha256Hex(publicToken);
    const guestToken = asString(body.guest_token);
    const guestTokenHash = guestToken ? sha256Hex(guestToken) : "";

    const { data: order, error: orderError } = await service
      .from("christmas_orders")
      .insert({
        public_token_hash: tokenHash,
        product_key: plan.productKey,
        payment_status: "pending",
        fulfillment_status: "not_started",
        locale: asString(body.locale) || "en",
        landing_path: asString(body.landing_path) || null,
        utm_source: asString(body.utm_source) || null,
        utm_medium: asString(body.utm_medium) || null,
        utm_campaign: asString(body.utm_campaign) || null,
        utm_content: asString(body.utm_content) || null,
        utm_term: asString(body.utm_term) || null,
        affiliate_ref: asString(body.affiliate_ref) || null,
        campaign_id: asString(body.campaign_id) || null,
        adset_id: asString(body.adset_id) || null,
        ad_id: asString(body.ad_id) || null,
        funnel_session_id: asString(body.funnel_session_id) || null,
        email: email || null,
        email_normalized: email || null,
        user_id: user.id,
        amount_cents: plan.amountCents,
        currency: plan.currency,
        package_key: plan.packageKey,
        pricing_key: PLANNER_PRODUCT_KEY,
        charged_amount_cents: plan.amountCents,
        sku: plan.sku,
        commercial_snapshot: {
          pricingKey: PLANNER_PRODUCT_KEY,
          chargedAmountMinor: plan.amountCents,
          currency: plan.currency,
          entitlement: plan.tier,
          addonKeys: plan.addonKeys,
          entitlements: plan.entitlements,
          seasonYear: plan.seasonYear,
          origin: "mozas",
        },
        metadata: {
          source: "origin-christmas-checkout",
          public_token_hint: publicToken,
          addon_keys: plan.addonKeys,
          entitlements: plan.entitlements,
          product_family: "christmas_planner",
          user_id: user.id,
          ...(guestTokenHash ? { guest_token_hash: guestTokenHash } : {}),
        },
      })
      .select("id")
      .single();
    if (orderError) throw orderError;

    const returnUrl = `${successUrl}${successUrl.includes("?") ? "&" : "?"}session_id={CHECKOUT_SESSION_ID}&token=${encodeURIComponent(publicToken)}`;
    const params = new URLSearchParams();
    params.set("mode", "payment");
    params.set("ui_mode", "custom");
    params.set("return_url", returnUrl);
    if (email) params.set("customer_email", email);
    plan.lineItems.forEach((item, index) => {
      params.set(`line_items[${index}][quantity]`, "1");
      params.set(`line_items[${index}][price_data][currency]`, plan.currency);
      params.set(`line_items[${index}][price_data][unit_amount]`, String(item.amountCents));
      params.set(`line_items[${index}][price_data][product_data][name]`, item.name);
    });
    params.set("metadata[product_family]", "christmas");
    params.set("metadata[product_key]", plan.productKey);
    params.set("metadata[package_key]", plan.packageKey);
    params.set("metadata[sku]", plan.sku);
    params.set("metadata[christmas_order_id]", order.id);
    params.set("metadata[planner]", "1");
    params.set("metadata[user_id]", user.id);
    params.set("client_reference_id", user.id);
    params.set("payment_intent_data[metadata][user_id]", user.id);
    params.set("payment_intent_data[metadata][product_key]", plan.productKey);
    params.set("payment_intent_data[metadata][christmas_order_id]", order.id);

    const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeSecret}`,
        "Stripe-Version": "2025-03-31.basil",
        "Content-Type": "application/x-www-form-urlencoded",
        "Idempotency-Key": `xmas-planner-origin-${order.id}-${plan.packageKey}-${plan.amountCents}`,
      },
      body: params,
    });
    const session = (await stripeRes.json()) as { id?: string; client_secret?: string; error?: { message?: string } };
    if (!stripeRes.ok || !session.id) {
      await service.from("christmas_orders").update({
        payment_status: "failed",
        last_error: asString(session.error?.message || "stripe_error").slice(0, 300),
      }).eq("id", order.id);
      return res.status(502).json({ error: "Unable to create checkout session", code: "stripe_error" });
    }

    await service.from("christmas_orders").update({
      stripe_checkout_session_id: session.id,
      payment_status: "pending",
    }).eq("id", order.id);

    return res.status(200).json({
      ok: true,
      orderId: order.id,
      publicToken,
      sessionId: session.id,
      clientSecret: session.client_secret,
      publishableKey: publishable,
      amountCents: plan.amountCents,
      currency: plan.currency,
      uiMode: "custom",
      addonKeys: plan.addonKeys,
      entitlements: plan.entitlements,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: message.slice(0, 300) });
  }
}
