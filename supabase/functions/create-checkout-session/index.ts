import { optionsResponse, jsonResponse } from "../_shared/cors.ts";
import {
  getAuthUser,
  getServiceClient,
  readJson,
} from "../_shared/supabase.ts";
import { assertRateLimit, clientIp } from "../_shared/rateLimit.ts";

type Body = {
  plan?: string;
  product_type?: string;
  pack?: string;
  email?: string;
  name?: string;
  user_id?: string;
  quantity?: number;
  generation_id?: string;
  template_id?: string;
  promo_code?: string;
  style_id?: string;
  funnel_slug?: string;
  occasion?: string;
  photo_path?: string;
  photo_bucket?: string;
  affiliate_user_id?: string;
  promo_discount_percent?: number;
  source?: string;
  action_type?: string;
  success_url?: string;
  cancel_url?: string;
};

type PricingRow = {
  stripe_price_id: string | null;
  key: string;
  credits: number | null;
  price_cents: number | null;
  name: string | null;
  category: string | null;
  currency: string | null;
};

const CREDIT_PACKS = new Set(["starter", "creator", "pro", "enterprise", "credits"]);
const ACTION_MAP: Record<string, string> = {
  full_hd: "offer_full_hd",
  regenerate: "offer_regenerate",
  golden_frame: "offer_golden_frame",
  puzzle: "offer_puzzle",
};

function firstString(...vals: unknown[]) {
  for (const v of vals) {
    const s = String(v ?? "").trim();
    if (s) return s;
  }
  return "";
}

function siteOrigin(): string {
  return (
    Deno.env.get("SITE_URL") ||
    Deno.env.get("PUBLIC_APP_URL") ||
    "http://127.0.0.1:5173"
  ).replace(/\/$/, "");
}

function safeReturnUrl(input: string, fallback: string): string {
  if (!input) return fallback;
  try {
    const candidate = new URL(input);
    const allowed = new URL(siteOrigin());
    if (candidate.origin === allowed.origin) return input;
  } catch {
    /* ignore */
  }
  return fallback;
}

async function ensureOnceCoupon(stripeKey: string, code: string, percentOff: number): Promise<string> {
  const id = code.replace(/[^A-Za-z0-9]/g, "").toUpperCase() || "PROMO";
  const headers = { Authorization: `Bearer ${stripeKey}` };
  const existing = await fetch(`https://api.stripe.com/v1/coupons/${id}`, { headers });
  if (existing.ok) return id;
  const params = new URLSearchParams();
  params.set("id", id);
  params.set("percent_off", String(Math.min(100, Math.max(1, Math.round(percentOff)))));
  params.set("duration", "once");
  params.set("name", id);
  const created = await fetch("https://api.stripe.com/v1/coupons", {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });
  const json = await created.json();
  if (!created.ok) throw new Error(json?.error?.message || "Could not create promo coupon");
  return id;
}

