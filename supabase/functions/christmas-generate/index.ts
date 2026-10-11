import { optionsResponse, jsonResponse } from "../_shared/cors.ts";
import { getServiceClient, isServiceRoleRequest, readJson } from "../_shared/supabase.ts";
import {
  CHRISTMAS_RESULT_BUCKET,
  CHRISTMAS_SIGNED_DOWNLOAD_SECONDS,
  CHRISTMAS_SOURCE_BUCKET,
  buildScenePrompt,
  generationEnabled,
  generationMock,
  sceneByKey,
  type ChristmasPackKey,
} from "../_shared/christmas/constants.ts";
import { asString } from "../_shared/christmas/crypto.ts";
import {
  christmasFailedPredictionId,
  recordChristmasV2ImageCost,
} from "../_shared/christmas/costLedger.ts";
import { sendChristmasDeliveryEmail } from "../_shared/christmas/email.ts";
import {
  generateSoulV2Image,
  requireChristmasHiggsfieldAuth,
} from "../_shared/christmas/higgsfieldProviders.ts";

type Body = { order_id?: string };

function waitUntil(promise: Promise<unknown>) {
  const runtime = (globalThis as { EdgeRuntime?: { waitUntil?: (value: Promise<unknown>) => void } })
    .EdgeRuntime;
  if (runtime && typeof runtime.waitUntil === "function") {
    runtime.waitUntil(promise);
    return;
  }
  void promise;
}

