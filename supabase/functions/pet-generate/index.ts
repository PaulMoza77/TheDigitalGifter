import { optionsResponse, jsonResponse } from "../_shared/cors.ts";
import { getServiceClient, isServiceRoleRequest, readJson } from "../_shared/supabase.ts";
import {
  generationEnabled,
  generationMock,
  PET_RESULT_BUCKET,
  PET_SOURCE_BUCKET,
  PET_SIGNED_DOWNLOAD_SECONDS,
  petImageModel,
  petImageModelVersion,
} from "../_shared/pet/constants.ts";
import { asString } from "../_shared/pet/crypto.ts";
import { canStartGeneration } from "../_shared/pet/guards.ts";
import { createReplicatePrediction, ReplicateHttpError } from "../_shared/pet/replicate.ts";
import { buildScenePrompt, PET_SCENE_DEFINITIONS } from "../_shared/pet/scenes.ts";
import {
  createFailedPredictionId,
  mockPredictionId,
  recordAiCostAttempt,
} from "../_shared/pet/costLedger.ts";
import {
  DEFAULT_THROTTLE_MAX_RETRIES,
  classifyCreateError,
  predictionAttemptNumber,
  resolveCreateIntervalMs,
  runEligibleSceneCreates,
  selectScenesForPredictionCreate,
  type SceneCreateView,
} from "../_shared/pet/replicateRateLimit.ts";

type Body = {
  order_id?: string;
  scene_keys?: string[];
};

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
  const { error: upError } = await service.storage.from(toBucket).upload(toPath, data, {
    contentType,
    upsert: true,
  });
  if (upError) throw upError;
}

