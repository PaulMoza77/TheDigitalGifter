import { optionsResponse, jsonResponse } from "../_shared/cors.ts";
import { getServiceClient, isServiceRoleRequest, readJson } from "../_shared/supabase.ts";
import { generateSantaScript, mockSantaScript } from "../_shared/christmas/santaScript.ts";
import { mockSantaSpeech, synthesizeSantaSpeech } from "../_shared/christmas/santaTts.ts";
import {
  generateSantaStill,
  generateSantaTalkingVideo,
  santaStillPrompt,
} from "../_shared/christmas/santaVideo.ts";
import { claimAndSendChristmasLifecycle } from "../_shared/christmas/lifecycle.ts";

/**
 * Post-payment Santa Video pipeline (async stages).
 * Never held open by the browser — invoke and return; job state is durable.
 */

type Body = { order_id?: string; resume?: boolean };

const RESULT_BUCKET = "christmas-generated";
const SOURCE_BUCKET = "christmas-source";

function asString(value: unknown): string {
  return String(value ?? "").trim();
}

function generationMock(): boolean {
  return asString(Deno.env.get("CHRISTMAS_SANTA_GENERATION_MOCK")).toLowerCase() === "true" ||
    asString(Deno.env.get("CHRISTMAS_GENERATION_MOCK")).toLowerCase() === "true";
}

