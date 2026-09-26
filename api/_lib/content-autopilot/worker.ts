import { createReadStream, createWriteStream, existsSync } from "node:fs";
import { copyFile, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { get as httpGet } from "node:http";
import { get as httpsGet } from "node:https";
import { ffprobeFile } from "../clip-factory/ffmpeg";
import { resolveVpsAbsolutePath, persistObjectToVps } from "../long-form-studio/storage";
import { getServiceClient } from "../christmas/supabaseClient";
import { enqueueFinishJob } from "../christmas-reel-pipeline/worker";
import { assembleSilentReel } from "./assembleReel";
import {
  estimateKlingVideoUsd,
  extractHiggsfieldImageUrl,
  extractHiggsfieldVideoUrl,
  getHiggsfieldAuthorization,
  higgsfieldConfigured,
  pollHiggsfieldRequest,
  submitContentImage,
  submitKlingVideo,
  uploadBytesToHiggsfield,
} from "./higgsfield";
import { generatePromptPack, imageQcConfigured, runImageQualityGate } from "./imageQc";
import { researchConfigured, runDailyResearch, selectDailyConcepts } from "./research";
import {
  budgetAllows,
  dailyLimitOk,
  ensureDailyUsage,
  loadSettings,
  logEvent,
  utcToday,
  bumpUsage,
} from "./settings";
import type { ContentClip, PipelineStatus } from "./types";
import { buildImagePrompt, buildMotionPrompt, reelTitleFromConcept } from "./visualStandard";

async function downloadUrl(url: string, dest: string): Promise<void> {
  await new Promise<void>((resolvePromise, reject) => {
    const lib = url.startsWith("https:") ? httpsGet : httpGet;
    lib(url, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        downloadUrl(res.headers.location, dest).then(resolvePromise, reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`download_http_${res.statusCode}`));
        return;
      }
      pipeline(res, createWriteStream(dest)).then(() => resolvePromise()).catch(reject);
    }).on("error", reject);
  });
}

function parseClips(raw: unknown): ContentClip[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item, index) => {
    const row = (item || {}) as Record<string, unknown>;
    return {
      index: Number(row.index ?? index),
      sceneLabel: String(row.sceneLabel || row.scene_label || String(index + 1)),
      imagePrompt: String(row.imagePrompt || row.image_prompt || ""),
      motionPrompt: String(row.motionPrompt || row.motion_prompt || ""),
      imageUrl: row.imageUrl ? String(row.imageUrl) : row.image_url ? String(row.image_url) : null,
      imageStoragePath: row.imageStoragePath ? String(row.imageStoragePath) : row.image_storage_path ? String(row.image_storage_path) : null,
      imageQc: (row.imageQc || row.image_qc || null) as ContentClip["imageQc"],
      imageQcReason: row.imageQcReason ? String(row.imageQcReason) : row.image_qc_reason ? String(row.image_qc_reason) : null,
      imageAttempts: Number(row.imageAttempts || row.image_attempts || 0),
      videoStoragePath: row.videoStoragePath ? String(row.videoStoragePath) : row.video_storage_path ? String(row.video_storage_path) : null,
      higgsfieldImageRequestId: row.higgsfieldImageRequestId
        ? String(row.higgsfieldImageRequestId)
        : row.higgsfield_image_request_id
          ? String(row.higgsfield_image_request_id)
          : null,
      higgsfieldVideoRequestId: row.higgsfieldVideoRequestId
        ? String(row.higgsfieldVideoRequestId)
        : row.higgsfield_video_request_id
          ? String(row.higgsfield_video_request_id)
          : null,
      videoCostUsd: row.videoCostUsd != null ? Number(row.videoCostUsd) : row.video_cost_usd != null ? Number(row.video_cost_usd) : null,
    };
  });
}

