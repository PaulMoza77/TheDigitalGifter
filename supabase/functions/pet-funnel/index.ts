import { optionsResponse, jsonResponse } from "../_shared/cors.ts";
import { getAuthUser, getServiceClient, readJson } from "../_shared/supabase.ts";
import { assertRateLimit, clientIp } from "../_shared/rateLimit.ts";
import {
  PET_CURRENCY,
  PET_SCENE_COUNT,
  PET_SIGNED_DOWNLOAD_SECONDS,
  PET_SIGNED_UPLOAD_SECONDS,
  PET_SKU,
  PET_SOURCE_BUCKET,
  PET_SPECIES,
  PET_PERSONALITIES,
  PET_RESULT_BUCKET,
  siteOrigin,
  publicDeliveryEstimate,
} from "../_shared/pet/constants.ts";
import {
  applyPetFlashSaleAmount,
  applyV2SaleAmount,
  applyV3SaleAmount,
  checkoutAmountNeedsRefresh,
  petFlashSale,
} from "../_shared/pet/flashSale.ts";
import {
  asString,
  decryptPublicToken,
  encryptPublicToken,
  extensionFromContentType,
  generatePublicToken,
  sha256Hex,
} from "../_shared/pet/crypto.ts";
import {
  PAID_STATUSES,
  accountOwnsPetOrder,
  assertUploadAllowed,
  deliveryAllowed,
  normalizeAccountEmail,
  rejectClientPriceTampering,
  tokenEnumerationRejected,
} from "../_shared/pet/guards.ts";
import {
  toCustomerOrder,
  toProgress,
  type PetClipRow,
  type PetOrderRow,
  type PetSceneRow,
} from "../_shared/pet/mapOrder.ts";
import { formatOfferPrice, rejectClientPriceTampering as rejectAgainstOffer, resolveServerOwnedOffer, resolveServerOwnedPromo } from "../_shared/pet/videoGuards.ts";
import { PET_SCENE_DEFINITIONS, sceneByKey } from "../_shared/pet/scenes.ts";
import { petMetaCheckoutFields, petPurchaseEventId, sendMetaCapiInitiateCheckout } from "../_shared/pet/meta.ts";
import { parseCheckoutAttribution, recordPetFunnelInitiateCheckout } from "../_shared/pet/funnelEvents.ts";
import {
  recordV3MetaInitiateCheckoutOnce,
  shouldDeferInitiateCheckoutToInteraction,
} from "../_shared/pet/v3InitiateCheckout.ts";
import { decideCheckoutSessionAction, isValidEmbeddedClientSecret, matchedEmbeddedCheckoutResponse, matchedOpenCheckoutResponse } from "../_shared/pet/checkout.ts";
import {
  publishableKeyFingerprint,
  publishableKeyMatchesSecretMode,
  stripeKeyAccountFingerprint,
  stripeSecretKeyMode,
  stripeKeysShareAccount,
} from "../_shared/pet/stripeKeys.ts";
import { enqueuePetGenerate, enqueuePetGenerateIfStalled } from "../_shared/pet/stripeFulfill.ts";
import {
  formatUpsellPrice,
  printPackEligibility,
  sceneUpsellKeys,
  upsellOfferByKey,
  type PetUpsellKey,
} from "../_shared/pet/upsells.ts";

type Body = Record<string, unknown>;

/** Custom Checkout (`ui_mode: custom`) requires Stripe API 2025-03-31.basil or newer. */
const STRIPE_API_VERSION = "2025-03-31.basil";

function stripeAuthHeaders(stripeKey: string, extra: Record<string, string> = {}): Record<string, string> {
  return {
    Authorization: `Bearer ${stripeKey}`,
    "Stripe-Version": STRIPE_API_VERSION,
    ...extra,
  };
}

function apiError(code: string, message: string, status = 400, extra: Record<string, unknown> = {}) {
  return jsonResponse({ error: message, code, ...extra }, status);
}

function isServiceRoleRequest(req: Request): boolean {
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  const parts = token.split(".");
  if (parts.length < 2) return false;
  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    return payload?.role === "service_role";
  } catch {
    return false;
  }
}

async function fetchStripeCheckoutSession(
  stripeKey: string,
  sessionId: string,
): Promise<{
  id?: string;
  status?: string;
  url?: string;
  client_secret?: string;
  expires_at?: number;
  payment_status?: string;
  livemode?: boolean;
  ui_mode?: string;
} | null> {
  const existingRes = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
    headers: stripeAuthHeaders(stripeKey),
  });
  if (!existingRes.ok) return null;
  return await existingRes.json();
}

async function resolvePublishableKey(stripeKey: string): Promise<string | null> {
  const fromEnv = String(Deno.env.get("STRIPE_PUBLISHABLE_KEY") || "").trim();
  if (!fromEnv.startsWith("pk_")) return null;
  if (!publishableKeyMatchesSecretMode(fromEnv, stripeKey)) return null;
  if (!stripeKeysShareAccount(fromEnv, stripeKey)) return null;
  return fromEnv;
}

type CheckoutDiag = {
  sessionExists: boolean;
  livemode: boolean | null;
  customUi: boolean;
  clientSecretValid: boolean;
  publishableMode: "live" | "test" | null;
  secretMode: "live" | "test" | null;
  publishableAccountFp: string | null;
  secretAccountFp: string | null;
  keysPaired: boolean;
  initFailureCode: string | null;
};

function buildCheckoutDiag(input: {
  stripeKey: string;
  publishableKey: string | null;
  session: {
    id?: string;
    livemode?: boolean;
    ui_mode?: string;
    status?: string;
    client_secret?: string | null;
  } | null;
  sessionExists: boolean;
  initFailureCode?: string | null;
}): CheckoutDiag {
  const publishableKey = String(input.publishableKey || "").trim();
  const sessionId = String(input.session?.id || "").trim();
  const clientSecret = String(input.session?.client_secret || "").trim();
  return {
    sessionExists: input.sessionExists,
    livemode: input.session?.livemode ?? null,
    customUi: input.session?.ui_mode === "custom",
    clientSecretValid: isValidEmbeddedClientSecret(clientSecret, sessionId),
    publishableMode: publishableKey.startsWith("pk_live_")
      ? "live"
      : publishableKey.startsWith("pk_test_")
        ? "test"
        : null,
    secretMode: stripeSecretKeyMode(input.stripeKey),
    publishableAccountFp: publishableKeyFingerprint(publishableKey),
    secretAccountFp: stripeKeyAccountFingerprint(input.stripeKey),
    keysPaired: publishableKey ? stripeKeysShareAccount(publishableKey, input.stripeKey) : false,
    initFailureCode: input.initFailureCode ?? null,
  };
}

