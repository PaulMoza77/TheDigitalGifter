import { jsonResponse, optionsResponse } from "../_shared/cors.ts";
import { getServiceClient, readJson } from "../_shared/supabase.ts";
import {
  buildChristmasPortraitPrompt,
  isPortraitProductKey,
  recoveryRouteForOrder,
} from "../_shared/christmas/portraitPromptRegistry.ts";

/**
 * Christmas checkout seam (Custom Checkout Elements compatible).
 * Amount is always resolved server-side from christmas_packages.
 * Disabled unless CHRISTMAS_CHECKOUT_ENABLED=true.
 *
 * Supports portrait vertical products: christmas_photo|family|couple|pet.
 * Style validation uses the server-owned prompt registry (never client prompts).
 */

type Body = {
  product_key?: string;
  package_key?: string;
  email?: string;
  amount_cents?: number;
  currency?: string;
  locale?: string;
  success_url?: string;
  cancel_url?: string;
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
  style_key?: string;
  source_path?: string;
  source_bucket?: string;
  source_content_type?: string;
  source_byte_size?: number;
  source_width?: number;
  source_height?: number;
  existing_order_id?: string;
  portrait_type?: string;
  species?: string;
  source_route?: string;
  /** Santa personalization (validated server-side). */
  child_first_name?: string;
  language?: string;
  age?: number;
  something_good?: string;
  hobby_or_interest?: string;
  christmas_wish?: string;
  custom_fact?: string;
  sender_name?: string;
  template_key?: string;
  guardian_consent?: boolean;
  consent_version?: string;
  /** Ignored — prompts are server-owned. */
  prompt?: string;
  client_prompt?: string;
};

function asString(value: unknown): string {
  return String(value ?? "").trim();
}

function checkoutEnabled(): boolean {
  const raw = asString(Deno.env.get("CHRISTMAS_CHECKOUT_ENABLED")).toLowerCase();
  return raw === "true" || raw === "1" || raw === "on";
}

