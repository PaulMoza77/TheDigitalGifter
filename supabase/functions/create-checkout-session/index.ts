import { optionsResponse, jsonResponse } from "../_shared/cors.ts";
import { getAuthUser, getServiceClient, readJson } from "../_shared/supabase.ts";
import { isCheckoutEnabledOnServer, mvpProduct } from "../_shared/mvpProduct.ts";

type Body = {
  email?: string;
  template_id?: string;
  style_id?: string;
  funnel_slug?: string;
  occasion?: string;
  photo_path?: string;
  photo_bucket?: string;
  digital_content_consent?: boolean;
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

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    if (!isCheckoutEnabledOnServer()) {
      return jsonResponse(
        {
          error:
            "Checkout is temporarily unavailable while payment and delivery are being verified.",
        },
        503,
      );
    }

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      return jsonResponse({ error: "STRIPE_SECRET_KEY is not configured." }, 503);
    }

    const { user } = await getAuthUser(req);
    const body = await readJson<Body>(req);
    const email = firstString(body.email, user?.email).toLowerCase();
    if (!isEmail(email)) return jsonResponse({ error: "A valid email is required." }, 400);
    if (!body.digital_content_consent) {
      return jsonResponse(
        {
          error:
            "You must agree to immediate supply of digital content and that the withdrawal right is lost once generation starts.",
        },
        400,
      );
    }

    const photoPath = firstString(body.photo_path);
    const photoBucket = firstString(body.photo_bucket, "customer-uploads");
    if (!photoPath) return jsonResponse({ error: "Upload a photo first." }, 400);

    const service = getServiceClient();
    const siteUrl =
      Deno.env.get("SITE_URL") || Deno.env.get("PUBLIC_APP_URL") || "http://127.0.0.1:5173";

    const uploadExpires = new Date(
      Date.now() + mvpProduct.uploadRetentionHours * 60 * 60 * 1000,
    ).toISOString();
    const resultExpires = new Date(
      Date.now() + mvpProduct.resultRetentionDays * 24 * 60 * 60 * 1000,
    ).toISOString();

    const { data: generation, error: genErr } = await service
      .from("generations")
      .insert({
        status: "pending",
        email,
        user_email: email,
        user_id: user?.id ?? null,
        template_id: firstString(body.template_id) || null,
        style_id: firstString(body.style_id) || null,
        style_slug: firstString(body.style_id, body.funnel_slug) || null,
        source_image_url: `${photoBucket}/${photoPath}`,
        attempt_kind: "initial",
        attempt_count: 0,
        upload_expires_at: uploadExpires,
        result_expires_at: resultExpires,
        prompt: firstString(body.style_id, body.occasion, "personalized still image"),
      })
      .select("id")
      .single();

    if (genErr || !generation?.id) {
      throw new Error(genErr?.message || "Could not create generation");
    }

    const { data: order, error: orderErr } = await service
      .from("mvp_orders")
      .insert({
        email,
        user_id: user?.id ?? null,
        status: "pending",
        sku: mvpProduct.sku,
        amount_cents: mvpProduct.amountCents,
        currency: mvpProduct.currency,
        generation_id: generation.id,
        template_id: firstString(body.template_id) || null,
        style_id: firstString(body.style_id) || null,
        occasion: firstString(body.occasion, body.funnel_slug) || null,
        photo_bucket: photoBucket,
        photo_path: photoPath,
        included_regenerations_allowed: mvpProduct.includedRegenerations,
        included_regenerations_used: 0,
        digital_content_consent: true,
        license: mvpProduct.license,
        upload_expires_at: uploadExpires,
        result_expires_at: resultExpires,
      })
      .select("id")
      .single();

    if (orderErr || !order?.id) {
      throw new Error(orderErr?.message || "Could not create order");
    }

    await service.from("generations").update({ order_id: order.id }).eq("id", generation.id);

    const successUrl =
      firstString(body.success_url) ||
      `${siteUrl}/funnel/result?session_id={CHECKOUT_SESSION_ID}&order_id=${order.id}&generation_id=${generation.id}`;
    const cancelUrl =
      firstString(body.cancel_url) ||
      `${siteUrl}/funnel/payment?canceled=1`;

    const params = new URLSearchParams();
    params.set("mode", "payment");
    params.set("success_url", successUrl);
    params.set("cancel_url", cancelUrl);
    params.set("customer_email", email);
    params.set("client_reference_id", order.id);

    const configuredPrice = firstString(Deno.env.get("STRIPE_PRICE_ID_STILL_IMAGE"));
    if (configuredPrice) {
      params.set("line_items[0][price]", configuredPrice);
      params.set("line_items[0][quantity]", "1");
    } else {
      params.set("line_items[0][quantity]", "1");
      params.set("line_items[0][price_data][currency]", mvpProduct.currency);
      params.set("line_items[0][price_data][unit_amount]", String(mvpProduct.amountCents));
      params.set("line_items[0][price_data][product_data][name]", mvpProduct.name);
      params.set(
        "line_items[0][price_data][product_data][description]",
        "One still image plus one included regeneration. Personal use.",
      );
    }

    params.set("metadata[order_id]", order.id);
    params.set("metadata[generation_id]", generation.id);
    params.set("metadata[sku]", mvpProduct.sku);
    params.set("metadata[email]", email);
    if (user?.id) params.set("metadata[user_id]", user.id);

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

    await service
      .from("mvp_orders")
      .update({ stripe_checkout_session_id: session.id, updated_at: new Date().toISOString() })
      .eq("id", order.id);

    await service
      .from("generations")
      .update({
        stripe_session_id: session.id,
        checkout_session_id: session.id,
      })
      .eq("id", generation.id);

    return jsonResponse({
      url: session.url,
      checkoutUrl: session.url,
      sessionUrl: session.url,
      checkout_url: session.url,
      id: session.id,
      order_id: order.id,
      generation_id: generation.id,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: message }, 500);
  }
});
