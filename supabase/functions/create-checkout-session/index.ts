import { optionsResponse, jsonResponse } from "../_shared/cors.ts";
import {
  getAuthUser,
  getServiceClient,
  readJson,
  requiredEnv,
} from "../_shared/supabase.ts";

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

function firstString(...vals: unknown[]) {
  for (const v of vals) {
    const s = String(v ?? "").trim();
    if (s) return s;
  }
  return "";
}

async function findPriceId(service: ReturnType<typeof getServiceClient>, key: string) {
  const { data } = await service
    .from("pricing_items")
    .select("stripe_price_id, key, credits, price_cents, name, category")
    .eq("key", key)
    .maybeSingle();
  if (data?.stripe_price_id) return data;

  const { data: rows } = await service
    .from("pricing_items")
    .select("stripe_price_id, key, credits, price_cents, name, category")
    .or(`key.eq.${key},name.ilike.${key}`)
    .limit(5);
  return rows?.[0] ?? null;
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
    const siteUrl = Deno.env.get("SITE_URL") || Deno.env.get("PUBLIC_APP_URL") || "http://127.0.0.1:5173";

    const email = firstString(body.email, user?.email);
    if (!email) return jsonResponse({ error: "email is required" }, 400);

    // Mode detection
    const actionType = firstString(body.action_type);
    const plan = firstString(body.plan, body.pack, body.product_type);
    const quantity = Math.max(1, Number(body.quantity || 1));

    let priceKey = "";
    let mode: "payment" | "subscription" = "payment";
    let metadata: Record<string, string> = {
      email,
      source: firstString(body.source, "tdg"),
    };

    if (actionType) {
      const map: Record<string, string> = {
        full_hd: "offer_full_hd",
        regenerate: "offer_regenerate",
        golden_frame: "offer_golden_frame",
        puzzle: "offer_puzzle",
      };
      priceKey = map[actionType] || `offer_${actionType}`;
      metadata.action_type = actionType;
      if (body.generation_id) metadata.generation_id = String(body.generation_id);
      mode = "payment";
    } else if (plan.startsWith("subscription_") || ["starter", "pro", "elite"].includes(plan)) {
      const normalized = plan.startsWith("subscription_")
        ? plan
        : `subscription_${plan}`;
      priceKey = normalized;
      // also try funnel keys
      mode = "subscription";
      metadata.plan = normalized;
    } else if (plan === "credits" || body.product_type === "credits" || body.pack) {
      priceKey = firstString(body.pack, body.plan, "starter");
      mode = "payment";
      metadata.product_type = "credits";
      metadata.pack = priceKey;
    } else {
      priceKey = plan || "subscription_pro";
      mode = priceKey.includes("subscription") ? "subscription" : "payment";
      metadata.plan = priceKey;
    }

    if (body.generation_id) metadata.generation_id = String(body.generation_id);
    if (body.template_id) metadata.template_id = String(body.template_id);
    if (body.style_id) metadata.style_id = String(body.style_id);
    if (body.funnel_slug) metadata.funnel_slug = String(body.funnel_slug);
    if (body.occasion) metadata.occasion = String(body.occasion);
    if (body.photo_path) metadata.photo_path = String(body.photo_path);
    if (body.photo_bucket) metadata.photo_bucket = String(body.photo_bucket);
    if (body.promo_code) metadata.promo_code = String(body.promo_code);
    if (body.affiliate_user_id) metadata.affiliate_user_id = String(body.affiliate_user_id);
    if (user?.id) metadata.user_id = user.id;

    let pricing = await findPriceId(service, priceKey);
    if (!pricing?.stripe_price_id) {
      // fallback common aliases
      const aliases = [
        priceKey,
        priceKey.replace("subscription_", ""),
        `funnel_${priceKey}`,
        `credit_${priceKey}`,
        `credits_${priceKey}`,
      ];
      for (const alias of aliases) {
        pricing = await findPriceId(service, alias);
        if (pricing?.stripe_price_id) break;
      }
    }

    if (!pricing?.stripe_price_id) {
      return jsonResponse(
        {
          error: `No stripe_price_id configured for pricing key "${priceKey}". Set it in admin pricing (test mode until production approval).`,
          key: priceKey,
        },
        400,
      );
    }

    const successUrl =
      firstString(body.success_url) ||
      `${siteUrl}/funnel/result?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = firstString(body.cancel_url) || `${siteUrl}/funnel/payment`;

    const params = new URLSearchParams();
    params.set("mode", mode);
    params.set("success_url", successUrl);
    params.set("cancel_url", cancelUrl);
    params.set("customer_email", email);
    params.set("client_reference_id", firstString(user?.id, body.generation_id, email));
    params.set("line_items[0][price]", String(pricing.stripe_price_id));
    params.set("line_items[0][quantity]", String(quantity));
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

    // Optional: attach session id on generation
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
      promo_applied: Boolean(body.promo_code),
      promo_code: body.promo_code ?? null,
      discount_percent: body.promo_discount_percent ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: message }, 500);
  }
});
