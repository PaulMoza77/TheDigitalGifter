/**
 * Node/Vercel port of supabase/functions/christmas-generate-video/index.ts.
 * Keep in sync with the Deno source — see api/christmas-funnel.ts for context.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  CHRISTMAS_RESULT_BUCKET,
  CHRISTMAS_SIGNED_DOWNLOAD_SECONDS,
  christmasVideoModel,
  generationMock,
  videoGenerationEnabled,
} from "./_lib/christmas/constants";
import { asString, isUuid } from "./_lib/christmas/crypto";
import { getServiceClient, isServiceRoleRequest } from "./_lib/christmas/supabaseClient";

type Body = { order_id?: string };

type ReplicatePrediction = {
  id?: string;
  status?: string;
  error?: string;
  detail?: string;
  output?: unknown;
};

const CHRISTMAS_VIDEO_PROMPT =
  "Subtle cinematic Christmas motion of this exact portrait. Soft fairy-light shimmer, gentle snowfall or fireplace glow, slight natural head movement and breathing. Preserve the exact face, clothing, and background. No morphing, no identity drift, no aggressive camera moves.";

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

async function generateSeedanceVideo(imageUrl: string): Promise<{
  predictionId: string;
  outputUrl: string;
  model: string;
}> {
  const token = asString(process.env.REPLICATE_API_TOKEN);
  if (!token) throw new Error("REPLICATE_API_TOKEN is not configured");
  const model = christmasVideoModel();
  const input = {
    prompt: CHRISTMAS_VIDEO_PROMPT,
    image: imageUrl,
    duration: 5,
    resolution: "720p",
    camera_fixed: false,
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
    throw new Error(asString(prediction?.detail || prediction?.error) || "Replicate video prediction failed");
  }

  let guard = 0;
  while (
    prediction?.status &&
    !["succeeded", "failed", "canceled"].includes(String(prediction.status)) &&
    guard < 90
  ) {
    await new Promise((r) => setTimeout(r, 3000));
    const poll = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    prediction = (await poll.json()) as ReplicatePrediction;
    guard += 1;
  }

  if (prediction.status !== "succeeded") {
    throw new Error(asString(prediction?.error) || `Video generation ${prediction?.status || "failed"}`);
  }
  const outputUrl = replicateOutputUrl(prediction.output);
  if (!outputUrl) throw new Error("Replicate returned no video URL");
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

    if (!videoGenerationEnabled() && !generationMock()) {
      return res.status(200).json({ ok: true, status: "held", started: 0 });
    }

    const [{ data: scenes }, { data: videos }] = await Promise.all([
      service
        .from("christmas_order_scenes")
        .select("id, scene_key, status, result_path, result_bucket")
        .eq("order_id", orderId),
      service.from("christmas_order_videos").select("*").eq("order_id", orderId),
    ]);

    // Upsell child packs may reference starter scene keys that live on the parent order.
    let sceneRows = scenes ?? [];
    const parentOrderId = asString(order.parent_order_id);
    if (parentOrderId) {
      const { data: parentScenes } = await service
        .from("christmas_order_scenes")
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

    const targets = (videos ?? []).filter((video) => ["queued", "failed"].includes(asString(video.status)));
    if (!targets.length) return res.status(200).json({ ok: true, status: "nothing_to_do", started: 0 });

    let started = 0;

    for (const video of targets) {
      const source = sceneRows.find(
        (scene) =>
          asString(scene.scene_key) === asString(video.source_scene_key) &&
          ["succeeded", "ready"].includes(asString(scene.status)) &&
          scene.result_path,
      );
      if (!source?.result_path) {
        await service
          .from("christmas_order_videos")
          .update({
            status: "failed",
            last_error: "Source scene result missing",
            attempts: Number(video.attempts || 0) + 1,
          })
          .eq("id", video.id);
        continue;
      }

      await service
        .from("christmas_order_videos")
        .update({
          status: "generating",
          last_error: null,
          attempts: Number(video.attempts || 0) + 1,
        })
        .eq("id", video.id);

      const resultPath = `${orderId}/videos/${video.id}.mp4`;

      try {
        if (generationMock()) {
          await service
            .from("christmas_order_videos")
            .update({
              status: "succeeded",
              model_name: "mock",
              result_bucket: CHRISTMAS_RESULT_BUCKET,
              result_path: resultPath,
              result_content_type: "video/mp4",
              duration_seconds: 5,
              replicate_prediction_id: `mock_video_${video.id}`,
              completed_at: new Date().toISOString(),
            })
            .eq("id", video.id);
        } else {
          const bucket = asString(source.result_bucket) || CHRISTMAS_RESULT_BUCKET;
          const { data: signed } = await service.storage
            .from(bucket)
            .createSignedUrl(source.result_path, CHRISTMAS_SIGNED_DOWNLOAD_SECONDS);
          if (!signed?.signedUrl) throw new Error("Could not sign source scene image");

          const prediction = await generateSeedanceVideo(signed.signedUrl);
          const videoRes = await fetch(prediction.outputUrl);
          if (!videoRes.ok) throw new Error(`Failed to download video (${videoRes.status})`);
          const bytes = Buffer.from(await videoRes.arrayBuffer());
          const { error: upErr } = await service.storage
            .from(CHRISTMAS_RESULT_BUCKET)
            .upload(resultPath, bytes, { contentType: "video/mp4", upsert: true });
          if (upErr) throw upErr;

          await service
            .from("christmas_order_videos")
            .update({
              status: "succeeded",
              model_name: prediction.model,
              result_bucket: CHRISTMAS_RESULT_BUCKET,
              result_path: resultPath,
              result_content_type: "video/mp4",
              duration_seconds: 5,
              replicate_prediction_id: prediction.predictionId,
              completed_at: new Date().toISOString(),
            })
            .eq("id", video.id);
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
        await service
          .from("christmas_order_videos")
          .update({
            status: "failed",
            last_error: message.slice(0, 500),
            completed_at: new Date().toISOString(),
          })
          .eq("id", video.id);
      }
    }

    return res.status(200).json({
      ok: true,
      started,
      status: generationMock() ? "mock_completed" : "completed",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: message });
  }
}

export const config = { maxDuration: 60 };
