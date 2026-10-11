/**
 * Node origin port of supabase/functions/christmas-generate/index.ts.
 * Keep in sync with the Deno source · see api/christmas-funnel.ts for context.
 */
import type { NodeApiRequest, NodeApiResponse } from "./_lib/nodeHandler";
import { waitUntil } from "./_lib/nodeHandler";
import {
  CHRISTMAS_RESULT_BUCKET,
  CHRISTMAS_SIGNED_DOWNLOAD_SECONDS,
  CHRISTMAS_SOURCE_BUCKET,
  buildScenePrompt,
  generationEnabled,
  generationMock,
  sceneByKey,
  type ChristmasPackKey,
} from "./_lib/christmas/constants";
import { extractHiggsfieldImageUrl } from "./_lib/christmas/higgsfieldImageShim";
import {
  pollHiggsfieldRequest,
  requireChristmasHiggsfieldAuth,
  submitSoulV2Image,
} from "./_lib/christmas/higgsfieldProviders";
import {
  CHRISTMAS_MAX_IMAGE_BYTES,
  fetchProviderMediaBytes,
} from "./_lib/christmas/providerMedia";
import { asString } from "./_lib/christmas/crypto";
import {
  christmasFailedPredictionId,
  recordChristmasV2ImageCost,
} from "./_lib/christmas/costLedger";
import { getServiceClient, isServiceRoleRequest } from "./_lib/christmas/supabaseClient";
import { invokeChristmasGenerateVideo, resolveSiteOriginFromRequest } from "./_lib/christmas/stripeFulfill";
import { sendChristmasDeliveryEmail } from "./_lib/christmas/email";

const MAX_SCENE_ATTEMPTS = 3;

type Body = { order_id?: string };

function decryptStoredToken(ciphertext: string | null | undefined): string | null {
  if (!ciphertext) return null;
  try {
    return Buffer.from(ciphertext, "base64").toString("utf8");
  } catch {
    return null;
  }
}

async function copyObject(
  service: ReturnType<typeof getServiceClient>,
  fromBucket: string,
  fromPath: string,
  toBucket: string,
  toPath: string,
  contentType: string,
) {
  const { data, error } = await service.storage.from(fromBucket).download(fromPath);
  if (error || !data) throw error || new Error("Could not read source photo");
  const buffer = Buffer.from(await data.arrayBuffer());
  const { error: upError } = await service.storage.from(toBucket).upload(toPath, buffer, {
    contentType,
    upsert: true,
  });
  if (upError) throw upError;
}

async function finalizeChristmasV2Generation(
  service: ReturnType<typeof getServiceClient>,
  orderId: string,
) {
  let finalized = await service.rpc("christmas_v2_finalize_generation_if_done", {
    p_order_id: orderId,
  });
  if (finalized.error) {
    const msg = String(finalized.error.message || "").toLowerCase();
    if (msg.includes("could not find") || msg.includes("function") || msg.includes("does not exist")) {
      finalized = await service.rpc("christmas_finalize_generation_if_done", {
        p_order_id: orderId,
      });
    }
  }
  return finalized;
}

function parseBody(req: NodeApiRequest): Body {
  const raw = req.body;
  if (!raw) return {};
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as Body;
    } catch {
      return {};
    }
  }
  if (typeof raw === "object") return raw as Body;
  return {};
}

