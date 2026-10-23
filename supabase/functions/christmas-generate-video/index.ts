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
import { sendChristmasDeliveryEmail } from "../_shared/christmas/email.ts";
import { generateChristmasHiggsfieldVideo } from "../_shared/christmas/higgsfield.ts";
import { buildChristmasVideoPrompt } from "../_shared/christmas/videoPrompts.ts";

type Body = { order_id?: string };

function decryptStoredToken(ciphertext: string | null | undefined): string | null {
  if (!ciphertext) return null;
  try {
    return atob(ciphertext);
  } catch {
    return null;
  }
}

async function maybeSendDeliveryEmail(
  service: ReturnType<typeof getServiceClient>,
  orderId: string,
) {
  const finalized = await service.rpc("christmas_v2_finalize_generation_if_done", {
    p_order_id: orderId,
  });
  if (finalized.error) throw finalized.error;
  const finalData = (typeof finalized.data === "string"
    ? JSON.parse(finalized.data)
    : finalized.data) as {
    done?: boolean;
    ready_for_email?: boolean;
    status?: string;
  };

  if (!finalData?.done || !finalData.ready_for_email) return finalData;

  const { data: refreshed } = await service
    .from("christmas_v2_orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle();
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
  return finalData;
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
    if (!order.paid_at) {
      return jsonResponse({ error: "Payment required", code: "PAYMENT_REQUIRED" }, 402);
    }

    if (!videoGenerationEnabled() && !generationMock()) {
      return jsonResponse({ ok: true, status: "held", started: 0 });
    }

    const expectedVideos = Number(order.video_count || 0);
    if (expectedVideos <= 0) {
      return jsonResponse({ ok: true, status: "nothing_to_do", started: 0 });
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

    // Recover missing video rows from order.video_source_scene_keys (idempotent).
    let videoRows = videos ?? [];
    if (videoRows.length < expectedVideos) {
      const fromOrder = Array.isArray(order.video_source_scene_keys)
        ? order.video_source_scene_keys.map((k: unknown) => asString(k)).filter(Boolean)
        : [];
      const existingKeys = new Set(videoRows.map((v) => asString(v.source_scene_key)));
      const missing = fromOrder
        .filter((key) => !existingKeys.has(key))
        .slice(0, expectedVideos - videoRows.length);
      if (missing.length) {
        const { data: inserted } = await service
          .from("christmas_v2_order_videos")
          .insert(missing.map((key) => ({ order_id: orderId, source_scene_key: key, status: "queued" })))
          .select("*");
        videoRows = [...videoRows, ...(inserted ?? [])];
      }
    }

    const targets = videoRows.filter((video) =>
      ["queued", "failed"].includes(asString(video.status)),
    );
    if (!targets.length) {
      const finalize = await maybeSendDeliveryEmail(service, orderId);
      return jsonResponse({ ok: true, status: "nothing_to_do", started: 0, finalize });
    }

    let started = 0;

    for (const video of targets) {
      const sourceSceneKey = asString(video.source_scene_key);
      const source = sceneRows.find(
        (scene) =>
          asString(scene.scene_key) === sourceSceneKey &&
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

      await service
        .from("christmas_v2_order_videos")
        .update({
          status: "generating",
          last_error: null,
          attempts: Number(video.attempts || 0) + 1,
        })
        .eq("id", video.id);

      const resultPath = `${orderId}/videos/${video.id}.mp4`;
      const prompt = buildChristmasVideoPrompt(sourceSceneKey);

      try {
        if (generationMock()) {
          // Persist a tiny valid-ish placeholder path marker only in mock mode.
          const mockBytes = new TextEncoder().encode("tdg-mock-christmas-video");
          await service.storage
            .from(CHRISTMAS_RESULT_BUCKET)
            .upload(resultPath, mockBytes, { contentType: "video/mp4", upsert: true });
          await service
            .from("christmas_v2_order_videos")
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

          const prediction = await generateChristmasHiggsfieldVideo(
            Deno.env,
            signed.signedUrl,
            prompt,
            {
              requestId: asString(video.replicate_prediction_id) || null,
              onSubmitted: async (id, model) => {
                await service
                  .from("christmas_v2_order_videos")
                  .update({
                    replicate_prediction_id: id,
                    model_name: model,
                  })
                  .eq("id", video.id);
              },
            },
          );
          const videoRes = await fetch(prediction.outputUrl);
          if (!videoRes.ok) throw new Error(`Failed to download video (${videoRes.status})`);
          const bytes = new Uint8Array(await videoRes.arrayBuffer());
          if (bytes.byteLength < 1000) throw new Error("Downloaded video is too small to be valid");
          const { error: upErr } = await service.storage
            .from(CHRISTMAS_RESULT_BUCKET)
            .upload(resultPath, bytes, { contentType: "video/mp4", upsert: true });
          if (upErr) throw upErr;

          await service
            .from("christmas_v2_order_videos")
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
          .from("christmas_v2_order_videos")
          .update({
            status: "failed",
            last_error: message.slice(0, 500),
            completed_at: new Date().toISOString(),
          })
          .eq("id", video.id);
      }
    }

    const finalize = await maybeSendDeliveryEmail(service, orderId);

    return jsonResponse({
      ok: true,
      started,
      status: generationMock() ? "mock_completed" : "completed",
      finalize,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: message }, 500);
  }
});