async function failConcept(conceptId: string, reason: string, status: PipelineStatus = "failed") {
  const service = getServiceClient();
  await service
    .from("content_concepts")
    .update({ pipeline_status: status, failure_reason: reason.slice(0, 500), updated_at: new Date().toISOString() })
    .eq("id", conceptId);
  await logEvent("concept_failed", { reason }, conceptId);
}

async function updateConcept(conceptId: string, patch: Record<string, unknown>) {
  const service = getServiceClient();
  await service
    .from("content_concepts")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", conceptId);
}

async function processSelectedConcept(row: Record<string, unknown>, settings: Awaited<ReturnType<typeof loadSettings>>) {
  const conceptId = String(row.id);
  const clipsPerReel = Math.max(2, Math.min(6, settings.clipsPerReel));
  const { imagePrompts, motionPrompts } = await generatePromptPack({
    concept: String(row.concept || ""),
    hook: String(row.hook || ""),
    conceptDescription: String(row.concept_description || row.concept || ""),
    conceptFamily: String(row.concept_family || ""),
    clipCount: clipsPerReel,
  });
  const clips: ContentClip[] = imagePrompts.map((imagePrompt, index) => ({
    index,
    sceneLabel: String(index + 1),
    imagePrompt: buildImagePrompt(imagePrompt),
    motionPrompt: buildMotionPrompt(motionPrompts[index] || motionPrompts[0] || ""),
    imageAttempts: 0,
  }));
  await updateConcept(conceptId, {
    pipeline_status: "prompts_ready",
    image_prompts: imagePrompts,
    motion_prompts: motionPrompts,
    clips,
  });
  await logEvent("prompts_ready", { clipCount: clips.length }, conceptId);
}