export default async function handler(req: NodeApiRequest, res: NodeApiResponse) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "authorization, content-type");
    return res.status(200).send("ok");
  }
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!isServiceRoleRequest(req.headers.authorization)) return res.status(403).json({ error: "Forbidden" });

  try {
    const body = parseBody(req);
    const orderId = asString(body.order_id);
    if (!orderId) return res.status(400).json({ error: "order_id required" });
    const service = getServiceClient();

    const { data: order, error } = await service
      .from("christmas_v2_orders")
      .select("*")
      .eq("id", orderId)
      .maybeSingle();
    if (error) throw error;
    if (!order) return res.status(404).json({ error: "order not found" });
    if (!order.paid_at) return res.status(402).json({ error: "Payment required", code: "PAYMENT_REQUIRED" });

    const claim = await service.rpc("claim_christmas_v2_generation_job", { p_order_id: orderId });
    if (claim.error) throw claim.error;
    const claimData = (typeof claim.data === "string" ? JSON.parse(claim.data) : claim.data) as {
      claimed?: boolean;
      status?: string;
    };
    if (!claimData?.claimed) {
      return res.status(200).json({ ok: true, status: "already_running", claim: claimData });
    }

    if (!order.photo_path) {
      await service
        .from("christmas_v2_generation_jobs")
        .update({
          status: "failed",
          last_error: "source_photo_missing",
          finished_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("order_id", orderId);
      await service
        .from("christmas_v2_orders")
        .update({ status: "failed", last_error: "source_photo_missing", updated_at: new Date().toISOString() })
        .eq("id", orderId);
      return res.status(400).json({ error: "Source photo missing" });
    }

    const { data: signed } = await service.storage
      .from(CHRISTMAS_SOURCE_BUCKET)
      .createSignedUrl(order.photo_path, CHRISTMAS_SIGNED_DOWNLOAD_SECONDS);
    if (!signed?.signedUrl) {
      await service
        .from("christmas_v2_generation_jobs")
        .update({
          status: "failed",
          last_error: "source_photo_sign_failed",
          finished_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("order_id", orderId);
      return res.status(500).json({ error: "Could not sign source photo" });
    }

    const { data: scenes, error: sceneError } = await service
      .from("christmas_v2_order_scenes")
      .select("*")
      .eq("order_id", orderId)
      .order("scene_number", { ascending: true });
    if (sceneError) throw sceneError;

    if (!generationEnabled() && !generationMock()) {
      await service
        .from("christmas_v2_generation_jobs")
        .update({ status: "held", last_error: "generation_disabled" })
        .eq("order_id", orderId);
      await service
        .from("christmas_v2_orders")
        .update({ status: "paid", last_error: "generation_disabled" })
        .eq("id", orderId);
      return res.status(200).json({ ok: true, status: "held", started: 0 });
    }

    // Orphan: generating without request_id means uncertain paid outcome — never silent re-submit.
    for (const scene of scenes ?? []) {
      if (asString(scene.status) === "generating" && !scene.replicate_prediction_id) {
        await service
          .from("christmas_v2_order_scenes")
          .update({
            status: "failed",
            last_error: "uncertain_provider_outcome",
            completed_at: new Date().toISOString(),
          })
          .eq("id", scene.id);
      }
    }

    const { data: refreshedScenes } = await service
      .from("christmas_v2_order_scenes")
      .select("*")
      .eq("order_id", orderId)
      .order("scene_number", { ascending: true });

    const targets = (refreshedScenes ?? []).filter((scene) => {
      const status = asString(scene.status);
      const pred = asString(scene.replicate_prediction_id);
      const lastError = asString(scene.last_error);
      if (lastError.startsWith("provider_terminal:") || lastError === "uncertain_provider_outcome") {
        return false;
      }
      if (status === "generating" && pred) return true; // resume poll only
      // Download/storage failure after submit: resume poll, never create a second request_id.
      if (status === "failed" && pred) return true;
      if (["queued", "failed"].includes(status) && !pred) {
        return Number(scene.attempts || 0) < MAX_SCENE_ATTEMPTS;
      }
      return false;
    });

    let started = 0;
    const contentType = asString(order.photo_content_type) || "image/jpeg";
    const authorization = generationMock()
      ? null
      : requireChristmasHiggsfieldAuth({ get: (name) => process.env[name] });

    for (const scene of targets) {
      const sceneKey = asString(scene.scene_key);
      const def = sceneByKey(sceneKey);
      if (!def) {
        await service
          .from("christmas_v2_order_scenes")
          .update({ status: "failed", last_error: "unknown_scene" })
          .eq("id", scene.id);
        continue;
      }

      const resultPath = `${orderId}/scenes/${sceneKey}.jpg`;
      const existingPredictionId = asString(scene.replicate_prediction_id);
      const resumeOnly = Boolean(existingPredictionId);
      const attemptNumber = resumeOnly
        ? Math.max(Number(scene.attempts || 1), 1)
        : Number(scene.attempts || 0) + 1;
      const isRetry = attemptNumber > 1;

      if (!resumeOnly) {
        await service
          .from("christmas_v2_order_scenes")
          .update({
            status: "generating",
            started_at: new Date().toISOString(),
            last_error: null,
            attempts: attemptNumber,
          })
          .eq("id", scene.id);
      }

      try {
        if (generationMock()) {
          const predictionId = existingPredictionId || `mock_${orderId}_${sceneKey}`;
          await copyObject(
            service,
            CHRISTMAS_SOURCE_BUCKET,
            order.photo_path,
            CHRISTMAS_RESULT_BUCKET,
            resultPath,
            contentType,
          );
          await service
            .from("christmas_v2_order_scenes")
            .update({
              status: "succeeded",
              progress_percent: 100,
              replicate_prediction_id: predictionId,
              result_bucket: CHRISTMAS_RESULT_BUCKET,
              result_path: resultPath,
              result_content_type: contentType,
              model_name: "mock",
              completed_at: new Date().toISOString(),
            })
            .eq("id", scene.id);
          await recordChristmasV2ImageCost(service, {
            predictionId,
            orderId,
            sceneId: asString(scene.id),
            sceneKey,
            attemptNumber,
            productSku: asString(order.sku),
            providerStatus: "succeeded",
            modelName: "mock",
            isMock: true,
            isRetry,
          });
        } else {
          let requestId = existingPredictionId;
          let modelName = asString(scene.model_name) || undefined;
          if (!requestId) {
            const submitted = await submitSoulV2Image({
              authorization: authorization!,
              prompt: buildScenePrompt(def),
              imageUrl: signed.signedUrl,
              aspectRatio: "3:4",
            });
            requestId = submitted.requestId;
            modelName = submitted.model;
            // Persist BEFORE polling — crash-safe anti double-charge.
            await service
              .from("christmas_v2_order_scenes")
              .update({
                replicate_prediction_id: requestId,
                model_name: submitted.model,
                status: "generating",
                progress_percent: 20,
              })
              .eq("id", scene.id);
          }

          const polled = await pollHiggsfieldRequest(authorization!, requestId, {
            maxAttempts: 48,
          });
          if (!polled.done) throw new Error("Higgsfield Soul v2 timed out");
          if (polled.failed || !polled.body) {
            throw new Error(`provider_terminal:${polled.status || "failed"}`);
          }
          const outputUrl = extractHiggsfieldImageUrl(polled.body);
          if (!outputUrl) throw new Error("Higgsfield Soul v2 returned no image URL");

          const media = await fetchProviderMediaBytes(outputUrl, {
            maxBytes: CHRISTMAS_MAX_IMAGE_BYTES,
            kind: "image",
          });
          const { error: upErr } = await service.storage
            .from(CHRISTMAS_RESULT_BUCKET)
            .upload(resultPath, Buffer.from(media.bytes), {
              contentType: media.contentType || "image/jpeg",
              upsert: true,
            });
          if (upErr) throw upErr;
          await service
            .from("christmas_v2_order_scenes")
            .update({
              status: "succeeded",
              progress_percent: 100,
              replicate_prediction_id: requestId,
              result_bucket: CHRISTMAS_RESULT_BUCKET,
              result_path: resultPath,
              result_content_type: media.contentType || "image/jpeg",
              model_name: modelName,
              completed_at: new Date().toISOString(),
            })
            .eq("id", scene.id);
          await recordChristmasV2ImageCost(service, {
            predictionId: requestId,
            orderId,
            sceneId: asString(scene.id),
            sceneKey,
            attemptNumber,
            productSku: asString(order.sku),
            providerStatus: "succeeded",
            modelName,
            isMock: false,
            isRetry,
            costNotes: "estimate_catalog_not_provider_invoice",
          });
        }
        started += 1;
      } catch (genErr) {
        const message = genErr instanceof Error ? genErr.message : String(genErr);
        const persistedId = asString(
          (
            await service
              .from("christmas_v2_order_scenes")
              .select("replicate_prediction_id")
              .eq("id", scene.id)
              .maybeSingle()
          ).data?.replicate_prediction_id,
        );
        await service
          .from("christmas_v2_order_scenes")
          .update({
            status: "failed",
            last_error: message.slice(0, 500),
            completed_at: new Date().toISOString(),
          })
          .eq("id", scene.id);
        await recordChristmasV2ImageCost(service, {
          predictionId:
            persistedId ||
            christmasFailedPredictionId({
              kind: "image",
              orderId,
              assetId: asString(scene.id),
              attempt: attemptNumber,
            }),
          orderId,
          sceneId: asString(scene.id),
          sceneKey,
          attemptNumber,
          productSku: asString(order.sku),
          providerStatus: "failed",
          isMock: generationMock(),
          isRetry,
          costNotes: persistedId
            ? "provider_or_postprocess_failed_with_request_id"
            : "failed_attempt_estimated_consumption",
        });
      }
    }

    const finalized = await finalizeChristmasV2Generation(service, orderId);
    if (finalized.error) throw finalized.error;
    const finalData = (typeof finalized.data === "string"
      ? JSON.parse(finalized.data)
      : finalized.data) as {
      done?: boolean;
      scenes_done?: boolean;
      awaiting_videos?: boolean;
      succeeded?: number;
      failed?: number;
    };

    const scenesReady =
      Boolean(finalData?.done) || Boolean(finalData?.scenes_done) || Boolean(finalData?.awaiting_videos);

    if (scenesReady && (finalData.succeeded || 0) > 0) {
      const { data: refreshed } = await service
        .from("christmas_v2_orders")
        .select("*")
        .eq("id", orderId)
        .maybeSingle();

      if (Number(refreshed?.video_count || 0) > 0) {
        const originForInvoke = resolveSiteOriginFromRequest(req.headers as Record<string, string | string[]>);
        waitUntil(
          invokeChristmasGenerateVideo(orderId, originForInvoke).catch((err) => {
            console.error("christmas-generate-video enqueue failed", err);
          }),
        );
      }

      // Delivery email only when the order is fully finalized (images + paid videos).
      if (finalData?.done) {
        const publicToken = decryptStoredToken(asString(refreshed?.public_token_ciphertext));
        const packKey = asString(refreshed?.pack_key) as ChristmasPackKey;
        if (publicToken && refreshed?.email && (packKey === "starter" || packKey === "magic" || packKey === "ultimate")) {
          try {
            await sendChristmasDeliveryEmail({
              service,
              orderId,
              email: asString(refreshed.email),
              publicToken,
              packKey,
            });
          } catch (emailErr) {
            console.error("christmas delivery email failed", emailErr);
          }
        }
      }
    }

    return res.status(200).json({
      ok: true,
      status: generationMock() ? "mock_completed" : "completed",
      started,
      finalize: finalData,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: message });
  }
}

export const config = { maxDuration: 60 };
