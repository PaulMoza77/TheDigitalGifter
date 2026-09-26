import { createHash } from "node:crypto";
import { createWriteStream, existsSync } from "node:fs";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import { get } from "node:https";
import { get as httpGet } from "node:http";
import { ffprobeFile } from "../clip-factory/ffmpeg";
import { resolveMediaPath } from "../clip-factory/vpsMedia";
import { persistObjectToVps } from "../long-form-studio/storage";
import { getServiceClient } from "../christmas/supabaseClient";
import { LIBRARY_VIDEOS } from "../../../src/features/admin-library/catalog";
import { analyzeContent } from "./contentAnalysis";
import { selectMusicTrack } from "./musicSelection";
import { buildPlatformMetadata } from "./metadata";
import { evaluateReadiness } from "./readinessGate";
import { mixReelWithMusic } from "./mixAudio";
import type { AutopilotMusicTrack, LibraryAssetRow } from "./types";

function asString(value: unknown): string {
  return String(value ?? "").trim();
}

function publicAssetPath(src: string): string | null {
  const clean = src.split("?")[0] || src;
  if (!clean.startsWith("/assets/")) return null;
  return resolve(process.cwd(), "public", clean.slice(1));
}

async function downloadUrl(url: string, dest: string): Promise<void> {
  await new Promise<void>((resolvePromise, reject) => {
    const lib = url.startsWith("https:") ? get : httpGet;
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

async function resolveSourceVideo(asset: LibraryAssetRow, dir: string): Promise<string> {
  if (asset.source_video_path) {
    try {
      const abs = resolveMediaPath(asset.source_video_path);
      if (existsSync(abs)) return abs;
    } catch {
      /* fall through */
    }
  }
  if (asset.storage_path) {
    try {
      const abs = resolveMediaPath(asset.storage_path);
      if (existsSync(abs)) return abs;
    } catch {
      /* fall through */
    }
  }
  const localPublic = publicAssetPath(asset.src);
  if (localPublic && existsSync(localPublic)) return localPublic;
  const dest = join(dir, "source.mp4");
  const base = asString(process.env.TDG_PUBLIC_ORIGIN || process.env.VITE_APP_URL || "https://www.thedigitalgifter.com").replace(
    /\/$/,
    "",
  );
  const url = asset.src.startsWith("http") ? asset.src : `${base}${asset.src.startsWith("/") ? asset.src : `/${asset.src}`}`;
  await downloadUrl(url, dest);
  return dest;
}

function resolveMusicFile(track: AutopilotMusicTrack): string {
  const candidates: string[] = [];
  if (track.filename) {
    candidates.push(resolve(process.cwd(), "dist/assets/music/christmas", track.filename));
    candidates.push(resolve(process.cwd(), "public/assets/music/christmas", track.filename));
  }
  if (track.publicSrc?.startsWith("/")) candidates.push(resolve(process.cwd(), "public", track.publicSrc.replace(/^\//, "")));
  if (track.storagePath) {
    try {
      candidates.push(resolveMediaPath(track.storagePath.replace(/^vps\//, "")));
    } catch {
      /* ignore */
    }
  }
  const found = candidates.find((path) => existsSync(path));
  if (!found) throw new Error(`music_file_missing:${track.id}`);
  return found;
}

export function mapMusicRow(row: Record<string, unknown>): AutopilotMusicTrack {
  return {
    id: String(row.id),
    title: String(row.title || ""),
    artistSource: String(row.artist_source || ""),
    mood: String(row.mood || ""),
    tags: (row.tags as string[]) || [],
    storagePath: row.storage_path ? String(row.storage_path) : null,
    publicSrc: row.public_src ? String(row.public_src) : null,
    filename: row.filename ? String(row.filename) : null,
    durationSeconds: Number(row.duration_seconds || 0),
    approvedForAutopilot: Boolean(row.approved_for_autopilot),
    commercialUseAllowed: row.commercial_use_allowed == null ? null : Boolean(row.commercial_use_allowed),
    instagramAllowed: Boolean(row.instagram_allowed),
    facebookAllowed: Boolean(row.facebook_allowed),
    youtubeAllowed: Boolean(row.youtube_allowed),
    lastUsedAt: row.last_used_at ? String(row.last_used_at) : null,
    licenseType: String(row.license_type || ""),
    licenseUrl: row.license_url ? String(row.license_url) : null,
    sourceUrl: row.source_url ? String(row.source_url) : null,
  };
}

export async function listAutopilotMusic(): Promise<AutopilotMusicTrack[]> {
  const service = getServiceClient();
  const { data, error } = await service
    .from("music_tracks")
    .select("*")
    .eq("approved_for_autopilot", true)
    .eq("demo", false)
    .order("last_used_at", { ascending: true, nullsFirst: true });
  if (error) throw error;
  return (data || []).map((row) => mapMusicRow(row as Record<string, unknown>));
}

export async function listAllMusic(): Promise<AutopilotMusicTrack[]> {
  const service = getServiceClient();
  const { data, error } = await service.from("music_tracks").select("*").order("created_at", { ascending: false }).limit(200);
  if (error) throw error;
  return (data || []).map((row) => mapMusicRow(row as Record<string, unknown>));
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function resolveLibraryAssetId(libraryAssetIdOrCatalogId: string): Promise<string> {
  if (isUuid(libraryAssetIdOrCatalogId)) return libraryAssetIdOrCatalogId;
  const video = LIBRARY_VIDEOS.find((item) => item.id === libraryAssetIdOrCatalogId);
  if (!video) throw Object.assign(new Error("Asset not found."), { status: 404 });
  const service = getServiceClient();
  const { data: existing } = await service
    .from("library_assets")
    .select("id")
    .eq("provenance->>catalog_id", video.id)
    .maybeSingle();
  if (existing?.id) return String(existing.id);
  const inserted = await service
    .from("library_assets")
    .insert({
      title: video.title,
      description: video.description || "",
      src: video.src,
      filename: video.filename,
      category: video.category,
      kind: video.kind,
      duration_seconds: video.durationSeconds ?? null,
      width: video.width ?? null,
      height: video.height ?? null,
      poster_src: video.poster || null,
      provenance: { catalog_id: video.id, source: "tdg_library_catalog" },
      publish_status: "pending_finish",
      publisher_eligible: false,
    })
    .select("id")
    .single();
  if (inserted.error) throw inserted.error;
  return String(inserted.data.id);
}

export async function enqueueFinishJob(libraryAssetId: string): Promise<{ jobId: string; libraryAssetId: string }> {
  const service = getServiceClient();
  const resolvedId = await resolveLibraryAssetId(libraryAssetId);
  const { data: asset, error: assetError } = await service.from("library_assets").select("id,publish_status").eq("id", resolvedId).maybeSingle();
  if (assetError) throw assetError;
  if (!asset) throw Object.assign(new Error("Asset not found."), { status: 404 });
  if (asset.publish_status === "ready_to_publish") {
    throw Object.assign(new Error("Asset is already ready to publish."), { status: 409 });
  }
  await service
    .from("library_assets")
    .update({ publish_status: "pending_finish", finish_error: null, updated_at: new Date().toISOString() })
    .eq("id", resolvedId);
  const { data: job, error } = await service
    .from("library_reel_finish_jobs")
    .upsert(
      { library_asset_id: resolvedId, status: "queued", last_error: null, updated_at: new Date().toISOString() },
      { onConflict: "library_asset_id" },
    )
    .select("id")
    .single();
  if (error) throw error;
  return { jobId: String(job.id), libraryAssetId: resolvedId };
}

async function recentTrackIds(service: ReturnType<typeof getServiceClient>): Promise<string[]> {
  const { data } = await service
    .from("library_assets")
    .select("music_track_id")
    .eq("publish_status", "ready_to_publish")
    .not("music_track_id", "is", null)
    .order("updated_at", { ascending: false })
    .limit(12);
  return (data || []).map((row) => String(row.music_track_id)).filter(Boolean);
}

export async function processFinishJob(jobId: string, workerId: string): Promise<{ ok: boolean; assetId?: string; error?: string }> {
  const service = getServiceClient();
  const { data: job, error: jobError } = await service.from("library_reel_finish_jobs").select("*").eq("id", jobId).maybeSingle();
  if (jobError) throw jobError;
  if (!job) return { ok: false, error: "job_missing" };

  const assetId = String(job.library_asset_id);
  const { data: assetRow, error: assetError } = await service.from("library_assets").select("*").eq("id", assetId).maybeSingle();
  if (assetError) throw assetError;
  if (!assetRow) return { ok: false, error: "asset_missing" };
  const asset = assetRow as LibraryAssetRow;

  const dir = await mkdtemp(join(tmpdir(), "tdg-reel-finish-"));
  let audioRenderOk = false;
  try {
    await service.from("library_assets").update({ publish_status: "processing", finish_error: null }).eq("id", assetId);
    const sourcePath = await resolveSourceVideo(asset, dir);
    if (!asset.source_video_path) {
      await service.from("library_assets").update({ source_video_path: asset.storage_path || null }).eq("id", assetId);
    }
    const videoProbe = await ffprobeFile(sourcePath);
    const contentTags = analyzeContent({
      title: asset.title,
      description: asset.description,
      category: asset.category,
      tags: asset.content_tags?.length ? asset.content_tags : undefined,
      provenance: asset.provenance,
    });
    const tracks = await listAutopilotMusic();
    const recent = await recentTrackIds(service);
    const music = selectMusicTrack({ tracks, contentTags, recentTrackIds: recent });
    if (!music) throw new Error("no_approved_music");

    const musicPath = resolveMusicFile(music);
    const musicProbe = await ffprobeFile(musicPath);
    const outputPath = join(dir, "master.mp4");
    await mixReelWithMusic({
      videoPath: sourcePath,
      musicPath,
      outputPath,
      videoDurationSeconds: videoProbe.duration,
    });
    audioRenderOk = true;
    const finalProbe = await ffprobeFile(outputPath);
    const metadata = buildPlatformMetadata({ title: asset.title, contentTags });
    const readiness = evaluateReadiness({
      videoProbe,
      musicTrack: music,
      musicProbe,
      audioRenderOk,
      finalProbe,
      metadata,
    });
    if (!readiness.ok) throw new Error(readiness.errors.join(","));

    const objectPath = `reel-finish/${assetId}/master.mp4`;
    await persistObjectToVps(outputPath, objectPath);
    const stableSrc = `/api/christmas-reel-pipeline?action=media&id=${assetId}`;
    const now = new Date().toISOString();
    await service
      .from("library_assets")
      .update({
        publish_status: "ready_to_publish",
        music_track_id: music.id,
        content_tags: contentTags,
        platform_metadata: metadata,
        publish_checks: readiness.checks,
        src: stableSrc,
        storage_bucket: "vps",
        storage_path: objectPath,
        duration_seconds: finalProbe.duration,
        width: finalProbe.width,
        height: finalProbe.height,
        finish_error: null,
        publisher_eligible: true,
        publisher_tags: contentTags,
        updated_at: now,
      })
      .eq("id", assetId);
    await service.from("music_tracks").update({ last_used_at: now }).eq("id", music.id);
    await service
      .from("library_reel_finish_jobs")
      .update({ status: "completed", last_error: null, updated_at: now })
      .eq("id", jobId);
    console.log(JSON.stringify({ source: "christmas-reel-pipeline", event: "finish_completed", assetId, workerId, musicId: music.id }));
    return { ok: true, assetId };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await service
      .from("library_assets")
      .update({ publish_status: "failed", finish_error: message.slice(0, 500), updated_at: new Date().toISOString() })
      .eq("id", assetId);
    await service
      .from("library_reel_finish_jobs")
      .update({ status: "failed", last_error: message.slice(0, 500), updated_at: new Date().toISOString() })
      .eq("id", jobId);
    return { ok: false, assetId, error: message };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function tickReelFinishWorker(workerId: string, limit = 2): Promise<{ claimed: number; completed: number; failed: number }> {
  const service = getServiceClient();
  const { data: jobs, error } = await service.rpc("claim_library_reel_finish_jobs", {
    p_limit: limit,
    p_worker_id: workerId,
  });
  if (error) throw error;
  let completed = 0;
  let failed = 0;
  for (const job of jobs || []) {
    const result = await processFinishJob(String(job.id), workerId);
    if (result.ok) completed += 1;
    else failed += 1;
  }
  return { claimed: (jobs || []).length, completed, failed };
}

export function verifyTrackLicenseEvidence(licensePageText: string): boolean {
  return /CC0\s+1\.0\s+Universal/i.test(licensePageText);
}

export async function sha256File(path: string): Promise<string> {
  const hash = createHash("sha256");
  await pipeline((await import("node:fs")).createReadStream(path), hash);
  return hash.digest("hex");
}

export async function writeLicenseProof(trackId: string, body: string): Promise<string> {
  const proofPath = join(process.cwd(), "public/assets/music/christmas/proofs", `${trackId}.txt`);
  await mkdir(dirname(proofPath), { recursive: true });
  await writeFile(proofPath, body, "utf8");
  return `/assets/music/christmas/proofs/${trackId}.txt`;
}
