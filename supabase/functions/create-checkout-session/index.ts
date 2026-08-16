import { optionsResponse, jsonResponse } from "../_shared/cors.ts";
import { getAuthUser, getServiceClient, readJson } from "../_shared/supabase.ts";
import { isCheckoutEnabledOnServer, mvpProduct } from "../_shared/mvpProduct.ts";
import { authorizeUploadAccess, verifyAccessToken } from "../_shared/guestToken.ts";
import { accessTokenSecret, sha256Hex } from "../_shared/access.ts";
import { hmacSha256Hex } from "../_shared/stripe.ts";
import { isServerManagedUploadPath, UPLOAD_BUCKET } from "../_shared/uploadPath.ts";
import { checkoutReturnUrls, configuredAppOrigin } from "../_shared/appOrigin.ts";
import { isStillImageTemplate, TEMPLATE_ACTIVE_COLUMN } from "../_shared/generationRecovery.ts";
import {
  stripeCheckoutIdempotencyKey,
  stripeExpireConfirmed,
  stripeExpireSessionPath,
  stripeSessionRetrievePath,
} from "../_shared/stripePayment.ts";
import {
  canReusePendingCheckout,
  checkoutRedeemKey,
  parseCheckoutRequestId,
  stripeCheckoutReuseAction,
} from "../_shared/checkoutRetry.ts";
import { persistedRowCount, requirePersistedWrite } from "../_shared/persistWrite.ts";

type Body = {
  email?: string;
  template_id?: string;
  style_id?: string;
  funnel_slug?: string;
  occasion?: string;
  upload_id?: string;
  access_token?: string;
  accessToken?: string;
  checkout_request_id?: string;
  photo_path?: string;
  photo_bucket?: string;
  digital_content_consent?: boolean;
  success_url?: string;
  cancel_url?: string;
};

type StripeSessionView = {
  httpOk: boolean;
  httpStatus: number;
  id: string;
  status: string;
  url: string;
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

async function readStripeJson(res: Response | null): Promise<Record<string, unknown>> {
  if (!res) return {};
  const body = await res.json().catch(() => ({}));
  return body && typeof body === "object" ? body as Record<string, unknown> : {};
}

function stripeSessionView(res: Response | null, body: Record<string, unknown>): StripeSessionView {
  return {
    httpOk: Boolean(res?.ok),
    httpStatus: res?.status ?? 0,
    id: firstString(body.id),
    status: firstString(body.status).toLowerCase(),
    url: firstString(body.url),
  };
}

async function retrieveStripeCheckoutSession(stripeKey: string, sessionId: string): Promise<StripeSessionView> {
  const id = String(sessionId || "").trim();
  if (!id) return { httpOk: false, httpStatus: 0, id: "", status: "", url: "" };
  const res = await fetch(`https://api.stripe.com${stripeSessionRetrievePath(id)}`, {
    headers: { Authorization: `Bearer ${stripeKey}` },
  }).catch(() => null);
  return stripeSessionView(res, await readStripeJson(res));
}

async function expireStripeCheckoutSession(stripeKey: string, sessionId: string) {
  const id = String(sessionId || "").trim();
  if (!id) return { confirmedExpired: false, sessionStatus: null as string | null };
  const expireRes = await fetch(`https://api.stripe.com${stripeExpireSessionPath(id)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${stripeKey}` },
  }).catch(() => null);
  const expireBody = await readStripeJson(expireRes);
  const expireView = stripeSessionView(expireRes, expireBody);
  let getView: StripeSessionView = { httpOk: false, httpStatus: 0, id, status: "", url: "" };
  const firstPass = stripeExpireConfirmed({
    expireHttpOk: expireView.httpOk,
    expireHttpStatus: expireView.httpStatus,
    expireSessionStatus: expireView.status,
  });
  if (!firstPass.confirmedExpired) {
    getView = await retrieveStripeCheckoutSession(stripeKey, id);
  }
  return stripeExpireConfirmed({
    expireHttpOk: expireView.httpOk,
    expireHttpStatus: expireView.httpStatus,
    expireSessionStatus: expireView.status,
    getHttpOk: getView.httpOk,
    getHttpStatus: getView.httpStatus,
    getSessionStatus: getView.status,
  });
}