function asSceneView(row: Record<string, unknown>): SceneCreateView {
  return {
    id: String(row.id || ""),
    sceneKey: String(row.scene_key || ""),
    status: String(row.status || ""),
    attempts: Number(row.attempts || 0),
    replicatePredictionId: row.replicate_prediction_id ? String(row.replicate_prediction_id) : null,
    lastError: row.last_error ? String(row.last_error) : null,
  };
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

    const { data: order, error } = await service.from("pet_orders").select("*").eq("id", orderId).maybeSingle();
    if (error) throw error;
    if (!order) return jsonResponse({ error: "order not found" }, 404);

    const allowed = canStartGeneration({ paidAt: order.paid_at, status: order.status });
    if (!allowed.ok) return jsonResponse({ error: allowed.message, code: allowed.code }, 402);

    const claim = await service.rpc("claim_pet_generation_job", { p_order_id: orderId });
    if (claim.error) throw claim.error;
    const claimData = (typeof claim.data === "string" ? JSON.parse(claim.data) : claim.data) as {
      claimed?: boolean;
      status?: string;
    };
    if (!claimData?.claimed && !body.scene_keys?.length) {
      return jsonResponse({ ok: true, status: "already_running", claim: claimData });
    }

    if (!order.photo_path) return jsonResponse({ error: "Source photo missing" }, 400);

    const { data: signed } = await service.storage
      .from(PET_SOURCE_BUCKET)
      .createSignedUrl(order.photo_path, PET_SIGNED_DOWNLOAD_SECONDS);
    if (!signed?.signedUrl) return jsonResponse({ error: "Could not sign source photo" }, 500);

    const { data: scenes, error: sceneError } = await service
      .from("pet_order_scenes")
      .select("*")
      .eq("order_id", orderId);
    if (sceneError) throw sceneError;
    const sceneViews = (scenes ?? []).map((row) => asSceneView(row as Record<string, unknown>));
    const selectedKeys = body.scene_keys?.length
      ? body.scene_keys.map((key) => asString(key)).filter(Boolean)
      : undefined;

    if (!generationEnabled() && !generationMock()) {
      await service.from("pet_generation_jobs").update({ status: "held", last_error: "generation_disabled" }).eq("order_id", orderId);
      await service.from("pet_orders").update({ status: "paid", last_error: "generation_disabled" }).eq("id", orderId);
      await service.rpc("pet_log_event", {
        p_order_id: orderId,
        p_action: "generation_held",
        p_actor_type: "system",
        p_payload: { reason: "PET_GENERATION_ENABLED is false" },
      });
      return jsonResponse({ ok: true, status: "held", started: 0 });
    }

    const model = petImageModel();
    const version = petImageModelVersion();
    let started = 0;

    if (generationMock()) {
      for (const scene of selectScenesForPredictionCreate(sceneViews, selectedKeys)) {
        const { data: claimed } = await service
          .from("pet_order_scenes")
          .update({ status: "generating", last_error: null })
          .eq("id", scene.id)
          .in("status", ["queued", "failed", "rate_limited", "generating"])
          .is("replicate_prediction_id", null)
          .select("*")
          .maybeSingle();
        if (!claimed) continue;
        const resultPath = `${orderId}/scenes/${scene.sceneKey}.jpg`;
        await copyObject(
          service,
          PET_SOURCE_BUCKET,
          order.photo_path,
          PET_RESULT_BUCKET,
          resultPath,
          order.photo_content_type || "image/jpeg",
        );
        const attemptNumber = predictionAttemptNumber(asSceneView(claimed as Record<string, unknown>));
        const predictionId = mockPredictionId(orderId, scene.sceneKey, attemptNumber);
        await service
          .from("pet_order_scenes")
          .update({
            status: "succeeded",
            progress_percent: 100,
            attempts: attemptNumber,
            replicate_prediction_id: predictionId,
            result_bucket: PET_RESULT_BUCKET,
            result_path: resultPath,
            result_content_type: order.photo_content_type || "image/jpeg",
            model_name: "mock",
            completed_at: new Date().toISOString(),
          })
          .eq("id", scene.id)
          .neq("status", "succeeded")
          .neq("status", "ready");
        await recordAiCostAttempt(service, {
          predictionId,
          orderId,
          sceneId: scene.id,
          sceneKey: scene.sceneKey,
          attemptNumber,
          modelName: "mock",
          isMock: true,
          costNotes: "mock_generation",
        });
        started += 1;
      }
      await service.rpc("pet_finalize_generation_if_done", { p_order_id: orderId });
      return jsonResponse({ ok: true, status: "mock_completed", started });
    }

    const holder = crypto.randomUUID();
    const lock = await service.rpc("claim_pet_provider_create_lock", {
      p_order_id: orderId,
      p_kind: "image",
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
        scenes: sceneViews,
        selectedKeys,
        intervalMs: resolveCreateIntervalMs(Deno.env.get("PET_REPLICATE_CREATE_INTERVAL_MS")),
        maxThrottleRetries: DEFAULT_THROTTLE_MAX_RETRIES,
        wait,
        claim: async (scene) => {
          const { data } = await service
            .from("pet_order_scenes")
            .update({
              status: "generating",
              progress_percent: 15,
              started_at: new Date().toISOString(),
              model_name: model,
              model_version: version,
              last_error: null,
            })
            .eq("id", scene.id)
            .in("status", ["queued", "failed", "rate_limited", "generating"])
            .is("replicate_prediction_id", null)
            .select("*")
            .maybeSingle();
          return data ? asSceneView(data as Record<string, unknown>) : null;
        },
        create: async (scene) => {
          try {
            const prediction = await createReplicatePrediction({
              prompt: buildScenePrompt({
                sceneKey: scene.sceneKey,
                petName: order.pet_name,
                species: order.species,
                personality: order.personality,
              }),
              imageUrl: signed.signedUrl,
              orderId,
              sceneKey: scene.sceneKey,
            });
            if (!prediction.id) return { ok: false, status: 500, error: "missing prediction id", retryAfterMs: null };
            return { ok: true, id: prediction.id };
          } catch (err) {
            if (err instanceof ReplicateHttpError) {
              return {
                ok: false,
                status: err.status,
                error: err.message,
                retryAfterMs: err.retryAfterMs,
              };
            }
            const message = err instanceof Error ? err.message : String(err);
            return { ok: false, status: 500, error: message.slice(0, 500), retryAfterMs: null };
          }
        },
        onPrediction: async (scene, predictionId, attemptNumber) => {
          const { data } = await service
            .from("pet_order_scenes")
            .update({
              replicate_prediction_id: predictionId,
              attempts: attemptNumber,
              model_name: model,
              model_version: version,
              last_error: null,
            })
            .eq("id", scene.id)
            .is("replicate_prediction_id", null)
            .neq("status", "succeeded")
            .neq("status", "ready")
            .select("id")
            .maybeSingle();
          if (!data) return;
          await recordAiCostAttempt(service, {
            predictionId,
            orderId,
            sceneId: scene.id,
            sceneKey: scene.sceneKey,
            attemptNumber,
            modelName: model,
            modelVersion: version,
          });
        },
        onThrottleExhausted: async (scene, errorMessage) => {
          await service
            .from("pet_order_scenes")
            .update({
              status: "rate_limited",
              progress_percent: 0,
              last_error: errorMessage.slice(0, 500),
            })
            .eq("id", scene.id)
            .is("replicate_prediction_id", null)
            .neq("status", "succeeded")
            .neq("status", "ready");
        },
        onRetryableExhausted: async (scene, errorMessage) => {
          await service
            .from("pet_order_scenes")
            .update({
              status: "queued",
              progress_percent: 0,
              last_error: errorMessage.slice(0, 500),
            })
            .eq("id", scene.id)
            .is("replicate_prediction_id", null)
            .neq("status", "succeeded")
            .neq("status", "ready");
        },
        onBillingRequired: async (scene, errorMessage) => {
          await service
            .from("pet_order_scenes")
            .update({
              status: "queued",
              progress_percent: 0,
              last_error: errorMessage.slice(0, 500),
            })
            .eq("id", scene.id)
            .is("replicate_prediction_id", null)
            .neq("status", "succeeded")
            .neq("status", "ready");
          await service
            .from("pet_generation_jobs")
            .update({ status: "held", last_error: "billing_required" })
            .eq("order_id", orderId);
          await service.from("pet_orders").update({ last_error: "billing_required" }).eq("id", orderId);
        },
        onPermanentFailure: async (scene, errorMessage, attemptNumber) => {
          await service
            .from("pet_order_scenes")
            .update({
              status: "failed",
              progress_percent: 100,
              attempts: attemptNumber,
              last_error: errorMessage.slice(0, 500),
              completed_at: new Date().toISOString(),
            })
            .eq("id", scene.id)
            .is("replicate_prediction_id", null)
            .neq("status", "succeeded")
            .neq("status", "ready");
          if (classifyCreateError(400, errorMessage) === "terminal") {
            await recordAiCostAttempt(service, {
              predictionId: createFailedPredictionId(crypto.randomUUID()),
              orderId,
              sceneId: scene.id,
              sceneKey: scene.sceneKey,
              attemptNumber,
              modelName: model,
              modelVersion: version,
              createFailed: true,
              costNotes: "create_failed_no_prediction_id",
            });
          }
        },
      });
      started = createResult.started;

      await service.from("pet_orders").update({ model_name: model, model_version: version }).eq("id", orderId);
      const { data: afterScenes } = await service
        .from("pet_order_scenes")
        .select("status, replicate_prediction_id")
        .eq("order_id", orderId);
      const waitingOnProvider = (afterScenes ?? []).some(
        (row) => row.replicate_prediction_id && String(row.status) === "generating",
      );
      const stillNeedsCreate = (afterScenes ?? []).some(
        (row) => !row.replicate_prediction_id && !["succeeded", "ready"].includes(String(row.status)),
      );
      if (createResult.billingRequired) {
        await service
          .from("pet_generation_jobs")
          .update({ status: "held", last_error: "billing_required" })
          .eq("order_id", orderId);
      } else if (!waitingOnProvider && stillNeedsCreate) {
        await service
          .from("pet_generation_jobs")
          .update({ status: "queued", last_error: null })
          .eq("order_id", orderId)
          .eq("status", "running");
      }
      const finalized = await service.rpc("pet_finalize_generation_if_done", { p_order_id: orderId });
      if (finalized.error) throw finalized.error;
      return jsonResponse({
        ok: true,
        status: createResult.billingRequired
          ? "billing_required"
          : (finalized.data as { status?: string } | null)?.status || "started",
        started,
        skipped: createResult.skipped,
        eligible: createResult.eligible,
        total: PET_SCENE_DEFINITIONS.length,
      });
    } finally {
      await service.rpc("release_pet_provider_create_lock", {
        p_order_id: orderId,
        p_kind: "image",
        p_holder: holder,
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: message }, 500);
  }
});
