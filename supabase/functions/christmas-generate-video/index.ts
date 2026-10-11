import { optionsResponse, jsonResponse } from "../_shared/cors.ts";
import { getServiceClient, isServiceRoleRequest, readJson } from "../_shared/supabase.ts";
import {
  CHRISTMAS_RESULT_BUCKET,
  CHRISTMAS_SIGNED_DOWNLOAD_SECONDS,
  generationMock,
  videoGenerationEnabled,
  type ChristmasPackKey,
} from "../_shared/christmas/constants.ts";
import { asString, isUuid } from "../_shared/christmas/crypto.ts";
import {
  christmasFailedPredictionId,
  recordChristmasV2VideoCost,
} from "../_shared/christmas/costLedger.ts";
import { sendChristmasDeliveryEmail } from "../_shared/christmas/email.ts";
import {
  extractVideoUrl,
  pollHiggsfieldRequest,
  requireChristmasHiggsfieldAuth,
  submitKling3ProVideo,
} from "../_shared/christmas/higgsfieldProviders.ts";
import {
  CHRISTMAS_MAX_VIDEO_BYTES,
  fetchProviderMediaBytes,
} from "../_shared/christmas/providerMedia.ts";

type Body = { order_id?: string };

const MAX_VIDEO_ATTEMPTS = 3;

const CHRISTMAS_VIDEO_PROMPT =
  "Subtle cinematic Christmas motion of this exact portrait. Soft fairy-light shimmer, gentle snowfall or fireplace glow, slight natural head movement and breathing. Preserve the exact face, clothing, and background. No morphing, no identity drift, no aggressive camera moves.";