function siteOrigin(): string {
  return (
    Deno.env.get("SITE_URL") ||
    Deno.env.get("PUBLIC_APP_URL") ||
    "https://www.thedigitalgifter.com"
  ).replace(/\/$/, "");
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    if (!checkoutEnabled()) {
      return jsonResponse({ error: "Christmas checkout is not enabled", code: "checkout_disabled" }, 403);
    }

    const body = await readJson<Body>(req);
    const productKey = asString(body.product_key);
    const packageKey =
      asString(body.package_key) ||
      (productKey === "christmas_santa_video" ? "basic" : "single");
    if (!productKey) return jsonResponse({ error: "product_key required" }, 400);

    // Client-supplied amount / prompts are intentionally ignored.
    void body.amount_cents;
    void body.currency;
    void body.prompt;
    void body.client_prompt;

    const service = getServiceClient();
    const { data: product, error: productError } = await service
      .from("christmas_products")
      .select("id, product_key, name, active")
      .eq("product_key", productKey)
      .maybeSingle();
    if (productError) throw productError;
    if (!product?.active) {
      return jsonResponse({ error: "Unknown or inactive product", code: "inactive_product" }, 400);
    }

    const { data: pkg, error: pkgError } = await service
      .from("christmas_packages")
      .select("*")
      .eq("product_id", product.id)
      .eq("package_key", packageKey)
      .maybeSingle();
    if (pkgError) throw pkgError;
    if (!pkg?.active) {
      return jsonResponse({ error: "Unknown or inactive package", code: "inactive_package" }, 400);
    }
    if (!pkg.purchasable) {
      return jsonResponse({ error: "Package is not purchasable", code: "not_purchasable" }, 400);
    }
    if (!pkg.price_cents || pkg.price_cents <= 0) {
      return jsonResponse({ error: "Invalid configured price", code: "invalid_price" }, 400);
    }

    const styleKey = asString(body.style_key);
    const sourcePath = asString(body.source_path);
    const species = asString(body.species).toLowerCase() || null;
    const portraitType = asString(body.portrait_type) || null;
    const sourceRoute = asString(body.source_route) ||
      recoveryRouteForOrder({
        productKey: product.product_key,
        species,
        landingPath: asString(body.landing_path),
      });

    if (isPortraitProductKey(product.product_key)) {
      if (!styleKey || !sourcePath) {
        return jsonResponse({ error: "style_key and source_path required", code: "missing_photo_fields" }, 400);
      }
      const promptCheck = buildChristmasPortraitPrompt({
        productKey: product.product_key,
        styleKey,
        species,
        clientPrompt: body.client_prompt || body.prompt,
      });
      if (!promptCheck.ok) {
        return jsonResponse({ error: "Unknown or disabled style for product", code: "invalid_style" }, 400);
      }
    }

    let santaPerso: Record<string, unknown> | null = null;
    if (product.product_key === "christmas_santa_video") {
      const name = asString(body.child_first_name);
      const language = asString(body.language).toLowerCase();
      const templateKey = asString(body.template_key) || "classic_santa";
      if (!body.guardian_consent) {
        return jsonResponse({ error: "Parent/guardian consent required", code: "consent_required" }, 400);
      }
      if (!name || name.length > 40) {
        return jsonResponse({ error: "child_first_name required", code: "name_required" }, 400);
      }
      if (language !== "en" && language !== "ro") {
        return jsonResponse({ error: "language must be en or ro", code: "invalid_language" }, 400);
      }
      if (templateKey !== "classic_santa") {
        return jsonResponse({ error: "template unavailable", code: "template_unavailable" }, 400);
      }
      const injection = /ignore\s+(all\s+)?(previous|prior|above)\s+instructions|system\s*prompt/i;
      for (const field of [
        body.something_good,
        body.hobby_or_interest,
        body.christmas_wish,
        body.custom_fact,
        body.sender_name,
      ]) {
        if (field && injection.test(String(field))) {
          return jsonResponse({ error: "Disallowed content in personalization", code: "prompt_injection" }, 400);
        }
      }
      santaPerso = {
        child_first_name: name,
        language,
        age: body.age == null ? null : Number(body.age),
        something_good: asString(body.something_good).slice(0, 120) || null,
        hobby_or_interest: asString(body.hobby_or_interest).slice(0, 80) || null,
        christmas_wish: asString(body.christmas_wish).slice(0, 120) || null,
        custom_fact: asString(body.custom_fact).slice(0, 120) || null,
        sender_name: asString(body.sender_name).slice(0, 60) || null,
        template_key: templateKey,
        guardian_consent: true,
        consent_version: asString(body.consent_version) || "santa_v1_2026_09",
        consented_at: new Date().toISOString(),
      };
    }

    const stripeSecret = asString(Deno.env.get("STRIPE_SECRET_KEY"));
    const publishable = asString(Deno.env.get("STRIPE_PUBLISHABLE_KEY"));
    if (!stripeSecret || !publishable) {
      return jsonResponse({ error: "Stripe is not configured" }, 503);
    }

    const email = asString(body.email).toLowerCase();
    const successUrl =
      asString(body.success_url) ||
      (product.product_key === "christmas_santa_video"
        ? `${siteOrigin()}/christmas/santa-video?checkout=success`
        : `${siteOrigin()}${sourceRoute}?checkout=success`);
    const sku = `xmas_${product.product_key}_${pkg.package_key}`;

    let orderId = asString(body.existing_order_id);
    let publicToken = "";

    const orderPatch = {
      email: email || null,
      email_normalized: email || null,
      style_key: styleKey || null,
      source_path: sourcePath || null,
      source_bucket: asString(body.source_bucket) || "christmas-source",
      source_content_type: asString(body.source_content_type) || null,
      source_byte_size: Number(body.source_byte_size) || null,
      source_width: Number(body.source_width) || null,
      source_height: Number(body.source_height) || null,
      portrait_type: portraitType,
      species,
      source_route: sourceRoute,
      amount_cents: pkg.price_cents,
      currency: pkg.currency,
      package_key: pkg.package_key,
      sku,
      locale: asString(body.locale) === "ro" ? "ro" : "en",
    };

    if (orderId) {
      const { data: existing } = await service
        .from("christmas_orders")
        .select("id,payment_status,stripe_checkout_session_id,amount_cents,public_token_hash")
        .eq("id", orderId)
        .maybeSingle();
      if (!existing || existing.payment_status === "paid") {
        orderId = "";
      } else {
        await service.from("christmas_orders").update(orderPatch).eq("id", orderId);
      }
    }

    if (!orderId) {
      publicToken = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
      const tokenHash = await sha256Hex(publicToken);
      const { data: order, error: orderError } = await service
        .from("christmas_orders")
        .insert({
          public_token_hash: tokenHash,
          product_key: product.product_key,
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
          metadata: {
            source: "christmas-checkout",
            public_token_hint: publicToken,
            portrait_type: portraitType,
            species,
            source_route: sourceRoute,
          },
          ...orderPatch,
        })
        .select("id")
        .single();
      if (orderError) throw orderError;
      orderId = order.id;
    }

    if (santaPerso) {
      const { error: persoError } = await service.from("christmas_santa_personalization").upsert(
        {
          order_id: orderId,
          ...santaPerso,
        },
        { onConflict: "order_id" },
      );
      if (persoError) throw persoError;
      await service.from("christmas_santa_video_jobs").upsert(
        {
          order_id: orderId,
          language: santaPerso.language,
          template_key: santaPerso.template_key,
          job_status: "draft",
        },
        { onConflict: "order_id" },
      );
    }

    const params = new URLSearchParams();
    params.set("mode", "payment");
    params.set("ui_mode", "custom");
    const returnUrl = successUrl.includes("{CHECKOUT_SESSION_ID}")
      ? successUrl
      : `${successUrl}${successUrl.includes("?") ? "&" : "?"}session_id={CHECKOUT_SESSION_ID}&token=${encodeURIComponent(publicToken || "recover")}`;
    params.set("return_url", returnUrl);
    if (email) params.set("customer_email", email);
    params.set("line_items[0][quantity]", "1");
    params.set("line_items[0][price_data][currency]", pkg.currency);
    params.set("line_items[0][price_data][unit_amount]", String(pkg.price_cents));
    params.set(
      "line_items[0][price_data][product_data][name]",
      `${product.name} — ${pkg.package_name}`,
    );
    params.set("metadata[product_family]", "christmas");
    params.set("metadata[product_type]", "christmas");
    params.set("metadata[product_key]", product.product_key);
    params.set("metadata[package_key]", pkg.package_key);
    params.set("metadata[sku]", sku);
    params.set("metadata[christmas_order_id]", orderId);
    if (styleKey) params.set("metadata[style_key]", styleKey);
    if (portraitType) params.set("metadata[portrait_type]", portraitType);
    if (species) params.set("metadata[species]", species);
    params.set("payment_intent_data[metadata][product_family]", "christmas");
    params.set("payment_intent_data[metadata][christmas_order_id]", orderId);

    const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeSecret}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Idempotency-Key": `xmas-checkout-${orderId}`,
      },
      body: params,
    });
    const session = await stripeRes.json();
    if (!stripeRes.ok) {
      await service
        .from("christmas_orders")
        .update({
          payment_status: "failed",
          last_error: asString(session.error?.message || "stripe_error"),
        })
        .eq("id", orderId);
      return jsonResponse({ error: "Unable to create checkout session", code: "stripe_error" }, 502);
    }

    await service
      .from("christmas_orders")
      .update({
        stripe_checkout_session_id: asString(session.id),
        payment_status: "pending",
      })
      .eq("id", orderId);

    return jsonResponse({
      ok: true,
      orderId,
      publicToken: publicToken || null,
      sessionId: session.id,
      clientSecret: session.client_secret,
      publishableKey: publishable,
      amountCents: pkg.price_cents,
      currency: pkg.currency,
      uiMode: "custom",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: message }, 500);
  }
});
