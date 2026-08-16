import { optionsResponse, jsonResponse } from "../_shared/cors.ts";
import { getServiceClient, isServiceRoleRequest, readJson } from "../_shared/supabase.ts";
import {
  generationEnabled,
  generationMock,
  PET_GENERATE_CONCURRENCY,
  PET_MAX_SCENE_ATTEMPTS,
  PET_RESULT_BUCKET,
  PET_SOURCE_BUCKET,
  PET_SIGNED_DOWNLOAD_SECONDS,
  petImageModel,
  petImageModelVersion,
} from "../_shared/pet/constants.ts";
import { asString } from "../_shared/pet/crypto.ts";
import { canStartGeneration } from "../_shared/pet/guards.ts";
import { createReplicatePrediction } from "../_shared/pet/replicate.ts";
import { buildScenePrompt, PET_SCENE_DEFINITIONS } from "../_shared/pet/scenes.ts";

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

async function runPool<T>(items: T[], limit: number, worker: (item: T) => Promise<void>) {
  const queue = [...items];
  const runners = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length) {
      const item = queue.shift();
      if (!item) return;
      await worker(item);
    }
  });
  await Promise.all(runners);
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

    let query = service
      .from("pet_order_scenes")
      .select("*")
      .eq("order_id", orderId)
      .in("status", ["queued", "failed"]);
    if (body.scene_keys?.length) query = query.in("scene_key", body.scene_keys);
    const { data: scenes, error: sceneError } = await query;
    if (sceneError) throw sceneError;

    const retryable = (scenes ?? []).filter((scene) => {
      if (scene.status === "succeeded" || scene.status === "ready") return false;
      return Number(scene.attempts || 0) < PET_MAX_SCENE_ATTEMPTS;
    });

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
      for (const scene of retryable) {
        const resultPath = `${orderId}/scenes/${scene.scene_key}.jpg`;
        await copyObject(
          service,
          PET_SOURCE_BUCKET,
          order.photo_path,
          PET_RESULT_BUCKET,
          resultPath,
          order.photo_content_type || "image/jpeg",
        );
        await service
          .from("pet_order_scenes")
          .update({
            status: "succeeded",
            progress_percent: 100,
            attempts: Number(scene.attempts || 0) + 1,
            result_bucket: PET_RESULT_BUCKET,
            result_path: resultPath,
            result_content_type: order.photo_content_type || "image/jpeg",
            model_name: "mock",
            completed_at: new Date().toISOString(),
          })
          .eq("id", scene.id);
        started += 1;
      }
      await service.rpc("pet_finalize_generation_if_done", { p_order_id: orderId });
      return jsonResponse({ ok: true, status: "mock_completed", started });
    }

    await runPool(retryable, PET_GENERATE_CONCURRENCY, async (scene) => {
      const prompt = buildScenePrompt({
        sceneKey: scene.scene_key,
        petName: order.pet_name,
        species: order.species,
        personality: order.personality,
      });
      await service
        .from("pet_order_scenes")
        .update({
          status: "generating",
          progress_percent: 15,
          attempts: Number(scene.attempts || 0) + 1,
          started_at: new Date().toISOString(),
          model_name: model,
          model_version: version,
          last_error: null,
        })
        .eq("id", scene.id)
        .neq("status", "succeeded")
        .neq("status", "ready");
      try {
        const prediction = await createReplicatePrediction({
          prompt,
          imageUrl: signed.signedUrl,
          orderId,
          sceneKey: scene.scene_key,
        });
        await service
          .from("pet_order_scenes")
          .update({
            replicate_prediction_id: prediction.id,
            model_name: prediction.model || model,
            model_version: prediction.version || version,
          })
          .eq("id", scene.id);
        started += 1;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await service
          .from("pet_order_scenes")
          .update({
            status: "failed",
            progress_percent: 100,
            last_error: message.slice(0, 500),
            completed_at: new Date().toISOString(),
          })
          .eq("id", scene.id)
          .neq("status", "succeeded")
          .neq("status", "ready");
      }
    });

    await service.from("pet_orders").update({ model_name: model, model_version: version }).eq("id", orderId);
    const finalized = await service.rpc("pet_finalize_generation_if_done", { p_order_id: orderId });
    if (finalized.error) throw finalized.error;
    return jsonResponse({
      ok: true,
      status: (finalized.data as { status?: string } | null)?.status || "started",
      started,
      total: PET_SCENE_DEFINITIONS.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: message }, 500);
  }
});
