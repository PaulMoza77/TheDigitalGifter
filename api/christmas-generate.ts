/**
 * Node/Vercel port of supabase/functions/christmas-generate/index.ts.
 * Keep in sync with the Deno source — see api/christmas-funnel.ts for context.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { waitUntil } from "@vercel/functions";
import {
  CHRISTMAS_RESULT_BUCKET,
  CHRISTMAS_SIGNED_DOWNLOAD_SECONDS,
  CHRISTMAS_SOURCE_BUCKET,
  buildScenePrompt,
  christmasImageModel,
  generationEnabled,
  generationMock,
  sceneByKey,
  type ChristmasPackKey,
} from "./_lib/christmas/constants";
import { asString } from "./_lib/christmas/crypto";
import { getServiceClient, isServiceRoleRequest } from "./_lib/christmas/supabaseClient";
import { invokeChristmasGenerateVideo, resolveSiteOriginFromRequest } from "./_lib/christmas/stripeFulfill";
import { sendChristmasDeliveryEmail } from "./_lib/christmas/email";

type Body = { order_id?: string };

type ReplicatePrediction = {
  id?: string;
  status?: string;
  error?: string;
  detail?: string;
  output?: unknown;
};

function replicateOutputUrl(output: unknown): string | null {
  if (typeof output === "string" && output.startsWith("http")) return output;
  if (Array.isArray(output)) {
    const first = output.find((item) => typeof item === "string" && item.startsWith("http"));
    if (typeof first === "string") return first;
  }
  if (output && typeof output === "object") {
    const rec = output as Record<string, unknown>;
    if (typeof rec.url === "string") return rec.url;
  }
  return null;
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

async function generateWithNanoBanana(prompt: string, imageUrl: string): Promise<{
  predictionId: string;
  outputUrl: string;
  model: string;
}> {
  const token = asString(process.env.REPLICATE_API_TOKEN);
  if (!token) throw new Error("REPLICATE_API_TOKEN is not configured");
  const model = christmasImageModel();
  const input = {
    prompt,
    image: imageUrl,
    image_input: [imageUrl],
  };

  const createRes = await fetch(`https://api.replicate.com/v1/models/${model}/predictions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "wait",
    },
    body: JSON.stringify({ input }),
  });
  let prediction = (await createRes.json()) as ReplicatePrediction;
  if (!createRes.ok) {
    throw new Error(asString(prediction?.detail || prediction?.error) || "Replicate prediction failed");
  }

  let guard = 0;
  while (
    prediction?.status &&
    !["succeeded", "failed", "canceled"].includes(String(prediction.status)) &&
    guard < 60
  ) {
    await new Promise((r) => setTimeout(r, 2000));
    const poll = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    prediction = (await poll.json()) as ReplicatePrediction;
    guard += 1;
  }

  if (prediction.status !== "succeeded") {
    throw new Error(asString(prediction?.error) || `Generation ${prediction?.status || "failed"}`);
  }
  const outputUrl = replicateOutputUrl(prediction.output);
  if (!outputUrl) throw new Error("Replicate returned no image URL");
  return { predictionId: asString(prediction.id), outputUrl, model };
}

function parseBody(req: VercelRequest): Body {
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
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
      .from("christmas_orders")
      .select("*")
      .eq("id", orderId)
      .maybeSingle();
    if (error) throw error;
    if (!order) return res.status(404).json({ error: "order not found" });
    if (!order.paid_at) return res.status(402).json({ error: "Payment required", code: "PAYMENT_REQUIRED" });

    const claim = await service.rpc("claim_christmas_generation_job", { p_order_id: orderId });
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
        .from("christmas_generation_jobs")
        .update({
          status: "failed",
          last_error: "source_photo_missing",
          finished_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("order_id", orderId);
      await service
        .from("christmas_orders")
        .update({ status: "failed", last_error: "source_photo_missing", updated_at: new Date().toISOString() })
        .eq("id", orderId);
      return res.status(400).json({ error: "Source photo missing" });
    }

    const { data: signed } = await service.storage
      .from(CHRISTMAS_SOURCE_BUCKET)
      .createSignedUrl(order.photo_path, CHRISTMAS_SIGNED_DOWNLOAD_SECONDS);
    if (!signed?.signedUrl) {
      await service
        .from("christmas_generation_jobs")
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
      .from("christmas_order_scenes")
      .select("*")
      .eq("order_id", orderId)
      .order("scene_number", { ascending: true });
    if (sceneError) throw sceneError;

    if (!generationEnabled() && !generationMock()) {
      await service
        .from("christmas_generation_jobs")
        .update({ status: "held", last_error: "generation_disabled" })
        .eq("order_id", orderId);
      await service
        .from("christmas_orders")
        .update({ status: "paid", last_error: "generation_disabled" })
        .eq("id", orderId);
      return res.status(200).json({ ok: true, status: "held", started: 0 });
    }

    const targets = (scenes ?? []).filter(
      (scene) => ["queued", "failed"].includes(asString(scene.status)) && !scene.replicate_prediction_id,
    );

    let started = 0;
    const contentType = asString(order.photo_content_type) || "image/jpeg";

    for (const scene of targets) {
      const sceneKey = asString(scene.scene_key);
      const def = sceneByKey(sceneKey);
      if (!def) {
        await service
          .from("christmas_order_scenes")
          .update({ status: "failed", last_error: "unknown_scene" })
          .eq("id", scene.id);
        continue;
      }

      await service
        .from("christmas_order_scenes")
        .update({
          status: "generating",
          started_at: new Date().toISOString(),
          last_error: null,
          attempts: Number(scene.attempts || 0) + 1,
        })
        .eq("id", scene.id);

      const resultPath = `${orderId}/scenes/${sceneKey}.jpg`;

      try {
        if (generationMock()) {
          await copyObject(service, CHRISTMAS_SOURCE_BUCKET, order.photo_path, CHRISTMAS_RESULT_BUCKET, resultPath, contentType);
          await service
            .from("christmas_order_scenes")
            .update({
              status: "succeeded",
              progress_percent: 100,
              replicate_prediction_id: `mock_${orderId}_${sceneKey}`,
              result_bucket: CHRISTMAS_RESULT_BUCKET,
              result_path: resultPath,
              result_content_type: contentType,
              model_name: "mock",
              completed_at: new Date().toISOString(),
            })
            .eq("id", scene.id);
        } else {
          const prompt = buildScenePrompt(def);
          const prediction = await generateWithNanoBanana(prompt, signed.signedUrl);
          const imgRes = await fetch(prediction.outputUrl);
          if (!imgRes.ok) throw new Error(`Failed to download generated image (${imgRes.status})`);
          const bytes = Buffer.from(await imgRes.arrayBuffer());
          const { error: upErr } = await service.storage
            .from(CHRISTMAS_RESULT_BUCKET)
            .upload(resultPath, bytes, { contentType: "image/jpeg", upsert: true });
          if (upErr) throw upErr;
          await service
            .from("christmas_order_scenes")
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
        }
        started += 1;
      } catch (genErr) {
        const message = genErr instanceof Error ? genErr.message : String(genErr);
        await service
          .from("christmas_order_scenes")
          .update({
            status: "failed",
            last_error: message.slice(0, 500),
            completed_at: new Date().toISOString(),
          })
          .eq("id", scene.id);
      }
    }

    const finalized = await service.rpc("christmas_finalize_generation_if_done", { p_order_id: orderId });
    if (finalized.error) throw finalized.error;
    const finalData = (typeof finalized.data === "string" ? JSON.parse(finalized.data) : finalized.data) as {
      done?: boolean;
      succeeded?: number;
      failed?: number;
    };

    if (finalData?.done && (finalData.succeeded || 0) > 0) {
      const { data: refreshed } = await service
        .from("christmas_orders")
        .select("*")
        .eq("id", orderId)
        .maybeSingle();
      const publicToken = (() => {
        const ciphertext = asString(refreshed?.public_token_ciphertext);
        if (!ciphertext) return null;
        try {
          return Buffer.from(ciphertext, "base64").toString("utf8");
        } catch {
          return null;
        }
      })();
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

      if (Number(refreshed?.video_count || 0) > 0) {
        const originForInvoke = resolveSiteOriginFromRequest(req.headers as Record<string, string | string[]>);
        waitUntil(
          invokeChristmasGenerateVideo(orderId, originForInvoke).catch((err) => {
            console.error("christmas-generate-video enqueue failed", err);
          }),
        );
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

export const config = { maxDuration: 300 };