function decryptStoredToken(ciphertext: string | null | undefined): string | null {
  if (!ciphertext) return null;
  try {
    return atob(ciphertext);
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);
  if (!isServiceRoleRequest(req)) return jsonResponse({ error: "Forbidden" }, 403);

  try {
    const body = await readJson<Body>(req);
    const orderId = asString(body.order_id);
    if (!orderId) return jsonResponse({ error: "order_id required" }, 400);
    const service = getServiceClient();

    // Christmas V2 quarantined tables (not commerce christmas_orders).
    const { data: order, error } = await service
      .from("christmas_v2_orders")
      .select("*")
      .eq("id", orderId)
      .maybeSingle();
    if (error) throw error;
    if (!order) return jsonResponse({ error: "order not found" }, 404);
    if (!order.paid_at) return jsonResponse({ error: "Payment required", code: "PAYMENT_REQUIRED" }, 402);

    if (!videoGenerationEnabled() && !generationMock()) {
      return jsonResponse({ ok: true, status: "held", started: 0 });
    }

    const [{ data: scenes }, { data: videos }] = await Promise.all([
      service
        .from("christmas_v2_order_scenes")
        .select("id, scene_key, status, result_path, result_bucket")
        .eq("order_id", orderId),
      service.from("christmas_v2_order_videos").select("*").eq("order_id", orderId),
    ]);

    // Upsell child packs may reference starter scene keys that live on the parent order.
    let sceneRows = scenes ?? [];
    const parentOrderId = asString(order.parent_order_id);
    if (parentOrderId) {
      const { data: parentScenes } = await service
        .from("christmas_v2_order_scenes")
        .select("id, scene_key, status, result_path, result_bucket")
        .eq("order_id", parentOrderId);
      if (parentScenes?.length) {
        const byKey = new Map(sceneRows.map((s) => [asString(s.scene_key), s]));
        for (const ps of parentScenes) {
          const key = asString(ps.scene_key);
          const existing = byKey.get(key);
          if (!existing || !existing.result_path) byKey.set(key, ps);
        }
        sceneRows = [...byKey.values()];
      }
    }

    // Orphan generating without request_id → uncertain outcome; never silent re-submit.
    for (const video of videos ?? []) {
      if (asString(video.status) === "generating" && !video.replicate_prediction_id) {
        await service
          .from("christmas_v2_order_videos")
          .update({
            status: "failed",
            last_error: "uncertain_provider_outcome",
            completed_at: new Date().toISOString(),
          })
          .eq("id", video.id);
      }
    }

    const { data: refreshedVideos } = await service
      .from("christmas_v2_order_videos")
      .select("*")
      .eq("order_id", orderId);

    const targets = (refreshedVideos ?? []).filter((video) => {
      const status = asString(video.status);
      const pred = asString(video.replicate_prediction_id);
      const lastError = asString(video.last_error);
      if (lastError.startsWith("provider_terminal:") || lastError === "uncertain_provider_outcome") {
        return false;
      }
      if (status === "generating" && pred) return true;
      // failed WITH prediction_id: resume poll / re-download only (never second paid submit)
      if (status === "failed" && pred) return true;
      if (["queued", "failed"].includes(status) && !pred) {
        return Number(video.attempts || 0) < MAX_VIDEO_ATTEMPTS;
      }
      return false;
    });
    if (!targets.length) return res.status(200).json({ ok: true, status: "nothing_to_do", started: 0 });

    let started = 0;
    const authorization = generationMock()
      ? null
      : requireChristmasHiggsfieldAuth({ get: (name) => Deno.env.get(name) });

    for (const video of targets) {
      const source = sceneRows.find(
        (scene) =>
          asString(scene.scene_key) === asString(video.source_scene_key) &&
          ["succeeded", "ready"].includes(asString(scene.status)) &&
          scene.result_path,
      );
      if (!source?.result_path) {
        await service
          .from("christmas_v2_order_videos")
          .update({
            status: "failed",
            last_error: "Source scene result missing",
            attempts: Number(video.attempts || 0) + 1,
          })
          .eq("id", video.id);
        continue;
      }

      const existingPredictionId = asString(video.replicate_prediction_id);
      const resumeOnly = Boolean(existingPredictionId);
      const attemptNumber = resumeOnly
        ? Math.max(Number(video.attempts || 1), 1)
        : Number(video.attempts || 0) + 1;
      const isRetry = attemptNumber > 1;
      const resultPath = `${orderId}/videos/${video.id}.mp4`;
      const sceneKey = asString(video.source_scene_key);

      if (!resumeOnly) {
        await service
          .from("christmas_v2_order_videos")
          .update({
            status: "generating",
            last_error: null,
            attempts: attemptNumber,
          })
          .eq("id", video.id);
      } else {
        await service
          .from("christmas_v2_order_videos")
          .update({ status: "generating", last_error: null })
          .eq("id", video.id);
      }

      try {
        if (generationMock()) {
          const predictionId = existingPredictionId || `mock_video_${video.id}`;
          await service
            .from("christmas_v2_order_videos")
            .update({
              status: "succeeded",
              model_name: "mock",
              result_bucket: CHRISTMAS_RESULT_BUCKET,
              result_path: resultPath,
              result_content_type: "video/mp4",
              duration_seconds: 5,
              replicate_prediction_id: predictionId,
              completed_at: new Date().toISOString(),
            })
            .eq("id", video.id);
          await recordChristmasV2VideoCost(service, {
            predictionId,
            orderId,
            videoId: asString(video.id),
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
          let modelName = asString(video.model_name) || undefined;
          if (!requestId) {
            const bucket = asString(source.result_bucket) || CHRISTMAS_RESULT_BUCKET;
            const { data: signed } = await service.storage
              .from(bucket)
              .createSignedUrl(source.result_path, CHRISTMAS_SIGNED_DOWNLOAD_SECONDS);
            if (!signed?.signedUrl) throw new Error("Could not sign source scene image");

            const submitted = await submitKling3ProVideo({
              authorization: authorization!,
              prompt: CHRISTMAS_VIDEO_PROMPT,
              imageUrl: signed.signedUrl,
              duration: 5,
            });
            requestId = submitted.requestId;
            modelName = submitted.model;
            await service
              .from("christmas_v2_order_videos")
              .update({
                replicate_prediction_id: requestId,
                model_name: submitted.model,
                status: "generating",
              })
              .eq("id", video.id);
          }

          const polled = await pollHiggsfieldRequest(authorization!, requestId, {
            maxAttempts: 90,
          });
          if (!polled.done) throw new Error("Higgsfield Kling 3 Pro timed out");
          if (polled.failed || !polled.body) {
            throw new Error(`provider_terminal:${polled.status || "failed"}`);
          }
          const outputUrl = extractVideoUrl(polled.body);
          if (!outputUrl) throw new Error("Higgsfield Kling 3 Pro returned no video URL");

          const media = await fetchProviderMediaBytes(outputUrl, {
            maxBytes: CHRISTMAS_MAX_VIDEO_BYTES,
            kind: "video",
          });
          const { error: upErr } = await service.storage
            .from(CHRISTMAS_RESULT_BUCKET)
            .upload(resultPath, media.bytes, {
              contentType: "video/mp4",
              upsert: true,
            });
          if (upErr) throw upErr;

          await service
            .from("christmas_v2_order_videos")
            .update({
              status: "succeeded",
              model_name: modelName,
              result_bucket: CHRISTMAS_RESULT_BUCKET,
              result_path: resultPath,
              result_content_type: "video/mp4",
              duration_seconds: 5,
              replicate_prediction_id: requestId,
              completed_at: new Date().toISOString(),
            })
            .eq("id", video.id);
          await recordChristmasV2VideoCost(service, {
            predictionId: requestId,
            orderId,
            videoId: asString(video.id),
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

        const sessionId = asString(order.funnel_session_id);
        if (isUuid(sessionId)) {
          try {
            await service.rpc("record_christmas_v2_funnel_event", {
              p_event_name: "christmas_v2_video_generated",
              p_funnel_session_id: sessionId,
              p_idempotency_key: `christmas_v2_video_generated:${video.id}`,
              p_product: asString(order.sku),
              p_pathname: "/christmas-ai-photos",
            });
          } catch (eventErr) {
            console.error("christmas_v2_video_generated event failed", eventErr);
          }
        }
      } catch (genErr) {
        const message = genErr instanceof Error ? genErr.message : String(genErr);
        const persistedId = asString(
          (
            await service
              .from("christmas_v2_order_videos")
              .select("replicate_prediction_id")
              .eq("id", video.id)
              .maybeSingle()
          ).data?.replicate_prediction_id,
        );
        await service
          .from("christmas_v2_order_videos")
          .update({
            status: "failed",
            last_error: message.slice(0, 500),
            completed_at: new Date().toISOString(),
          })
          .eq("id", video.id);
        await recordChristmasV2VideoCost(service, {
          predictionId:
            persistedId ||
            christmasFailedPredictionId({
              kind: "video",
              orderId,
              assetId: asString(video.id),
              attempt: attemptNumber,
            }),
          orderId,
          videoId: asString(video.id),
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
    if (finalized.error) throw finalized.error;
    const finalData = (typeof finalized.data === "string"
      ? JSON.parse(finalized.data)
      : finalized.data) as { done?: boolean; succeeded?: number };

    if (finalData?.done && (finalData.succeeded || 0) > 0) {
      const { data: refreshed } = await service
        .from("christmas_v2_orders")
        .select("*")
        .eq("id", orderId)
        .maybeSingle();
      const publicToken = decryptStoredToken(asString(refreshed?.public_token_ciphertext));
      const packKey = asString(refreshed?.pack_key) as ChristmasPackKey;
      if (
        publicToken &&
        refreshed?.email &&
        (packKey === "starter" || packKey === "magic" || packKey === "ultimate")
      ) {
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

    return jsonResponse({
      ok: true,
      started,
      status: generationMock() ? "mock_completed" : "completed",
      finalize: finalData,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: message }, 500);
  }
});
