import { optionsResponse, jsonResponse } from "../_shared/cors.ts";
import { getServiceClient, readJson } from "../_shared/supabase.ts";
import { assertRateLimit, clientIp } from "../_shared/rateLimit.ts";
import {
  PET_CURRENCY,
  PET_PRICE_CENTS,
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
  asString,
  encryptPublicToken,
  extensionFromContentType,
  generatePublicToken,
  sha256Hex,
} from "../_shared/pet/crypto.ts";
import {
  assertUploadAllowed,
  deliveryAllowed,
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
import { PET_SCENE_DEFINITIONS } from "../_shared/pet/scenes.ts";
import { petMetaCheckoutFields, petPurchaseEventId, sendMetaCapiInitiateCheckout } from "../_shared/pet/meta.ts";
import { decideCheckoutSessionAction, matchedOpenCheckoutResponse } from "../_shared/pet/checkout.ts";
import { enqueuePetGenerate, enqueuePetGenerateIfStalled } from "../_shared/pet/stripeFulfill.ts";

type Body = Record<string, unknown>;

function apiError(code: string, message: string, status = 400) {
  return jsonResponse({ error: message, code }, status);
}

async function fetchStripeCheckoutSession(
  stripeKey: string,
  sessionId: string,
): Promise<{
  id?: string;
  status?: string;
  url?: string;
  expires_at?: number;
  payment_status?: string;
} | null> {
  const existingRes = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
    headers: { Authorization: `Bearer ${stripeKey}` },
  });
  if (!existingRes.ok) return null;
  return await existingRes.json();
}

function checkoutConflict() {
  return apiError(
    "CHECKOUT_CONFLICT",
    "Checkout changed while starting payment. Refresh and try again.",
    409,
  );
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
  const offer = typeof data === "string" ? JSON.parse(data) : data;
  return resolveServerOwnedOffer(offer);
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
      const deliveryEstimate = publicDeliveryEstimate(
        String(payload?.deliveryEstimate || payload?.delivery_estimate_label || ""),
      );
      return jsonResponse({
        sku: offer.sku,
        name: "My Pet’s Secret Life",
        amountCents: offer.amountCents,
        currency: offer.currency,
        imageCount: 12,
        videoCount: 2,
        subscription: false,
        active: true,
        priceDisplay: formatOfferPrice(offer.amountCents),
        version: Number(payload?.version || 1),
        deliveryEstimate,
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
      const priceCheck = rejectAgainstOffer(
        {
          amountCents: body.amountCents,
          currency: body.currency,
          sku: body.sku,
        },
        offer.amountCents,
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
        amount_cents: offer.amountCents,
        charged_amount_cents: offer.amountCents,
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
        p_payload: { sku: offer.sku, amount_cents: offer.amountCents, offer_version: offerRow?.version ?? 1 },
      });
      return jsonResponse({
        orderId: data.id,
        publicToken,
        status: "awaiting_upload",
        amountCents: offer.amountCents,
        currency: offer.currency,
        sku: offer.sku,
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

      const decision = decideCheckoutSessionAction({
        existingSession: existingSession
          ? { ...existingSession, id: existingSession.id || storedSessionId }
          : null,
        orderId: order.id,
        issuedCount: issuedCount || 0,
      });

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
        await sendMetaCapiInitiateCheckout({
          eventId: meta.eventId,
          orderId: order.id,
          email: asString(order.email),
          amountCents: meta.chargedAmountCents,
        });
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
      params.set("success_url", successUrl);
      params.set("cancel_url", cancelUrl);
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
      params.set("metadata[meta_event_id]", petPurchaseEventId(order.id));
      params.set("metadata[email_hash]", await sha256Hex(order.email));
      params.set("payment_intent_data[metadata][sku]", PET_SKU);
      params.set("payment_intent_data[metadata][pet_order_id]", order.id);

      const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${stripeKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
          "Idempotency-Key": decision.idempotencyKey,
        },
        body: params,
      });
      const session = await stripeRes.json();
      if (!stripeRes.ok) {
        return apiError("INVALID_REQUEST", session.error?.message || "Stripe checkout failed", 502);
      }

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
        const matched = matchedOpenCheckoutResponse(winner ? { ...winner, id: winner.id || attachedId } : null);
        if (!matched.ok) return checkoutConflict();
        const meta = petMetaCheckoutFields(order);
        await sendMetaCapiInitiateCheckout({
          eventId: meta.eventId,
          orderId: order.id,
          email: asString(order.email),
          amountCents: meta.chargedAmountCents,
        });
        return jsonResponse({
          sessionId: matched.sessionId,
          checkoutUrl: matched.checkoutUrl,
          status: "open",
          reused: true,
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
      await sendMetaCapiInitiateCheckout({
        eventId: meta.eventId,
        orderId: order.id,
        email: asString(order.email),
        amountCents: meta.chargedAmountCents,
      });
      return jsonResponse({
        sessionId: matched.sessionId,
        checkoutUrl: matched.checkoutUrl,
        status: "open",
        ...meta,
      });
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
