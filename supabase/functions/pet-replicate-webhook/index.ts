import { optionsResponse, jsonResponse } from "../_shared/cors.ts";
import { getServiceClient } from "../_shared/supabase.ts";
import { PET_RESULT_BUCKET } from "../_shared/pet/constants.ts";
import { asString } from "../_shared/pet/crypto.ts";
import { readImageSize } from "../_shared/pet/imageSize.ts";
import { replicateOutputUrl, verifyReplicateWebhook, type ReplicatePrediction } from "../_shared/pet/replicate.ts";
import { finalizeAiCostPrediction } from "../_shared/pet/costLedger.ts";

async function copyRemoteImage(
  service: ReturnType<typeof getServiceClient>,
  imageUrl: string,
  path: string,
): Promise<{ contentType: string; size: number; width: number | null; height: number | null }> {
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`Could not fetch generated image (${res.status})`);
  const contentType = res.headers.get("content-type") || "image/jpeg";
  const bytes = new Uint8Array(await res.arrayBuffer());
  const { error } = await service.storage.from(PET_RESULT_BUCKET).upload(path, bytes, {
    contentType,
    upsert: true,
  });
  if (error) throw error;
  const size = readImageSize(bytes);
  return { contentType, size: bytes.byteLength, width: size?.width ?? null, height: size?.height ?? null };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const rawBody = await req.text();
    const verified = await verifyReplicateWebhook(req, rawBody);
    if (!verified) return jsonResponse({ error: "Invalid Replicate signature" }, 401);

    const prediction = JSON.parse(rawBody) as ReplicatePrediction;
    const predictionId = asString(prediction.id);
    if (!predictionId) return jsonResponse({ error: "Missing prediction id" }, 400);

    const webhookId = req.headers.get("webhook-id") || "";
    const status = asString(prediction.status);
    const service = getServiceClient();

    if (!["succeeded", "failed", "canceled"].includes(status)) {
      return jsonResponse({ ok: true, ignored: true, status });
    }

    const { data: scene } = await service
      .from("pet_order_scenes")
      .select("id, order_id, scene_key, status")
      .eq("replicate_prediction_id", predictionId)
      .maybeSingle();

    await finalizeAiCostPrediction(service, {
      predictionId,
      providerStatus: status,
      modelName: prediction.model || null,
      modelVersion: prediction.version || null,
      orderId: scene?.order_id || new URL(req.url).searchParams.get("order_id"),
      sceneId: scene?.id || null,
      sceneKey: scene?.scene_key || new URL(req.url).searchParams.get("scene_key"),
    });

    let resultPath: string | null = null;
    let contentType: string | null = null;
    let resultWidth: number | null = null;
    let resultHeight: number | null = null;
    let resultByteSize: number | null = null;
    if (status === "succeeded") {
      const outputUrl = replicateOutputUrl(prediction.output);
      if (!outputUrl) {
        const applied = await service.rpc("pet_apply_scene_prediction_result", {
          p_prediction_id: predictionId,
          p_webhook_id: webhookId,
          p_event_status: status,
          p_scene_status: "failed",
          p_result_bucket: null,
          p_result_path: null,
          p_result_content_type: null,
          p_error: "Replicate returned no image URL",
          p_duration_ms: Math.round((prediction.metrics?.predict_time || 0) * 1000),
          p_model_name: prediction.model || null,
          p_model_version: prediction.version || null,
          p_result_width: null,
          p_result_height: null,
          p_result_byte_size: null,
        });
        if (applied.error) throw applied.error;
        return jsonResponse({ ok: true, result: applied.data });
      }
      const { data: sceneForCopy } = scene
        ? { data: scene }
        : await service
            .from("pet_order_scenes")
            .select("order_id, scene_key, status")
            .eq("replicate_prediction_id", predictionId)
            .maybeSingle();
      if (sceneForCopy?.status === "succeeded" || sceneForCopy?.status === "ready") {
        return jsonResponse({ ok: true, status: "already_succeeded" });
      }
      const orderId = sceneForCopy?.order_id || new URL(req.url).searchParams.get("order_id");
      const sceneKey = sceneForCopy?.scene_key || new URL(req.url).searchParams.get("scene_key");
      resultPath = `${orderId}/scenes/${sceneKey}.jpg`;
      const copied = await copyRemoteImage(service, outputUrl, resultPath);
      contentType = copied.contentType;
      resultWidth = copied.width;
      resultHeight = copied.height;
      resultByteSize = copied.size;
    }

    const applied = await service.rpc("pet_apply_scene_prediction_result", {
      p_prediction_id: predictionId,
      p_webhook_id: webhookId,
      p_event_status: status,
      p_scene_status: status === "succeeded" ? "succeeded" : "failed",
      p_result_bucket: status === "succeeded" ? PET_RESULT_BUCKET : null,
      p_result_path: resultPath,
      p_result_content_type: contentType,
      p_error: status === "succeeded" ? null : asString(prediction.error) || status,
      p_duration_ms: Math.round((prediction.metrics?.predict_time || 0) * 1000),
      p_model_name: prediction.model || null,
      p_model_version: prediction.version || null,
      p_result_width: resultWidth,
      p_result_height: resultHeight,
      p_result_byte_size: resultByteSize,
    });
    if (applied.error) throw applied.error;
    return jsonResponse({ ok: true, result: applied.data });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: message }, 500);
  }
});
