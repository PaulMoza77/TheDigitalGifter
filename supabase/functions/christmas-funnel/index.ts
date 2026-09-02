import { optionsResponse, jsonResponse } from "../_shared/cors.ts";
import { getServiceClient, getAuthUser, readJson } from "../_shared/supabase.ts";
import {
  CHRISTMAS_PACKS,
  CHRISTMAS_PRODUCT_TYPE,
  CHRISTMAS_RESULT_BUCKET,
  CHRISTMAS_SIGNED_DOWNLOAD_SECONDS,
  CHRISTMAS_SIGNED_UPLOAD_SECONDS,
  CHRISTMAS_SOURCE_BUCKET,
  STARTER_SCENE_KEYS,
  sceneByKey,
  siteOrigin,
  type ChristmasPackKey,
} from "../_shared/christmas/constants.ts";
import {
  asInt,
  asString,
  encryptPublicToken,
  extensionFromContentType,
  generatePublicToken,
  isUuid,
  sha256Hex,
} from "../_shared/christmas/crypto.ts";
import { enqueueChristmasGenerate } from "../_shared/christmas/stripeFulfill.ts";

type Body = Record<string, unknown>;

const STRIPE_API_VERSION_CUSTOM = "2025-03-31.basil";
/** Elements Checkout (`ui_mode: elements`) — match pet V2 Dahlia quickstart. */
const STRIPE_API_VERSION_ELEMENTS = "2026-07-29.dahlia";

const ALLOWED_PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_PHOTO_BYTES = 15 * 1024 * 1024;
const PAID_STATUSES = ["paid", "generating", "awaiting_qc", "complete", "partial_failure"] as const;

function apiError(code: string, message: string, status = 400, extra: Record<string, unknown> = {}) {
  return jsonResponse({ error: message, code, ...extra }, status);
}

function stripeAuthHeaders(
  stripeKey: string,
  extra: Record<string, string> = {},
  apiVersion: string = STRIPE_API_VERSION_CUSTOM,
): Record<string, string> {
  return {
    Authorization: `Bearer ${stripeKey}`,
    "Stripe-Version": apiVersion,
    ...extra,
  };
}

function normalizeUiMode(raw: string): "hosted" | "elements" {
  return raw.trim().toLowerCase() === "elements" ? "elements" : "hosted";
}

function packKeyOrDefault(value: unknown): ChristmasPackKey {
  const key = asString(value);
  if (key === "magic" || key === "ultimate" || key === "starter") return key;
  return "starter";
}

function resolveSceneKeys(packKey: ChristmasPackKey, requested: unknown): string[] {
  const fromBody = Array.isArray(requested)
    ? requested.map((k) => asString(k)).filter((k) => Boolean(sceneByKey(k)))
    : [];
  const pack = CHRISTMAS_PACKS[packKey];
  if (fromBody.length >= pack.imageCount) return fromBody.slice(0, pack.imageCount);
  if (packKey === "starter") return [...STARTER_SCENE_KEYS];
  if (fromBody.length) return fromBody;
  return [...STARTER_SCENE_KEYS];
}

function decryptStoredToken(ciphertext: string | null | undefined): string | null {
  if (!ciphertext) return null;
  try {
    return atob(ciphertext);
  } catch {
    return null;
  }
}