function generationEnabled(): boolean {
  const raw = asString(Deno.env.get("CHRISTMAS_SANTA_GENERATION_ENABLED") || "true").toLowerCase();
  return raw !== "false" && raw !== "0" && raw !== "off";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);
  if (!isServiceRoleRequest(req)) return jsonResponse({ error: "Forbidden" }, 403);

  const pipelineStarted = Date.now();
  try {
    const body = await readJson<Body>(req);
    const orderId = asString(body.order_id);
    if (!orderId) return jsonResponse({ error: "order_id required" }, 400);
    const service = getServiceClient();

    const { data: order, error: orderError } = await service
      .from("christmas_orders")
      .select("*")
      .eq("id", orderId)
      .maybeSingle();
    if (orderError) throw orderError;
    if (!order) return jsonResponse({ error: "order not found" }, 404);
    if (order.payment_status !== "paid") {
      return jsonResponse({ error: "payment_required", code: "payment_required" }, 402);
    }
    if (order.product_key !== "christmas_santa_video") {
      return jsonResponse({ error: "wrong_product" }, 400);
    }

    const { data: perso } = await service
      .from("christmas_santa_personalization")
      .select("*")
      .eq("order_id", orderId)
      .maybeSingle();
    if (!perso?.guardian_consent) {
      return jsonResponse({ error: "consent_or_personalization_missing" }, 400);
    }

    const claim = await service.rpc("claim_christmas_santa_video_job", { p_order_id: orderId });
    if (claim.error) throw claim.error;
    const claimData = (typeof claim.data === "string" ? JSON.parse(claim.data) : claim.data) as {
      claimed?: boolean;
      status?: string;
      reason?: string;
    };
    if (!claimData?.claimed) {
      return jsonResponse({ ok: true, status: claimData?.status || claimData?.reason || "not_claimed" });
    }

    // Sync language/template from personalization
    await service
      .from("christmas_santa_video_jobs")
      .update({
        language: perso.language,
        template_key: perso.template_key || "classic_santa",
      })
      .eq("order_id", orderId);

    let { data: job } = await service
      .from("christmas_santa_video_jobs")
      .select("*")
      .eq("order_id", orderId)
      .single();
    if (!job) return jsonResponse({ error: "job_missing" }, 500);

    if (!generationEnabled() && !generationMock()) {
      await failJob(service, orderId, "generation_disabled", "Santa generation is disabled");
      return jsonResponse({ ok: false, code: "generation_disabled" }, 503);
    }

    const mock = generationMock();
    const costs = {
      script: Number(job.cost_script_usd) || 0,
      tts: Number(job.cost_tts_usd) || 0,
      still: Number(job.cost_still_usd) || 0,
      video: Number(job.cost_video_usd) || 0,
    };
    const latencies = {
      script: Number(job.latency_script_ms) || 0,
      tts: Number(job.latency_tts_ms) || 0,
      still: Number(job.latency_still_ms) || 0,
      video: Number(job.latency_video_ms) || 0,
    };

    // ---- SCRIPT ----
    if (job.script_status !== "ready" || !job.script_text) {
      await service
        .from("christmas_santa_video_jobs")
        .update({ script_status: "running", job_status: "queued" })
        .eq("order_id", orderId);
      try {
        const scriptInput = {
          childFirstName: perso.child_first_name,
          language: perso.language as "en" | "ro",
          age: perso.age,
          somethingGood: perso.something_good,
          hobbyOrInterest: perso.hobby_or_interest,
          christmasWish: perso.christmas_wish,
          customFact: perso.custom_fact,
          senderName: perso.sender_name,
          templateKey: perso.template_key || "classic_santa",
        };
        const script = mock ? mockSantaScript(scriptInput) : await generateSantaScript(scriptInput);
        costs.script = script.estimatedCostUsd;
        latencies.script = script.latencyMs;
        await service
          .from("christmas_santa_video_jobs")
          .update({
            script_text: script.script,
            script_word_count: script.wordCount,
            estimated_duration_seconds: script.estimatedDurationSeconds,
            script_status: "ready",
            job_status: "script_ready",
            provider_script: mock ? "mock" : "openai",
            model_script: script.model,
            cost_script_usd: script.estimatedCostUsd,
            latency_script_ms: script.latencyMs,
            cost_state: "estimated",
          })
          .eq("order_id", orderId);
        job.script_text = script.script;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await failJob(service, orderId, "script_failed", message.slice(0, 200), "script");
        return jsonResponse({ ok: false, code: "script_failed", error: message }, 502);
      }
    }

    // ---- TTS ----
    if (job.audio_status !== "ready" || !job.source_audio_path) {
      await service
        .from("christmas_santa_video_jobs")
        .update({ audio_status: "running", job_status: "audio_queued" })
        .eq("order_id", orderId);
      try {
        const tts = mock
          ? mockSantaSpeech()
          : await synthesizeSantaSpeech(String(job.script_text), perso.language as "en" | "ro");
        costs.tts = tts.estimatedCostUsd;
        latencies.tts = tts.latencyMs;
        const audioPath = `santa/${orderId}/speech.mp3`;
        const { error: upErr } = await service.storage.from(RESULT_BUCKET).upload(audioPath, tts.bytes, {
          contentType: tts.contentType,
          upsert: true,
        });
        if (upErr) throw upErr;
        await service
          .from("christmas_santa_video_jobs")
          .update({
            audio_status: "ready",
            job_status: "audio_ready",
            source_audio_bucket: RESULT_BUCKET,
            source_audio_path: audioPath,
            provider_tts: mock ? "mock" : tts.provider,
            model_tts: tts.model,
            cost_tts_usd: tts.estimatedCostUsd,
            latency_tts_ms: tts.latencyMs,
            metadata: {
              ...(typeof job.metadata === "object" && job.metadata ? job.metadata : {}),
              tts_voice: tts.voice,
            },
          })
          .eq("order_id", orderId);
        job.source_audio_path = audioPath;
        job.source_audio_bucket = RESULT_BUCKET;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await failJob(service, orderId, "tts_failed", message.slice(0, 200), "audio");
        return jsonResponse({ ok: false, code: "tts_failed", error: message }, 502);
      }
    }

    // ---- SANTA STILL ----
    if (!job.santa_still_path) {
      try {
        const stillPath = `santa/templates/${perso.template_key || "classic_santa"}.jpg`;
        // Prefer shared template cache
        const existing = await service.storage.from(SOURCE_BUCKET).download(stillPath);
        let stillBytes: Uint8Array;
        let stillMeta = { predictionId: "cache", model: "cached", latencyMs: 0, estimatedCostUsd: 0 };
        if (!existing.error && existing.data && !mock) {
          stillBytes = new Uint8Array(await existing.data.arrayBuffer());
        } else if (mock) {
          // Minimal JPEG SOI/EOI — mock path only
          stillBytes = Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]);
        } else {
          const still = await generateSantaStill({
            prompt: santaStillPrompt(perso.template_key || "classic_santa"),
          });
          stillBytes = still.bytes;
          stillMeta = still;
          costs.still = still.estimatedCostUsd;
          latencies.still = still.latencyMs;
          await service.storage.from(SOURCE_BUCKET).upload(stillPath, stillBytes, {
            contentType: "image/jpeg",
            upsert: true,
          });
        }
        const orderStill = `santa/${orderId}/santa_still.jpg`;
        await service.storage.from(SOURCE_BUCKET).upload(orderStill, stillBytes, {
          contentType: "image/jpeg",
          upsert: true,
        });
        await service
          .from("christmas_santa_video_jobs")
          .update({
            santa_still_bucket: SOURCE_BUCKET,
            santa_still_path: orderStill,
            cost_still_usd: stillMeta.estimatedCostUsd,
            latency_still_ms: stillMeta.latencyMs,
            metadata: {
              ...(typeof job.metadata === "object" && job.metadata ? job.metadata : {}),
              still_prediction_id: stillMeta.predictionId,
              still_model: stillMeta.model,
            },
          })
          .eq("order_id", orderId);
        job.santa_still_path = orderStill;
        job.santa_still_bucket = SOURCE_BUCKET;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await failJob(service, orderId, "still_failed", message.slice(0, 200), "video");
        return jsonResponse({ ok: false, code: "still_failed", error: message }, 502);
      }
    }

    // ---- TALKING VIDEO ----
    if (job.video_status !== "ready" || !job.result_video_path) {
      await service
        .from("christmas_santa_video_jobs")
        .update({ video_status: "running", job_status: "video_processing" })
        .eq("order_id", orderId);
      try {
        let videoBytes: Uint8Array;
        let videoMeta = {
          predictionId: "mock",
          model: "mock",
          estimatedCostUsd: 0,
          latencyMs: 1,
          mode: "mock" as string,
        };
        if (mock) {
          // Minimal ISO BMFF-ish placeholder — not a real playable deliverable for PASS proofs
          videoBytes = new TextEncoder().encode("tdg-santa-mock-mp4");
        } else {
          const imageSigned = await service.storage
            .from(job.santa_still_bucket || SOURCE_BUCKET)
            .createSignedUrl(job.santa_still_path!, 60 * 30);
          const audioSigned = await service.storage
            .from(job.source_audio_bucket || RESULT_BUCKET)
            .createSignedUrl(job.source_audio_path!, 60 * 30);
          if (!imageSigned.data?.signedUrl || !audioSigned.data?.signedUrl) {
            throw new Error("could_not_sign_media");
          }
          const video = await generateSantaTalkingVideo({
            imageUrl: imageSigned.data.signedUrl,
            audioUrl: audioSigned.data.signedUrl,
            orderId,
          });
          videoMeta = video;
          costs.video = video.estimatedCostUsd;
          latencies.video = video.latencyMs;
          const dl = await fetch(video.outputUrl);
          if (!dl.ok) throw new Error("video_download_failed");
          videoBytes = new Uint8Array(await dl.arrayBuffer());
        }

        const videoPath = `santa/${orderId}/result.mp4`;
        const { error: upVideo } = await service.storage.from(RESULT_BUCKET).upload(videoPath, videoBytes, {
          contentType: "video/mp4",
          upsert: true,
        });
        if (upVideo) throw upVideo;

        const { data: asset, error: assetError } = await service
          .from("christmas_order_assets")
          .insert({
            order_id: orderId,
            asset_kind: "video",
            storage_bucket: RESULT_BUCKET,
            storage_path: videoPath,
            sort_order: 0,
            metadata: {
              product_key: "christmas_santa_video",
              language: perso.language,
              template_key: perso.template_key,
              mock,
              estimated_cost_usd: costs.script + costs.tts + costs.still + costs.video,
              cost_state: mock ? "exact" : "estimated",
            },
          })
          .select("id")
          .single();
        if (assetError) throw assetError;

        const totalCost = costs.script + costs.tts + costs.still + costs.video;
        const totalLatency = Date.now() - pipelineStarted;
        const retentionDays = Number(Deno.env.get("CHRISTMAS_SANTA_RETENTION_DAYS") || 365);
        const deleteAfter = new Date(Date.now() + retentionDays * 86400000).toISOString();

        await service
          .from("christmas_santa_video_jobs")
          .update({
            video_status: "ready",
            job_status: "completed",
            result_video_bucket: RESULT_BUCKET,
            result_video_path: videoPath,
            result_asset_id: asset.id,
            provider_video: mock
              ? "mock"
              : videoMeta.mode === "still_audio_mux"
              ? "ffmpeg_compose"
              : "replicate",
            model_video: videoMeta.model,
            provider_job_id: videoMeta.predictionId,
            cost_video_usd: videoMeta.estimatedCostUsd,
            cost_total_usd: totalCost,
            cost_state: mock ? "exact" : "estimated",
            latency_video_ms: videoMeta.latencyMs,
            latency_total_ms: totalLatency,
            completed_at: new Date().toISOString(),
            retention_delete_after: deleteAfter,
            error_code: null,
            error_message_safe: null,
            metadata: {
              ...(typeof job.metadata === "object" && job.metadata ? job.metadata : {}),
              video_mode: videoMeta.mode,
            },
          })
          .eq("order_id", orderId);

        await service
          .from("christmas_orders")
          .update({
            fulfillment_status: "completed",
            generation_finished_at: new Date().toISOString(),
            result_asset_id: asset.id,
            model_name: videoMeta.model,
            replicate_prediction_id: videoMeta.predictionId,
            last_error: null,
            metadata: {
              ...(typeof order.metadata === "object" && order.metadata ? order.metadata : {}),
              santa_language: perso.language,
              santa_template: perso.template_key,
              estimated_cost_usd: totalCost,
              cost_state: mock ? "exact" : "estimated",
              cost_breakdown: costs,
              latency_ms: totalLatency,
              latency_breakdown: latencies,
              mock,
            },
          })
          .eq("id", orderId);

        // Best-effort idempotent lifecycle delivery (persisted order.locale)
        try {
          const email = asString(order.email);
          const tokenHint = asString(
            (order.metadata as Record<string, unknown> | null)?.public_token_hint,
          );
          if (email && tokenHint) {
            const site = (
              Deno.env.get("SITE_URL") ||
              Deno.env.get("PUBLIC_APP_URL") ||
              "https://www.thedigitalgifter.com"
            ).replace(/\/$/, "");
            const link = `${site}/christmas/santa-video?token=${encodeURIComponent(tokenHint)}`;
            await claimAndSendChristmasLifecycle({
              service,
              template: "generation_ready",
              orderId,
              productKey: "christmas_santa_video",
              locale: asString(order.locale) || "en",
              email,
              productName: "Santa Video",
              resultUrl: link,
            });
          }
        } catch {
          /* ignore */
        }

        return jsonResponse({
          ok: true,
          status: "completed",
          asset_id: asset.id,
          mock,
          estimated_cost_usd: totalCost,
          latency_ms: totalLatency,
          language: perso.language,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await failJob(service, orderId, "video_failed", message.slice(0, 200), "video");
        return jsonResponse({ ok: false, code: "video_failed", error: message }, 502);
      }
    }

    return jsonResponse({ ok: true, status: "completed", already: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: message }, 500);
  }
});

async function failJob(
  service: ReturnType<typeof getServiceClient>,
  orderId: string,
  code: string,
  safeMessage: string,
  stage: "script" | "audio" | "video" = "video",
) {
  const patch: Record<string, unknown> = {
    job_status: "failed",
    error_code: code,
    error_message_safe: safeMessage,
  };
  if (stage === "script") patch.script_status = "failed";
  if (stage === "audio") patch.audio_status = "failed";
  if (stage === "video") patch.video_status = "failed";
  await service.from("christmas_santa_video_jobs").update(patch).eq("order_id", orderId);
  await service
    .from("christmas_orders")
    .update({ fulfillment_status: "failed", last_error: safeMessage })
    .eq("id", orderId);
  try {
    const { data: ord } = await service
      .from("christmas_orders")
      .select("email,locale,product_key")
      .eq("id", orderId)
      .maybeSingle();
    if (ord) {
      await claimAndSendChristmasLifecycle({
        service,
        template: "generation_failed",
        orderId,
        productKey: asString(ord.product_key) || "christmas_santa_video",
        locale: asString(ord.locale) || "en",
        email: asString(ord.email) || null,
        productName: "Santa Video",
      });
    }
  } catch {
    /* best-effort terminal failure email once via ledger */
  }
}
