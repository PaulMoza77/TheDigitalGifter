import { optionsResponse, jsonResponse } from "../_shared/cors.ts";
import { getServiceClient, isServiceRoleRequest, readJson } from "../_shared/supabase.ts";
import {
  PET_RESULT_BUCKET,
  PET_SIGNED_DOWNLOAD_SECONDS,
  petVideoDurationSeconds,
  petVideoMaxAttempts,
  petVideoModel,
  petVideoResolution,
  videoGenerationEnabled,
  videoGenerationMock,
} from "../_shared/pet/constants.ts";
import { asString } from "../_shared/pet/crypto.ts";
import {
  createFailedPredictionId,
  mockPredictionId,
  recordVideoAiCostAttempt,
} from "../_shared/pet/costLedger.ts";
import { canGenerateVideoClips, canRetryVideoClip, defaultVideoPrompt, videoStoragePath } from "../_shared/pet/videoGuards.ts";
import { createReplicateVideoPrediction, ReplicateHttpError } from "../_shared/pet/replicate.ts";
import {
  DEFAULT_THROTTLE_MAX_RETRIES,
  classifyCreateError,
  resolveCreateIntervalMs,
  runEligibleSceneCreates,
  type SceneCreateView,
} from "../_shared/pet/replicateRateLimit.ts";

