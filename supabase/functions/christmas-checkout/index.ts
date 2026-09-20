import { jsonResponse, optionsResponse } from "../_shared/cors.ts";
import { isWave1GenerationLocale, normalizeWave1GenerationLocale } from "../_shared/christmas/wave1Locale.ts";
import { getServiceClient, readJson } from "../_shared/supabase.ts";
import {
  buildChristmasPortraitPrompt,
  isPortraitProductKey,
  recoveryRouteForOrder,
} from "../_shared/christmas/portraitPromptRegistry.ts";
import {
  catalogFromRows,
  commercialKeyForProduct,
  resolveWebCheckout,
  snapshotWebOrder,
} from "../_shared/christmas/commercialOffers.ts";
import {
  isPlannerProductKey,
  PLANNER_PRODUCT_KEY,
  plannerSafeCheckoutSuccessUrl,
  resolvePlannerCheckoutFromRows,
} from "../_shared/christmas/plannerCommerce.ts";

/**
 * Christmas checkout seam (Custom Checkout Elements compatible).
 * Amount is always resolved server-side from pricing_items (christmas_offer).
 * Client amount_cents is ignored. christmas_packages remain for funnel/SKU metadata.
 * Disabled unless CHRISTMAS_CHECKOUT_ENABLED=true.
 * Planner Founding Pass may also open when CHRISTMAS_PLANNER_CHECKOUT_ENABLED=true
 * without turning on other Christmas product sales.
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
  /** Gift-tree guest continuity — hashed server-side into order metadata. */
  guest_token?: string;
  /** Planner add-ons — charged only when not already included in the package. */
  addon_keys?: string[];
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
    const body = await readJson<Body>(req);
    const productKey = asString(body.product_key);
    if (!productKey) return jsonResponse({ error: "product_key required" }, 400);
    // Planner Founding Pass is gated by checkout_live / CHRISTMAS_PLANNER_CHECKOUT_ENABLED.
    // Other Christmas products stay behind the global CHRISTMAS_CHECKOUT_ENABLED kill switch.
    if (!isPlannerProductKey(productKey) && !checkoutEnabled()) {
      return jsonResponse({ error: "Christmas checkout is not enabled", code: "checkout_disabled" }, 403);
    }
    // Client-supplied Stripe price IDs are never accepted.
    void (body as { price_id?: unknown }).price_id;
    void (body as { stripe_price_id?: unknown }).stripe_price_id;
    const packageKey =
      asString(body.package_key) ||
      (productKey === "christmas_santa_video" ? "basic" : "single");

    // Client-supplied amount / prompts are intentionally ignored.
    void body.amount_cents;
    void body.currency;
    void body.prompt;
    void body.client_prompt;

    const service = getServiceClient();
    const plannerFlow = isPlannerProductKey(productKey);

    let resolvedProductKey = productKey;
    let productName = "";
    let amountCents = 0;
    let currency = "usd";
    let commercialSnapshot: Record<string, unknown> = {};
    let packageKeyResolved = packageKey;
    let sku = "";
    let commercialKey: string | null = null;
    let plannerAddonKeys: string[] = [];
    let plannerLineItems: Array<{ packageKey: string; name: string; amountCents: number }> = [];
    let plannerEntitlements: string[] = [];
    let pricingKey: string | null = null;
    let pricingUpdatedAt: string | null = null;

    if (plannerFlow) {
      const { data: plannerProduct, error: plannerProductError } = await service
        .from("christmas_products")
        .select("id, product_key, name, active, metadata")
        .eq("product_key", PLANNER_PRODUCT_KEY)
        .maybeSingle();
      if (plannerProductError) throw plannerProductError;
      if (!plannerProduct) {
        return jsonResponse({ error: "Unknown Christmas Planner product.", code: "unknown_product" }, 400);
      }
      const { data: plannerPackages, error: plannerPkgError } = await service
        .from("christmas_packages")
        .select("*")
        .eq("product_id", plannerProduct.id);
      if (plannerPkgError) throw plannerPkgError;
      const plannerPlan = resolvePlannerCheckoutFromRows({
        product: plannerProduct,
        packages: plannerPackages || [],
        packageKey,
        addonKeys: Array.isArray(body.addon_keys) ? body.addon_keys.map((k) => String(k)) : [],
        clientAmountCents: body.amount_cents,
        clientCurrency: body.currency,
        christmasCheckoutEnabled: true,
      });
      if (!plannerPlan.ok) {
        const status = plannerPlan.code === "checkout_disabled" ? 403 : 400;
        return jsonResponse({ error: plannerPlan.message, code: plannerPlan.code }, status);
      }
      resolvedProductKey = plannerPlan.productKey;
      productName = plannerPlan.productName;
      amountCents = plannerPlan.amountCents;
      currency = plannerPlan.currency;
      packageKeyResolved = plannerPlan.packageKey;
      sku = plannerPlan.sku;
      plannerAddonKeys = plannerPlan.addonKeys;
      plannerLineItems = plannerPlan.lineItems;
      plannerEntitlements = plannerPlan.entitlements;
      pricingKey = PLANNER_PRODUCT_KEY;
      commercialSnapshot = {
        pricingKey: PLANNER_PRODUCT_KEY,
        chargedAmountMinor: plannerPlan.amountCents,
        currency: plannerPlan.currency,
        entitlement: plannerPlan.tier,
        addonKeys: plannerPlan.addonKeys,
        skippedAddonKeys: plannerPlan.skippedAddonKeys,
        entitlements: plannerPlan.entitlements,
        seasonYear: plannerPlan.seasonYear,
      };
    } else {
      commercialKey = commercialKeyForProduct(productKey);
      const { data: pricingRows, error: pricingError } = await service
        .from("pricing_items")
        .select("*")
        .eq("category", "christmas_offer");
      if (pricingError) throw pricingError;
      const catalog = catalogFromRows(pricingRows || []);
      const checkoutPlan = resolveWebCheckout({
        productKey,
        catalog,
        clientAmountCents: body.amount_cents,
        clientCurrency: body.currency,
      });
      if (!checkoutPlan.ok) {
        return jsonResponse({ error: checkoutPlan.message, code: checkoutPlan.code }, 400);
      }

      const { data: product, error: productError } = await service
        .from("christmas_products")
        .select("id, product_key, name, active")
        .eq(
          "product_key",
          productKey === "xmas_portrait"
            ? "christmas_photo"
            : productKey === "xmas_santa_video"
              ? "christmas_santa_video"
              : productKey === "xmas_magic_bundle"
                ? "christmas_magic_bundle"
                : productKey,
        )
        .maybeSingle();
      if (productError) throw productError;

      const { data: pkg, error: pkgError } = await service
        .from("christmas_packages")
        .select("*")
        .eq("product_id", product?.id || "00000000-0000-0000-0000-000000000000")
        .eq("package_key", packageKey)
        .maybeSingle();
      if (pkgError) throw pkgError;

      resolvedProductKey =
        product?.product_key ||
        (commercialKey === "xmas_portrait"
          ? "christmas_photo"
          : commercialKey === "xmas_santa_video"
            ? "christmas_santa_video"
            : commercialKey === "xmas_magic_bundle"
              ? "christmas_magic_bundle"
              : productKey);
      productName = product?.name || checkoutPlan.offer.name;
      amountCents = checkoutPlan.amountCents;
      currency = checkoutPlan.currency;
      commercialSnapshot = snapshotWebOrder(checkoutPlan.offer);
      packageKeyResolved = pkg?.package_key || packageKey || "single";
      sku = checkoutPlan.sku;
      pricingKey = checkoutPlan.offer.key;
      pricingUpdatedAt = checkoutPlan.offer.updatedAt;
    }

    const styleKey = asString(body.style_key);
    const sourcePath = asString(body.source_path);
    const species = asString(body.species).toLowerCase() || null;
    const portraitType = asString(body.portrait_type) || null;
    const sourceRoute = asString(body.source_route) ||
      recoveryRouteForOrder({
        productKey: resolvedProductKey,
        species,
        landingPath: asString(body.landing_path),
      });

    if (isPortraitProductKey(resolvedProductKey) && commercialKey !== "xmas_magic_bundle") {
      if (!styleKey || !sourcePath) {
        return jsonResponse({ error: "style_key and source_path required", code: "missing_photo_fields" }, 400);
      }
      const promptCheck = buildChristmasPortraitPrompt({
        productKey: resolvedProductKey,
        styleKey,
        species,
        clientPrompt: body.client_prompt || body.prompt,
      });
      if (!promptCheck.ok) {
        return jsonResponse({ error: "Unknown or disabled style for product", code: "invalid_style" }, 400);
      }
    }

    let santaPerso: Record<string, unknown> | null = null;
    if (resolvedProductKey === "christmas_santa_video") {
      const name = asString(body.child_first_name);
      const language = normalizeWave1GenerationLocale(asString(body.language));
      const templateKey = asString(body.template_key) || "classic_santa";
      if (!body.guardian_consent) {
        return jsonResponse({ error: "Parent/guardian consent required", code: "consent_required" }, 400);
      }
      if (!name || name.length > 40) {
        return jsonResponse({ error: "child_first_name required", code: "name_required" }, 400);
      }
      if (!isWave1GenerationLocale(language)) {
        return jsonResponse({ error: "unsupported Wave 1 language", code: "invalid_language" }, 400);
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
    const successUrl = plannerFlow
      ? plannerSafeCheckoutSuccessUrl(asString(body.success_url) || asString(body.landing_path), siteOrigin())
      : asString(body.success_url) ||
        (resolvedProductKey === "christmas_santa_video"
          ? `${siteOrigin()}/christmas/santa-video?checkout=success`
          : `${siteOrigin()}${sourceRoute}?checkout=success`);

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
      amount_cents: amountCents,
      currency,
      package_key: packageKeyResolved,
      pricing_key: pricingKey,
      pricing_updated_at: pricingUpdatedAt,
      charged_amount_cents: amountCents,
      commercial_snapshot: commercialSnapshot,
      sku,
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

    const guestToken = asString(body.guest_token);
    const guestTokenHash = guestToken ? await sha256Hex(guestToken) : "";

    if (!orderId) {
      publicToken = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
      const tokenHash = await sha256Hex(publicToken);
      const { data: order, error: orderError } = await service
        .from("christmas_orders")
        .insert({
          public_token_hash: tokenHash,
          product_key: resolvedProductKey,
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
            ...(plannerFlow
              ? {
                  addon_keys: plannerAddonKeys,
                  entitlements: plannerEntitlements,
                  product_family: "christmas_planner",
                }
              : {}),
            ...(guestTokenHash ? { guest_token_hash: guestTokenHash } : {}),
          },
          ...orderPatch,
        })
        .select("id")
        .single();
      if (orderError) throw orderError;
      orderId = order.id;
    } else if (guestTokenHash) {
      const { data: existingMeta } = await service
        .from("christmas_orders")
        .select("metadata")
        .eq("id", orderId)
        .maybeSingle();
      const prev = (existingMeta?.metadata || {}) as Record<string, unknown>;
      if (!asString(prev.guest_token_hash)) {
        await service
          .from("christmas_orders")
          .update({ metadata: { ...prev, guest_token_hash: guestTokenHash } })
          .eq("id", orderId);
      }
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
    // Do not set payment_method_types — automatic methods include Apple Pay / Google Pay when Stripe + domain + device allow them.
    const returnUrl = successUrl.includes("{CHECKOUT_SESSION_ID}")
      ? successUrl
      : `${successUrl}${successUrl.includes("?") ? "&" : "?"}session_id={CHECKOUT_SESSION_ID}&token=${encodeURIComponent(publicToken || "recover")}`;
    params.set("return_url", returnUrl);
    if (email) params.set("customer_email", email);
    const items = plannerFlow && plannerLineItems.length
      ? plannerLineItems
      : [{ packageKey: packageKeyResolved, name: productName, amountCents }];
    items.forEach((item, index) => {
      params.set(`line_items[${index}][quantity]`, "1");
      params.set(`line_items[${index}][price_data][currency]`, currency);
      params.set(`line_items[${index}][price_data][unit_amount]`, String(item.amountCents));
      params.set(`line_items[${index}][price_data][product_data][name]`, item.name);
    });
    params.set("metadata[product_family]", "christmas");
    params.set("metadata[product_type]", "christmas");
    params.set("metadata[product_key]", resolvedProductKey);
    params.set("metadata[package_key]", packageKeyResolved);
    params.set("metadata[commercial_key]", pricingKey || "");
    params.set("metadata[sku]", sku);
    params.set("metadata[christmas_order_id]", orderId);
    if (plannerFlow) {
      params.set("metadata[planner]", "1");
      params.set("metadata[addon_keys]", plannerAddonKeys.join(","));
      params.set("metadata[entitlements]", plannerEntitlements.join(","));
    }
    if (guestTokenHash) params.set("metadata[guest_token_hash]", guestTokenHash);
    if (styleKey) params.set("metadata[style_key]", styleKey);
    if (portraitType) params.set("metadata[portrait_type]", portraitType);
    if (species) params.set("metadata[species]", species);
    params.set("payment_intent_data[metadata][product_family]", "christmas");
    params.set("payment_intent_data[metadata][christmas_order_id]", orderId);
    if (guestTokenHash) {
      params.set("payment_intent_data[metadata][guest_token_hash]", guestTokenHash);
    }

    const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeSecret}`,
        "Stripe-Version": "2025-03-31.basil",
        "Content-Type": "application/x-www-form-urlencoded",
        "Idempotency-Key": plannerFlow
          ? `xmas-planner-${orderId}-${packageKeyResolved}-${plannerAddonKeys.join(".")}-${amountCents}`
          : `xmas-checkout-${orderId}`,
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
      amountCents,
      currency,
      uiMode: "custom",
      addonKeys: plannerFlow ? plannerAddonKeys : undefined,
      entitlements: plannerFlow ? plannerEntitlements : undefined,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: message }, 500);
  }
});