function checkoutResponse(session: { id: string; url: string }, orderId: string, generationId: string) {
  return jsonResponse({
    url: session.url,
    checkoutUrl: session.url,
    sessionUrl: session.url,
    checkout_url: session.url,
    id: session.id,
    order_id: orderId,
    generation_id: generationId,
  });
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
    if (!upload || (upload.status !== "confirmed" && upload.status !== "consumed")) {
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

    const checkoutRequestId = parseCheckoutRequestId(body.checkout_request_id) || crypto.randomUUID();

    let existingOrder: {
      id: string;
      generation_id: string | null;
      stripe_checkout_session_id: string | null;
      status: string;
      checkout_request_id: string | null;
    } | null = null;

    const { data: byRequest, error: byRequestErr } = await service
      .from("mvp_orders")
      .select("id, generation_id, stripe_checkout_session_id, status, checkout_request_id")
      .eq("checkout_request_id", checkoutRequestId)
      .maybeSingle();
    if (byRequestErr) throw byRequestErr;
    if (byRequest) existingOrder = byRequest;

    if (!existingOrder) {
      const { data: byUpload, error: byUploadErr } = await service
        .from("mvp_orders")
        .select("id, generation_id, stripe_checkout_session_id, status, checkout_request_id")
        .eq("upload_id", uploadId)
        .neq("status", "canceled")
        .maybeSingle();
      if (byUploadErr) throw byUploadErr;
      if (byUpload) existingOrder = byUpload;
    }

    const uploadExpires = new Date(
      Date.now() + mvpProduct.uploadRetentionHours * 60 * 60 * 1000,
    ).toISOString();
    const resultExpires = new Date(
      Date.now() + mvpProduct.resultRetentionDays * 24 * 60 * 60 * 1000,
    ).toISOString();

    let orderId = "";
    let generationId = "";
    const storedRequestId = parseCheckoutRequestId(existingOrder?.checkout_request_id) || checkoutRequestId;
    const redeemCode = await hmacSha256Hex(secret, checkoutRedeemKey(storedRequestId));

    if (existingOrder && canReusePendingCheckout(existingOrder.status)) {
      orderId = existingOrder.id;
      generationId = String(existingOrder.generation_id || "");
      if (!generationId) {
        return jsonResponse({ error: "existing_checkout_missing_generation" }, 500);
      }
      createdOrderId = orderId;
    } else if (existingOrder) {
      return jsonResponse({
        error: "This upload is already attached to an order.",
        order_id: existingOrder.id,
        reconcilable: existingOrder.status !== "canceled",
      }, 409);
    } else {
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
          checkout_request_id: storedRequestId,
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
        const { data: deleted, error: delErr } = await service
          .from("generations")
          .delete()
          .eq("id", generation.id)
          .select("id");
        requirePersistedWrite({
          error: delErr,
          rowCount: persistedRowCount(deleted),
          label: "generation_cleanup",
        });
        const duplicate = String(orderErr?.message || "").toLowerCase().includes("mvp_orders_one_live_upload")
          || String(orderErr?.code || "") === "23505";
        if (duplicate) {
          const { data: raced, error: racedErr } = await service
            .from("mvp_orders")
            .select("id, generation_id, stripe_checkout_session_id, status, checkout_request_id")
            .eq("upload_id", uploadId)
            .neq("status", "canceled")
            .maybeSingle();
          if (racedErr) throw racedErr;
          if (raced && canReusePendingCheckout(raced.status) && raced.generation_id) {
            existingOrder = raced;
            orderId = raced.id;
            generationId = String(raced.generation_id);
            createdOrderId = orderId;
          } else {
            return jsonResponse({ error: "This upload is already attached to an order." }, 409);
          }
        } else {
          throw new Error(orderErr?.message || "Could not create order");
        }
      } else {
        orderId = order.id;
        generationId = generation.id;
        createdOrderId = order.id;
        const { data: linked, error: linkErr } = await service
          .from("generations")
          .update({ order_id: order.id })
          .eq("id", generation.id)
          .select("id");
        requirePersistedWrite({
          error: linkErr,
          rowCount: persistedRowCount(linked),
          label: "generation_order_link",
        });
      }
    }

    const { error: redeemErr } = await service.from("access_redeem_codes").upsert({
      code_hash: await sha256Hex(redeemCode),
      order_id: orderId,
      expires_at: resultExpires,
    }, { onConflict: "code_hash" });
    if (redeemErr) throw redeemErr;

    const { successUrl, cancelUrl } = checkoutReturnUrls(origin, {
      orderId,
      generationId,
      redeemCode,
    });

    const params = new URLSearchParams();
    params.set("mode", "payment");
    params.set("success_url", successUrl);
    params.set("cancel_url", cancelUrl);
    params.set("customer_email", email);
    params.set("client_reference_id", orderId);

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

    params.set("metadata[order_id]", orderId);
    params.set("metadata[generation_id]", generationId);
    params.set("metadata[sku]", mvpProduct.sku);
    params.set("metadata[email]", email);
    params.set("metadata[checkout_request_id]", storedRequestId);
    if (user?.id) params.set("metadata[user_id]", user.id);

    const existingSessionId = firstString(existingOrder?.stripe_checkout_session_id);
    if (existingSessionId) {
      const existingSession = await retrieveStripeCheckoutSession(stripeKey, existingSessionId);
      const reuse = stripeCheckoutReuseAction({
        sessionId: existingSession.id || existingSessionId,
        sessionStatus: existingSession.status,
        sessionUrl: existingSession.url,
      });
      if (reuse === "paid_keep_pending") {
        return jsonResponse({
          error: "checkout_already_paid",
          order_id: orderId,
          generation_id: generationId,
          reconcilable: true,
        }, 409);
      }
      if (reuse === "return_existing") {
        stripeSessionId = existingSession.id || existingSessionId;
        return checkoutResponse(
          { id: stripeSessionId, url: existingSession.url },
          orderId,
          generationId,
        );
      }
    }

    const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Idempotency-Key": stripeCheckoutIdempotencyKey(orderId),
      },
      body: params,
    });
    const session = await stripeRes.json();
    if (!stripeRes.ok) {
      return jsonResponse({
        error: session.error?.message || "Stripe checkout failed",
        order_id: orderId,
        reconcilable: true,
      }, 502);
    }
    stripeSessionId = String(session.id || "");

    const cancelAfterStripe = async (error: string, status = 409) => {
      const expiry = await expireStripeCheckoutSession(stripeKey, stripeSessionId);
      if (!expiry.confirmedExpired) {
        return jsonResponse({
          error,
          order_id: orderId,
          generation_id: generationId,
          reconcilable: true,
          stripe_status: expiry.sessionStatus,
        }, status);
      }
      const { error: cancelErr } = await service
        .from("mvp_orders")
        .update({ status: "canceled", error, updated_at: new Date().toISOString() })
        .eq("id", orderId)
        .eq("status", "pending");
      if (cancelErr) {
        return jsonResponse({ error: cancelErr.message, reconcilable: true, order_id: orderId }, 500);
      }
      return jsonResponse({
        error: error === "upload_unavailable"
          ? "This upload is no longer available for checkout."
          : error,
      }, status);
    };

    const { data: consumed, error: consumeErr } = await service.rpc("consume_confirmed_upload", {
      p_upload_id: uploadId,
      p_order_id: orderId,
    });
    if (consumeErr) {
      return await cancelAfterStripe("upload_consume_failed", 500);
    }
    if (!consumed?.ok) {
      return await cancelAfterStripe("upload_unavailable", 409);
    }

    const { data: updatedOrder, error: orderUpdateErr } = await service
      .from("mvp_orders")
      .update({
        stripe_checkout_session_id: session.id,
        checkout_request_id: storedRequestId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId)
      .select("id");
    if (orderUpdateErr || persistedRowCount(updatedOrder) < 1) {
      return await cancelAfterStripe(orderUpdateErr?.message || "order_update_failed", 500);
    }

    const { data: updatedGen, error: genUpdateErr } = await service
      .from("generations")
      .update({
        stripe_session_id: session.id,
        checkout_session_id: session.id,
      })
      .eq("id", generationId)
      .select("id");
    if (genUpdateErr || persistedRowCount(updatedGen) < 1) {
      return await cancelAfterStripe(genUpdateErr?.message || "generation_update_failed", 500);
    }

    return checkoutResponse(
      { id: String(session.id || ""), url: String(session.url || "") },
      orderId,
      generationId,
    );
  } catch (err) {
    if (stripeSessionId && stripeKey) {
      const expiry = await expireStripeCheckoutSession(stripeKey, stripeSessionId);
      if (createdOrderId && expiry.confirmedExpired) {
        try {
          const service = getServiceClient();
          const { error: cancelErr } = await service
            .from("mvp_orders")
            .update({ status: "canceled", error: "checkout_failed_after_stripe", updated_at: new Date().toISOString() })
            .eq("id", createdOrderId)
            .eq("status", "pending");
          if (cancelErr) throw cancelErr;
        } catch {
          return jsonResponse({
            error: err instanceof Error ? err.message : String(err),
            reconcilable: true,
            order_id: createdOrderId,
          }, 500);
        }
      } else if (createdOrderId && !expiry.confirmedExpired) {
        const message = err instanceof Error ? err.message : String(err);
        return jsonResponse({
          error: message,
          reconcilable: true,
          order_id: createdOrderId,
          stripe_status: expiry.sessionStatus,
        }, 500);
      }
    }
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: message }, 500);
  }
});