type Body = {
  order_id?: string;
  clip_id?: string;
  retry?: boolean;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);
  if (!isServiceRoleRequest(req)) return jsonResponse({ error: "Forbidden" }, 403);

  try {
    const body = await readJson<Body>(req);
    const orderId = asString(body.order_id);
    if (!orderId) return jsonResponse({ error: "order_id required" }, 400);
    const service = getServiceClient();

    const { data: order, error } = await service.from("pet_orders").select("*").eq("id", orderId).maybeSingle();
    if (error) throw error;
    if (!order) return jsonResponse({ error: "order not found" }, 404);

    const [{ data: scenes }, { data: clips }] = await Promise.all([
      service.from("pet_order_scenes").select("id, order_id, status, result_path, scene_key").eq("order_id", orderId),
      service.from("pet_order_video_clips").select("*").eq("pet_order_id", orderId).order("slot"),
    ]);

    const retryClipId = asString(body.clip_id);
    const targets = retryClipId
      ? (clips ?? []).filter((clip) => clip.id === retryClipId)
      : (clips ?? []).filter(
          (clip) =>
            ["queued", "failed", "rate_limited"].includes(String(clip.status)) ||
            (String(clip.status) === "generating" && !clip.replicate_prediction_id),
        );

    if (retryClipId) {
      const retryCheck = canRetryVideoClip({
        callerIsAdmin: true,
        paidAt: order.paid_at,
        clip: targets[0]
          ? {
              id: targets[0].id,
              petOrderId: targets[0].pet_order_id,
              sourceSceneId: targets[0].source_scene_id,
              slot: targets[0].slot,
              status: targets[0].status,
            }
          : null,
        orderId,
      });
      if (!retryCheck.ok) return jsonResponse({ error: retryCheck.message, code: retryCheck.code }, 400);
    } else {
      const generateCheck = canGenerateVideoClips({
        callerIsAdmin: true,
        paidAt: order.paid_at,
        orderStatus: String(order.status),
        scenes: (scenes ?? []).map((scene) => ({ id: scene.id, orderId: scene.order_id, status: scene.status })),
        selectedSceneIds: (clips ?? []).map((clip) => String(clip.source_scene_id)),
        orderId,
        existingClips: (clips ?? []).map((clip) => ({
          id: clip.id,
          petOrderId: clip.pet_order_id,
          sourceSceneId: clip.source_scene_id,
          slot: clip.slot,
          status: clip.status,
          replicatePredictionId: clip.replicate_prediction_id,
        })),
        videoGenerationEnabled: videoGenerationEnabled(),
        videoGenerationMock: videoGenerationMock(),
      });
      if (!generateCheck.ok) {
        const status = generateCheck.status === "held" ? 200 : generateCheck.code === "PAYMENT_REQUIRED" ? 402 : 400;
        if (generateCheck.status === "held") {
          await service.from("pet_orders").update({ last_error: "video_generation_disabled" }).eq("id", orderId);
          await service.rpc("pet_log_event", {
            p_order_id: orderId,
            p_action: "video_generation_held",
            p_actor_type: "system",
            p_payload: { reason: "PET_VIDEO_GENERATION_ENABLED is false" },
          });
          return jsonResponse({ ok: true, status: "held", started: 0, message: generateCheck.message });
        }
        return jsonResponse({ error: generateCheck.message, code: generateCheck.code }, status);
      }
    }

    if (!targets.length) return jsonResponse({ error: "No video clips are ready to generate" }, 400);

    const model = petVideoModel();
    const duration = petVideoDurationSeconds();
    const resolution = petVideoResolution();
    const maxAttempts = petVideoMaxAttempts();
    const prompt = defaultVideoPrompt();
    let started = 0;

    await service
      .from("pet_orders")
      .update({ status: "generating_videos", last_error: null })
      .eq("id", orderId);

    if (videoGenerationMock()) {
      for (const clip of targets) {
        const source = (scenes ?? []).find((scene) => scene.id === clip.source_scene_id);
        if (!source?.result_path) {
          await service
            .from("pet_order_video_clips")
            .update({ status: "failed", provider_error: "Source portrait file is missing" })
            .eq("id", clip.id);
          continue;
        }
        const attemptNumber = Number(clip.attempt_number || 0) + 1;
        await service
          .from("pet_order_video_clips")
          .update({
            status: "succeeded",
            attempt_number: attemptNumber,
            max_attempts: maxAttempts,
            model_name: "mock",
            prompt_snapshot: prompt,
            requested_duration_seconds: duration,
            requested_resolution: resolution,
            result_content_type: "video/mp4",
            completed_at: new Date().toISOString(),
            provider_error: "mock_generation",
          })
          .eq("id", clip.id);
        await recordVideoAiCostAttempt(service, {
          predictionId: mockPredictionId(orderId, `video-${clip.slot}`, attemptNumber),
          orderId,
          clipId: clip.id,
          sourceSceneId: clip.source_scene_id,
          sceneKey: source.scene_key,
          attemptNumber,
          modelName: "mock",
          resolution,
          requestedSeconds: duration,
          isMock: true,
          costNotes: "mock_generation",
        });
        started += 1;
      }
      await service.rpc("pet_finalize_video_if_done", { p_order_id: orderId });
      void videoStoragePath;
      return jsonResponse({ ok: true, started, status: "mock_completed" });
    }

    if (retryClipId) {
      for (const clip of targets) {
        if (String(clip.status) === "failed" && clip.replicate_prediction_id) {
          await service
            .from("pet_order_video_clips")
            .update({ status: "queued", replicate_prediction_id: null, provider_error: null })
            .eq("id", clip.id)
            .eq("status", "failed");
          clip.replicate_prediction_id = null;
          clip.status = "queued";
        }
      }
    }

    const clipViews: SceneCreateView[] = targets.map((clip) => ({
      id: String(clip.id),
      sceneKey: `video-slot-${clip.slot}`,
      status: String(clip.status),
      attempts: Number(clip.attempt_number || 0),
      replicatePredictionId: clip.replicate_prediction_id ? String(clip.replicate_prediction_id) : null,
      lastError: clip.provider_error ? String(clip.provider_error) : null,
    }));

    const holder = crypto.randomUUID();
    const lock = await service.rpc("claim_pet_provider_create_lock", {
      p_order_id: orderId,
      p_kind: "video",
      p_holder: holder,
      p_lease_seconds: 150,
    });
    if (lock.error) throw lock.error;
    const lockData = (typeof lock.data === "string" ? JSON.parse(lock.data) : lock.data) as { claimed?: boolean };
    if (!lockData?.claimed) {
      return jsonResponse({ ok: true, status: "already_running", started: 0 });
    }

    try {
      const createResult = await runEligibleSceneCreates({
        scenes: clipViews,
        intervalMs: resolveCreateIntervalMs(Deno.env.get("PET_REPLICATE_CREATE_INTERVAL_MS")),
        maxThrottleRetries: DEFAULT_THROTTLE_MAX_RETRIES,
        wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
        claim: async (clipView) => {
          const { data } = await service
            .from("pet_order_video_clips")
            .update({
              status: "generating",
              max_attempts: maxAttempts,
              started_at: new Date().toISOString(),
              model_name: model,
              prompt_snapshot: prompt,
              requested_duration_seconds: duration,
              requested_resolution: resolution,
              provider_error: null,
            })
            .eq("id", clipView.id)
            .in("status", ["queued", "failed", "rate_limited", "generating"])
            .is("replicate_prediction_id", null)
            .select("*")
            .maybeSingle();
          if (!data) return null;
          return {
            id: String(data.id),
            sceneKey: `video-slot-${data.slot}`,
            status: String(data.status),
            attempts: Number(data.attempt_number || 0),
            replicatePredictionId: data.replicate_prediction_id ? String(data.replicate_prediction_id) : null,
            lastError: data.provider_error ? String(data.provider_error) : null,
          };
        },
        create: async (clipView) => {
          const clip = targets.find((item) => String(item.id) === clipView.id);
          const source = (scenes ?? []).find((scene) => scene.id === clip?.source_scene_id);
          if (!source?.result_path) {
            return { ok: false, status: 400, error: "Source portrait file is missing", retryAfterMs: null };
          }
          const { data: signed } = await service.storage
            .from(PET_RESULT_BUCKET)
            .createSignedUrl(source.result_path, PET_SIGNED_DOWNLOAD_SECONDS);
          if (!signed?.signedUrl) {
            return { ok: false, status: 500, error: "Could not sign source portrait", retryAfterMs: null };
          }
          try {
            const prediction = await createReplicateVideoPrediction({
              prompt,
              imageUrl: signed.signedUrl,
              orderId,
              clipId: clipView.id,
              slot: Number(clip?.slot || 1),
            });
            if (!prediction.id) return { ok: false, status: 500, error: "missing prediction id", retryAfterMs: null };
            return { ok: true, id: prediction.id };
          } catch (err) {
            if (err instanceof ReplicateHttpError) {
              return { ok: false, status: err.status, error: err.message, retryAfterMs: err.retryAfterMs };
            }
            const message = err instanceof Error ? err.message : String(err);
            return { ok: false, status: 500, error: message.slice(0, 500), retryAfterMs: null };
          }
        },
        onPrediction: async (clipView, predictionId, attemptNumber) => {
          const clip = targets.find((item) => String(item.id) === clipView.id);
          const source = (scenes ?? []).find((scene) => scene.id === clip?.source_scene_id);
          const { data } = await service
            .from("pet_order_video_clips")
            .update({
              replicate_prediction_id: predictionId,
              attempt_number: attemptNumber,
              model_name: model,
            })
            .eq("id", clipView.id)
            .is("replicate_prediction_id", null)
            .neq("status", "succeeded")
            .neq("status", "ready")
            .select("id")
            .maybeSingle();
          if (!data || !clip || !source) return;
          await recordVideoAiCostAttempt(service, {
            predictionId,
            orderId,
            clipId: clipView.id,
            sourceSceneId: clip.source_scene_id,
            sceneKey: source.scene_key,
            attemptNumber,
            modelName: model,
            resolution,
            requestedSeconds: duration,
          });
        },
        onThrottleExhausted: async (clipView, errorMessage) => {
          await service
            .from("pet_order_video_clips")
            .update({ status: "rate_limited", provider_error: errorMessage.slice(0, 500) })
            .eq("id", clipView.id)
            .is("replicate_prediction_id", null)
            .neq("status", "succeeded")
            .neq("status", "ready");
        },
        onRetryableExhausted: async (clipView, errorMessage) => {
          await service
            .from("pet_order_video_clips")
            .update({ status: "queued", provider_error: errorMessage.slice(0, 500) })
            .eq("id", clipView.id)
            .is("replicate_prediction_id", null)
            .neq("status", "succeeded")
            .neq("status", "ready");
        },
        onBillingRequired: async (clipView, errorMessage) => {
          await service
            .from("pet_order_video_clips")
            .update({ status: "queued", provider_error: errorMessage.slice(0, 500) })
            .eq("id", clipView.id)
            .is("replicate_prediction_id", null)
            .neq("status", "succeeded")
            .neq("status", "ready");
          await service.from("pet_orders").update({ last_error: "billing_required" }).eq("id", orderId);
        },
        onPermanentFailure: async (clipView, errorMessage, attemptNumber) => {
          const clip = targets.find((item) => String(item.id) === clipView.id);
          const source = (scenes ?? []).find((scene) => scene.id === clip?.source_scene_id);
          await service
            .from("pet_order_video_clips")
            .update({
              status: "failed",
              attempt_number: attemptNumber,
              provider_error: errorMessage.slice(0, 500),
              completed_at: new Date().toISOString(),
            })
            .eq("id", clipView.id)
            .is("replicate_prediction_id", null)
            .neq("status", "succeeded")
            .neq("status", "ready");
          if (clip && source && classifyCreateError(400, errorMessage) === "terminal") {
            await recordVideoAiCostAttempt(service, {
              predictionId: createFailedPredictionId(crypto.randomUUID()),
              orderId,
              clipId: clipView.id,
              sourceSceneId: clip.source_scene_id,
              sceneKey: source.scene_key,
              attemptNumber,
              modelName: model,
              resolution,
              requestedSeconds: duration,
              createFailed: true,
              costNotes: "create_failed_no_prediction_id",
            });
          }
        },
      });
      started = createResult.started;
      await service.rpc("pet_finalize_video_if_done", { p_order_id: orderId });
      void videoStoragePath;
      return jsonResponse({
        ok: true,
        started,
        skipped: createResult.skipped,
        status: createResult.billingRequired ? "billing_required" : "started",
      });
    } finally {
      await service.rpc("release_pet_provider_create_lock", {
        p_order_id: orderId,
        p_kind: "video",
        p_holder: holder,
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: message }, 500);
  }
});