async function findPricing(
  service: ReturnType<typeof getServiceClient>,
  key: string,
): Promise<PricingRow | null> {
  const { data } = await service
    .from("pricing_items")
    .select("stripe_price_id, key, credits, price_cents, name, category, currency")
    .eq("key", key)
    .maybeSingle();
  if (data) return data as PricingRow;

  const { data: rows } = await service
    .from("pricing_items")
    .select("stripe_price_id, key, credits, price_cents, name, category, currency")
    .or(`key.eq.${key},name.ilike.${key}`)
    .limit(5);
  return (rows?.[0] as PricingRow) ?? null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      return jsonResponse(
        {
          error:
            "STRIPE_SECRET_KEY is not configured. Set it as a Supabase Edge secret (use test key until production approval).",
        },
        503,
      );
    }

    const { user } = await getAuthUser(req);
    const body = await readJson<Body>(req);
    const service = getServiceClient();

    const allowed = await assertRateLimit(
      service,
      `checkout:${user?.id || clientIp(req)}`,
      30,
      3600,
    );
    if (!allowed) return jsonResponse({ error: "Too many checkout attempts. Please wait." }, 429);

    const email = firstString(body.email, user?.email).toLowerCase();
    if (!email) return jsonResponse({ error: "email is required" }, 400);

    const actionType = firstString(body.action_type);
    const requestedPlan = firstString(body.plan, body.pack, body.product_type);
    const productType = firstString(body.product_type);
    const quantity = Math.min(10, Math.max(1, Number(body.quantity || 1)));

    let priceKey = "";
    let mode: "payment" | "subscription" = "payment";
    const metadata: Record<string, string> = {
      email,
      source: firstString(body.source, "tdg"),
    };

    if (actionType) {
      priceKey = ACTION_MAP[actionType] || `offer_${actionType}`;
      metadata.action_type = actionType;
      if (body.generation_id) metadata.generation_id = String(body.generation_id);
      mode = "payment";
    } else if (productType === "credits" || CREDIT_PACKS.has(requestedPlan) || CREDIT_PACKS.has(firstString(body.pack))) {
      priceKey = firstString(body.pack, requestedPlan === "credits" ? "starter" : requestedPlan, "starter");
      if (priceKey.startsWith("subscription_")) {
        return jsonResponse({ error: "Invalid credit pack" }, 400);
      }
      mode = "payment";
      metadata.product_type = "credits";
      metadata.pack = priceKey;
    } else if (requestedPlan.startsWith("subscription_")) {
      priceKey = requestedPlan;
      mode = "subscription";
      metadata.plan = requestedPlan;
      metadata.product_type = "subscription";
    } else {
      return jsonResponse({ error: `Unsupported plan "${requestedPlan}"` }, 400);
    }

    if (body.generation_id) metadata.generation_id = String(body.generation_id);
    if (body.template_id) metadata.template_id = String(body.template_id);
    if (body.style_id) metadata.style_id = String(body.style_id);
    if (body.funnel_slug) metadata.funnel_slug = String(body.funnel_slug);
    if (body.occasion) metadata.occasion = String(body.occasion);
    if (body.photo_path) metadata.photo_path = String(body.photo_path);
    if (body.photo_bucket) metadata.photo_bucket = String(body.photo_bucket);
    if (user?.id) metadata.user_id = user.id;

    let promoCode = firstString(body.promo_code).toUpperCase();
    let promoDiscount: number | null = null;
    void body.promo_discount_percent;
    if (promoCode) {
      if (promoCode === "VTM99") {
        promoDiscount = 100;
        metadata.promo_code = promoCode;
      } else {
        const { data: promo } = await service.rpc("lookup_affiliate_promo", { p_code: promoCode });
        const row = Array.isArray(promo) ? promo[0] : promo;
        if (row?.code) {
          promoCode = String(row.code);
          promoDiscount = Number(row.discount_percent || 0);
          metadata.promo_code = promoCode;
          if (row.affiliate_user_id) metadata.affiliate_user_id = String(row.affiliate_user_id);
        } else {
          return jsonResponse({ error: "Invalid promo code." }, 400);
        }
      }
    }

    let pricing = await findPricing(service, priceKey);
    if (!pricing) {
      const aliases = [
        priceKey.replace("subscription_", ""),
        `funnel_${priceKey}`,
        `credit_${priceKey}`,
        `credits_${priceKey}`,
      ];
      for (const alias of aliases) {
        pricing = await findPricing(service, alias);
        if (pricing) break;
      }
    }

    if (!pricing) {
      return jsonResponse(
        {
          error: `No pricing configured for key "${priceKey}". Set it in admin pricing.`,
          key: priceKey,
        },
        400,
      );
    }

    const successUrl = safeReturnUrl(
      firstString(body.success_url),
      `${siteOrigin()}/funnel/result?session_id={CHECKOUT_SESSION_ID}`,
    );
    const cancelUrl = safeReturnUrl(
      firstString(body.cancel_url),
      `${siteOrigin()}/funnel/payment`,
    );

    const params = new URLSearchParams();
    params.set("mode", mode);
    params.set("success_url", successUrl);
    params.set("cancel_url", cancelUrl);
    params.set("customer_email", email);
    params.set("client_reference_id", firstString(user?.id, body.generation_id, email));
    params.set("metadata[email]", email);
    if (pricing.stripe_price_id) {
      params.set("line_items[0][price]", String(pricing.stripe_price_id));
    } else {
      const unitAmount = Math.round(Number(pricing.price_cents || 0));
      if (!Number.isFinite(unitAmount) || unitAmount <= 0) {
        return jsonResponse(
          { error: `Pricing key "${priceKey}" has no stripe_price_id or price_cents` },
          400,
        );
      }
      params.set("line_items[0][price_data][currency]", String(pricing.currency || "eur"));
      params.set("line_items[0][price_data][unit_amount]", String(unitAmount));
      params.set("line_items[0][price_data][product_data][name]", String(pricing.name || priceKey));
      if (mode === "subscription") {
        params.set("line_items[0][price_data][recurring][interval]", "month");
      }
    }
    params.set("line_items[0][quantity]", String(mode === "subscription" ? 1 : quantity));
    metadata.credits = String(pricing.credits ?? 0);
    metadata.price_key = pricing.key;
    metadata.price_cents = String(pricing.price_cents ?? 0);
    if (promoCode && promoDiscount && promoDiscount > 0) {
      const couponId = await ensureOnceCoupon(stripeKey, promoCode, promoDiscount);
      params.set("discounts[0][coupon]", couponId);
      if (promoDiscount >= 100) {
        params.set("payment_method_collection", "if_required");
      }
    }
    for (const [k, v] of Object.entries(metadata)) {
      if (v) params.set(`metadata[${k}]`, v);
    }

    const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    });
    const session = await stripeRes.json();
    if (!stripeRes.ok) {
      return jsonResponse({ error: session.error?.message || "Stripe checkout failed" }, 502);
    }

    if (body.generation_id) {
      await service
        .from("generations")
        .update({
          stripe_session_id: session.id,
          checkout_session_id: session.id,
          metadata: metadata,
        })
        .eq("id", body.generation_id);
    }

    return jsonResponse({
      url: session.url,
      checkoutUrl: session.url,
      sessionUrl: session.url,
      checkout_url: session.url,
      id: session.id,
      generation_id: body.generation_id ?? null,
      user_id: user?.id ?? null,
      promo_applied: Boolean(promoCode),
      promo_code: promoCode || null,
      discount_percent: promoDiscount,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: message }, 500);
  }
});
