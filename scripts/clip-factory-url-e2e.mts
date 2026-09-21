import { createClient } from "@supabase/supabase-js";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { acquireSourceMedia } from "../api/_lib/clip-factory/acquire.ts";
import { processClipFactoryJob } from "../api/_lib/clip-factory/worker.ts";
import { extractYoutubeId } from "../src/features/clip-factory/ingest/adapters/youtube.ts";
import { classifyVideoUrl } from "../src/features/clip-factory/ingest/classify.ts";

const YT = "https://youtu.be/pV9UPP7n0Po?si=_O2KuMDc1OhkyAg_";
const AUTHORIZED = process.env.CLIP_FACTORY_E2E_URL || "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";

function requireEnv(name: string) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`missing ${name}`);
  return value;
}

async function youtubeProbe() {
  const classified = classifyVideoUrl(YT);
  const id = extractYoutubeId(YT);
  const oembed = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`);
  const meta = oembed.ok ? await oembed.json() : {};
  let acquireCode = "ok";
  let acquireMessage = "";
  const dest = join(await mkdtemp(join(tmpdir(), "yt-")), "source.mp4");
  try {
    await acquireSourceMedia({
      sourceKind: "youtube",
      sourcePayload: { url: `https://www.youtube.com/watch?v=${id}` },
      dest,
      downloadStorage: async () => undefined,
      resolveLibraryFile: () => null,
      copyFile: async () => undefined,
    });
  } catch (error) {
    acquireCode = (error as { code?: string }).code || "error";
    acquireMessage = error instanceof Error ? error.message : String(error);
  }
  await rm(dest, { force: true });
  return {
    classified,
    title: meta.title || null,
    thumbnail: meta.thumbnail_url || null,
    acquireCode,
    acquireMessage,
  };
}

async function authorizedJob() {
  const service = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const inserted = await service
    .from("clip_factory_jobs")
    .insert({
      created_by_email: "e2e@internal",
      status: "queued",
      stage: "queued",
      progress: 2,
      progress_label: "Queued",
      source_kind: "direct_media_url",
      source_payload: { url: AUTHORIZED, mediaUrl: AUTHORIZED, provider: "direct", importMode: "direct_download", ingestionCapability: "FULL_IMPORT" },
      source_label: "Authorized URL e2e",
      options: { clipCount: 10, duration: "auto", platform: "auto", objective: "auto", captionStyle: "auto", language: "en", aiHook: true },
      provider: "direct",
      rights_confirmed: true,
      auto_render: true,
    })
    .select("id")
    .single();
  if (inserted.error || !inserted.data) throw inserted.error || new Error("job insert failed");
  const jobId = inserted.data.id;
  try {
    await processClipFactoryJob(jobId);
  } catch (error) {
    const { data } = await service.from("clip_factory_jobs").select("status,error_code,error_message,media_id,clips_generated").eq("id", jobId).maybeSingle();
    return { jobId, processError: error instanceof Error ? error.message : String(error), job: data };
  }
  const { data: job } = await service
    .from("clip_factory_jobs")
    .select("id,status,error_code,error_message,media_id,clips_generated,moments_found,progress_label")
    .eq("id", jobId)
    .maybeSingle();
  const { data: renders } = await service
    .from("clip_factory_renders")
    .select("id,status,library_asset_id,storage_path,width,height,duration_seconds,file_size_bytes")
    .eq("job_id", jobId);
  const { data: transcript } = job?.media_id
    ? await service.from("clip_factory_media").select("id,source_kind,source_url,duration_seconds").eq("id", job.media_id).maybeSingle()
    : { data: null };
  const okRenders = (renders || []).filter((row) => row.status === "completed" && row.library_asset_id && (row.file_size_bytes || 0) > 0);
  const validVertical = okRenders.filter((row) => row.width === 1080 && row.height === 1920 && Number(row.duration_seconds || 0) > 0);
  return { jobId, job, renders, media: transcript, okRenders: okRenders.length, validVertical: validVertical.length };
}

const report = {
  youtube: await youtubeProbe(),
  authorized: await authorizedJob(),
};
console.log(JSON.stringify(report, null, 2));
if (!report.authorized.validVertical) {
  process.exitCode = 2;
}