function decryptStoredToken(ciphertext: string | null | undefined): string | null {
  if (!ciphertext) return null;
  try {
    return atob(ciphertext);
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
  const { error: upError } = await service.storage.from(toBucket).upload(toPath, data, {
    contentType,
    upsert: true,
  });
  if (upError) throw upError;
}

async function generateChristmasImage(prompt: string, imageUrl: string): Promise<{
  predictionId: string;
  outputUrl: string;
  model: string;
}> {
  const authorization = requireChristmasHiggsfieldAuth({ get: (name) => Deno.env.get(name) });
  const result = await generateSoulV2Image({
    authorization,
    prompt,
    imageUrl,
    aspectRatio: "3:4",
  });
  return {
    predictionId: result.requestId,
    outputUrl: result.outputUrl,
    model: result.model,
  };
}

async function finalizeChristmasV2Generation(
  service: ReturnType<typeof getServiceClient>,
  orderId: string,
) {
  // Prefer the post-quarantine name; keep the legacy alias for older DBs.
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

async function enqueueChristmasVideo(orderId: string) {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return;
  await fetch(`${url.replace(/\/$/, "")}/functions/v1/christmas-generate-video`, {
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
  if (!isServiceRoleRequest(req)) return jsonResponse({ error: "Forbidden" }, 403);

  try {
    const body = await readJson<Body>(req);
    const orderId = asString(body.order_id);
    if (!orderId) return jsonResponse({ error: "order_id required" }, 400);
    const service = getServiceClient();

    const { data: order, error } = await service
      .from("christmas_v2_orders")
      .select("*")
      .eq("id", orderId)
      .maybeSingle();
    if (error) throw error;
    if (!order) return jsonResponse({ error: "order not found" }, 404);
    if (!order.paid_at) return jsonResponse({ error: "Payment required", code: "PAYMENT_REQUIRED" }, 402);

    const claim = await service.rpc("claim_christmas_v2_generation_job", { p_order_id: orderId });
    if (claim.error) throw claim.error;
    const claimData = (typeof claim.data === "string" ? JSON.parse(claim.data) : claim.data) as {
      claimed?: boolean;
      status?: string;
    };
    if (!claimData?.claimed) {
      return jsonResponse({ ok: true, status: "already_running", claim: claimData });
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
      return jsonResponse({ error: "Source photo missing" }, 400);
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
      return jsonResponse({ error: "Could not sign source photo" }, 500);
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
      return jsonResponse({ ok: true, status: "held", started: 0 });
    }

    const targets = (scenes ?? []).filter(
      (scene) =>
        ["queued", "failed"].includes(asString(scene.status)) && !scene.replicate_prediction_id,
    );

    let started = 0;
    const contentType = asString(order.photo_content_type) || "image/jpeg";

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

      await service
        .from("christmas_v2_order_scenes")
        .update({
          status: "generating",
          started_at: new Date().toISOString(),
          last_error: null,
          attempts: Number(scene.attempts || 0) + 1,
        })
        .eq("id", scene.id);

      const resultPath = `${orderId}/scenes/${sceneKey}.jpg`;
      const attemptNumber = Number(scene.attempts || 0) + 1;
      const isRetry = attemptNumber > 1;

      try {
        if (generationMock()) {
          const predictionId = `mock_${orderId}_${sceneKey}`;
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
          const prompt = buildScenePrompt(def);
          const prediction = await generateChristmasImage(prompt, signed.signedUrl);
          const imgRes = await fetch(prediction.outputUrl);
          if (!imgRes.ok) throw new Error(`Failed to download generated image (${imgRes.status})`);
          const bytes = new Uint8Array(await imgRes.arrayBuffer());
          const { error: upErr } = await service.storage
            .from(CHRISTMAS_RESULT_BUCKET)
            .upload(resultPath, bytes, { contentType: "image/jpeg", upsert: true });
          if (upErr) throw upErr;
          await service
            .from("christmas_v2_order_scenes")
            .update({
              status: "succeeded",
              progress_percent: 100,
              replicate_prediction_id: prediction.predictionId,
              result_bucket: CHRISTMAS_RESULT_BUCKET,
              result_path: resultPath,
              result_content_type: "image/jpeg",
              model_name: prediction.model,
              completed_at: new Date().toISOString(),
            })
            .eq("id", scene.id);
          await recordChristmasV2ImageCost(service, {
            predictionId: prediction.predictionId,
            orderId,
            sceneId: asString(scene.id),
            sceneKey,
            attemptNumber,
            productSku: asString(order.sku),
            providerStatus: "succeeded",
            modelName: prediction.model,
            isMock: false,
            isRetry,
            costNotes: "estimate_catalog_not_provider_invoice",
          });
        }
        started += 1;
      } catch (genErr) {
        const message = genErr instanceof Error ? genErr.message : String(genErr);
        await service
          .from("christmas_v2_order_scenes")
          .update({
            status: "failed",
            last_error: message.slice(0, 500),
            completed_at: new Date().toISOString(),
          })
          .eq("id", scene.id);
        await recordChristmasV2ImageCost(service, {
          predictionId: christmasFailedPredictionId({
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
          costNotes: "failed_attempt_estimated_consumption",
        });
      }
    }

    const finalized = await finalizeChristmasV2Generation(service, orderId);
    if (finalized.error) throw finalized.error;
    const finalData = (typeof finalized.data === "string"
      ? JSON.parse(finalized.data)
      : finalized.data) as {
      done?: boolean;
      succeeded?: number;
      failed?: number;
    };

    const scenesReady =
      Boolean(finalData?.done) ||
      Boolean((finalData as { scenes_done?: boolean }).scenes_done) ||
      Boolean((finalData as { awaiting_videos?: boolean }).awaiting_videos);

    if (scenesReady && (finalData.succeeded || 0) > 0) {
      const { data: refreshed } = await service
        .from("christmas_v2_orders")
        .select("*")
        .eq("id", orderId)
        .maybeSingle();

      if (Number(refreshed?.video_count || 0) > 0) {
        waitUntil(
          enqueueChristmasVideo(orderId).catch((err) => {
            console.error("christmas-generate-video enqueue failed", err);
          }),
        );
      }

      // Delivery email only when images + paid videos are finalized.
      if (finalData?.done) {
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
    }

    return jsonResponse({
      ok: true,
      status: generationMock() ? "mock_completed" : "completed",
      started,
      finalize: finalData,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: message }, 500);
  }
});
