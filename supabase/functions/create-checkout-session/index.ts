import { optionsResponse, jsonResponse } from "../_shared/cors.ts";
import { getAuthUser, getServiceClient, readJson } from "../_shared/supabase.ts";
import { isCheckoutEnabledOnServer, mvpProduct } from "../_shared/mvpProduct.ts";
import { authorizeUploadAccess, verifyAccessToken } from "../_shared/guestToken.ts";
import { accessTokenSecret, sha256Hex } from "../_shared/access.ts";
import { isServerManagedUploadPath, UPLOAD_BUCKET } from "../_shared/uploadPath.ts";
import { checkoutReturnUrls, configuredAppOrigin, randomRedeemCode } from "../_shared/appOrigin.ts";
import { isStillImageTemplate, TEMPLATE_ACTIVE_COLUMN } from "../_shared/generationRecovery.ts";
import {
  stripeCheckoutIdempotencyKey,
  stripeExpireSessionPath,
} from "../_shared/stripePayment.ts";

type Body = {
  email?: string;
  template_id?: string;
  style_id?: string;
  funnel_slug?: string;
  occasion?: string;
  upload_id?: string;
  access_token?: string;
  accessToken?: string;
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

async function expireStripeCheckoutSession(stripeKey: string, sessionId: string) {
  const id = String(sessionId || "").trim();
  if (!id) return;
  await fetch(`https://api.stripe.com${stripeExpireSessionPath(id)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${stripeKey}` },
  }).catch(() => undefined);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  let stripeKey = "";
  let stripeSessionId = "";
  let createdOrderId = "";

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

    stripeKey = Deno.env.get("STRIPE_SECRET_KEY") || "";
    if (!stripeKey) {
      return jsonResponse({ error: "STRIPE_SECRET_KEY is not configured." }, 503);
    }

    const secret = accessTokenSecret();
    const origin = configuredAppOrigin(Deno.env.get("SITE_URL"));

    const { user } = await getAuthUser(req);
    const body = await readJson<Body>(req);
    void body.success_url;
    void body.cancel_url;
    void body.photo_path;
    void body.photo_bucket;

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

    const uploadId = firstString(body.upload_id);
    const uploadToken = firstString(body.access_token, body.accessToken);
    if (!uploadId) {
      return jsonResponse({ error: "A confirmed upload is required." }, 400);
    }

    const token = uploadToken
      ? await verifyAccessToken(uploadToken, secret, { typ: "upload", id: uploadId })
      : null;

    const service = getServiceClient();
    const { data: upload, error: uploadErr } = await service
      .from("upload_sessions")
      .select("*")
      .eq("id", uploadId)
      .maybeSingle();
    if (uploadErr) throw uploadErr;
    if (!upload || upload.status !== "confirmed") {
      return jsonResponse({ error: "Confirm the photo upload before checkout." }, 400);
    }
    if (upload.bucket !== UPLOAD_BUCKET || !isServerManagedUploadPath(String(upload.path))) {
      return jsonResponse({ error: "Invalid upload path" }, 400);
    }

    const allowed = authorizeUploadAccess({
      uploadUserId: upload.user_id ? String(upload.user_id) : null,
      authUserId: user?.id ?? null,
      tokenOk: Boolean(token),
      expiresAt: upload.expires_at ? String(upload.expires_at) : null,
    });
    if (!allowed) return jsonResponse({ error: "Unauthorized" }, 401);

    const templateId = firstString(body.template_id);
    if (!templateId) {
      return jsonResponse({ error: "A valid template is required." }, 400);
    }
    const { data: tmpl, error: tmplErr } = await service
      .from("templates")
      .select(`id, prompt, ${TEMPLATE_ACTIVE_COLUMN}, type`)
      .eq("id", templateId)
      .maybeSingle();
    if (tmplErr) {
      return jsonResponse({ error: "template_lookup_failed", detail: tmplErr.message }, 500);
    }
    const templateCheck = isStillImageTemplate({
      exists: Boolean(tmpl),
      active: tmpl?.isactive === true,
      type: tmpl?.type ?? null,
      prompt: tmpl?.prompt ?? null,
    });
    if (!templateCheck.ok) {
      return jsonResponse({ error: templateCheck.error }, 400);
    }
    const templatePrompt = templateCheck.prompt;

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
        user_id: user?.id ?? upload.user_id ?? null,
        template_id: templateId,
        style_id: firstString(body.style_id) || null,
        style_slug: firstString(body.style_id, body.funnel_slug) || null,
        source_image_url: `${UPLOAD_BUCKET}/${upload.path}`,
        attempt_kind: "initial",
        attempt_count: 0,
        upload_expires_at: uploadExpires,
        result_expires_at: resultExpires,
        prompt: templatePrompt,
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
        user_id: user?.id ?? upload.user_id ?? null,
        status: "pending",
        sku: mvpProduct.sku,
        amount_cents: mvpProduct.amountCents,
        currency: mvpProduct.currency,
        generation_id: generation.id,
        template_id: templateId,
        style_id: firstString(body.style_id) || null,
        occasion: firstString(body.occasion, body.funnel_slug) || null,
        photo_bucket: UPLOAD_BUCKET,
        photo_path: upload.path,
        upload_id: uploadId,
        template_prompt: templatePrompt,
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
      await service.from("generations").delete().eq("id", generation.id);
      const duplicate = String(orderErr?.message || "").toLowerCase().includes("mvp_orders_one_live_upload")
        || String(orderErr?.code || "") === "23505";
      if (duplicate) {
        return jsonResponse({ error: "This upload is already attached to an order." }, 409);
      }
      throw new Error(orderErr?.message || "Could not create order");
    }
    createdOrderId = order.id;

    await service.from("generations").update({ order_id: order.id }).eq("id", generation.id);

    const redeemCode = randomRedeemCode();
    const { error: redeemErr } = await service.from("access_redeem_codes").insert({
      code_hash: await sha256Hex(redeemCode),
      order_id: order.id,
      expires_at: resultExpires,
    });
    if (redeemErr) throw redeemErr;

    const { successUrl, cancelUrl } = checkoutReturnUrls(origin, {
      orderId: order.id,
      generationId: generation.id,
      redeemCode,
    });

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
        "Idempotency-Key": stripeCheckoutIdempotencyKey(order.id),
      },
      body: params,
    });
    const session = await stripeRes.json();
    if (!stripeRes.ok) {
      await service
        .from("mvp_orders")
        .update({ status: "canceled", error: "stripe_checkout_failed", updated_at: new Date().toISOString() })
        .eq("id", order.id);
      return jsonResponse({ error: session.error?.message || "Stripe checkout failed" }, 502);
    }
    stripeSessionId = String(session.id || "");

    const cancelAfterStripe = async (error: string, status = 409) => {
      await expireStripeCheckoutSession(stripeKey, stripeSessionId);
      await service
        .from("mvp_orders")
        .update({ status: "canceled", error, updated_at: new Date().toISOString() })
        .eq("id", order.id);
      return jsonResponse({ error: error === "upload_unavailable"
        ? "This upload is no longer available for checkout."
        : error }, status);
    };

    const { data: consumed, error: consumeErr } = await service.rpc("consume_confirmed_upload", {
      p_upload_id: uploadId,
      p_order_id: order.id,
    });
    if (consumeErr || !consumed?.ok) {
      return await cancelAfterStripe("upload_unavailable", 409);
    }

    const { error: orderUpdateErr } = await service
      .from("mvp_orders")
      .update({ stripe_checkout_session_id: session.id, updated_at: new Date().toISOString() })
      .eq("id", order.id);
    if (orderUpdateErr) {
      return await cancelAfterStripe("order_update_failed", 500);
    }

    const { error: genUpdateErr } = await service
      .from("generations")
      .update({
        stripe_session_id: session.id,
        checkout_session_id: session.id,
      })
      .eq("id", generation.id);
    if (genUpdateErr) {
      return await cancelAfterStripe("generation_update_failed", 500);
    }

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
    if (stripeSessionId && stripeKey) {
      await expireStripeCheckoutSession(stripeKey, stripeSessionId);
    }
    if (createdOrderId && stripeSessionId) {
      try {
        const service = getServiceClient();
        await service
          .from("mvp_orders")
          .update({ status: "canceled", error: "checkout_failed_after_stripe", updated_at: new Date().toISOString() })
          .eq("id", createdOrderId);
      } catch {
        // Best-effort cancel; the expired Stripe session cannot be paid.
      }
    }
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: message }, 500);
  }
});