async function processPromptsReady(row: Record<string, unknown>, settings: Awaited<ReturnType<typeof loadSettings>>) {
  if (!higgsfieldConfigured()) throw new Error("higgsfield_credentials_missing");
  if (!(await dailyLimitOk(settings, "images"))) throw new Error("daily_image_limit");
  const conceptId = String(row.id);
  const clips = parseClips(row.clips);
  const auth = getHiggsfieldAuthorization();
  const workDir = await mkdtemp(join(tmpdir(), "tdg-ca-"));
  try {
    const pending = clips.find((clip) => !(clip.imageStoragePath && clip.imageQc === "PASS"));
    if (!pending) {
      await updateConcept(conceptId, { clips, pipeline_status: "qc_review" });
      await logEvent("images_qc_passed", { clips: clips.length }, conceptId);
      return;
    }
    const clip = pending;
      if ((clip.imageAttempts || 0) >= settings.maxImageAttemptsPerClip) {
        await failConcept(conceptId, `image_attempts_exceeded_clip_${clip.index}`);
        return;
      }
      if (!(await budgetAllows(settings))) {
        await logEvent("budget_stop", { stage: "image" }, conceptId);
        return;
      }
      const requestId = await submitContentImage(auth, clip.imagePrompt);
      const polled = await pollHiggsfieldRequest(auth, requestId, { maxAttempts: 40, sleepMs: 2500 });
      if (!polled.done || polled.failed || !polled.body) {
        clip.imageAttempts = (clip.imageAttempts || 0) + 1;
        await bumpUsage({ image_retries: 1 });
        await updateConcept(conceptId, { clips, pipeline_status: "generating_assets" });
        if ((clip.imageAttempts || 0) >= settings.maxImageAttemptsPerClip) {
          await failConcept(conceptId, `image_generation_failed_clip_${clip.index}`);
        }
        return;
      }
      const imageUrl = extractHiggsfieldImageUrl(polled.body);
      if (!imageUrl) {
        await failConcept(conceptId, `image_url_missing_clip_${clip.index}`);
        return;
      }
      const imagePath = join(workDir, `clip_${clip.index}.jpg`);
      await downloadUrl(imageUrl, imagePath);
      await bumpUsage({ images_generated: 1 });
      clip.imageUrl = imageUrl;
      clip.higgsfieldImageRequestId = requestId;
      clip.imageAttempts = (clip.imageAttempts || 0) + 1;

      if (!imageQcConfigured()) {
        await failConcept(conceptId, "image_qc_not_configured");
        return;
      }
      const qc = await runImageQualityGate({ imagePath, imagePrompt: clip.imagePrompt });
      clip.imageQc = qc.verdict;
      clip.imageQcReason = qc.reason;
      if (qc.verdict === "REJECT") {
        await failConcept(conceptId, `image_qc_reject:${qc.reason}`);
        return;
      }
      if (qc.verdict === "REGENERATE") {
        await bumpUsage({ image_retries: 1 });
        await updateConcept(conceptId, { clips, pipeline_status: "generating_assets" });
        return;
      }
      const objectPath = `productions/content-autopilot/${conceptId}/clip-${clip.index}.jpg`;
      await persistObjectToVps(imagePath, objectPath);
      clip.imageStoragePath = objectPath;

    await updateConcept(conceptId, { clips, pipeline_status: "generating_assets" });
    const allPassed = clips.every((c) => c.imageQc === "PASS" && c.imageStoragePath);
    if (allPassed) {
      await updateConcept(conceptId, { clips, pipeline_status: "qc_review" });
      await logEvent("images_qc_passed", { clips: clips.length }, conceptId);
    }
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

async function processVideos(row: Record<string, unknown>, settings: Awaited<ReturnType<typeof loadSettings>>) {
  const conceptId = String(row.id);
  const clips = parseClips(row.clips);
  const auth = getHiggsfieldAuthorization();
  const workDir = await mkdtemp(join(tmpdir(), "tdg-ca-v-"));
  let spend = Number(row.generation_cost_usd || 0);
  try {
    const clip = clips.find((item) => !item.videoStoragePath);
    if (!clip) {
      await updateConcept(conceptId, {
        clips,
        generation_cost_usd: spend,
        pipeline_status: "assembling_reel",
      });
      return;
    }
      if (!(await dailyLimitOk(settings, "videos"))) throw new Error("daily_video_limit");
      if (!(await budgetAllows(settings))) {
        await logEvent("budget_stop", { stage: "video" }, conceptId);
        return;
      }
      const imageUrl = clip.imageUrl;
      if (!imageUrl) throw new Error("missing_image_url_for_video");
      const estimate = await estimateKlingVideoUsd(auth, imageUrl, clip.motionPrompt);
      if (!(await budgetAllows(settings, estimate))) {
        await logEvent("budget_stop", { stage: "video_estimate", estimate }, conceptId);
        return;
      }
      const requestId = await submitKlingVideo(auth, imageUrl, clip.motionPrompt);
      const polled = await pollHiggsfieldRequest(auth, requestId, { maxAttempts: 80, sleepMs: 4000 });
      if (!polled.done || polled.failed || !polled.body) {
        await bumpUsage({ video_retries: 1 });
        await failConcept(conceptId, `video_generation_failed_clip_${clip.index}`);
        return;
      }
      const videoUrl = extractHiggsfieldVideoUrl(polled.body);
      if (!videoUrl) {
        await failConcept(conceptId, `video_url_missing_clip_${clip.index}`);
        return;
      }
      const videoPath = join(workDir, `clip_${clip.index}.mp4`);
      await downloadUrl(videoUrl, videoPath);
      const objectPath = `productions/content-autopilot/${conceptId}/clip-${clip.index}.mp4`;
      await persistObjectToVps(videoPath, objectPath);
      clip.videoStoragePath = objectPath;
      clip.higgsfieldVideoRequestId = requestId;
      clip.videoCostUsd = estimate;
      spend += estimate;
      await bumpUsage({ videos_generated: 1, estimated_spend_usd: estimate });
    await updateConcept(conceptId, {
      clips,
      generation_cost_usd: spend,
      pipeline_status: "qc_review",
    });
    if (clips.every((item) => item.videoStoragePath)) {
      await updateConcept(conceptId, { pipeline_status: "assembling_reel" });
      await logEvent("videos_ready", { clips: clips.length, spend }, conceptId);
    }
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

async function processAssemble(row: Record<string, unknown>) {
  const conceptId = String(row.id);
  const clips = parseClips(row.clips);
  const workDir = await mkdtemp(join(tmpdir(), "tdg-ca-a-"));
  try {
    const localClips: string[] = [];
    for (const clip of clips) {
      if (!clip.videoStoragePath) throw new Error("missing_video_clip");
      const local = join(workDir, `src_${clip.index}.mp4`);
      const abs = resolveVpsAbsolutePath(clip.videoStoragePath);
      if (!existsSync(abs)) throw new Error(`clip_not_found:${clip.videoStoragePath}`);
      await copyFile(abs, local);
      localClips.push(local);
    }
    const outputPath = join(workDir, "reel.mp4");
    await assembleSilentReel({ workDir, clipPaths: localClips, outputPath });
    const probe = await ffprobeFile(outputPath);
    const objectPath = `productions/content-autopilot/${conceptId}/source-reel.mp4`;
    await persistObjectToVps(outputPath, objectPath);
    const service = getServiceClient();
    const title = reelTitleFromConcept({ concept: String(row.concept || ""), hook: String(row.hook || "") });
    const tags = [String(row.concept_family || ""), "content_autopilot", "christmas"];
    const inserted = await service
      .from("library_assets")
      .insert({
        title,
        description: String(row.concept_description || row.concept || ""),
        src: `/api/content-autopilot?action=media&id=${conceptId}`,
        filename: `content-autopilot-${conceptId.slice(0, 8)}.mp4`,
        category: "christmas_reels",
        kind: "video",
        duration_seconds: probe.duration,
        width: probe.width,
        height: probe.height,
        provenance: {
          source: "content_autopilot",
          concept_id: conceptId,
          concept_family: row.concept_family,
          hook: row.hook,
          clips,
        },
        content_tags: tags,
        publish_status: "pending_finish",
        publisher_eligible: false,
        source_video_path: objectPath,
        storage_bucket: "vps",
        storage_path: objectPath,
      })
      .select("id")
      .single();
    if (inserted.error) throw inserted.error;
    const libraryAssetId = String(inserted.data.id);
    await enqueueFinishJob(libraryAssetId);
    await updateConcept(conceptId, {
      library_asset_id: libraryAssetId,
      pipeline_status: "library_pending_finish",
      generation_count: Number(row.generation_count || 0) + 1,
      last_used_at: new Date().toISOString(),
    });
    await logEvent("library_enqueued_finish", { libraryAssetId }, conceptId);
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

async function syncFinishStatus(row: Record<string, unknown>) {
  const conceptId = String(row.id);
  const assetId = String(row.library_asset_id || "");
  if (!assetId) return;
  const service = getServiceClient();
  const { data: asset } = await service.from("library_assets").select("publish_status,publisher_eligible").eq("id", assetId).maybeSingle();
  if (!asset) return;
  if (asset.publish_status === "ready_to_publish" && asset.publisher_eligible) {
    await updateConcept(conceptId, { pipeline_status: "ready", failure_reason: null });
    await logEvent("concept_ready", { assetId }, conceptId);
  } else if (asset.publish_status === "failed") {
    await failConcept(conceptId, "reel_finish_failed");
  }
}

async function processConceptRow(row: Record<string, unknown>, settings: Awaited<ReturnType<typeof loadSettings>>) {
  const status = String(row.pipeline_status || "");
  if (status === "selected") {
    await processSelectedConcept(row, settings);
    return;
  }
  if (status === "prompts_ready" || status === "generating_assets") {
    await updateConcept(String(row.id), { pipeline_status: "generating_assets" });
    await processPromptsReady(row, settings);
    return;
  }
  if (status === "qc_review") {
    await processVideos(row, settings);
    return;
  }
  if (status === "assembling_reel") {
    await processAssemble(row);
    return;
  }
  if (status === "library_pending_finish") {
    await syncFinishStatus(row);
  }
}

export async function tickContentAutopilot(workerId: string): Promise<Record<string, unknown>> {
  const settings = await loadSettings();
  if (!settings.enabled) return { ok: true, skipped: "disabled" };
  const usage = await ensureDailyUsage();
  const result: Record<string, unknown> = { workerId, usageDate: utcToday() };

  if (!usage.research_completed && researchConfigured()) {
    const research = await runDailyResearch({
      candidateLimit: settings.researchCandidatesPerDay,
      performanceHints: "",
    });
    result.research = research;
  }

  if (Boolean(usage.research_completed) || Number(result.research ? (result.research as { inserted?: number }).inserted || 0 : 0) > 0) {
    result.selection = await selectDailyConcepts(settings.productionConceptsPerDay);
  }

  if (settings.generationPaused) {
    result.generation = "paused";
    return result;
  }

  const service = getServiceClient();
  const activeStatuses = ["selected", "prompts_ready", "generating_assets", "qc_review", "assembling_reel", "library_pending_finish"];
  const { data: nextConcept } = await service
    .from("content_concepts")
    .select("*")
    .eq("usage_date", utcToday())
    .in("pipeline_status", activeStatuses)
    .order("updated_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (nextConcept) {
    try {
      await processConceptRow(nextConcept as Record<string, unknown>, settings);
      result.processedConceptId = nextConcept.id;
      result.processedStatus = nextConcept.pipeline_status;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await failConcept(String(nextConcept.id), message);
      result.processError = message.slice(0, 200);
    }
  }
  return result;
}

export async function getDashboardSnapshot() {
  const service = getServiceClient();
  const settings = await loadSettings();
  const usage = await ensureDailyUsage();
  const today = utcToday();
  const { data: concepts } = await service
    .from("content_concepts")
    .select("*")
    .eq("usage_date", today)
    .order("created_at", { ascending: false });
  const counts = {
    researched: (concepts || []).length,
    selected: (concepts || []).filter((row) => !["candidate", "skipped"].includes(String(row.pipeline_status))).length,
    images: (concepts || []).filter((row) => ["qc_review", "assembling_reel", "library_pending_finish", "ready"].includes(String(row.pipeline_status))).length,
    qcPass: (concepts || []).filter((row) => ["qc_review", "assembling_reel", "library_pending_finish", "ready"].includes(String(row.pipeline_status))).length,
    videos: (concepts || []).filter((row) => ["assembling_reel", "library_pending_finish", "ready"].includes(String(row.pipeline_status))).length,
    reels: (concepts || []).filter((row) => ["library_pending_finish", "ready"].includes(String(row.pipeline_status))).length,
    ready: (concepts || []).filter((row) => row.pipeline_status === "ready").length,
    published: (concepts || []).filter((row) => Number(row.publication_count || 0) > 0).length,
  };
  return { settings, usage, counts, concepts: concepts || [] };
}

export async function retryConcept(conceptId: string) {
  await updateConcept(conceptId, { pipeline_status: "selected", failure_reason: null });
  await logEvent("manual_retry", {}, conceptId);
}

export async function streamConceptMedia(conceptId: string, res: import("../nodeHandler").NodeApiResponse) {
  const service = getServiceClient();
  const { data: concept } = await service.from("content_concepts").select("id").eq("id", conceptId).maybeSingle();
  if (!concept) throw Object.assign(new Error("not_found"), { status: 404 });
  const objectPath = `productions/content-autopilot/${conceptId}/source-reel.mp4`;
  const abs = resolveVpsAbsolutePath(objectPath);
  if (!existsSync(abs)) throw Object.assign(new Error("not_found"), { status: 404 });
  res.setHeader("Content-Type", "video/mp4");
  createReadStream(abs).pipe(res);
}
