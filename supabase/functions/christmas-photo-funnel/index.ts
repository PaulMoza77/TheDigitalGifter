import { optionsResponse, jsonResponse } from "../_shared/cors.ts";
import { getServiceClient, readJson, isServiceRoleRequest } from "../_shared/supabase.ts";
import { validatePetSpecies } from "../_shared/pet/speciesValidate.ts";

/**
 * Christmas portrait funnel APIs: signed upload, order lookup, species check, admin retry.
 * Pre-payment blur preview is client-side only — this function never calls Replicate generation.
 * Species validation may use vision (Moondream/OpenAI) — not image generation.
 */

type Body = {
  action?: string;
  content_type?: string;
  byte_size?: number;
  width?: number;
  height?: number;
  style_key?: string;
  public_token?: string;
  session_id?: string;
  order_id?: string;
  email?: string;
  image_data_url?: string;
  expected_species?: string;
};

const CONFIRMABLE_PORTRAITS = new Set([
  "christmas_photo",
  "christmas_family",
  "christmas_couple",
]);

const SOURCE_BUCKET = "christmas-source";
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 15 * 1024 * 1024;

function asString(value: unknown): string {
  return String(value ?? "").trim();
}

function browserStorageUrl(req: Request, signedUrl: string): string {
  const forwardedHost = (req.headers.get("x-forwarded-host") || "").split(",")[0].trim();
  const host = forwardedHost || "supabase.thedigitalgifter.com";
  const internal = host === "api-gw" || host.startsWith("localhost") || host.startsWith("127.");
  const publicHost = internal ? "supabase.thedigitalgifter.com" : host;
  const signed = new URL(signedUrl);
  signed.protocol = "https:";
  signed.hostname = publicHost;
  signed.port = "";
  return signed.toString();
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function enqueuePortraitGeneration(orderId: string) {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return;
  void fetch(`${url.replace(/\/$/, "")}/functions/v1/christmas-photo-generate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      apikey: key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ order_id: orderId }),
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const body = await readJson<Body>(req);
    const action = asString(body.action);
    const service = getServiceClient();

    if (action === "createUpload") {
      const contentType = asString(body.content_type).toLowerCase();
      const byteSize = Number(body.byte_size || 0);
      if (!ALLOWED.has(contentType)) {
        return jsonResponse({ error: "Unsupported content type", code: "invalid_photo" }, 400);
      }
      if (!Number.isFinite(byteSize) || byteSize <= 0 || byteSize > MAX_BYTES) {
        return jsonResponse({ error: "Invalid file size", code: "invalid_photo" }, 400);
      }
      const uploadId = crypto.randomUUID();
      const ext = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
      const path = `uploads/${uploadId}.${ext}`;
      const { data, error } = await service.storage
        .from(SOURCE_BUCKET)
        .createSignedUploadUrl(path);
      if (error || !data) {
        return jsonResponse({ error: error?.message || "Could not create upload URL" }, 500);
      }
      return jsonResponse({
        ok: true,
        uploadId,
        path,
        bucket: SOURCE_BUCKET,
        token: data.token,
        signedUrl: data.signedUrl,
        // Explicit contract: upload endpoint never generates AI previews.
        replicate_preview: false,
      });
    }

    if (action === "validateSpecies") {
      const expectedRaw = asString(body.expected_species).toLowerCase();
      if (expectedRaw !== "dog" && expectedRaw !== "cat") {
        return jsonResponse({ error: "expected_species must be dog or cat" }, 400);
      }
      const imageDataUrl = asString(body.image_data_url);
      if (!imageDataUrl.startsWith("data:image/")) {
        return jsonResponse({ error: "image_data_url required", code: "invalid_photo" }, 400);
      }
      // Cap payload size (~2MB base64) to avoid abuse
      if (imageDataUrl.length > 2_800_000) {
        return jsonResponse({ error: "Image too large for species check", code: "invalid_photo" }, 400);
      }
      const result = await validatePetSpecies({
        imageDataUrl,
        expected: expectedRaw,
      });
      if (!result.ok) {
        const switchHint =
          expectedRaw === "dog"
            ? "This looks like a cat. Switch to Christmas Cats?"
            : "This looks like a dog. Switch to Christmas Dogs?";
        return jsonResponse(
          {
            ok: false,
            action: result.action,
            detected: result.detected,
            confidence: result.confidence,
            provider: result.provider,
            errorCode: result.errorCode,
            error: result.errorCode === "wrong_species" ? switchHint : result.error,
            switch_to: result.errorCode === "wrong_species"
              ? (expectedRaw === "dog" ? "/christmas/cats" : "/christmas/dogs")
              : null,
          },
          400,
        );
      }
      return jsonResponse({
        ok: true,
        action: result.action,
        detected: result.detected,
        confidence: result.confidence,
        provider: result.provider,
      });
    }

    if (action === "confirmStripePayment") {
      const token = asString(body.public_token);
      const sessionId = asString(body.session_id);
      if (!token || token.length < 32 || !/^cs_(live|test)_[A-Za-z0-9]+$/.test(sessionId)) {
        return jsonResponse({ error: "invalid confirmation" }, 400);
      }
      const hash = await sha256Hex(token);
      const { data: order, error } = await service
        .from("christmas_orders")
        .select("id,product_key,payment_status,fulfillment_status,stripe_checkout_session_id,amount_cents,currency,email,email_normalized,user_id")
        .eq("public_token_hash", hash)
        .maybeSingle();
      if (error) throw error;
      if (!order) return jsonResponse({ error: "Order not found" }, 404);
      const productKey = asString(order.product_key);
      if (!CONFIRMABLE_PORTRAITS.has(productKey)) {
        return jsonResponse({ error: "unsupported product", code: "unsupported_product" }, 403);
      }
      if (Number(order.amount_cents) !== 499 || asString(order.currency).toLowerCase() !== "eur") {
        return jsonResponse({ error: "price mismatch", code: "price_mismatch" }, 409);
      }
      const boundSession = asString(order.stripe_checkout_session_id);
      if (!boundSession || boundSession !== sessionId) {
        return jsonResponse({ error: "session mismatch", code: "session_mismatch" }, 403);
      }
      const stripeKey = Deno.env.get("STRIPE_SECRET_KEY") || "";
      const keyMode = stripeKey.startsWith("sk_live_") ? "live" : stripeKey.startsWith("sk_test_") ? "test" : "";
      if (!keyMode) return jsonResponse({ error: "Stripe is not configured" }, 503);
      const sessionRes = await fetch(
        `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,
        { headers: { Authorization: `Bearer ${stripeKey}` } },
      );
      const session = await sessionRes.json();
      if (!sessionRes.ok) {
        return jsonResponse({ error: "Could not verify payment" }, 502);
      }
      const liveMode = session?.livemode === true;
      if ((keyMode === "live") !== liveMode) {
        return jsonResponse({ error: "mode mismatch", code: "mode_mismatch" }, 403);
      }
      if (asString(session?.status) !== "complete" || asString(session?.payment_status) !== "paid") {
        return jsonResponse({ ok: true, status: "not_paid", paymentStatus: asString(session?.payment_status) });
      }
      const amountTotal = Number(session?.amount_total);
      const currency = asString(session?.currency).toLowerCase();
      if (amountTotal !== 499 || currency !== "eur") {
        return jsonResponse({ error: "price mismatch", code: "price_mismatch" }, 409);
      }
      const sessionMeta = (session?.metadata || {}) as Record<string, unknown>;
      if (asString(sessionMeta.christmas_order_id) !== asString(order.id)) {
        return jsonResponse({ error: "session mismatch", code: "session_mismatch" }, 403);
      }
      if (asString(sessionMeta.product_key) !== productKey || asString(sessionMeta.product_family) !== "christmas") {
        return jsonResponse({ error: "product mismatch", code: "product_mismatch" }, 403);
      }
      const sessionEmail = asString(session?.customer_details?.email || session?.customer_email).toLowerCase();
      const orderEmail = asString(order.email_normalized || order.email).toLowerCase();
      if (orderEmail && sessionEmail && orderEmail !== sessionEmail) {
        return jsonResponse({ error: "customer mismatch", code: "customer_mismatch" }, 403);
      }
      const metaUser = asString(sessionMeta.user_id);
      if (order.user_id && metaUser && metaUser !== asString(order.user_id)) {
        return jsonResponse({ error: "customer mismatch", code: "customer_mismatch" }, 403);
      }
      const { data, error: rpcError } = await service.rpc("fulfill_christmas_order_payment", {
        p_order_id: order.id,
        p_stripe_session_id: sessionId,
        p_stripe_payment_intent_id: asString(session?.payment_intent) || null,
        p_amount_cents: amountTotal,
        p_currency: currency,
        p_stripe_event_id: `confirm:${sessionId}`,
      });
      if (rpcError) throw rpcError;
      const result = (data || {}) as { ok?: boolean; status?: string; fulfillment_status?: string };
      if (result.ok !== true) {
        return jsonResponse({ ok: false, status: result.status || "rejected" }, 409);
      }
      const fulfillment = asString(result.fulfillment_status || order.fulfillment_status);
      if (fulfillment !== "completed") {
        const { data: job } = await service
          .from("christmas_generation_jobs")
          .select("status,claimed_at")
          .eq("order_id", order.id)
          .maybeSingle();
        const claimedAt = job?.claimed_at ? Date.parse(String(job.claimed_at)) : 0;
        const runningFresh = job?.status === "running" && claimedAt > 0 && Date.now() - claimedAt < 3 * 60 * 1000;
        if (job?.status !== "succeeded" && !runningFresh) {
          enqueuePortraitGeneration(asString(order.id));
        }
      }
      return jsonResponse({
        ok: true,
        status: result.status || "paid",
        fulfillment_status: fulfillment,
      });
    }

    if (action === "getOrder") {
      const token = asString(body.public_token);
      if (!token || token.length < 32) {
        return jsonResponse({ error: "Invalid token" }, 400);
      }
      const hash = await sha256Hex(token);
      const { data: order, error } = await service
        .from("christmas_orders")
        .select(
          "id,product_key,package_key,style_key,payment_status,fulfillment_status,amount_cents,currency,last_error,created_at,paid_at,generation_started_at,generation_finished_at,model_name,result_asset_id,portrait_type,species,source_route,landing_path,metadata",
        )
        .eq("public_token_hash", hash)
        .maybeSingle();
      if (error) throw error;
      if (!order) return jsonResponse({ error: "Order not found" }, 404);

      let resultUrl: string | null = null;
      if (order.result_asset_id) {
        const { data: asset } = await service
          .from("christmas_order_assets")
          .select("storage_bucket,storage_path")
          .eq("id", order.result_asset_id)
          .maybeSingle();
        if (asset?.storage_bucket && asset?.storage_path) {
          const signed = await service.storage
            .from(asset.storage_bucket)
            .createSignedUrl(asset.storage_path, 60 * 15);
          resultUrl = signed.data?.signedUrl ? browserStorageUrl(req, signed.data.signedUrl) : null;
        }
      }

      return jsonResponse({
        ok: true,
        order: {
          ...order,
          resultUrl,
        },
      });
    }

    if (action === "retryGeneration") {
      if (!isServiceRoleRequest(req)) {
        return jsonResponse({ error: "Forbidden" }, 403);
      }
      const orderId = asString(body.order_id);
      if (!orderId) return jsonResponse({ error: "order_id required" }, 400);
      const { data: order } = await service
        .from("christmas_orders")
        .select("id,payment_status,fulfillment_status")
        .eq("id", orderId)
        .maybeSingle();
      if (!order || order.payment_status !== "paid") {
        return jsonResponse({ error: "payment_required" }, 402);
      }
      await service.from("christmas_generation_jobs").upsert(
        {
          order_id: orderId,
          status: "queued",
          last_error: null,
        },
        { onConflict: "order_id" },
      );
      await service
        .from("christmas_orders")
        .update({ fulfillment_status: "queued", last_error: null })
        .eq("id", orderId);

      enqueuePortraitGeneration(orderId);
      return jsonResponse({ ok: true, queued: true });
    }

    return jsonResponse({ error: "Unknown action" }, 400);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: message }, 500);
  }
});