async function embeddedCheckoutPayload(input: {
  stripeKey: string;
  session: {
    id?: string;
    url?: string;
    client_secret?: string | null;
    expires_at?: number | null;
    livemode?: boolean;
    ui_mode?: string;
    status?: string;
  };
  sessionExists?: boolean;
}) {
  const matchedEmbedded = matchedEmbeddedCheckoutResponse(input.session);
  if (!matchedEmbedded.ok) return { ok: false as const, reason: "conflict" as const };
  const publishableKey = await resolvePublishableKey(input.stripeKey);
  if (!publishableKey) {
    return {
      ok: false as const,
      reason: "publishable_key_unavailable" as const,
      diag: buildCheckoutDiag({
        stripeKey: input.stripeKey,
        publishableKey: null,
        session: input.session,
        sessionExists: input.sessionExists ?? true,
        initFailureCode: "publishable_key_unpaired_or_missing",
      }),
    };
  }
  return {
    ok: true as const,
    sessionId: matchedEmbedded.sessionId,
    clientSecret: matchedEmbedded.clientSecret,
    publishableKey,
    checkoutUrl: asString(input.session.url) || null,
    expiresAt: input.session.expires_at ?? null,
    diag: buildCheckoutDiag({
      stripeKey: input.stripeKey,
      publishableKey,
      session: input.session,
      sessionExists: input.sessionExists ?? true,
    }),
  };
}

function checkoutConflict() {
  return apiError(
    "CHECKOUT_CONFLICT",
    "Checkout changed while starting payment. Refresh and try again.",
    409,
  );
}

function isV2Funnel(value: unknown): boolean {
  return asString(value) === "v2";
}

function isV3Funnel(value: unknown): boolean {
  return asString(value) === "v3";
}

async function maybeRecordInitiateCheckoutOnSessionCreate(
  service: ReturnType<typeof getServiceClient>,
  order: PetOrderRow,
  meta: ReturnType<typeof petMetaCheckoutFields>,
  checkoutCtx: {
    funnelSessionId: string | null;
    deviceType: string | null;
    attribution: ReturnType<typeof parseCheckoutAttribution>;
  },
) {
  if (shouldDeferInitiateCheckoutToInteraction(order.funnel_variant)) return;
  await sendMetaCapiInitiateCheckout({
    eventId: meta.eventId,
    orderId: order.id,
    email: asString(order.email),
    amountCents: meta.chargedAmountCents,
  });
  await recordPetFunnelInitiateCheckout(service, {
    orderId: order.id,
    amountCents: meta.chargedAmountCents,
    species: asString(order.species),
    ...checkoutCtx,
  });
}