async function requireOrder(
  service: ReturnType<typeof getServiceClient>,
  orderId: string,
  publicToken: string,
) {
  if (!isUuid(orderId) || !publicToken) return null;
  const hash = await sha256Hex(publicToken);
  const { data, error } = await service
    .from("christmas_v2_orders")
    .select("*")
    .eq("id", orderId)
    .eq("public_token_hash", hash)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function findOrderByToken(service: ReturnType<typeof getServiceClient>, publicToken: string) {
  if (!publicToken) return null;
  const hash = await sha256Hex(publicToken);
  const { data, error } = await service
    .from("christmas_v2_orders")
    .select("*")
    .eq("public_token_hash", hash)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function insertScenes(
  service: ReturnType<typeof getServiceClient>,
  orderId: string,
  sceneKeys: string[],
) {
  if (!sceneKeys.length) return;
  const rows = sceneKeys.map((key, index) => {
    const def = sceneByKey(key);
    return {
      order_id: orderId,
      scene_key: key,
      scene_number: index + 1,
      title: def?.label || key,
      status: "queued",
    };
  });
  const { error } = await service.from("christmas_v2_order_scenes").insert(rows);
  if (error) throw error;
}

async function insertVideos(
  service: ReturnType<typeof getServiceClient>,
  orderId: string,
  sourceSceneKeys: string[],
) {
  if (!sourceSceneKeys.length) return;
  const rows = sourceSceneKeys.map((key) => ({
    order_id: orderId,
    source_scene_key: key,
    status: "queued",
  }));
  const { error } = await service.from("christmas_v2_order_videos").insert(rows);
  if (error) throw error;
}

async function signedDownload(
  service: ReturnType<typeof getServiceClient>,
  bucket: string,
  path: string | null | undefined,
) {
  if (!path) return null;
  const { data, error } = await service.storage
    .from(bucket)
    .createSignedUrl(path, CHRISTMAS_SIGNED_DOWNLOAD_SECONDS);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

async function buildOrderResults(
  service: ReturnType<typeof getServiceClient>,
  order: Record<string, unknown>,
  publicToken: string,
) {
  const orderId = asString(order.id);
  const [{ data: scenes }, { data: videos }] = await Promise.all([
    service
      .from("christmas_v2_order_scenes")
      .select("*")
      .eq("order_id", orderId)
      .order("scene_number", { ascending: true }),
    service.from("christmas_v2_order_videos").select("*").eq("order_id", orderId).order("created_at"),
  ]);

  const sceneRows = scenes ?? [];
  const videoRows = videos ?? [];
  const unlocked = ["paid", "generating", "awaiting_qc", "complete", "partial_failure"].includes(
    asString(order.status),
  ) && Boolean(order.paid_at);

  const sceneOut = [];
  let progressSum = 0;
  for (const scene of sceneRows) {
    const status = asString(scene.status);
    const pct =
      status === "succeeded" || status === "ready"
        ? 100
        : status === "generating"
          ? Math.max(asInt(scene.progress_percent), 10)
          : asInt(scene.progress_percent);
    progressSum += pct;
    const imageUrl =
      unlocked && ["succeeded", "ready"].includes(status) && scene.result_path
        ? await signedDownload(service, asString(scene.result_bucket) || CHRISTMAS_RESULT_BUCKET, scene.result_path)
        : null;
    sceneOut.push({
      sceneKey: scene.scene_key,
      title: scene.title,
      status,
      imageUrl,
    });
  }

  const videoOut = [];
  for (const video of videoRows) {
    const status = asString(video.status);
    const videoUrl =
      unlocked && ["succeeded", "ready"].includes(status) && video.result_path
        ? await signedDownload(service, asString(video.result_bucket) || CHRISTMAS_RESULT_BUCKET, video.result_path)
        : null;
    videoOut.push({
      id: video.id,
      sourceSceneKey: video.source_scene_key,
      status,
      videoUrl,
    });
  }

  const progressPercent = sceneRows.length
    ? Math.round(progressSum / sceneRows.length)
    : asString(order.status) === "complete"
      ? 100
      : 0;

  return {
    order: {
      orderId,
      publicToken,
      status: asString(order.status),
      packKey: asString(order.pack_key) as ChristmasPackKey,
      amountCents: asInt(order.amount_cents),
      imageCount: asInt(order.image_count),
      videoCount: asInt(order.video_count),
      email: asString(order.email) || undefined,
    },
    scenes: sceneOut,
    videos: videoOut,
    progressPercent,
  };
}

function attributionFromBody(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object") return {};
  const src = raw as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const key of [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_content",
    "utm_term",
    "campaign_id",
    "adset_id",
    "ad_id",
  ]) {
    const value = asString(src[key]);
    if (value) out[key] = value.slice(0, 500);
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const body = await readJson<Body>(req);
    const action = asString(body.action);
    const service = getServiceClient();

    if (action === "createOrder") {
      const email = asString(body.email).toLowerCase();
      const customerName = asString(body.customerName).slice(0, 80) || null;
      const photo = (body.photo || {}) as Record<string, unknown>;
      const packKey = packKeyOrDefault(body.packKey);
      const pack = CHRISTMAS_PACKS[packKey];
      const contentType = asString(photo.contentType);
      const byteSize = asInt(photo.byteSize);
      const funnelSessionId = isUuid(body.funnelSessionId) ? asString(body.funnelSessionId) : null;

      if (!email || !email.includes("@")) return apiError("INVALID_REQUEST", "A valid email is required.");
      if (!ALLOWED_PHOTO_TYPES.has(contentType) || byteSize <= 0 || byteSize > MAX_PHOTO_BYTES) {
        return apiError("INVALID_REQUEST", "Photo must be JPEG, PNG, or WebP under 15MB.");
      }

      const sceneKeys = resolveSceneKeys(packKey, body.sceneKeys);
      const publicToken = generatePublicToken();
      const publicTokenHash = await sha256Hex(publicToken);
      const insert = {
        public_token_hash: publicTokenHash,
        public_token_ciphertext: await encryptPublicToken(publicToken),
        email,
        email_normalized: email,
        customer_name: customerName,
        sku: pack.sku,
        pack_key: pack.key,
        product_type: CHRISTMAS_PRODUCT_TYPE,
        amount_cents: pack.amountCents,
        charged_amount_cents: pack.amountCents,
        currency: "usd",
        status: "awaiting_upload",
        image_count: pack.imageCount,
        video_count: pack.videoCount,
        photo_file_name: asString(photo.fileName).slice(0, 180) || "photo.jpg",
        photo_content_type: contentType,
        photo_byte_size: byteSize,
        meta_event_id: `pending_${crypto.randomUUID()}`,
        funnel_session_id: funnelSessionId,
        scene_keys: sceneKeys,
        video_source_scene_keys: [],
        surprise_me: false,
      };
      const { data, error } = await service.from("christmas_v2_orders").insert(insert).select("*").single();
      if (error) throw error;

      const metaEventId = `christmas_purchase_${data.id}`;
      await service.from("christmas_v2_orders").update({ meta_event_id: metaEventId }).eq("id", data.id);
      await insertScenes(service, data.id, sceneKeys);

      return jsonResponse({
        orderId: data.id,
        publicToken,
        status: "awaiting_upload",
        packKey: pack.key,
        amountCents: pack.amountCents,
        imageCount: pack.imageCount,
        videoCount: pack.videoCount,
      });
    }

    if (action === "getSignedUploadUrl") {
      const orderId = asString(body.orderId);
      const publicToken = asString(body.publicToken);
      const contentType = asString(body.contentType);
      const byteSize = asInt(body.byteSize);
      if (!ALLOWED_PHOTO_TYPES.has(contentType) || byteSize <= 0 || byteSize > MAX_PHOTO_BYTES) {
        return apiError("INVALID_REQUEST", "Photo must be JPEG, PNG, or WebP under 15MB.");
      }
      const order = await requireOrder(service, orderId, publicToken);
      if (!order) return apiError("ORDER_NOT_FOUND", "We could not find that order.", 404);
      if (!["awaiting_upload", "awaiting_payment"].includes(asString(order.status))) {
        return apiError("INVALID_REQUEST", "This order is no longer accepting a new photo.");
      }
      const objectPath = `${order.id}/source/${crypto.randomUUID()}.${extensionFromContentType(contentType)}`;
      const { data, error } = await service.storage
        .from(CHRISTMAS_SOURCE_BUCKET)
        .createSignedUploadUrl(objectPath);
      if (error || !data?.signedUrl) throw error || new Error("Could not create upload URL");
      await service
        .from("christmas_v2_orders")
        .update({
          photo_bucket: CHRISTMAS_SOURCE_BUCKET,
          photo_path: objectPath,
          photo_content_type: contentType,
          photo_file_name: asString(body.fileName).slice(0, 180) || "photo.jpg",
          photo_byte_size: byteSize,
        })
        .eq("id", order.id);
      return jsonResponse({
        uploadUrl: data.signedUrl,
        method: "PUT",
        headers: { "content-type": contentType },
        objectPath,
        expiresAt: new Date(Date.now() + CHRISTMAS_SIGNED_UPLOAD_SECONDS * 1000).toISOString(),
      });
    }

    if (action === "confirmUpload") {
      const order = await requireOrder(service, asString(body.orderId), asString(body.publicToken));
      if (!order) return apiError("ORDER_NOT_FOUND", "We could not find that order.", 404);
      const objectPath = asString(body.objectPath);
      if (!objectPath || objectPath !== order.photo_path) {
        return apiError("INVALID_REQUEST", "Upload path is not valid for this order.");
      }
      const { data: exists, error } = await service.storage
        .from(CHRISTMAS_SOURCE_BUCKET)
        .createSignedUrl(objectPath, 30);
      if (error || !exists?.signedUrl) {
        return apiError("UPLOAD_FAILED", "Photo was not found in storage.", 400);
      }
      await service
        .from("christmas_v2_orders")
        .update({
          status: "awaiting_payment",
          photo_confirmed_at: new Date().toISOString(),
        })
        .eq("id", order.id);
      return jsonResponse({
        ok: true,
        orderId: order.id,
        publicToken: asString(body.publicToken),
        status: "awaiting_payment",
      });
    }

    if (action === "updateOrderContact") {
      const order = await requireOrder(service, asString(body.orderId), asString(body.publicToken));
      if (!order) return apiError("ORDER_NOT_FOUND", "We could not find that order.", 404);
      if (!["awaiting_upload", "awaiting_payment"].includes(asString(order.status))) {
        return apiError("INVALID_REQUEST", "This order can no longer be updated.");
      }
      if (order.paid_at) return apiError("INVALID_REQUEST", "This order is already paid.");
      const email = asString(body.email).toLowerCase();
      const customerName = asString(body.customerName).slice(0, 80) || null;
      if (!email || !email.includes("@") || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return apiError("INVALID_REQUEST", "A valid email is required.");
      }
      const { error } = await service
        .from("christmas_v2_orders")
        .update({ email, email_normalized: email, customer_name: customerName })
        .eq("id", order.id);
      if (error) throw error;
      return jsonResponse({ ok: true });
    }

    if (action === "createStripeCheckout") {
      const publicToken = asString(body.publicToken);
      const order = await requireOrder(service, asString(body.orderId), publicToken);
      if (!order) return apiError("ORDER_NOT_FOUND", "We could not find that order.", 404);
      if (asString(order.status) !== "awaiting_payment") {
        return apiError("INVALID_REQUEST", "This order is not ready for payment.");
      }
      if (!order.photo_path || !order.photo_confirmed_at) {
        return apiError("INVALID_REQUEST", "Upload and confirm the photo first.");
      }

      const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
      const publishableKey = asString(Deno.env.get("STRIPE_PUBLISHABLE_KEY"));
      if (!stripeKey) return apiError("INVALID_REQUEST", "Stripe is not configured.", 503);

      const uiMode = normalizeUiMode(asString(body.uiMode || body.ui_mode));
      const funnelSessionId = isUuid(body.funnelSessionId || body.funnel_session_id)
        ? asString(body.funnelSessionId || body.funnel_session_id)
        : asString(order.funnel_session_id) || null;
      const attribution = attributionFromBody(body.attribution);
      const pack = CHRISTMAS_PACKS[packKeyOrDefault(order.pack_key)];
      const amountCents = asInt(order.amount_cents) || pack.amountCents;

      const defaultSuccess = `${siteOrigin()}/christmas-ai-photos/order?token=${encodeURIComponent(publicToken)}&session_id={CHECKOUT_SESSION_ID}`;
      const successUrl = asString(body.successUrl) || defaultSuccess;
      const cancelUrl = asString(body.cancelUrl) || `${siteOrigin()}/christmas-ai-photos?checkout=canceled`;

      const params = new URLSearchParams();
      params.set("mode", "payment");
      if (uiMode === "elements") {
        params.set("ui_mode", "elements");
        params.set("return_url", successUrl);
        params.set("expires_at", String(Math.floor(Date.now() / 1000) + 31 * 60));
      } else {
        params.set("success_url", successUrl);
        params.set("cancel_url", cancelUrl);
      }
      params.set("customer_email", asString(order.email));
      params.set("client_reference_id", asString(order.id));
      params.set("line_items[0][price_data][currency]", "usd");
      params.set("line_items[0][price_data][unit_amount]", String(amountCents));
      params.set("line_items[0][price_data][product_data][name]", pack.name);
      params.set(
        "line_items[0][price_data][product_data][description]",
        `${pack.imageCount} Christmas AI photos${pack.videoCount ? ` + ${pack.videoCount} video${pack.videoCount > 1 ? "s" : ""}` : ""}. No subscription.`,
      );
      params.set("line_items[0][quantity]", "1");
      params.set("metadata[product_type]", CHRISTMAS_PRODUCT_TYPE);
      params.set("metadata[sku]", pack.sku);
      params.set("metadata[christmas_order_id]", asString(order.id));
      params.set("metadata[pack_key]", pack.key);
      if (funnelSessionId) params.set("metadata[funnel_session_id]", funnelSessionId);
      for (const [key, value] of Object.entries(attribution)) {
        params.set(`metadata[${key}]`, value);
      }
      params.set("metadata[email_hash]", await sha256Hex(asString(order.email)));
      params.set("payment_intent_data[metadata][product_type]", CHRISTMAS_PRODUCT_TYPE);
      params.set("payment_intent_data[metadata][christmas_order_id]", asString(order.id));

      const apiVersion = uiMode === "elements" ? STRIPE_API_VERSION_ELEMENTS : STRIPE_API_VERSION_CUSTOM;
      const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: stripeAuthHeaders(
          stripeKey,
          {
            "Content-Type": "application/x-www-form-urlencoded",
            // Rotate idempotency on retries so Stripe returns a fresh Elements client_secret
            // instead of an expired/stale session (matches pet-funnel bootstrap behavior).
            "Idempotency-Key": `christmas-checkout-${order.id}-${crypto.randomUUID()}`,
          },
          apiVersion,
        ),
        body: params,
      });
      const session = await stripeRes.json();
      if (!stripeRes.ok) {
        return apiError(
          "INVALID_REQUEST",
          asString(session?.error?.message) || "Stripe checkout failed",
          502,
        );
      }

      const sessionId = asString(session.id);
      await service
        .from("christmas_v2_orders")
        .update({
          stripe_checkout_session_id: sessionId,
          funnel_session_id: funnelSessionId || order.funnel_session_id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", order.id);
      await service.from("christmas_v2_checkout_sessions").insert({
        order_id: order.id,
        stripe_session_id: sessionId,
      });

      return jsonResponse({
        orderId: order.id,
        publicToken,
        sessionId,
        clientSecret: asString(session.client_secret) || null,
        publishableKey: publishableKey || null,
        checkoutUrl: asString(session.url) || null,
        expiresAt: session.expires_at ?? null,
        amountCents,
        status: "open",
      });
    }

    if (action === "createUpsellCheckout") {
      const parentToken = asString(body.publicToken);
      const parentOrderId = asString(body.parentOrderId);
      const parent = await requireOrder(service, parentOrderId, parentToken);
      if (!parent) return apiError("ORDER_NOT_FOUND", "We could not find that order.", 404);
      if (!parent.paid_at) {
        return apiError("INVALID_REQUEST", "Upsells unlock after your starter pack is paid.", 402);
      }

      const packKeyRaw = asString(body.packKey);
      if (packKeyRaw !== "magic" && packKeyRaw !== "ultimate") {
        return apiError("INVALID_REQUEST", "Choose the Magic or Ultimate pack.");
      }
      const packKey = packKeyRaw as "magic" | "ultimate";
      const pack = CHRISTMAS_PACKS[packKey];
      const sceneKeys = resolveSceneKeys(packKey, body.sceneKeys);
      const videoSourceSceneKeys = Array.isArray(body.videoSourceSceneKeys)
        ? body.videoSourceSceneKeys
            .map((k) => asString(k))
            .filter((k) => Boolean(sceneByKey(k)))
            .slice(0, pack.videoCount)
        : sceneKeys.slice(0, pack.videoCount);
      const surpriseMe = body.surpriseMe === true;
      const uiMode = normalizeUiMode(asString(body.uiMode || body.ui_mode) || "hosted");
      const funnelSessionId = isUuid(body.funnelSessionId)
        ? asString(body.funnelSessionId)
        : asString(parent.funnel_session_id) || null;

      const childToken = generatePublicToken();
      const childHash = await sha256Hex(childToken);
      const insert = {
        public_token_hash: childHash,
        public_token_ciphertext: await encryptPublicToken(childToken),
        email: parent.email,
        email_normalized: parent.email_normalized,
        customer_name: parent.customer_name,
        sku: pack.sku,
        pack_key: pack.key,
        product_type: CHRISTMAS_PRODUCT_TYPE,
        amount_cents: pack.amountCents,
        charged_amount_cents: pack.amountCents,
        currency: "usd",
        status: "awaiting_payment",
        image_count: pack.imageCount,
        video_count: pack.videoCount,
        parent_order_id: parent.id,
        photo_bucket: parent.photo_bucket,
        photo_path: parent.photo_path,
        photo_content_type: parent.photo_content_type,
        photo_file_name: parent.photo_file_name,
        photo_byte_size: parent.photo_byte_size,
        photo_confirmed_at: parent.photo_confirmed_at || new Date().toISOString(),
        meta_event_id: `pending_${crypto.randomUUID()}`,
        funnel_session_id: funnelSessionId,
        scene_keys: sceneKeys,
        video_source_scene_keys: videoSourceSceneKeys,
        surprise_me: surpriseMe,
      };
      const { data: child, error } = await service.from("christmas_v2_orders").insert(insert).select("*").single();
      if (error) throw error;

      const metaEventId = `christmas_purchase_${child.id}`;
      await service.from("christmas_v2_orders").update({ meta_event_id: metaEventId }).eq("id", child.id);
      await insertScenes(service, child.id, sceneKeys);
      await insertVideos(service, child.id, videoSourceSceneKeys);

      const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
      const publishableKey = asString(Deno.env.get("STRIPE_PUBLISHABLE_KEY"));
      if (!stripeKey) return apiError("INVALID_REQUEST", "Stripe is not configured.", 503);

      let successUrl =
        asString(body.successUrl) ||
        `${siteOrigin()}/christmas-ai-photos/order?token={PUBLIC_TOKEN}&session_id={CHECKOUT_SESSION_ID}`;
      successUrl = successUrl.replaceAll("{PUBLIC_TOKEN}", encodeURIComponent(childToken));
      const cancelUrl =
        asString(body.cancelUrl) ||
        `${siteOrigin()}/christmas-ai-photos/order?token=${encodeURIComponent(parentToken)}&upsell=canceled`;

      const params = new URLSearchParams();
      params.set("mode", "payment");
      if (uiMode === "elements") {
        params.set("ui_mode", "elements");
        params.set("return_url", successUrl);
        params.set("expires_at", String(Math.floor(Date.now() / 1000) + 31 * 60));
      } else {
        params.set("success_url", successUrl);
        params.set("cancel_url", cancelUrl);
      }
      params.set("customer_email", asString(child.email));
      params.set("client_reference_id", asString(child.id));
      params.set("line_items[0][price_data][currency]", "usd");
      params.set("line_items[0][price_data][unit_amount]", String(pack.amountCents));
      params.set("line_items[0][price_data][product_data][name]", pack.name);
      params.set(
        "line_items[0][price_data][product_data][description]",
        `${pack.imageCount} Christmas photos + ${pack.videoCount} AI video${pack.videoCount > 1 ? "s" : ""}.`,
      );
      params.set("line_items[0][quantity]", "1");
      params.set("metadata[product_type]", CHRISTMAS_PRODUCT_TYPE);
      params.set("metadata[sku]", pack.sku);
      params.set("metadata[christmas_order_id]", asString(child.id));
      params.set("metadata[parent_order_id]", asString(parent.id));
      params.set("metadata[pack_key]", pack.key);
      if (funnelSessionId) params.set("metadata[funnel_session_id]", funnelSessionId);
      params.set("payment_intent_data[metadata][product_type]", CHRISTMAS_PRODUCT_TYPE);
      params.set("payment_intent_data[metadata][christmas_order_id]", asString(child.id));

      const apiVersion = uiMode === "elements" ? STRIPE_API_VERSION_ELEMENTS : STRIPE_API_VERSION_CUSTOM;
      const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: stripeAuthHeaders(
          stripeKey,
          {
            "Content-Type": "application/x-www-form-urlencoded",
            "Idempotency-Key": `christmas-upsell-${child.id}-${crypto.randomUUID()}`,
          },
          apiVersion,
        ),
        body: params,
      });
      const session = await stripeRes.json();
      if (!stripeRes.ok) {
        await service.from("christmas_v2_orders").delete().eq("id", child.id);
        return apiError(
          "INVALID_REQUEST",
          asString(session?.error?.message) || "Stripe checkout failed",
          502,
        );
      }

      const sessionId = asString(session.id);
      await service
        .from("christmas_v2_orders")
        .update({ stripe_checkout_session_id: sessionId })
        .eq("id", child.id);
      await service.from("christmas_v2_checkout_sessions").insert({
        order_id: child.id,
        stripe_session_id: sessionId,
      });

      return jsonResponse({
        orderId: child.id,
        publicToken: childToken,
        sessionId,
        clientSecret: asString(session.client_secret) || null,
        publishableKey: publishableKey || null,
        checkoutUrl: asString(session.url) || null,
        expiresAt: session.expires_at ?? null,
        amountCents: pack.amountCents,
        status: "open",
      });
    }

    if (action === "confirmStripePayment") {
      const publicToken = asString(body.publicToken);
      const sessionId = asString(body.sessionId || body.session_id);
      if (!publicToken || !sessionId) {
        return apiError("INVALID_REQUEST", "publicToken and sessionId are required.");
      }
      const order = await findOrderByToken(service, publicToken);
      if (!order) return apiError("ORDER_NOT_FOUND", "We could not find that order.", 404);

      const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
      if (!stripeKey) return apiError("INVALID_REQUEST", "Stripe is not configured.", 503);

      const sessionRes = await fetch(
        `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,
        { headers: stripeAuthHeaders(stripeKey) },
      );
      const session = await sessionRes.json();
      if (!sessionRes.ok) {
        return apiError(
          "INVALID_REQUEST",
          asString(session?.error?.message) || "Could not verify payment.",
          502,
        );
      }

      const sessionMetadata = (session?.metadata || {}) as Record<string, unknown>;
      const sessionOrderId = asString(sessionMetadata.christmas_order_id) || asString(session?.client_reference_id);
      if (sessionOrderId && sessionOrderId !== asString(order.id)) {
        return apiError("INVALID_REQUEST", "This payment session does not match the order.", 400);
      }

      const paymentStatus = asString(session?.payment_status);
      if (paymentStatus !== "paid") {
        return jsonResponse({ ok: true, status: "not_paid", paymentStatus, orderId: order.id, publicToken });
      }

      const amountTotal = session?.amount_total == null ? null : asInt(session.amount_total);
      const { data, error } = await service.rpc("fulfill_christmas_v2_order_payment", {
        p_event_id: `confirm:${sessionId}`,
        p_session_id: sessionId,
        p_event_type: "checkout.session.completed",
        p_payment_status: paymentStatus,
        p_payment_intent_id: asString(session?.payment_intent),
        p_amount_cents: amountTotal,
        p_currency: asString(session?.currency) || "usd",
        p_order_id: asString(order.id),
      });
      if (error) throw error;

      const result = data as { status?: string; should_enqueue?: boolean; already_paid?: boolean } | null;
      if (result?.should_enqueue) enqueueChristmasGenerate(asString(order.id));

      const funnelSessionId = asString(sessionMetadata.funnel_session_id) || asString(order.funnel_session_id);
      if (isUuid(funnelSessionId)) {
        try {
          await service.rpc("record_christmas_v2_funnel_event", {
            p_event_name: "christmas_v2_purchase",
            p_funnel_session_id: funnelSessionId,
            p_idempotency_key: `christmas_v2_purchase:${order.id}`,
            p_amount_cents: amountTotal,
            p_product: asString(order.sku),
            p_pathname: "/christmas-ai-photos",
          });
        } catch (evtErr) {
          console.error("christmas_v2_purchase event failed", evtErr);
        }
      }

      return jsonResponse({
        ok: true,
        status: result?.status || "fulfilled",
        alreadyPaid: Boolean(result?.already_paid),
        orderId: asString(order.id),
        publicToken,
      });
    }

    if (action === "getOrderByPublicToken" || action === "pollGenerationProgress") {
      const publicToken = asString(body.publicToken);
      const order = await findOrderByToken(service, publicToken);
      if (!order) return apiError("ORDER_NOT_FOUND", "We could not find that order.", 404);
      return jsonResponse(await buildOrderResults(service, order as Record<string, unknown>, publicToken));
    }

    if (action === "listMyChristmasGalleries") {
      const { user } = await getAuthUser(req);
      const accountEmail = asString(user?.email).toLowerCase();
      if (!user || !accountEmail.includes("@")) {
        return apiError("AUTH_REQUIRED", "Sign in to see your Christmas galleries.", 401);
      }

      const { data: orders, error } = await service
        .from("christmas_v2_orders")
        .select("*")
        .eq("email_normalized", accountEmail)
        .in("status", [...PAID_STATUSES])
        .order("created_at", { ascending: false })
        .limit(12);
      if (error) throw error;

      const galleries = [];
      for (const order of orders ?? []) {
        const token = decryptStoredToken(asString(order.public_token_ciphertext));
        if (!token) continue;
        const results = await buildOrderResults(service, order as Record<string, unknown>, token);
        const pack = CHRISTMAS_PACKS[packKeyOrDefault(order.pack_key)];
        galleries.push({
          orderId: order.id,
          publicToken: token,
          packKey: pack.key,
          packName: pack.name,
          status: asString(order.status),
          createdAt: order.created_at,
          imageCount: asInt(order.image_count),
          videoCount: asInt(order.video_count),
          scenes: results.scenes,
          videos: results.videos,
        });
      }
      return jsonResponse(galleries);
    }

    return apiError("INVALID_REQUEST", `Unknown action: ${action || "(missing)"}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: message }, 500);
  }
});
