import { createHash, randomUUID } from "node:crypto";
import { existsSync, promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getServiceClient } from "../christmas/supabaseClient";
import { buildAssCaptions, resolveCaptionStyle } from "../../../src/features/clip-factory/captions";
import { planReframe } from "../../../src/features/clip-factory/reframe";
import type { CaptionStyle, ClipFactoryOptions, Transcript } from "../../../src/features/clip-factory/types";
import { DEFAULT_CLIP_FACTORY_OPTIONS } from "../../../src/features/clip-factory/types";
import { acquireSourceMedia } from "./acquire";
import { IngestError, sanitizeFilename } from "./ingest";
import { desiredClipCount } from "../../../src/features/clip-factory/boundaries";
import {
  detectScenes,
  extractAudioMp3,
  extractJpeg,
  extractThumbnail,
  ffprobeFile,
  renderVerticalClip,
} from "./ffmpeg";
import { describeFrames, openaiConfigured, proposeMoments, transcribeWhisper } from "./openai";
import { signedPlaybackPath } from "./mediaSign";

const BUCKET = "clip-factory";
const root = resolve(fileURLToPath(new URL(".", import.meta.url)), "../../..");

let running = false;

function log(event: string, extra: Record<string, unknown>) {
  console.log(JSON.stringify({ source: "clip-factory", event, ...extra }));
}

async function recordEvent(jobId: string | null, eventName: string, detail: Record<string, unknown> = {}) {
  const service = getServiceClient();
  await service.from("clip_factory_events").insert({ job_id: jobId, event_name: eventName, detail });
  log(eventName, { job_id: jobId, ...detail });
}

async function patchJob(id: string, patch: Record<string, unknown>) {
  const service = getServiceClient();
  await service
    .from("clip_factory_jobs")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
}

async function hashFile(path: string): Promise<string> {
  const buf = await fs.readFile(path);
  return createHash("sha256").update(buf).digest("hex");
}

async function uploadBytes(path: string, dest: string, contentType: string) {
  const service = getServiceClient();
  const bytes = await fs.readFile(path);
  const { error } = await service.storage.from(BUCKET).upload(dest, bytes, { contentType, upsert: true });
  if (error) throw error;
  return bytes.length;
}

async function downloadStorage(storagePath: string, dest: string) {
  const service = getServiceClient();
  const { data, error } = await service.storage.from(BUCKET).download(storagePath);
  if (error || !data) throw error || new Error("storage_download_failed");
  await fs.writeFile(dest, Buffer.from(await data.arrayBuffer()));
}

function resolveLocalLibrary(src: string): string | null {
  if (!src.startsWith("/") || src.includes("..") || src.includes("://")) return null;
  const candidates = [join(root, "dist", src), join(root, "public", src)];
  return candidates.find((path) => existsSync(path)) || null;
}