function resolveFunnelVariant(value: unknown): "v1" | "v2" | "v3" {
  const raw = asString(value);
  if (raw === "v3") return "v3";
  if (raw === "v2") return "v2";
  return "v1";
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

async function findOrderByToken(service: ReturnType<typeof getServiceClient>, token: string) {
  if (tokenEnumerationRejected(token)) return null;
  const hash = await sha256Hex(token);
  const { data, error } = await service.from("pet_orders").select("*").eq("public_token_hash", hash).maybeSingle();
  if (error) throw error;
  return (data as PetOrderRow & Record<string, unknown>) || null;
}

async function requireOrder(
  service: ReturnType<typeof getServiceClient>,
  orderId: string,
  publicToken: string,
) {
  const order = await findOrderByToken(service, publicToken);
  if (!order || order.id !== orderId) return null;
  return order;
}

async function loadClips(service: ReturnType<typeof getServiceClient>, orderId: string) {
  const { data, error } = await service
    .from("pet_order_video_clips")
    .select("*")
    .eq("pet_order_id", orderId)
    .order("slot", { ascending: true });
  if (error) throw error;
  return (data ?? []) as PetClipRow[];
}

async function loadActiveOffer(service: ReturnType<typeof getServiceClient>) {
  const { data, error } = await service.rpc("get_public_pet_offer");
  if (error) throw error;
  const payload = typeof data === "string" ? JSON.parse(data) : data;
  const offer = resolveServerOwnedOffer(payload);
  if (!offer.ok) return offer;
  return { ...offer, amountCents: applyPetFlashSaleAmount(offer.amountCents) };
}

async function loadScenes(service: ReturnType<typeof getServiceClient>, orderId: string) {
  const { data, error } = await service
    .from("pet_order_scenes")
    .select("*")
    .eq("order_id", orderId)
    .order("scene_number", { ascending: true });
  if (error) throw error;
  return (data ?? []) as PetSceneRow[];
}

type PetUpsellRow = {
  id: string;
  upsell_key: string;
  scene_key: string | null;
  status: string;
  fulfillment_status: string | null;
  metadata: Record<string, unknown> | null;
  paid_at: string | null;
  fulfilled_at: string | null;
};

async function loadOrderUpsells(service: ReturnType<typeof getServiceClient>, orderId: string) {
  const { data, error } = await service
    .from("pet_order_upsells")
    .select("id, upsell_key, scene_key, status, fulfillment_status, metadata, paid_at, fulfilled_at")
    .eq("pet_order_id", orderId)
    .in("status", ["paid", "fulfilled"])
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as PetUpsellRow[];
}

function upsellIsPurchased(rows: PetUpsellRow[], key: PetUpsellKey, sceneKey?: string | null) {
  return rows.some((row) => {
    if (row.upsell_key !== key) return false;
    if (key === "retry_3_scenes") return true;
    return row.scene_key === sceneKey;
  });
}

async function buildUpsellCatalog(input: {
  scenes: PetSceneRow[];
  purchased: PetUpsellRow[];
}) {
  const sceneOffers = sceneUpsellKeys().map((key) => {
    const offer = upsellOfferByKey(key)!;
    return {
      key,
      name: offer.name,
      description: offer.description,
      priceCents: offer.priceCents,
      currency: offer.currency,
      scope: offer.scope,
      cta: offer.cta,
      purchasedCta: offer.purchasedCta,
      priceDisplay: formatUpsellPrice(offer.priceCents, offer.currency),
    };
  });

  const perScene = input.scenes
    .filter((scene) => ["succeeded", "ready"].includes(String(scene.status)) && scene.result_path)
    .map((scene) => {
      const width = Number(scene.result_width || 0) || null;
      const height = Number(scene.result_height || 0) || null;
      const print = printPackEligibility(width, height);
      const offers = sceneOffers.map((offer) => {
        const purchased = upsellIsPurchased(input.purchased, offer.key as PetUpsellKey, scene.scene_key);
        const available =
          offer.key === "print_pack" ? print.eligible : true;
        return {
          ...offer,
          purchased,
          available,
          unavailableReason:
            offer.key === "print_pack" && !print.eligible ? print.reason : null,
          printMaxSizeLabel: offer.key === "print_pack" ? print.maxSizeLabel : null,
        };
      });
      return {
        sceneKey: scene.scene_key,
        title: sceneByKey(scene.scene_key)?.title || scene.title,
        width,
        height,
        offers,
      };
    });

  const retryOffer = upsellOfferByKey("retry_3_scenes")!;
  const retryPurchased = upsellIsPurchased(input.purchased, "retry_3_scenes");
  return {
    sceneUpsells: perScene,
    orderUpsells: [
      {
        key: retryOffer.key,
        name: retryOffer.name,
        description: retryOffer.description,
        priceCents: retryOffer.priceCents,
        currency: retryOffer.currency,
        scope: retryOffer.scope,
        cta: retryOffer.cta,
        purchasedCta: retryOffer.purchasedCta,
        priceDisplay: formatUpsellPrice(retryOffer.priceCents, retryOffer.currency),
        purchased: retryPurchased,
        available: !retryPurchased,
        maxScenes: 3,
      },
    ],
    purchased: input.purchased.map((row) => ({
      id: row.id,
      upsellKey: row.upsell_key,
      sceneKey: row.scene_key,
      status: row.status,
      fulfillmentStatus: row.fulfillment_status,
      sceneKeys: Array.isArray(row.metadata?.scene_keys)
        ? (row.metadata?.scene_keys as string[])
        : [],
      paidAt: row.paid_at,
      fulfilledAt: row.fulfilled_at,
    })),
  };
}

async function signedDownload(
  service: ReturnType<typeof getServiceClient>,
  bucket: string,
  path: string | null | undefined,
) {
  if (!path) return null;
  const { data, error } = await service.storage.from(bucket).createSignedUrl(path, PET_SIGNED_DOWNLOAD_SECONDS);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const body = await readJson<Body>(req);
    const action = asString(body.action);
    const service = getServiceClient();
    const pollActions = new Set([
      "pollGenerationProgress",
      "getOrderByPublicToken",
      "getOrderResults",
      "getPublicOffer",
      "listMyPetGalleries",
    ]);
    const allowed = pollActions.has(action)
      ? await assertRateLimit(service, `pet-funnel:${clientIp(req)}:${action || "unknown"}`, 180, 600)
      : await assertRateLimit(service, `pet-funnel:${clientIp(req)}:${action || "unknown"}`, 60, 3600);
    if (!allowed) return apiError("INVALID_REQUEST", "Too many requests. Please wait.", 429);

    if (action === "getPublicOffer") {
      const raw = await service.rpc("get_public_pet_offer");
      if (raw.error) throw raw.error;
      const payload = typeof raw.data === "string" ? JSON.parse(raw.data) : raw.data;
      const offer = resolveServerOwnedOffer(payload);
      if (!offer.ok) return apiError("INVALID_REQUEST", offer.message, 503);
      const sale = petFlashSale();
      const amountCents = applyPetFlashSaleAmount(offer.amountCents);
      const deliveryEstimate = publicDeliveryEstimate(
        String(payload?.deliveryEstimate || payload?.delivery_estimate_label || ""),
      );
      return jsonResponse({
        sku: offer.sku,
        name: "My Pet’s Secret Life",
        amountCents,
        currency: offer.currency,
        imageCount: 12,
        videoCount: 2,
        subscription: false,
        active: true,
        priceDisplay: formatOfferPrice(amountCents),
        version: Number(payload?.version || 1),
        deliveryEstimate,
        compareAtCents: sale.active ? sale.compareAtCents : undefined,
        compareAtDisplay: sale.active ? sale.compareAtDisplay : undefined,
        saleExpiresAt: sale.expiresAt,
        saleActive: sale.active,
      });
    }

    if (action === "createOrder") {
      const email = asString(body.email).toLowerCase();
      const petName = asString(body.petName).slice(0, 40);
      const species = asString(body.species);
      const personality = asString(body.personality);
      const photo = (body.photo || {}) as Record<string, unknown>;
      const offer = await loadActiveOffer(service);
      if (!offer.ok) return apiError("INVALID_REQUEST", offer.message, 503);
      const funnelVariant = resolveFunnelVariant(body.funnelVariant);
      const amountCents =
        funnelVariant === "v3"
          ? applyV3SaleAmount()
          : funnelVariant === "v2"
            ? applyV2SaleAmount()
            : offer.amountCents;
      const priceCheck = rejectAgainstOffer(
        {
          amountCents: body.amountCents,
          currency: body.currency,
          sku: body.sku,
        },
        amountCents,
      );
      if (!priceCheck.ok) return apiError(priceCheck.code, priceCheck.message);
      if (!email || !email.includes("@")) return apiError("INVALID_REQUEST", "A valid email is required.");
      if (petName.length < 2) return apiError("INVALID_REQUEST", "Pet name is required.");
      if (!PET_SPECIES.includes(species as (typeof PET_SPECIES)[number])) {
        return apiError("INVALID_REQUEST", "Choose dog, cat, or other.");
      }
      if (!PET_PERSONALITIES.includes(personality as (typeof PET_PERSONALITIES)[number])) {
        return apiError("INVALID_REQUEST", "Choose a personality.");
      }
      const subtype = asString(body.subtype);
      const subtypeDetail = asString(body.subtypeDetail).slice(0, 40);
      const allowedSubtypes = ["rabbit", "bird", "small_pet", "reptile", "horse", "other"];
      if (species === "other") {
        if (!allowedSubtypes.includes(subtype)) {
          return apiError("INVALID_REQUEST", "Choose what kind of pet you have.");
        }
        if (subtype === "other" && !subtypeDetail) {
          return apiError("INVALID_REQUEST", "Tell us what kind of pet.");
        }
      }
      const uploadCheck = assertUploadAllowed(asString(photo.contentType), Number(photo.byteSize || 0));
      if (!uploadCheck.ok) return apiError(uploadCheck.code, uploadCheck.message);

      const publicToken = generatePublicToken();
      const publicTokenHash = await sha256Hex(publicToken);
      const { data: offerRow } = await service
        .from("pet_offers")
        .select("id, version")
        .eq("sku", offer.sku)
        .eq("active", true)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();
      const insert = {
        public_token_hash: publicTokenHash,
        email,
        email_normalized: email,
        pet_name: petName,
        species,
        personality,
        sku: offer.sku,
        amount_cents: amountCents,
        charged_amount_cents: amountCents,
        funnel_variant: funnelVariant,
        currency: offer.currency,
        offer_id: offerRow?.id ?? null,
        offer_version: offerRow?.version ?? 1,
        image_count: 12,
        video_count: 2,
        status: "awaiting_upload",
        photo_file_name: asString(photo.fileName).slice(0, 180) || "pet.jpg",
        photo_content_type: asString(photo.contentType),
        photo_byte_size: Number(photo.byteSize || 0),
        photo_width: Number(photo.width || 0) || null,
        photo_height: Number(photo.height || 0) || null,
        meta_event_id: `pending_${crypto.randomUUID()}`,
        public_token_ciphertext: await encryptPublicToken(publicToken),
        subtype: species === "other" ? subtype : null,
        subtype_detail: species === "other" && subtype === "other" ? subtypeDetail : null,
      };
      const { data, error } = await service.from("pet_orders").insert(insert).select("*").single();
      if (error) throw error;
      const metaEventId = petPurchaseEventId(data.id);
      await service.from("pet_orders").update({ meta_event_id: metaEventId }).eq("id", data.id);
      await service.rpc("pet_log_event", {
        p_order_id: data.id,
        p_action: "order_created",
        p_actor_type: "customer",
        p_payload: {
          sku: offer.sku,
          amount_cents: amountCents,
          offer_version: offerRow?.version ?? 1,
          funnel_variant: funnelVariant,
        },
      });
      return jsonResponse({
        orderId: data.id,
        publicToken,
        status: "awaiting_upload",
        amountCents,
        currency: offer.currency,
        sku: offer.sku,
        funnelVariant,
      });
    }

    if (action === "getSignedUploadUrl") {
      const orderId = asString(body.orderId);
      const publicToken = asString(body.publicToken);
      const contentType = asString(body.contentType);
      const byteSize = Number(body.byteSize || 0);
      const uploadCheck = assertUploadAllowed(contentType, byteSize);
      if (!uploadCheck.ok) return apiError(uploadCheck.code, uploadCheck.message);
      const order = await requireOrder(service, orderId, publicToken);
      if (!order) return apiError("ORDER_NOT_FOUND", "We could not find that order.", 404);
      if (!["awaiting_upload", "awaiting_payment"].includes(String(order.status))) {
        return apiError("INVALID_REQUEST", "This order is no longer accepting a new photo.");
      }
      const objectPath = `${order.id}/source/${crypto.randomUUID()}.${extensionFromContentType(contentType)}`;
      const { data, error } = await service.storage
        .from(PET_SOURCE_BUCKET)
        .createSignedUploadUrl(objectPath);
      if (error || !data?.signedUrl) throw error || new Error("Could not create upload URL");
      await service
        .from("pet_orders")
        .update({
          photo_bucket: PET_SOURCE_BUCKET,
          photo_path: objectPath,
          photo_content_type: contentType,
          photo_file_name: asString(body.fileName).slice(0, 180) || "pet.jpg",
          photo_byte_size: byteSize,
        })
        .eq("id", order.id);
      return jsonResponse({
        uploadUrl: data.signedUrl,
        method: "PUT",
        headers: { "content-type": contentType },
        objectPath,
        expiresAt: new Date(Date.now() + PET_SIGNED_UPLOAD_SECONDS * 1000).toISOString(),
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
        .from(PET_SOURCE_BUCKET)
        .createSignedUrl(objectPath, 30);
      if (error || !exists?.signedUrl) {
        return apiError("UPLOAD_FAILED", "Photo was not found in storage.", 400);
      }
      await service
        .from("pet_orders")
        .update({
          status: "awaiting_payment",
          photo_confirmed_at: new Date().toISOString(),
          photo_byte_size: Number(order.photo_byte_size || 0),
        })
        .eq("id", order.id);
      await service.rpc("pet_log_event", {
        p_order_id: order.id,
        p_action: "photo_confirmed",
        p_actor_type: "customer",
      });
      return jsonResponse({
        orderId: order.id,
        publicToken: asString(body.publicToken),
        status: "awaiting_payment",
        photoStored: true,
      });
    }

    if (action === "updateOrderContact") {
      const order = await requireOrder(service, asString(body.orderId), asString(body.publicToken));
      if (!order) return apiError("ORDER_NOT_FOUND", "We could not find that order.", 404);
      if (!["awaiting_upload", "awaiting_payment"].includes(String(order.status))) {
        return apiError("INVALID_REQUEST", "This order can no longer be updated.");
      }
      if (order.paid_at) {
        return apiError("INVALID_REQUEST", "This order is already paid.");
      }
      const email = asString(body.email).toLowerCase();
      const petName = asString(body.petName).slice(0, 40);
      if (!email || !email.includes("@") || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return apiError("INVALID_REQUEST", "A valid email is required.");
      }
      if (petName.length < 2) return apiError("INVALID_REQUEST", "Pet name is required.");
      await service
        .from("pet_orders")
        .update({
          email,
          email_normalized: email,
          pet_name: petName,
        })
        .eq("id", order.id);

      const sessionId = asString(order.stripe_checkout_session_id);
      const stripeKey = Deno.env.get("STRIPE_SECRET_KEY") || "";
      let stripeSessionSynced = false;
      if (sessionId && stripeKey) {
        const params = new URLSearchParams();
        params.set("customer_email", email);
        params.set("metadata[email_hash]", await sha256Hex(email));
        const stripeRes = await fetch(
          `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,
          {
            method: "POST",
            headers: stripeAuthHeaders(stripeKey, {
              "Content-Type": "application/x-www-form-urlencoded",
            }),
            body: params,
          },
        );
        stripeSessionSynced = stripeRes.ok;
        if (!stripeRes.ok) {
          const stripeErr = await stripeRes.json().catch(() => ({}));
          console.error(
            "[updateOrderContact] stripe session sync failed",
            asString((stripeErr as { error?: { message?: string } })?.error?.message) || "unknown",
          );
        }
      }

      return jsonResponse({
        orderId: order.id,
        email,
        petName,
        updated: true,
        stripeSessionSynced,
      });
    }

    if (action === "recordV3InitiateCheckout") {
      const order = await requireOrder(service, asString(body.orderId), asString(body.publicToken));
      if (!order) return apiError("ORDER_NOT_FOUND", "We could not find that order.", 404);
      if (!isV3Funnel(order.funnel_variant)) {
        return apiError("INVALID_REQUEST", "This order is not a V3 checkout.");
      }
      if (order.paid_at) {
        return jsonResponse({ eventId: petMetaCheckoutFields(order).eventId, alreadySent: true, sent: false });
      }
      const meta = petMetaCheckoutFields(order);
      const requestedEventId = asString(body.eventId);
      if (requestedEventId && requestedEventId !== meta.eventId) {
        return apiError("INVALID_REQUEST", "Initiate checkout event id mismatch.");
      }
      const result = await recordV3MetaInitiateCheckoutOnce(service, {
        orderId: order.id,
        email: asString(order.email),
        amountCents: meta.chargedAmountCents,
      });
      return jsonResponse({
        eventId: result.eventId,
        sent: result.sent,
        alreadySent: result.alreadySent,
      });
    }

    if (action === "debugStripeCheckout") {
      if (!isServiceRoleRequest(req)) {
        return apiError("INVALID_REQUEST", "Unauthorized.", 401);
      }
      const orderId = asString(body.orderId);
      if (!orderId) return apiError("INVALID_REQUEST", "orderId is required.", 400);
      const stripeKey = Deno.env.get("STRIPE_SECRET_KEY") || "";
      const publishableKey = String(Deno.env.get("STRIPE_PUBLISHABLE_KEY") || "").trim();
      const { data: order, error: orderError } = await service
        .from("pet_orders")
        .select("id,stripe_checkout_session_id,funnel_variant")
        .eq("id", orderId)
        .maybeSingle();
      if (orderError) throw orderError;
      if (!order) return apiError("ORDER_NOT_FOUND", "We could not find that order.", 404);
      const sessionId = asString(order.stripe_checkout_session_id);
      const session = sessionId && stripeKey ? await fetchStripeCheckoutSession(stripeKey, sessionId) : null;
      let stripeAccountId: string | null = null;
      if (stripeKey) {
        const acctRes = await fetch("https://api.stripe.com/v1/account", { headers: stripeAuthHeaders(stripeKey) });
        if (acctRes.ok) {
          const acct = await acctRes.json();
          stripeAccountId = asString(acct.id) || null;
        }
      }
      return jsonResponse({
        orderId,
        funnelVariant: order.funnel_variant,
        stripeAccountId,
        checkoutDiag: buildCheckoutDiag({
          stripeKey,
          publishableKey: publishableKey || null,
          session,
          sessionExists: Boolean(session),
          initFailureCode: publishableKey && stripeKey && !stripeKeysShareAccount(publishableKey, stripeKey)
            ? "publishable_secret_account_mismatch"
            : null,
        }),
        embedded: session
          ? await embeddedCheckoutPayload({
            stripeKey,
            session,
            sessionExists: true,
          })
          : null,
      });
    }

    if (action === "createStripeCheckout") {
      const publicToken = asString(body.publicToken);
      const order = await requireOrder(service, asString(body.orderId), publicToken);
      if (!order) return apiError("ORDER_NOT_FOUND", "We could not find that order.", 404);
      if (String(order.status) !== "awaiting_payment") {
        return apiError("INVALID_REQUEST", "This order is not ready for payment.");
      }
      if (!order.photo_path || !order.photo_confirmed_at) {
        return apiError("INVALID_REQUEST", "Upload and confirm the pet photo first.");
      }
      const checkoutCtx = {
        funnelSessionId: asString(body.funnelSessionId || body.funnel_session_id) || null,
        deviceType: asString(body.deviceType || body.device_type) || null,
        attribution: parseCheckoutAttribution(body.attribution),
      };
      const promo = resolveServerOwnedPromo(body.promoCode ?? body.promo_code, body.discountPercent ?? body.discount_percent);
      if (!promo.ok) return apiError("INVALID_REQUEST", promo.message);
      if (promo.code) {
        const charged = promo.chargedAmountCents;
        await service
          .from("pet_orders")
          .update({
            promo_code: promo.code,
            discount_percent: promo.discountPercent,
            charged_amount_cents: charged,
          })
          .eq("id", order.id);
        const fulfilled = await service.rpc("fulfill_pet_order_payment", {
          p_event_id: `promo_${promo.code}_${order.id}`,
          p_session_id: `promo:${promo.code}:${order.id}`,
          p_event_type: "promo.comp",
          p_payment_status: "no_payment_required",
          p_payment_intent_id: null,
          p_amount_cents: charged,
          p_currency: order.currency || PET_CURRENCY,
          p_order_id: order.id,
        });
        if (fulfilled.error) throw fulfilled.error;
        const result = fulfilled.data as { should_enqueue?: boolean; status?: string };
        if (result?.should_enqueue) {
          enqueuePetGenerate(order.id);
        }
        return jsonResponse({
          sessionId: `promo_${promo.code}_${order.id}`,
          checkoutUrl: null,
          status: "comped",
          promoCode: promo.code,
          ...petMetaCheckoutFields({ ...order, charged_amount_cents: charged }),
        });
      }

      const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
      if (!stripeKey) return apiError("INVALID_REQUEST", "Stripe is not configured.", 503);

      const { count: issuedCount } = await service
        .from("pet_checkout_sessions")
        .select("id", { count: "exact", head: true })
        .eq("order_id", order.id);

      const storedSessionId = asString(order.stripe_checkout_session_id);
      const existingSession = storedSessionId
        ? await fetchStripeCheckoutSession(stripeKey, storedSessionId)
        : null;
      if (storedSessionId && !existingSession) {
        return checkoutConflict();
      }

      const liveOffer = await loadActiveOffer(service);
      const existingView = existingSession
        ? { ...existingSession, id: existingSession.id || storedSessionId }
        : null;
      const paymentProcessing = existingView
        ? existingView.status === "complete" ||
          existingView.payment_status === "paid" ||
          existingView.payment_status === "no_payment_required"
        : false;
      const liveAmount = isV3Funnel(order.funnel_variant)
        ? applyV3SaleAmount()
        : isV2Funnel(order.funnel_variant)
          ? applyV2SaleAmount()
          : liveOffer.ok
            ? liveOffer.amountCents
            : null;
      let amountChanged = false;
      if (
        !paymentProcessing &&
        liveAmount != null &&
        checkoutAmountNeedsRefresh(Number(order.amount_cents), liveAmount)
      ) {
        await service
          .from("pet_orders")
          .update({
            amount_cents: liveAmount,
            charged_amount_cents: liveAmount,
          })
          .eq("id", order.id);
        order.amount_cents = liveAmount;
        order.charged_amount_cents = liveAmount;
        amountChanged = true;
      }

      const requestedOnPage = ["custom", "embedded"].includes(asString(body.uiMode || body.ui_mode));
      const onPage = requestedOnPage;
      const decision = decideCheckoutSessionAction({
        existingSession: amountChanged && existingView
          ? { ...existingView, status: "expired" }
          : existingView,
        orderId: order.id,
        issuedCount: issuedCount || 0,
        uiMode: onPage ? "custom" : "hosted",
      });

      if (onPage && existingView?.id) {
        const embeddedReuse = matchedEmbeddedCheckoutResponse({
          ...existingView,
          id: existingView.id || storedSessionId,
        });
        if (embeddedReuse.ok) {
          await service.rpc("attach_pet_checkout_session", {
            p_order_id: order.id,
            p_session_id: embeddedReuse.sessionId,
            p_expected_session_id: storedSessionId || null,
          });
          const meta = petMetaCheckoutFields(order);
          const embedded = await embeddedCheckoutPayload({
            stripeKey,
            session: { ...existingView, id: existingView.id || storedSessionId },
            sessionExists: true,
          });
          if (!embedded.ok) {
            await service.rpc("pet_log_event", {
              p_order_id: order.id,
              p_action: "checkout_embedded_unavailable",
              p_actor_type: "system",
              p_payload: embedded.diag,
            });
            return apiError("INVALID_REQUEST", "Stripe publishable key unavailable.", 503, embedded.diag);
          }
          await maybeRecordInitiateCheckoutOnSessionCreate(service, order, meta, checkoutCtx);
          return jsonResponse({
            sessionId: embedded.sessionId,
            checkoutUrl: embedded.checkoutUrl,
            clientSecret: embedded.clientSecret,
            publishableKey: embedded.publishableKey,
            expiresAt: embedded.expiresAt,
            status: "open",
            reused: true,
            checkoutDiag: embedded.diag,
            ...meta,
          });
        }
      }

      if (decision.action === "payment_processing") {
        await service.rpc("attach_pet_checkout_session", {
          p_order_id: order.id,
          p_session_id: decision.sessionId,
          p_expected_session_id: storedSessionId || null,
        });
        return jsonResponse({
          sessionId: decision.sessionId,
          checkoutUrl: null,
          status: "payment_processing",
          ...petMetaCheckoutFields(order),
        });
      }

      if (decision.action === "reuse") {
        const matched = matchedOpenCheckoutResponse(existingSession);
        if (!matched.ok) return checkoutConflict();
        await service.rpc("attach_pet_checkout_session", {
          p_order_id: order.id,
          p_session_id: matched.sessionId,
          p_expected_session_id: storedSessionId || null,
        });
        const meta = petMetaCheckoutFields(order);
        await maybeRecordInitiateCheckoutOnSessionCreate(service, order, meta, checkoutCtx);
        return jsonResponse({
          sessionId: matched.sessionId,
          checkoutUrl: matched.checkoutUrl,
          status: "open",
          reused: true,
          ...meta,
        });
      }

      const successUrl = `${siteOrigin()}/pet/order?token=${encodeURIComponent(publicToken)}&session_id={CHECKOUT_SESSION_ID}`;
      const cancelUrl = safeReturnUrl(asString(body.cancelUrl), `${siteOrigin()}/pet/checkout`);
      const params = new URLSearchParams();
      params.set("mode", "payment");
      if (onPage) {
        params.set("ui_mode", "custom");
        params.set("return_url", successUrl);
        params.set("expires_at", String(Math.floor(Date.now() / 1000) + 31 * 60));
      } else {
        params.set("success_url", successUrl);
        params.set("cancel_url", cancelUrl);
      }
      params.set("customer_email", order.email);
      params.set("client_reference_id", order.id);
      params.set("line_items[0][price_data][currency]", String(order.currency || PET_CURRENCY));
      params.set("line_items[0][price_data][unit_amount]", String(order.amount_cents));
      params.set("line_items[0][price_data][product_data][name]", "My Pet’s Secret Life");
      params.set("line_items[0][price_data][product_data][description]", "One-time 12 QC-approved pet portraits and 2 cinematic clips. No subscription.");
      params.set("line_items[0][quantity]", "1");
      params.set("metadata[sku]", PET_SKU);
      params.set("metadata[product_type]", "pet_secret_life");
      params.set("metadata[pet_order_id]", order.id);
      params.set("metadata[funnel_variant]", isV3Funnel(order.funnel_variant) ? "v3" : isV2Funnel(order.funnel_variant) ? "v2" : "v1");
      if (isV3Funnel(order.funnel_variant)) {
        params.set("metadata[funnel_version]", "v3");
        params.set("metadata[species]", asString(order.species) || "cat");
        const attr = checkoutCtx.attribution;
        const creativeFromContent = asString(attr.utm_content)?.replace(/-FINAL$/i, "").slice(0, 120) || null;
        for (const [key, value] of [
          ["utm_source", attr.utm_source],
          ["utm_medium", attr.utm_medium],
          ["utm_campaign", attr.utm_campaign],
          ["utm_content", attr.utm_content],
          ["utm_term", attr.utm_term],
          ["campaign_id", attr.campaign_id],
          ["adset_id", attr.adset_id],
          ["ad_id", attr.ad_id],
          ["creative_id", creativeFromContent],
        ] as const) {
          const next = asString(value);
          if (next) params.set(`metadata[${key}]`, next.slice(0, 500));
        }
      }
      if (checkoutCtx.funnelSessionId) {
        params.set("metadata[funnel_session_id]", checkoutCtx.funnelSessionId);
      }
      params.set("metadata[meta_event_id]", petPurchaseEventId(order.id));
      params.set("metadata[email_hash]", await sha256Hex(order.email));
      params.set("payment_intent_data[metadata][sku]", PET_SKU);
      params.set("payment_intent_data[metadata][pet_order_id]", order.id);

      const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: stripeAuthHeaders(stripeKey, {
          "Content-Type": "application/x-www-form-urlencoded",
          "Idempotency-Key": decision.idempotencyKey,
        }),
        body: params,
      });
      const session = await stripeRes.json();
      if (!stripeRes.ok) {
        const stripeType = asString(session.error?.type) || null;
        const stripeCode = asString(session.error?.code) || null;
        return apiError(
          "INVALID_REQUEST",
          session.error?.message || "Stripe checkout failed",
          stripeRes.status === 402 ? 402 : 502,
          {
            checkoutDiag: buildCheckoutDiag({
              stripeKey,
              publishableKey: null,
              session: null,
              sessionExists: false,
              initFailureCode: stripeCode || stripeType || "stripe_session_create_failed",
            }),
          },
        );
      }

      const verifiedSession = await fetchStripeCheckoutSession(stripeKey, asString(session.id));

      const attached = await service.rpc("attach_pet_checkout_session", {
        p_order_id: order.id,
        p_session_id: session.id,
        p_expected_session_id: decision.expectedSessionId,
      });
      if (attached.error) throw attached.error;
      const attachedId = asString(
        (attached.data as { stripe_checkout_session_id?: string } | null)?.stripe_checkout_session_id,
      );

      if (attachedId && attachedId !== asString(session.id)) {
        const winner = await fetchStripeCheckoutSession(stripeKey, attachedId);
        if (onPage) {
          const winnerSession = winner ? { ...winner, id: winner.id || attachedId } : null;
          const meta = petMetaCheckoutFields(order);
          const embedded = await embeddedCheckoutPayload({
            stripeKey,
            session: winnerSession || { id: attachedId },
            sessionExists: Boolean(winner),
          });
          if (!embedded.ok) {
            if (embedded.reason === "conflict") return checkoutConflict();
            await service.rpc("pet_log_event", {
              p_order_id: order.id,
              p_action: "checkout_embedded_unavailable",
              p_actor_type: "system",
              p_payload: embedded.diag,
            });
            return apiError("INVALID_REQUEST", "Stripe publishable key unavailable.", 503, {
              checkoutDiag: embedded.diag,
            });
          }
          await maybeRecordInitiateCheckoutOnSessionCreate(service, order, meta, checkoutCtx);
          return jsonResponse({
            sessionId: embedded.sessionId,
            checkoutUrl: embedded.checkoutUrl,
            clientSecret: embedded.clientSecret,
            publishableKey: embedded.publishableKey,
            expiresAt: embedded.expiresAt,
            status: "open",
            reused: true,
            checkoutDiag: embedded.diag,
            ...meta,
          });
        }
        const matched = matchedOpenCheckoutResponse(winner ? { ...winner, id: winner.id || attachedId } : null);
        if (!matched.ok) return checkoutConflict();
        const meta = petMetaCheckoutFields(order);
        await maybeRecordInitiateCheckoutOnSessionCreate(service, order, meta, checkoutCtx);
        return jsonResponse({
          sessionId: matched.sessionId,
          checkoutUrl: matched.checkoutUrl,
          status: "open",
          reused: true,
          ...meta,
        });
      }

      if (onPage) {
        const sessionView = verifiedSession || session;
        const meta = petMetaCheckoutFields(order);
        const embedded = await embeddedCheckoutPayload({
          stripeKey,
          session: sessionView,
          sessionExists: Boolean(verifiedSession),
        });
        if (!embedded.ok) {
          if (embedded.reason === "conflict") return checkoutConflict();
          await service.rpc("pet_log_event", {
            p_order_id: order.id,
            p_action: "checkout_embedded_unavailable",
            p_actor_type: "system",
            p_payload: embedded.diag,
          });
          return apiError("INVALID_REQUEST", "Stripe publishable key unavailable.", 503, {
            checkoutDiag: embedded.diag,
          });
        }
        await service.rpc("pet_log_event", {
          p_order_id: order.id,
          p_action: "checkout_session_created",
          p_actor_type: "system",
          p_payload: { ...embedded.diag, initiate_event_id: meta.eventId, ui_mode: "custom" },
        });
        await maybeRecordInitiateCheckoutOnSessionCreate(service, order, meta, checkoutCtx);
        return jsonResponse({
          sessionId: embedded.sessionId,
          checkoutUrl: embedded.checkoutUrl,
          clientSecret: embedded.clientSecret,
          publishableKey: embedded.publishableKey,
          expiresAt: embedded.expiresAt,
          status: "open",
          checkoutDiag: embedded.diag,
          ...meta,
        });
      }

      const matched = matchedOpenCheckoutResponse(session);
      if (!matched.ok) return checkoutConflict();
      const meta = petMetaCheckoutFields(order);
      await service.rpc("pet_log_event", {
        p_order_id: order.id,
        p_action: "checkout_session_created",
        p_actor_type: "system",
        p_payload: { session_present: true, initiate_event_id: meta.eventId },
      });
      await maybeRecordInitiateCheckoutOnSessionCreate(service, order, meta, checkoutCtx);
      return jsonResponse({
        sessionId: matched.sessionId,
        checkoutUrl: matched.checkoutUrl,
        status: "open",
        ...meta,
      });
    }

    if (action === "createUpsellCheckout") {
      const publicToken = asString(body.publicToken);
      const upsellKey = asString(body.upsellKey) as PetUpsellKey;
      const sceneKey = asString(body.sceneKey) || null;
      const sceneKeysInput = Array.isArray(body.sceneKeys)
        ? body.sceneKeys.map((item) => asString(item)).filter(Boolean)
        : [];
      const order = await findOrderByToken(service, publicToken);
      if (!order) return apiError("ORDER_NOT_FOUND", "We could not find that order.", 404);

      const offer = upsellOfferByKey(upsellKey);
      if (!offer) return apiError("INVALID_REQUEST", "Unknown add-on.", 400);

      if (!deliveryAllowed({
        orderStatus: String(order.status),
        qcStatus: order.qc_status as string | null,
        completedAt: order.completed_at ? String(order.completed_at) : null,
      })) {
        return apiError("INVALID_REQUEST", "Add-ons unlock after your order is paid.", 402);
      }

      const scenes = await loadScenes(service, order.id);
      const purchased = await loadOrderUpsells(service, order.id);

      if (offer.scope === "scene") {
        if (!sceneKey) return apiError("INVALID_REQUEST", "Choose a portrait first.", 400);
        const scene = scenes.find((row) => row.scene_key === sceneKey);
        if (!scene || !["succeeded", "ready"].includes(String(scene.status)) || !scene.result_path) {
          return apiError("INVALID_REQUEST", "That portrait is not ready yet.", 400);
        }
        if (upsellIsPurchased(purchased, upsellKey, sceneKey)) {
          return apiError("INVALID_REQUEST", "You already own this add-on for this portrait.", 409);
        }
        if (upsellKey === "print_pack") {
          const print = printPackEligibility(scene.result_width, scene.result_height);
          if (!print.eligible) {
            return apiError("INVALID_REQUEST", print.reason || "This portrait is too small to print.", 400);
          }
        }
      }

      if (upsellKey === "retry_3_scenes") {
        if (upsellIsPurchased(purchased, "retry_3_scenes")) {
          return apiError("INVALID_REQUEST", "You already purchased a 3-scene retry for this order.", 409);
        }
        if (sceneKeysInput.length < 1 || sceneKeysInput.length > 3) {
          return apiError("INVALID_REQUEST", "Pick 1 to 3 portraits to retry.", 400);
        }
        const readyKeys = new Set(
          scenes
            .filter((row) => ["succeeded", "ready"].includes(String(row.status)))
            .map((row) => row.scene_key),
        );
        if (sceneKeysInput.some((key) => !readyKeys.has(key))) {
          return apiError("INVALID_REQUEST", "One or more selected portraits are not ready.", 400);
        }
      }

      const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
      if (!stripeKey) return apiError("INVALID_REQUEST", "Stripe is not configured.", 503);

      const metadata: Record<string, unknown> = {};
      if (upsellKey === "retry_3_scenes") {
        metadata.scene_keys = sceneKeysInput;
      }

      const { data: upsellRow, error: upsellError } = await service
        .from("pet_order_upsells")
        .insert({
          pet_order_id: order.id,
          upsell_key: upsellKey,
          scene_key: offer.scope === "scene" ? sceneKey : null,
          amount_cents: offer.priceCents,
          currency: offer.currency,
          status: "pending",
          metadata,
        })
        .select("id")
        .single();
      if (upsellError) throw upsellError;

      const upsellId = asString((upsellRow as { id?: string }).id);
      const successUrl = safeReturnUrl(
        asString(body.successUrl),
        `${siteOrigin()}/pet/order?token=${encodeURIComponent(publicToken)}&upsell=success&upsell_id=${upsellId}`,
      );
      const cancelUrl = safeReturnUrl(
        asString(body.cancelUrl),
        `${siteOrigin()}/pet/order?token=${encodeURIComponent(publicToken)}`,
      );

      const params = new URLSearchParams();
      params.set("mode", "payment");
      params.set("success_url", successUrl);
      params.set("cancel_url", cancelUrl);
      params.set("customer_email", order.email);
      params.set("client_reference_id", order.id);
      params.set("line_items[0][price_data][currency]", offer.currency);
      params.set("line_items[0][price_data][unit_amount]", String(offer.priceCents));
      params.set("line_items[0][price_data][product_data][name]", offer.name);
      params.set(
        "line_items[0][price_data][product_data][description]",
        offer.scope === "scene" && sceneKey
          ? `${offer.description} — ${sceneByKey(sceneKey)?.title || sceneKey}`
          : offer.description,
      );
      params.set("line_items[0][quantity]", "1");
      params.set("metadata[product_type]", "pet_upsell");
      params.set("metadata[upsell_key]", upsellKey);
      params.set("metadata[pet_order_id]", order.id);
      params.set("metadata[pet_upsell_id]", upsellId);
      params.set("metadata[scene_key]", sceneKey || "");
      if (upsellKey === "retry_3_scenes") {
        params.set("metadata[scene_keys]", JSON.stringify(sceneKeysInput));
      }
      params.set("payment_intent_data[metadata][product_type]", "pet_upsell");
      params.set("payment_intent_data[metadata][pet_upsell_id]", upsellId);

      const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: stripeAuthHeaders(stripeKey, {
          "Content-Type": "application/x-www-form-urlencoded",
          "Idempotency-Key": `pet-upsell-${upsellId}`,
        }),
        body: params,
      });
      const session = await stripeRes.json();
      if (!stripeRes.ok) {
        await service.from("pet_order_upsells").delete().eq("id", upsellId);
        return apiError("INVALID_REQUEST", session.error?.message || "Stripe checkout failed", 502);
      }

      await service
        .from("pet_order_upsells")
        .update({ stripe_checkout_session_id: asString(session.id) })
        .eq("id", upsellId);

      return jsonResponse({
        upsellId,
        sessionId: asString(session.id),
        checkoutUrl: asString(session.url),
        status: "open",
        upsellKey,
        amountCents: offer.priceCents,
        priceDisplay: formatUpsellPrice(offer.priceCents, offer.currency),
      });
    }

    if (action === "listMyPetGalleries") {
      const { user } = await getAuthUser(req);
      const accountEmail = normalizeAccountEmail(user?.email);
      if (!user || !accountEmail.includes("@")) {
        return apiError("AUTH_REQUIRED", "Sign in to see your pet portraits.", 401);
      }

      const { data: orders, error: orderError } = await service
        .from("pet_orders")
        .select("id, pet_name, species, status, created_at, paid_at, completed_at, qc_status, public_token_ciphertext, email_normalized")
        .eq("email_normalized", accountEmail)
        .in("status", [...PAID_STATUSES])
        .order("created_at", { ascending: false })
        .limit(8);
      if (orderError) throw orderError;

      const galleries = [];
      for (const order of orders ?? []) {
        if (
          !accountOwnsPetOrder({
            accountEmail,
            orderEmailNormalized: String(order.email_normalized || ""),
          })
        ) {
          continue;
        }
        if (!deliveryAllowed({
          orderStatus: String(order.status),
          qcStatus: order.qc_status as string | null,
          completedAt: order.completed_at ? String(order.completed_at) : null,
        })) {
          continue;
        }
        const publicToken = await decryptPublicToken(asString(order.public_token_ciphertext));
        const scenes = await loadScenes(service, String(order.id));
        const clips = await loadClips(service, String(order.id));
        const purchasedUpsells = await loadOrderUpsells(service, String(order.id));
        const upsellCatalog = await buildUpsellCatalog({ scenes, purchased: purchasedUpsells });
        const petName = asString(order.pet_name) || "pet";
        const portraits = (await Promise.all(
          scenes.map(async (scene) => {
            if (!["succeeded", "ready"].includes(String(scene.status)) || !scene.result_path) return null;
            const url = await signedDownload(service, PET_RESULT_BUCKET, scene.result_path);
            if (!url) return null;
            const title = sceneByKey(scene.scene_key)?.title || scene.title;
            return {
              sceneId: scene.scene_key,
              title,
              previewUrl: url,
              downloadUrl: url,
              fileName: `${petName}-${scene.scene_key}.jpg`.toLowerCase().replace(/[^a-z0-9.-]+/g, "-"),
              width: Number(scene.result_width || 0) || null,
              height: Number(scene.result_height || 0) || null,
            };
          }),
        )).filter((item): item is NonNullable<typeof item> => Boolean(item));

        const clipItems = await Promise.all(
          clips.map(async (clip) => {
            const ready = ["succeeded", "ready"].includes(String(clip.status)) && Boolean(clip.result_path);
            const url = ready ? await signedDownload(service, PET_RESULT_BUCKET, clip.result_path) : null;
            return {
              id: clip.id,
              title: `Cinematic clip ${clip.slot}`,
              previewUrl: url,
              downloadUrl: url,
              fileName: `${petName}-clip-${clip.slot}.mp4`.toLowerCase().replace(/[^a-z0-9.-]+/g, "-"),
              ready: Boolean(url),
            };
          }),
        );

        galleries.push({
          orderId: order.id,
          publicToken: publicToken || null,
          petName,
          species: order.species,
          status: String(order.status),
          createdAt: order.created_at,
          orderUrl: publicToken
            ? `${siteOrigin()}/pet/order?token=${encodeURIComponent(publicToken)}`
            : `${siteOrigin()}/account/dashboard`,
          portraits,
          clips: clipItems,
          upsells: upsellCatalog,
        });
      }

      return jsonResponse({ galleries });
    }

    if (action === "getOrderByPublicToken" || action === "pollGenerationProgress" || action === "getOrderResults") {
      const publicToken = asString(body.publicToken);
      const order = await findOrderByToken(service, publicToken);
      if (!order) return apiError("ORDER_NOT_FOUND", "We could not find that order.", 404);
      const scenes = await loadScenes(service, order.id);
      const clips = await loadClips(service, order.id);

      if (action === "getOrderByPublicToken") {
        return jsonResponse(toCustomerOrder(order, scenes, publicToken, clips));
      }
      if (action === "pollGenerationProgress") {
        await enqueuePetGenerateIfStalled({
          service,
          orderId: order.id,
          orderStatus: String(order.status),
          paidAt: order.paid_at ? String(order.paid_at) : null,
        });
        return jsonResponse(toProgress(order, scenes, publicToken, clips));
      }

      const unlocked = deliveryAllowed({
        orderStatus: String(order.status),
        qcStatus: order.qc_status as string | null,
        completedAt: order.completed_at,
      });
      const purchasedUpsells = unlocked ? await loadOrderUpsells(service, order.id) : [];
      const upsellCatalog = unlocked ? await buildUpsellCatalog({ scenes, purchased: purchasedUpsells }) : null;
      const sceneResults = [];
      for (const scene of scenes.length ? scenes : PET_SCENE_DEFINITIONS.map((item) => ({
        scene_key: item.key,
        title: item.title,
        status: "queued",
        progress_percent: 0,
        last_error: null,
        started_at: null,
        completed_at: null,
        result_path: null,
        result_content_type: null,
        result_width: null,
        result_height: null,
      }))) {
        const mapped = toProgress(order, [scene], publicToken).scenes[0];
        const previewUrl =
          unlocked && scene.result_path
            ? await signedDownload(service, PET_RESULT_BUCKET, scene.result_path)
            : null;
        const ready = unlocked && mapped.status === "ready" && Boolean(previewUrl);
        const detectedWidth = Number(scene.result_width || 0) || null;
        const detectedHeight = Number(scene.result_height || 0) || null;
        sceneResults.push({
          sceneId: mapped.sceneId,
          title: mapped.title,
          status: mapped.status,
          previewUrl,
          assets: [
            {
              format: "high_res",
              label: "QC-approved portrait",
              url: ready ? previewUrl : null,
              mimeType: scene.result_content_type || "image/jpeg",
              width: detectedWidth,
              height: detectedHeight,
              dpi: null,
              ready,
            },
            {
              format: "wallpaper",
              label: "Phone wallpaper (Coming later)",
              url: null,
              mimeType: "image/jpeg",
              width: null,
              height: null,
              dpi: null,
              ready: false,
            },
            {
              format: "social",
              label: "Social format (Coming later)",
              url: null,
              mimeType: "image/jpeg",
              width: null,
              height: null,
              dpi: null,
              ready: false,
            },
            {
              format: "poster",
              label: "Printable poster (Coming later)",
              url: null,
              mimeType: "image/jpeg",
              width: null,
              height: null,
              dpi: null,
              ready: false,
            },
          ],
        });
      }
      const clipResults = [];
      for (const clip of clips) {
        const mapped = toProgress(order, scenes, publicToken, [clip]).clips[0];
        const previewUrl =
          unlocked && clip.result_path
            ? await signedDownload(service, PET_RESULT_BUCKET, clip.result_path)
            : null;
        const ready = unlocked && mapped?.status === "ready" && Boolean(previewUrl);
        clipResults.push({
          id: clip.id,
          slot: clip.slot === 2 ? 2 : 1,
          sourceSceneId: clip.source_scene_id,
          title: mapped?.title || `Cinematic clip ${clip.slot}`,
          status: mapped?.status || "queued",
          previewUrl: ready ? previewUrl : null,
          downloadUrl: ready ? previewUrl : null,
          mimeType: "video/mp4",
          durationSeconds: Number(clip.output_duration_seconds || clip.requested_duration_seconds || 5),
          width: clip.result_width ?? null,
          height: clip.result_height ?? null,
          ready,
        });
      }
      return jsonResponse({
        orderId: order.id,
        publicToken,
        petName: order.pet_name,
        status: toCustomerOrder(order, scenes, publicToken, clips).status,
        scenes: sceneResults,
        clips: clipResults,
        upsells: upsellCatalog,
        formatNote:
          "This purchase includes 12 QC-approved portraits and 2 cinematic 5-second clips. File dimensions are the real generated size. Wallpaper, social, and poster crops are not included and are labelled Coming later.",
        totalCount: PET_SCENE_COUNT,
      });
    }

    return apiError("INVALID_REQUEST", "Unknown pet funnel action.");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("PET_TOKEN_ENCRYPTION_KEY")) {
      return apiError("INVALID_REQUEST", "Pet order tokens are not configured.", 503);
    }
    return jsonResponse({ error: message, code: "GENERATION_FAILED" }, 500);
  }
});