function formatClock(seconds: number): string {
  const t = Math.max(0, Number(seconds) || 0);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = Math.floor(t % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function estimateCost(cost: Record<string, number>): number {
  const whisperUsd = ((cost.whisper_seconds || 0) / 60) * 0.006;
  const tokenUsd = ((cost.openai_tokens || 0) / 1_000_000) * 0.25;
  const storageUsd = ((cost.storage_bytes || 0) / 1_000_000_000) * 0.021;
  return Number((whisperUsd + tokenUsd + storageUsd).toFixed(4));
}

function verticalFilter(mode: "track" | "blur_pad" | "center", cropExpr: string): string {
  const base = "scale=iw*sar:ih,setsar=1";
  if (mode === "blur_pad") {
    return `${base},split[bg][fg];[bg]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=18:6[back];[fg]scale=1080:1920:force_original_aspect_ratio=decrease[front];[back][front]overlay=(W-w)/2:(H-h)/2`;
  }
  if (mode === "center") {
    return `${base},scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920`;
  }
  return `${base},${cropExpr},scale=1080:1920`;
}

export async function processClipFactoryJob(jobId: string): Promise<void> {
  const service = getServiceClient();
  const { data: job, error } = await service.from("clip_factory_jobs").select("*").eq("id", jobId).maybeSingle();
  if (error || !job) throw error || new Error("job_not_found");
  const options = { ...DEFAULT_CLIP_FACTORY_OPTIONS, ...(job.options || {}) } as ClipFactoryOptions;
  const workDir = join(tmpdir(), `tdg-clip-${jobId}`);
  await fs.mkdir(workDir, { recursive: true });
  const sourcePath = join(workDir, "source.mp4");
  const cost: Record<string, number> = { ...(job.cost || {}) };

  try {
    if (
      ["queued", "ingesting", "importing", "downloading", "uploading", "failed", "waiting_for_media", "source_detected"].includes(
        job.status,
      ) &&
      !job.media_id
    ) {
      await patchJob(jobId, {
        status: "importing",
        stage: "importing",
        progress: 8,
        progress_label: "Importing source...",
        error_message: null,
        failed_stage: null,
      });
      await recordEvent(jobId, "clip_factory_source_added", { source_kind: job.source_kind });
      const payload = job.source_payload || {};
      if (job.source_kind === "direct_media_url" || job.source_kind === "youtube" || job.source_kind === "vimeo") {
        await patchJob(jobId, { status: "downloading", stage: "importing", progress: 12, progress_label: "Importing source..." });
      }
      const ingested = await acquireSourceMedia({
        sourceKind: job.source_kind,
        sourcePayload: payload,
        sourceLabel: job.source_label,
        dest: sourcePath,
        downloadStorage,
        resolveLibraryFile: resolveLocalLibrary,
        copyFile: (from, to) => fs.copyFile(from, to),
        findStoredMedia: async (sourceUrl) => {
          const { data } = await service
            .from("clip_factory_media")
            .select("storage_path,source_label")
            .eq("source_url", sourceUrl)
            .maybeSingle();
          return data?.storage_path ? { storagePath: data.storage_path, title: data.source_label } : null;
        },
        loadLibraryAsset: async (id) => {
          const { data: asset } = await service
            .from("library_assets")
            .select("storage_path,title")
            .eq("id", id)
            .maybeSingle();
          return asset?.storage_path ? { storagePath: asset.storage_path, title: asset.title } : null;
        },
      });
      if (ingested.status !== "ingested") {
        throw new IngestError("import_failed", "Source media was not ingested.");
      }

      let probe;
      try {
        probe = await ffprobeFile(sourcePath);
      } catch {
        throw new IngestError("corrupt_file", "This file could not be read as video. Try MP4/H.264.");
      }
      if (!probe.duration || probe.duration < 3) {
        throw new IngestError("very_short_video", `Video is too short (${probe.duration.toFixed(1)}s). Use a clip of at least 3 seconds.`);
      }
      if (probe.duration > 7200) {
        throw new IngestError("duration_exceeded", "Video exceeds maximum supported duration.");
      }
      if (probe.width < 240 || probe.height < 240) {
        throw new IngestError("low_resolution", `Resolution ${probe.width}×${probe.height} is too low for a good vertical crop.`);
      }
      const mediaHash = await hashFile(sourcePath);
      const storedPath = `media/${mediaHash}/source.mp4`;
      const size = await uploadBytes(sourcePath, storedPath, "video/mp4");
      cost.storage_bytes = (cost.storage_bytes || 0) + size;

      const { data: existing } = await service.from("clip_factory_media").select("*").eq("media_hash", mediaHash).maybeSingle();
      let mediaId = existing?.id as string | undefined;
      if (!mediaId) {
        const inserted = await service
          .from("clip_factory_media")
          .insert({
            media_hash: mediaHash,
            source_kind: job.source_kind,
            source_label: job.source_label,
            source_url: payload.url || null,
            library_asset_id: payload.libraryAssetId || null,
            storage_bucket: BUCKET,
            storage_path: storedPath,
            content_type: "video/mp4",
            file_size_bytes: probe.fileSize || size,
            duration_seconds: probe.duration,
            width: probe.width,
            height: probe.height,
            fps: probe.fps,
            codec_video: probe.videoCodec,
            codec_audio: probe.audioCodec,
            has_audio: probe.hasAudio,
            orientation: probe.orientation,
            probe,
          })
          .select("id")
          .single();
        if (inserted.error) throw inserted.error;
        mediaId = inserted.data.id;
      }
      if (job.source_kind === "upload" && String(payload.objectPath || "").startsWith("uploads/")) {
        await service.storage.from(BUCKET).remove([String(payload.objectPath)]);
      }
      await patchJob(jobId, {
        media_id: mediaId,
        media_hash: mediaHash,
        progress: 18,
        progress_label: "Importing source...",
        cost: { ...cost, estimated_usd: estimateCost(cost) },
      });
      job.media_id = mediaId;
      job.media_hash = mediaHash;
    }

    const { data: media } = await service.from("clip_factory_media").select("*").eq("id", job.media_id).maybeSingle();
    if (!media) throw new Error("media_missing");
    try {
      await fs.access(sourcePath);
    } catch {
      await downloadStorage(media.storage_path, sourcePath);
    }

    await recordEvent(jobId, "clip_factory_analysis_started", { media_hash: media.media_hash });
    await patchJob(jobId, {
      status: "extracting_audio",
      stage: "extracting_audio",
      progress: 24,
      progress_label: "Extracting audio",
      analysis_started_at: new Date().toISOString(),
    });

    let transcript: Transcript = { language: null, fullText: "", words: [], segments: [] };
    const { data: cachedTranscript } = await service
      .from("clip_factory_transcripts")
      .select("*")
      .eq("media_hash", media.media_hash)
      .maybeSingle();

    if (cachedTranscript) {
      transcript = {
        language: cachedTranscript.language,
        languageProbability: cachedTranscript.language_probability,
        fullText: cachedTranscript.full_text,
        words: cachedTranscript.words || [],
        segments: cachedTranscript.segments || [],
      };
      await patchJob(jobId, { status: "transcribing", stage: "transcribing", progress: 40, progress_label: `Transcribing ${formatClock(Number(media.duration_seconds || 0))} video...` });
    } else if (!media.has_audio) {
      await patchJob(jobId, { status: "transcribing", stage: "transcribing", progress: 40, progress_label: `Transcribing ${formatClock(Number(media.duration_seconds || 0))} video...` });
    } else {
      if (!openaiConfigured()) {
        throw new IngestError(
          "ai_provider_failure",
          "OPENAI_API_KEY is not configured on the server, so speech cannot be transcribed.",
        );
      }
      await patchJob(jobId, { status: "extracting_audio", stage: "extracting_audio", progress: 28, progress_label: "Extracting audio" });
      const audioPath = join(workDir, "audio.mp3");
      try {
        await extractAudioMp3(sourcePath, audioPath);
      } catch {
        throw new IngestError("no_audio", "Audio could not be extracted from this file.");
      }
      await patchJob(jobId, { status: "transcribing", stage: "transcribing", progress: 34, progress_label: `Transcribing ${formatClock(Number(media.duration_seconds || 0))} video...` });
      try {
        const result = await transcribeWhisper(audioPath, options.language);
        transcript = result;
        cost.whisper_seconds = (cost.whisper_seconds || 0) + (result.usage.minutes * 60 || media.duration_seconds || 0);
        cost.openai_calls = (cost.openai_calls || 0) + 1;
        await service.from("clip_factory_transcripts").upsert({
          media_hash: media.media_hash,
          language: transcript.language,
          language_probability: transcript.languageProbability,
          full_text: transcript.fullText,
          words: transcript.words,
          segments: transcript.segments,
          provider: "openai_whisper",
          duration_seconds: media.duration_seconds,
        }, { onConflict: "media_hash" });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (/audio|silent|no speech/i.test(message)) {
          transcript = { language: options.language === "auto" ? null : options.language, fullText: "", words: [], segments: [] };
        } else {
          throw new IngestError("transcription_failure", `Transcription failed: ${message.slice(0, 220)}`);
        }
      }
    }

    await patchJob(jobId, {
      status: "analyzing",
      stage: "analyzing",
      progress: 52,
      progress_label: "Analyzing transcript...",
      cost: { ...cost, estimated_usd: estimateCost(cost) },
    });

    let visualNotes: Awaited<ReturnType<typeof describeFrames>>["notes"] = [];
    const { data: cachedScenes } = await service
      .from("clip_factory_scene_analyses")
      .select("*")
      .eq("media_hash", media.media_hash)
      .maybeSingle();
    if (cachedScenes) {
      visualNotes = cachedScenes.frames || [];
    } else {
      const sceneTimes = await detectScenes(sourcePath);
      const duration = Number(media.duration_seconds || 0);
      const sampled = new Set<number>();
      sampled.add(Math.min(0.4, duration / 8));
      for (const t of sceneTimes) sampled.add(t);
      const step = Math.max(6, duration / 8);
      for (let t = step; t < duration - 0.3; t += step) sampled.add(Number(t.toFixed(2)));
      const times = [...sampled].filter((t) => t >= 0 && t < duration).sort((a, b) => a - b).slice(0, 10);
      const frames: Array<{ t: number; jpeg: Buffer }> = [];
      for (const t of times) {
        const framePath = join(workDir, `f-${t}.jpg`);
        try {
          await extractJpeg(sourcePath, t, framePath);
          frames.push({ t, jpeg: await fs.readFile(framePath) });
        } catch {
          /* skip bad frame */
        }
      }
      if (openaiConfigured() && frames.length) {
        const described = await describeFrames(frames);
        visualNotes = described.notes;
        cost.openai_calls = (cost.openai_calls || 0) + 1;
        cost.openai_tokens = (cost.openai_tokens || 0) + described.tokens;
      } else {
        visualNotes = times.map((t) => ({ t, note: "Scene sample", subjectX: 0.5, subjectY: 0.45, hasFace: false, confidence: 0.2 }));
      }
      await service.from("clip_factory_scene_analyses").upsert({
        media_hash: media.media_hash,
        scenes: sceneTimes,
        frames: visualNotes,
        visual_summary: visualNotes.map((n) => n.note).join(" "),
        provider: openaiConfigured() ? "ffmpeg_gpt4o_mini" : "ffmpeg_only",
      }, { onConflict: "media_hash" });
    }

    await patchJob(jobId, { status: "selecting_moments", stage: "selecting_moments", progress: 68, progress_label: "Analyzing transcript..." });
    if (!openaiConfigured()) {
      throw new IngestError(
        "ai_provider_failure",
        "OPENAI_API_KEY is not configured, so viral moments cannot be selected from this video.",
      );
    }
    await patchJob(jobId, { status: "selecting_moments", stage: "selecting_moments", progress: 78, progress_label: "Selecting strongest moments..." });
    let proposed;
    try {
      proposed = await proposeMoments({
        transcript,
        visuals: visualNotes,
        duration: Number(media.duration_seconds),
        options: {
          clipCount: options.clipCount,
          duration: options.duration,
          objective: options.objective,
          platform: options.platform,
        },
      });
    } catch (err) {
      throw new IngestError("ai_provider_failure", `Moment analysis failed: ${(err as Error).message.slice(0, 220)}`);
    }
    cost.openai_calls = (cost.openai_calls || 0) + 1;
    cost.openai_tokens = (cost.openai_tokens || 0) + proposed.tokens;

    const reframe = planReframe({
      width: media.width,
      height: media.height,
      keyframes: visualNotes.map((n) => ({
        t: n.t,
        subjectX: n.subjectX,
        subjectY: n.subjectY,
        hasFace: n.hasFace,
        confidence: n.confidence,
      })),
    });

    await service.from("clip_factory_candidates").delete().eq("job_id", jobId);
    if (proposed.candidates.length) {
      await service.from("clip_factory_candidates").insert(
        proposed.candidates.map((c, index) => ({
          job_id: jobId,
          media_hash: media.media_hash,
          start_time: c.startTime,
          end_time: c.endTime,
          duration: c.duration,
          title: c.title,
          hook: c.hook,
          summary: c.summary,
          reason: c.reason,
          category: c.category,
          suggested_platforms: c.suggestedPlatforms,
          suggested_caption: c.suggestedCaption,
          suggested_post_caption: c.suggestedPostCaption,
          hashtags: c.hashtags,
          confidence: c.confidence,
          scores: c.scores,
          overall_viral_score: c.overallViralScore,
          why_it_works: c.whyItWorks,
          crop: reframe,
          sort_index: index,
        })),
      );
    }

    const thumbPath = join(workDir, "source-thumb.jpg");
    try {
      await extractThumbnail(sourcePath, Math.min(1.2, Number(media.duration_seconds) * 0.15), thumbPath);
      const tdest = `jobs/${jobId}/source-thumb.jpg`;
      await uploadBytes(thumbPath, tdest, "image/jpeg");
      await patchJob(jobId, { source_thumbnail_path: tdest });
    } catch {
      /* thumbnail is optional at analysis time */
    }

    const want = desiredClipCount(options.clipCount, Number(media.duration_seconds || 0));
    await patchJob(jobId, {
      status: "selecting_moments",
      stage: "selecting_moments",
      progress: 82,
      progress_label: `Detected ${proposed.candidates.length} candidate moments`,
      moments_found: proposed.candidates.length,
      analysis_completed_at: new Date().toISOString(),
      cost: { ...cost, estimated_usd: estimateCost(cost) },
      error_message: proposed.candidates.length ? null : "No strong standalone moments were found. Try a longer talking-head or story video.",
    });
    await recordEvent(jobId, "clip_factory_analysis_completed", {
      moments_found: proposed.candidates.length,
      estimated_usd: estimateCost(cost),
    });

    const autoRender = job.auto_render !== false;
    if (!proposed.candidates.length) {
      await patchJob(jobId, { status: "failed", stage: "failed", failed_stage: "selecting_moments", error_code: "no_moments", lease_expires_at: null });
      return;
    }
    if (!autoRender) {
      await patchJob(jobId, { status: "ready", stage: "ready", progress: 100, lease_expires_at: null });
      return;
    }

    const { data: storedCandidates } = await service
      .from("clip_factory_candidates")
      .select("id")
      .eq("job_id", jobId)
      .eq("rejected", false)
      .order("overall_viral_score", { ascending: false })
      .limit(want);
    const renderIds = (storedCandidates || []).map((row) => row.id);
    await patchJob(jobId, {
      status: "rendering",
      stage: "rendering",
      progress: 86,
      progress_label: `Selecting top ${renderIds.length}...`,
    });
    for (const candidateId of renderIds) {
      const { data: existing } = await service
        .from("clip_factory_renders")
        .select("id,status")
        .eq("job_id", jobId)
        .eq("candidate_id", candidateId)
        .maybeSingle();
      if (!existing) {
        await service.from("clip_factory_renders").insert({
          job_id: jobId,
          candidate_id: candidateId,
          status: "queued",
          start_time: 0,
          end_time: 0,
          caption_style: options.captionStyle,
          ai_hook_enabled: options.aiHook,
        });
      }
    }
    for (let i = 0; i < renderIds.length; i += 1) {
      const candidateId = renderIds[i];
      await patchJob(jobId, {
        status: "rendering",
        stage: "rendering",
        progress: Math.min(95, 86 + Math.round(((i) / Math.max(1, renderIds.length)) * 10)),
        progress_label: `Rendering ${i + 1}/${renderIds.length}...`,
      });
      try {
        await renderClipFactoryCandidate({
          jobId,
          candidateId,
          captionStyle: options.captionStyle,
          aiHook: options.aiHook,
        });
      } catch {
        /* a single failed render must not destroy the job */
      }
    }
    const { count: completedCount } = await service
      .from("clip_factory_renders")
      .select("id", { count: "exact", head: true })
      .eq("job_id", jobId)
      .eq("status", "completed");
    const readyCount = completedCount || 0;
    await patchJob(jobId, {
      status: readyCount ? (readyCount === renderIds.length ? "completed" : "partial") : "partial",
      stage: readyCount ? "completed" : "failed",
      progress: 100,
      progress_label: readyCount ? `${readyCount} clips ready` : "Rendering failed",
      clips_generated: readyCount,
      lease_expires_at: null,
    });
  } catch (err) {
    const code = err instanceof IngestError ? err.code : "analysis_failed";
    const message = err instanceof Error ? err.message : String(err);
    await patchJob(jobId, {
      status: "failed",
      stage: "failed",
      failed_stage: "analysis",
      error_code: code,
      error_message: message.slice(0, 500),
      lease_expires_at: null,
    });
    await recordEvent(jobId, "clip_factory_analysis_failed", { code, message: message.slice(0, 400) });
    throw err;
  } finally {
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function renderClipFactoryCandidate(input: {
  jobId: string;
  candidateId: string;
  captionStyle?: CaptionStyle;
  aiHook?: boolean;
  startTime?: number;
  endTime?: number;
}): Promise<void> {
  const service = getServiceClient();
  const { data: job } = await service.from("clip_factory_jobs").select("*").eq("id", input.jobId).maybeSingle();
  const { data: candidate } = await service.from("clip_factory_candidates").select("*").eq("id", input.candidateId).maybeSingle();
  const { data: media } = await service.from("clip_factory_media").select("*").eq("id", job?.media_id).maybeSingle();
  if (!job || !candidate || !media) throw new Error("render_missing_records");

  const { data: existing } = await service
    .from("clip_factory_renders")
    .select("*")
    .eq("job_id", input.jobId)
    .eq("candidate_id", input.candidateId)
    .maybeSingle();
  if (existing?.status === "completed" && existing.storage_path) return;
  if (existing?.status === "rendering" && existing.updated_at && Date.now() - new Date(existing.updated_at).getTime() < 8 * 60 * 1000) {
    return;
  }

  const renderId = existing?.id || randomUUID();
  if (!existing) {
    await service.from("clip_factory_renders").insert({
      id: renderId,
      job_id: input.jobId,
      candidate_id: input.candidateId,
      status: "rendering",
      start_time: candidate.start_time,
      end_time: candidate.end_time,
      caption_style: input.captionStyle || job.options?.captionStyle || "auto",
      ai_hook_enabled: input.aiHook ?? job.options?.aiHook ?? true,
      crop: candidate.crop,
    });
  } else {
    await service.from("clip_factory_renders").update({ status: "rendering", error_message: null, updated_at: new Date().toISOString() }).eq("id", renderId);
  }

  await patchJob(input.jobId, { status: "rendering", stage: "rendering", progress: 88, progress_label: "Rendering vertical clip..." });
  await recordEvent(input.jobId, "clip_factory_render_started", { candidate_id: input.candidateId });

  const workDir = join(tmpdir(), `tdg-render-${renderId}`);
  await fs.mkdir(workDir, { recursive: true });
  const sourcePath = join(workDir, "source.mp4");
  const outPath = join(workDir, "clip.mp4");
  const thumbPath = join(workDir, "thumb.jpg");
  const assPath = join(workDir, "captions.ass");
  const started = Date.now();
  try {
    await downloadStorage(media.storage_path, sourcePath);
    const { data: transcriptRow } = await service
      .from("clip_factory_transcripts")
      .select("*")
      .eq("media_hash", media.media_hash)
      .maybeSingle();
    const transcript: Transcript = transcriptRow
      ? {
          language: transcriptRow.language,
          fullText: transcriptRow.full_text || "",
          words: transcriptRow.words || [],
          segments: transcriptRow.segments || [],
        }
      : { language: null, fullText: "", words: [], segments: [] };

    const start = input.startTime ?? Number(candidate.start_time);
    const end = input.endTime ?? Number(candidate.end_time);
    const duration = Math.max(1, end - start);
    const options = { ...DEFAULT_CLIP_FACTORY_OPTIONS, ...(job.options || {}) } as ClipFactoryOptions;
    const style = resolveCaptionStyle((input.captionStyle || options.captionStyle) as CaptionStyle, options.objective);
    const aiHook = input.aiHook ?? (options.objective === "viral" || options.objective === "auto" ? options.aiHook : options.aiHook);
    const ass = buildAssCaptions({
      transcript,
      start,
      end,
      style,
      hook: candidate.hook,
      hookEnabled: Boolean(aiHook && candidate.hook),
    });
    await fs.writeFile(assPath, ass, "utf8");

    const crop = candidate.crop || { mode: "center", keyframes: [] };
    const { ffmpegCropExpression } = await import("../../../src/features/clip-factory/reframe");
    const cropExpr = ffmpegCropExpression(crop, start, media.width, media.height);
    const filter = verticalFilter(crop.mode || "center", cropExpr);

    await patchJob(input.jobId, { status: "captioning", stage: "captioning", progress: 70, progress_label: "Adding captions" });
    await renderVerticalClip({
      source: sourcePath,
      output: outPath,
      start,
      duration,
      filter: `${filter},fps=30,format=yuv420p`,
      assPath,
      hasAudio: Boolean(media.has_audio),
    });
    await patchJob(input.jobId, { status: "saving", stage: "saving", progress: 86, progress_label: "Saving to Library" });
    const mid = Math.min(duration * 0.35, Math.max(0.2, duration / 2));
    await extractThumbnail(outPath, mid, thumbPath);

    const videoKey = `renders/${input.jobId}/${candidate.id}.mp4`;
    const thumbKey = `renders/${input.jobId}/${candidate.id}.jpg`;
    const videoBytes = await uploadBytes(outPath, videoKey, "video/mp4");
    await uploadBytes(thumbPath, thumbKey, "image/jpeg");
    const probe = await ffprobeFile(outPath);

    const filename = sanitizeFilename(`${candidate.title || "clip"}-${candidate.id.slice(0, 8)}.mp4`);
    const libraryInsert = await service
      .from("library_assets")
      .insert({
        title: candidate.title,
        description: candidate.suggested_post_caption || candidate.summary,
        src: signedPlaybackPath("render", renderId),
        filename,
        category: "clip_factory",
        kind: "reel",
        duration_seconds: probe.duration,
        width: 1080,
        height: 1920,
        poster_src: signedPlaybackPath("thumb", renderId),
        storage_bucket: BUCKET,
        storage_path: videoKey,
        thumbnail_path: thumbKey,
        provenance: {
          source_asset: media.library_asset_id || media.source_label,
          source_url: media.source_url,
          source_timestamps: { start, end },
          clip_factory_job: input.jobId,
          candidate_id: candidate.id,
          generated_at: new Date().toISOString(),
          ai_score: candidate.overall_viral_score,
          caption: candidate.suggested_post_caption,
          hashtags: candidate.hashtags,
          platform_recommendations: candidate.suggested_platforms,
          hook: candidate.hook,
          category: candidate.category,
          explanation: candidate.reason,
        },
      })
      .select("id")
      .single();
    if (libraryInsert.error) throw libraryInsert.error;

    await service
      .from("clip_factory_renders")
      .update({
        status: "completed",
        library_asset_id: libraryInsert.data.id,
        storage_bucket: BUCKET,
        storage_path: videoKey,
        thumbnail_path: thumbKey,
        width: 1080,
        height: 1920,
        duration_seconds: probe.duration,
        file_size_bytes: videoBytes,
        start_time: start,
        end_time: end,
        updated_at: new Date().toISOString(),
      })
      .eq("id", renderId);

    const { count } = await service
      .from("clip_factory_renders")
      .select("id", { count: "exact", head: true })
      .eq("job_id", input.jobId)
      .eq("status", "completed");
    const { count: pending } = await service
      .from("clip_factory_renders")
      .select("id", { count: "exact", head: true })
      .eq("job_id", input.jobId)
      .in("status", ["queued", "rendering"]);
    const generated = count || 1;
    const cost = { ...(job.cost || {}), render_ms: Date.now() - started, storage_bytes: ((job.cost || {}).storage_bytes || 0) + videoBytes };
    cost.estimated_usd = estimateCost(cost);
    const done = !pending;
    await patchJob(input.jobId, {
      clips_generated: generated,
      status: done ? "completed" : "rendering",
      stage: done ? "completed" : "rendering",
      progress: done ? 100 : Math.min(95, 70 + generated * 5),
      progress_label: done ? `${generated} clips ready` : `Rendering ${generated} ready...`,
      cost,
      lease_expires_at: done ? null : undefined,
    });
    await recordEvent(input.jobId, "clip_factory_render_completed", { render_id: renderId, library_asset_id: libraryInsert.data.id });
    await recordEvent(input.jobId, "clip_factory_saved_to_library", { library_asset_id: libraryInsert.data.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await service
      .from("clip_factory_renders")
      .update({ status: "failed", error_message: message.slice(0, 500), updated_at: new Date().toISOString() })
      .eq("id", renderId);
    await patchJob(input.jobId, {
      status: "partial",
      stage: "rendering",
      failed_stage: "render",
      error_code: "render_failure",
      error_message: message.slice(0, 500),
      lease_expires_at: null,
    });
    await recordEvent(input.jobId, "clip_factory_render_failed", { candidate_id: input.candidateId, message: message.slice(0, 400) });
    throw err;
  } finally {
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function tickClipFactory(workerId = "origin"): Promise<{ claimed: number }> {
  if (running) return { claimed: 0 };
  running = true;
  try {
    const service = getServiceClient();
    const { data, error } = await service.rpc("claim_clip_factory_jobs", {
      p_limit: 1,
      p_worker_id: workerId,
      p_now: new Date().toISOString(),
    });
    if (error) {
      log("claim_failed", { message: error.message });
      return { claimed: 0 };
    }
    const jobs = Array.isArray(data) ? data : data ? [data] : [];
    for (const job of jobs) {
      const pendingRender = await service
        .from("clip_factory_renders")
        .select("id,candidate_id,job_id,status")
        .eq("job_id", job.id)
        .in("status", ["queued", "rendering"])
        .limit(1)
        .maybeSingle();
      try {
        if (pendingRender.data && (job.status === "rendering" || pendingRender.data.status === "queued" || pendingRender.data.status === "rendering")) {
          await renderClipFactoryCandidate({ jobId: job.id, candidateId: pendingRender.data.candidate_id });
        } else if (job.status !== "ready" && job.status !== "completed" && job.status !== "partial" && job.status !== "failed") {
          await processClipFactoryJob(job.id);
        }
      } catch (err) {
        log("job_error", { job_id: job.id, message: err instanceof Error ? err.message : String(err) });
      }
    }
    return { claimed: jobs.length };
  } finally {
    running = false;
  }
}

export function kickClipFactoryWorker() {
  setTimeout(() => {
    void tickClipFactory("origin-kick").then((result) => {
      if (result.claimed > 0) kickClipFactoryWorker();
    });
  }, 50);
}
