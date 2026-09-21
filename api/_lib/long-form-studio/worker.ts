import { mkdir, copyFile, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { LIBRARY_VIDEOS, isLibraryPhoto, type LibraryVideo } from "../../../src/features/admin-library/catalog";
import { generateDescription, generateThumbnailConcepts, generateTitleOptions } from "../../../src/features/long-form-studio/copy";
import { MOOD_LABELS, STAGE_LABELS, type MusicMood, type MusicTrack, type ProductionStatus, type StylePreset } from "../../../src/features/long-form-studio/types";
import { buildPlaylist } from "../../../src/features/long-form-studio/playlist";
import { validateProductionRights } from "../../../src/features/long-form-studio/rightsManifest";
import { checkProductionSimilarity } from "../../../src/features/long-form-studio/similarity";
import { ORIGINAL_MUSIC_SEED } from "../../../src/features/long-form-studio/seedMusic";
import { renderLongFormVideo, visualTreatmentId, type SceneInput } from "./render";
import { loadLocalState, saveLocalState, newId } from "./localState";
import { signedLongFormPath, stableMediaPath } from "./mediaSign";
import { ensureAllOriginalMusic } from "./originalMusic";
import { assertCreatePayload } from "./validateInput";
import {
  LONG_FORM_BUCKET,
  bucketHeadroom,
  hashFile,
  longFormLocalAllowed,
  signedStorageDownload,
  uploadObjectStreaming,
} from "./storage";
import { getServiceClient } from "../christmas/supabaseClient";
import type { VisualAssetRights } from "../../../src/features/long-form-studio/types";

let running = false;

export function sceneFromLibrary(id: string): LibraryVideo | undefined {
  return LIBRARY_VIDEOS.find((item) => item.id === id);
}

export function visualRightsFor(scene: LibraryVideo): VisualAssetRights {
  return {
    id: scene.id,
    title: scene.title,
    origin: "tdg_library",
    commercialUseAllowed: null,
    notes: "Library listing is a creation pointer, not a commercial-rights certificate.",
    creationRecord: {
      catalogId: scene.id,
      src: scene.src,
      model: scene.model || null,
      createdAt: scene.createdAt || null,
      tags: scene.tags || [],
    },
  };
}

function serviceOrThrow() {
  return getServiceClient();
}

function serviceIfConfigured() {
  try {
    return getServiceClient();
  } catch (error) {
    if (longFormLocalAllowed()) return null;
    throw error;
  }
}

export function rowToTrack(row: Record<string, unknown>): MusicTrack {
  return {
    id: String(row.id),
    title: String(row.title || ""),
    artistSource: String(row.artist_source || ""),
    durationSeconds: Number(row.duration_seconds || 0),
    genre: String(row.genre || ""),
    mood: String(row.mood || ""),
    source: row.source as MusicTrack["source"],
    licenseType: String(row.license_type || ""),
    commercialUseAllowed: row.commercial_use_allowed == null ? null : Boolean(row.commercial_use_allowed),
    youtubeMonetizationAllowed: (row.youtube_monetization_allowed as MusicTrack["youtubeMonetizationAllowed"]) || "unknown",
    attributionRequired: Boolean(row.attribution_required),
    attributionText: String(row.attribution_text || ""),
    licenseUrl: row.license_url ? String(row.license_url) : null,
    acquisitionDate: row.acquisition_date ? String(row.acquisition_date) : null,
    proofStoragePath: row.proof_storage_path ? String(row.proof_storage_path) : null,
    internalNotes: String(row.internal_notes || ""),
    publicSrc: row.public_src ? String(row.public_src) : null,
    filename: row.filename ? String(row.filename) : null,
    storagePath: row.storage_path ? String(row.storage_path) : null,
    storageBucket: row.storage_bucket ? String(row.storage_bucket) : null,
    compositionRights: (row.composition_rights as MusicTrack["compositionRights"]) || "unknown",
    recordingRights: (row.recording_rights as MusicTrack["recordingRights"]) || "unknown",
    rightsComplete: Boolean(row.rights_complete),
    demo: Boolean(row.demo),
    proofAccessible: Boolean(row.proof_accessible),
    fileSha256: row.file_sha256 ? String(row.file_sha256) : null,
    creationRecord: (row.creation_record as Record<string, unknown>) || {},
    editorialStatus: String(row.editorial_status || "unreviewed"),
  };
}

export async function loadMusic(): Promise<MusicTrack[]> {
  const service = serviceIfConfigured();
  if (service) {
    const { data, error } = await service.from("music_tracks").select("*").order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const rows = (data || []).map(rowToTrack);
    const imported = rows.filter((t) => !t.demo);
    const demos = rows.filter((t) => t.demo);
    return [...imported, ...(demos.length ? demos : ORIGINAL_MUSIC_SEED)];
  }
  const local = await loadLocalState();
  const imported = local.music.filter((t) => !t.demo && t.source === "youtube_audio_library");
  return [...imported, ...ORIGINAL_MUSIC_SEED];
}

export type CreateProductionInput = {
  sceneIds: string[];
  mood: string;
  style: StylePreset;
  durationSeconds: number;
  shuffle?: boolean;
  seed?: number;
  createdBy?: string;
};

function preparePlan(input: CreateProductionInput, music: MusicTrack[], existing: Parameters<typeof checkProductionSimilarity>[1]) {
  const scenes = input.sceneIds.map((id) => {
    const item = sceneFromLibrary(id);
    if (!item) throw new Error(`Scene ${id} is not in the Library.`);
    return item;
  });
  const playlist = buildPlaylist({
    tracks: music,
    mood: input.mood,
    targetSeconds: input.durationSeconds,
    shuffle: input.shuffle !== false,
    seed: input.seed ?? Date.now() % 1_000_000,
    includeDemo: true,
  });
  if (!playlist.entries.length) {
    throw new Error("No music for this mood. Import a YouTube Audio Library track or use a demo pad for a technical test.");
  }
  const usedTracks = playlist.selected;
  const rights = validateProductionRights({
    visuals: scenes.map(visualRightsFor),
    tracks: usedTracks,
  });
  const sceneTitle = scenes[0]?.title || "Christmas ambience";
  const titles = generateTitleOptions({
    sceneTitle,
    style: input.style,
    moodLabel: MOOD_LABELS[input.mood as MusicMood] || input.mood,
  });
  const description = generateDescription({
    sceneTitle,
    style: input.style,
    mood: input.mood,
    durationSeconds: input.durationSeconds,
    tracks: usedTracks,
  });
  const thumbs = generateThumbnailConcepts(sceneTitle);
  const treatment = visualTreatmentId(input.style, input.sceneIds);
  const similarity = checkProductionSimilarity(
    {
      sceneIds: input.sceneIds,
      sceneSequence: input.sceneIds,
      musicTrackIds: usedTracks.map((t) => t.id),
      playlistOrder: playlist.entries.map((e) => e.trackId),
      visualTreatment: treatment,
      stylePreset: input.style,
      durationSeconds: input.durationSeconds,
      title: titles[0]!,
      thumbnailConceptId: thumbs[0]?.id,
    },
    existing,
  );
  return { scenes, playlist, usedTracks, rights, titles, description, thumbs, treatment, similarity };
}

export async function queueProduction(input: CreateProductionInput) {
  const parsed = assertCreatePayload(input);
  const music = await loadMusic();
  const existing = await loadExistingFingerprints();
  const plan = preparePlan({ ...input, ...parsed }, music, existing);
  const productionId = newId();
  const jobId = newId();
  const production: Record<string, unknown> = {
    id: productionId,
    status: "queued",
    theme: "christmas",
    style_preset: parsed.style,
    duration_seconds: parsed.durationSeconds,
    scene_ids: parsed.sceneIds,
    scene_sequence: parsed.sceneIds,
    music_track_ids: plan.usedTracks.map((t) => t.id),
    playlist: plan.playlist.entries,
    visual_treatment: plan.treatment,
    title_suggestions: plan.titles,
    description: plan.description,
    thumbnail_concepts: plan.thumbs,
    rights_manifest: plan.rights.manifest,
    similarity: plan.similarity,
    soundtrack_kind: plan.playlist.usedDemo ? "demo" : "imported",
    rights_status: plan.rights.ok ? "rights_documented" : "rights_review_required",
    editorial_status: "unreviewed",
    persist_confirmed: false,
    mood: parsed.mood,
    created_at: new Date().toISOString(),
    job_id: jobId,
    progress: 0,
    stage: "queued",
    progress_label: "Waiting to start",
    created_by: input.createdBy || null,
  };
  await persistProduction(production, { requireRemote: !longFormLocalAllowed() });
  await persistJob({
    id: jobId,
    production_id: productionId,
    status: "queued",
    stage: "queued",
    progress: 0,
    payload: { ...parsed, shuffle: input.shuffle !== false, seed: input.seed || 1 },
    attempt_count: 0,
    max_attempts: 3,
  });
  return { production, jobId, rights: plan.rights, similarity: plan.similarity };
}

export async function createAndRenderProduction(
  input: CreateProductionInput,
  options?: { skipRender?: boolean; workDir?: string; productionId?: string },
) {
  if (options?.skipRender && !options.productionId) {
    return queueProduction(input);
  }
  if (options?.productionId) {
    return processProductionById(options.productionId, options.workDir);
  }
  const queued = await queueProduction(input);
  return processProductionById(String(queued.production.id), options?.workDir);
}

export async function processProductionById(productionId: string, workDir?: string) {
  const production = await getProduction(productionId);
  if (!production) throw new Error("Production not found.");
  const jobId = String(production.job_id || newId());
  const parsed = assertCreatePayload({
    sceneIds: (production.scene_ids as string[]) || [],
    mood: String(production.mood || "cozy_instrumental"),
    style: String(production.style_preset),
    durationSeconds: Number(production.duration_seconds),
  });
  const music = await loadMusic();
  const existing = (await loadExistingFingerprints()).filter((item) => item.id !== productionId);
  const plan2 = preparePlan(
    {
      sceneIds: parsed.sceneIds,
      mood: parsed.mood,
      style: parsed.style,
      durationSeconds: parsed.durationSeconds,
      shuffle: true,
      seed: Number((production as { seed?: number }).seed || 7),
    },
    music,
    existing,
  );

  production.status = "rendering";
  production.progress_label = STAGE_LABELS.preparing_scene;
  production.stage = "preparing_scene";
  await persistProduction(production, { requireRemote: !longFormLocalAllowed() });

  const dir = workDir || join(process.env.LONG_FORM_WORK_DIR || "/tmp/tdg-long-form", productionId);
  await mkdir(dir, { recursive: true });
  const heartbeat = setInterval(() => {
    void heartbeatJob(jobId).catch(() => undefined);
  }, 60_000);

  try {
    await bucketHeadroom(parsed.durationSeconds >= 3600 ? 2_000_000_000 : 80_000_000);
    const sceneInputs: SceneInput[] = plan2.scenes.map((s) => ({
      id: s.id,
      title: s.title,
      src: s.src,
      kind: s.kind,
      filename: s.filename,
    }));
    const rendered = await renderLongFormVideo({
      workDir: dir,
      scenes: sceneInputs,
      tracks: plan2.usedTracks,
      playlist: plan2.playlist.entries,
      durationSeconds: parsed.durationSeconds,
      style: parsed.style,
      onProgress: async (stage, progress, label) => {
        production.stage = stage;
        production.progress = progress;
        production.progress_label = label;
        production.status = "rendering";
        await persistProduction(production, { requireRemote: !longFormLocalAllowed() });
        await patchJob(jobId, { stage, progress, progress_label: label, status: "rendering" });
      },
    });

    const filename = `final.mp4`;
    const videoKey = `productions/${productionId}/${filename}`;
    const thumbKey = `productions/${productionId}/thumb.jpg`;
    const localAllowed = longFormLocalAllowed();
    const service = serviceIfConfigured();

    let libraryAsset: { id: string; src: string; poster: string; storagePath: string };
    if (service) {
      const videoStat = await stat(rendered.outputPath);
      await bucketHeadroom(videoStat.size);
      const uploaded = await uploadObjectStreaming({
        localPath: rendered.outputPath,
        objectPath: videoKey,
        contentType: "video/mp4",
      });
      await uploadObjectStreaming({
        localPath: rendered.thumbnailPath,
        objectPath: thumbKey,
        contentType: "image/jpeg",
      });
      libraryAsset = await saveLibraryRow({
        productionId,
        title: plan2.titles[0]!,
        description: plan2.description,
        filename: `${productionId}.mp4`,
        videoKey,
        thumbKey,
        bytes: uploaded.bytes,
        probe: rendered.probe,
        sceneIds: parsed.sceneIds,
        musicTrackIds: plan2.usedTracks.map((t) => t.id),
        rightsManifest: plan2.rights.manifest,
        titles: plan2.titles,
        durationSeconds: parsed.durationSeconds,
        style: parsed.style,
        demo: plan2.playlist.usedDemo,
      });
      production.file_size_bytes = uploaded.bytes;
      production.persist_confirmed = true;
    } else if (localAllowed) {
      const destDir = join(process.cwd(), "output/long-form/productions");
      await mkdir(destDir, { recursive: true });
      const destVideo = join(destDir, `${productionId}.mp4`);
      const destThumb = join(destDir, `${productionId}.jpg`);
      await copyFile(rendered.outputPath, destVideo);
      await copyFile(rendered.thumbnailPath, destThumb);
      libraryAsset = {
        id: productionId,
        src: signedSafe("video", productionId),
        poster: signedSafe("thumb", productionId),
        storagePath: destVideo,
      };
      production.persist_confirmed = true;
      production.storage_bucket = "local";
    } else {
      throw new Error("Storage is not configured. The video was not saved.");
    }

    const savedStatus: ProductionStatus = plan2.playlist.usedDemo
      ? "demo"
      : plan2.rights.ok
        ? "saved"
        : "rights_review_required";
    if (plan2.similarity.tooSimilar && savedStatus !== "demo") {
      production.status = "similarity_review_required";
    } else {
      production.status = savedStatus;
    }
    production.progress = 100;
    production.stage = "saving_to_library";
    production.progress_label = STAGE_LABELS.saving_to_library;
    production.library_asset_id = libraryAsset.id;
    production.storage_bucket = service ? LONG_FORM_BUCKET : production.storage_bucket;
    production.storage_path = videoKey;
    production.thumbnail_path = thumbKey;
    production.probe = rendered.probe;
    production.width = rendered.probe.width;
    production.height = rendered.probe.height;
    production.src = libraryAsset.src;
    production.poster = libraryAsset.poster;
    production.playback_url = signedSafe("video", productionId);
    production.rights_manifest = plan2.rights.manifest;
    production.similarity = plan2.similarity;
    production.soundtrack_kind = plan2.playlist.usedDemo ? "demo" : "imported";
    production.rights_status = plan2.rights.ok ? "rights_documented" : "rights_review_required";
    await persistProduction(production, { requireRemote: !longFormLocalAllowed() });
    await patchJob(jobId, { status: "completed", progress: 100, progress_label: "Saved to Library", stage: "saving_to_library" });
    if (!workDir) await rm(dir, { recursive: true, force: true }).catch(() => undefined);
    return { production, jobId, rights: plan2.rights, similarity: plan2.similarity, libraryAsset, rendered };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    production.status = message.toLowerCase().includes("storage") || message.toLowerCase().includes("library") ? "persist_failed" : "failed";
    production.error_message = message.slice(0, 400);
    production.persist_confirmed = false;
    await persistProduction(production, { requireRemote: false }).catch(() => undefined);
    await patchJob(jobId, { status: "failed", error_message: message.slice(0, 400) }).catch(() => undefined);
    throw error;
  } finally {
    clearInterval(heartbeat);
  }
}

async function saveLibraryRow(input: {
  productionId: string;
  title: string;
  description: string;
  filename: string;
  videoKey: string;
  thumbKey: string;
  bytes: number;
  probe: { duration: number; width: number; height: number; fileSize: number | null };
  sceneIds: string[];
  musicTrackIds: string[];
  rightsManifest: unknown;
  titles: string[];
  durationSeconds: number;
  style: StylePreset;
  demo: boolean;
}) {
  const service = serviceOrThrow();
  const existing = await service
    .from("library_assets")
    .select("id")
    .eq("storage_path", input.videoKey)
    .maybeSingle();
  if (existing.error) throw new Error(existing.error.message);
  const src = stableMediaPath("video", input.productionId);
  const poster = stableMediaPath("thumb", input.productionId);
  const row = {
    title: input.title,
    description: input.description,
    src,
    filename: input.filename,
    category: "long_form",
    kind: "long_form",
    duration_seconds: input.probe.duration,
    width: input.probe.width,
    height: input.probe.height,
    poster_src: poster,
    storage_bucket: LONG_FORM_BUCKET,
    storage_path: input.videoKey,
    thumbnail_path: input.thumbKey,
    provenance: {
      type: "long_form",
      theme: "christmas",
      duration: input.durationSeconds,
      scene_ids: input.sceneIds,
      music_track_ids: input.musicTrackIds,
      rights_manifest: input.rightsManifest,
      title_suggestions: input.titles,
      production_id: input.productionId,
      created_date: new Date().toISOString(),
      style: input.style,
      demo_soundtrack: input.demo,
      file_size_bytes: input.bytes,
    },
  };
  if (existing.data?.id) {
    const upd = await service.from("library_assets").update(row).eq("id", existing.data.id).select("id").single();
    if (upd.error) throw new Error(upd.error.message);
    return { id: upd.data.id, src, poster, storagePath: input.videoKey };
  }
  const insert = await service.from("library_assets").insert(row).select("id").single();
  if (insert.error || !insert.data) throw new Error(insert.error?.message || "Library save failed.");
  return { id: insert.data.id, src, poster, storagePath: input.videoKey };
}

async function persistProduction(production: Record<string, unknown>, opts: { requireRemote: boolean }) {
  const local = await loadLocalState();
  const idx = local.productions.findIndex((p) => p.id === production.id);
  if (idx >= 0) local.productions[idx] = production;
  else local.productions.unshift(production);
  if (longFormLocalAllowed()) await saveLocalState(local);
  const service = serviceIfConfigured();
  if (!service) {
    if (opts.requireRemote) throw new Error("Database is not configured.");
    return;
  }
  const { error } = await service.from("long_form_productions").upsert({
    id: production.id,
    status: production.status,
    theme: production.theme,
    style_preset: production.style_preset,
    duration_seconds: production.duration_seconds,
    scene_ids: production.scene_ids,
    scene_sequence: production.scene_sequence,
    music_track_ids: production.music_track_ids,
    playlist: production.playlist,
    visual_treatment: production.visual_treatment,
    title_suggestions: production.title_suggestions,
    description: production.description,
    thumbnail_concepts: production.thumbnail_concepts,
    thumbnail_path: production.thumbnail_path,
    rights_manifest: production.rights_manifest,
    similarity: production.similarity,
    library_asset_id: production.library_asset_id || null,
    storage_bucket: production.storage_bucket || null,
    storage_path: production.storage_path || null,
    width: production.width,
    height: production.height,
    probe: production.probe,
    job_id: production.job_id,
    persist_confirmed: Boolean(production.persist_confirmed),
    file_size_bytes: production.file_size_bytes || null,
    soundtrack_kind: production.soundtrack_kind || "unknown",
    rights_status: production.rights_status || "rights_review_required",
    editorial_status: production.editorial_status || "unreviewed",
    mood: production.mood || "cozy_instrumental",
    error_message: production.error_message || null,
    progress: production.progress || 0,
    stage: production.stage,
    progress_label: production.progress_label,
    created_by: production.created_by || null,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}

async function persistJob(job: Record<string, unknown>) {
  if (longFormLocalAllowed()) {
    const local = await loadLocalState();
    const idx = local.jobs.findIndex((row) => row.id === job.id);
    if (idx >= 0) local.jobs[idx] = { ...local.jobs[idx], ...job };
    else local.jobs.unshift(job);
    await saveLocalState(local);
  }
  const service = serviceIfConfigured();
  if (!service) {
    if (!longFormLocalAllowed()) throw new Error("Database is not configured.");
    return;
  }
  const { error } = await service.from("long_form_jobs").upsert({
    id: job.id,
    production_id: job.production_id,
    status: job.status,
    stage: job.stage,
    progress: job.progress || 0,
    progress_label: job.progress_label || null,
    error_message: job.error_message || null,
    payload: job.payload || {},
    attempt_count: job.attempt_count || 0,
    max_attempts: job.max_attempts || 3,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}

async function patchJob(id: string, patch: Record<string, unknown>) {
  await persistJob({ id, ...patch });
}

async function heartbeatJob(id: string) {
  const service = serviceIfConfigured();
  if (!service) return;
  const { error } = await service
    .from("long_form_jobs")
    .update({
      heartbeat_at: new Date().toISOString(),
      lease_expires_at: new Date(Date.now() + 20 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function getProduction(id: string): Promise<Record<string, unknown> | null> {
  const service = serviceIfConfigured();
  if (service) {
    const { data, error } = await service.from("long_form_productions").select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(error.message);
    if (data) return decorateProduction(data as Record<string, unknown>);
  }
  const local = await loadLocalState();
  const row = local.productions.find((p) => p.id === id);
  return row ? decorateProduction(row) : null;
}

function decorateProduction(row: Record<string, unknown>) {
  const id = String(row.id);
  if (row.persist_confirmed && row.storage_path) {
    try {
      row.playback_url = signedLongFormPath("video", id);
      row.poster = signedLongFormPath("thumb", id);
      row.src = row.playback_url;
    } catch {
      row.playback_url = stableMediaPath("video", id);
      row.src = row.playback_url;
    }
  }
  return row;
}

async function loadExistingFingerprints() {
  const service = serviceIfConfigured();
  if (service) {
    const { data, error } = await service
      .from("long_form_productions")
      .select("id,title_suggestions,scene_ids,scene_sequence,music_track_ids,playlist,visual_treatment,style_preset,duration_seconds,thumbnail_concepts,status")
      .in("status", ["saved", "demo", "rights_review_required", "similarity_review_required"]);
    if (error) throw new Error(error.message);
    return (data || []).map(fingerprintFromRow);
  }
  const local = await loadLocalState();
  return local.productions.map(fingerprintFromRow);
}

function fingerprintFromRow(p: Record<string, unknown>) {
  return {
    id: String(p.id),
    title: String((p.title_suggestions as string[] | undefined)?.[0] || "Untitled"),
    config: {
      sceneIds: (p.scene_ids as string[]) || [],
      sceneSequence: (p.scene_sequence as string[]) || [],
      musicTrackIds: (p.music_track_ids as string[]) || [],
      playlistOrder: ((p.playlist as Array<{ trackId: string }>) || []).map((e) => e.trackId),
      visualTreatment: String(p.visual_treatment || ""),
      stylePreset: (p.style_preset as StylePreset) || "cozy",
      durationSeconds: Number(p.duration_seconds || 0),
      title: String((p.title_suggestions as string[] | undefined)?.[0] || ""),
      thumbnailConceptId: (p.thumbnail_concepts as Array<{ id: string }> | undefined)?.[0]?.id,
    },
  };
}

export async function listStudioBootstrap() {
  const music = (await loadMusic()).map((track) => ({
    ...track,
    publicSrc: track.publicSrc || signedSafe("audio", track.id),
  }));
  const service = serviceIfConfigured();
  let productions: Record<string, unknown>[] = [];
  if (service) {
    const { data, error } = await service.from("long_form_productions").select("*").order("created_at", { ascending: false }).limit(40);
    if (error) throw new Error(error.message);
    productions = (data || []).map((row) => decorateProduction(row as Record<string, unknown>));
  } else if (longFormLocalAllowed()) {
    productions = (await loadLocalState()).productions.slice(0, 40).map(decorateProduction);
  }
  const scenes = LIBRARY_VIDEOS.filter(
    (item) => item.category === "christmas_reels" || item.category === "christmas_marketing",
  ).map((item) => ({
    ...item,
    photo: isLibraryPhoto(item),
  }));
  return { music, scenes, productions };
}

export async function listLibraryVideos() {
  const service = serviceIfConfigured();
  if (service) {
    const { data, error } = await service
      .from("library_assets")
      .select("*")
      .eq("category", "long_form")
      .order("created_at", { ascending: false })
      .limit(80);
    if (error) throw new Error(error.message);
    return (data || []).map((row) => {
      const productionId = String((row.provenance as { production_id?: string } | null)?.production_id || row.id);
      let src = String(row.src || "");
      try {
        src = signedLongFormPath("video", productionId);
      } catch {
        src = stableMediaPath("video", productionId);
      }
      return {
        id: String(row.id),
        title: String(row.title || "Long-form"),
        description: String(row.description || ""),
        src,
        filename: String(row.filename || "long-form.mp4"),
        category: "long_form",
        kind: "long_form",
        durationSeconds: Number(row.duration_seconds || 0),
        poster: signedSafe("thumb", productionId),
        width: Number(row.width || 1920),
        height: Number(row.height || 1080),
      };
    });
  }
  if (!longFormLocalAllowed()) return [];
  const local = await loadLocalState();
  return local.productions
    .filter((p) => p.persist_confirmed)
    .map((p) => ({
      id: String(p.library_asset_id || p.id),
      title: String((p.title_suggestions as string[] | undefined)?.[0] || "Long-form"),
      description: String(p.description || ""),
      src: signedSafe("video", String(p.id)),
      filename: `${String(p.id)}.mp4`,
      category: "long_form",
      kind: "long_form",
      durationSeconds: Number(p.duration_seconds || 0),
      poster: signedSafe("thumb", String(p.id)),
      width: Number(p.width || 1920),
      height: Number(p.height || 1080),
    }));
}

function signedSafe(kind: "video" | "thumb", id: string) {
  try {
    return signedLongFormPath(kind, id);
  } catch {
    return stableMediaPath(kind, id);
  }
}

export async function resolveMediaRedirect(kind: string, id: string): Promise<{ url: string; contentType: string } | { localPath: string; contentType: string }> {
  if (!["video", "thumb", "audio"].includes(kind)) {
    throw Object.assign(new Error("Unsupported media type."), { status: 400 });
  }
  if (id.includes("..") || id.includes("/") || id.includes("\\")) {
    throw Object.assign(new Error("Invalid media id."), { status: 400 });
  }
  const service = serviceIfConfigured();
  if (kind === "audio") {
    const music = await loadMusic();
    const track = music.find((t) => t.id === id);
    if (!track) throw Object.assign(new Error("Media is not available."), { status: 404 });
    if (track.storagePath && service) {
      const preview = String((track.creationRecord as { preview_path?: string } | undefined)?.preview_path || track.storagePath);
      const url = await signedStorageDownload(preview, 3600);
      return { url, contentType: "audio/mp4" };
    }
    if (track.publicSrc) {
      const localPath = join(process.cwd(), "public", track.publicSrc.replace(/^\//, ""));
      return { localPath, contentType: "audio/mp4" };
    }
    throw Object.assign(new Error("Media is not available."), { status: 404 });
  }
  if (service) {
    const { data, error } = await service.from("long_form_productions").select("storage_path,thumbnail_path,storage_bucket,persist_confirmed").eq("id", id).maybeSingle();
    if (error) throw new Error(error.message);
    const path = kind === "thumb" ? data?.thumbnail_path : data?.storage_path;
    if (!path || !data?.persist_confirmed) throw Object.assign(new Error("Media is not available."), { status: 404 });
    const url = await signedStorageDownload(String(path), 3600);
    return { url, contentType: kind === "thumb" ? "image/jpeg" : "video/mp4" };
  }
  if (!longFormLocalAllowed()) throw Object.assign(new Error("Media is not available."), { status: 404 });
  const dest = join(process.cwd(), "output/long-form/productions", kind === "thumb" ? `${id}.jpg` : `${id}.mp4`);
  return { localPath: dest, contentType: kind === "thumb" ? "image/jpeg" : "video/mp4" };
}

export async function retryProduction(productionId: string) {
  const production = await getProduction(productionId);
  if (!production) throw new Error("Production not found.");
  const status = String(production.status);
  if (!["failed", "persist_failed"].includes(status)) {
    throw Object.assign(new Error("Only failed jobs can be retried."), { status: 400 });
  }
  const jobId = String(production.job_id || newId());
  production.status = "queued";
  production.error_message = null;
  production.stage = "queued";
  production.progress = 0;
  production.progress_label = "Waiting to start";
  await persistProduction(production, { requireRemote: !longFormLocalAllowed() });
  await persistJob({
    id: jobId,
    production_id: productionId,
    status: "queued",
    stage: "queued",
    progress: 0,
    progress_label: "Waiting to start",
    error_message: null,
  });
  kickLongFormWorker();
  return { production };
}

export function kickLongFormWorker() {
  setTimeout(() => {
    void tickLongForm("origin-kick").then((result) => {
      if (result.claimed > 0) kickLongFormWorker();
    });
  }, 50);
}

export async function tickLongForm(workerId = "origin"): Promise<{ claimed: number }> {
  if (running) return { claimed: 0 };
  running = true;
  try {
    const service = serviceIfConfigured();
    if (!service) return { claimed: 0 };
    const now = new Date().toISOString();
    const stale = await service
      .from("long_form_jobs")
      .update({
        status: "failed",
        error_message: "Retry limit reached after an interrupted render.",
        updated_at: now,
      })
      .eq("status", "rendering")
      .lt("lease_expires_at", now)
      .filter("attempt_count", "gte", "max_attempts");
    if (stale.error) {
      const expired = await service
        .from("long_form_jobs")
        .select("id,attempt_count,max_attempts,production_id")
        .eq("status", "rendering")
        .lt("lease_expires_at", now);
      if (!expired.error) {
        for (const job of expired.data || []) {
          if (Number(job.attempt_count) >= Number(job.max_attempts)) {
            await service
              .from("long_form_jobs")
              .update({ status: "failed", error_message: "Retry limit reached after an interrupted render.", updated_at: now })
              .eq("id", job.id);
            await service
              .from("long_form_productions")
              .update({ status: "failed", error_message: "Retry limit reached after an interrupted render.", updated_at: now })
              .eq("id", job.production_id);
          }
        }
      }
    }
    const { data, error } = await service.rpc("claim_long_form_jobs", {
      p_limit: 1,
      p_worker_id: workerId,
      p_now: now,
    });
    if (error) {
      console.error(JSON.stringify({ source: "long-form-studio", event: "claim_failed", message: error.message }));
      return { claimed: 0 };
    }
    const jobs = Array.isArray(data) ? data : data ? [data] : [];
    for (const job of jobs) {
      try {
        await processProductionById(String(job.production_id));
      } catch (err) {
        console.error(
          JSON.stringify({
            source: "long-form-studio",
            event: "job_error",
            job_id: job.id,
            message: err instanceof Error ? err.message : String(err),
          }),
        );
      }
    }
    return { claimed: jobs.length };
  } finally {
    running = false;
  }
}

export async function seedDemoMusicIfMissing() {
  const service = serviceIfConfigured();
  if (!service) return ORIGINAL_MUSIC_SEED;
  for (const track of ORIGINAL_MUSIC_SEED) {
    const { data, error } = await service.from("music_tracks").select("id").eq("id", track.id).maybeSingle();
    if (error) throw new Error(error.message);
    if (data) continue;
    const ins = await service.from("music_tracks").insert({
      id: track.id,
      title: track.title,
      artist_source: track.artistSource,
      duration_seconds: track.durationSeconds,
      genre: track.genre,
      mood: track.mood,
      source: track.source,
      license_type: track.licenseType,
      commercial_use_allowed: null,
      youtube_monetization_allowed: "unknown",
      attribution_required: false,
      demo: true,
      creation_record: track.creationRecord,
      rights_complete: false,
      public_src: track.publicSrc,
      filename: track.filename,
      internal_notes: track.internalNotes,
      editorial_status: "demo_unreviewed",
    });
    if (ins.error && !String(ins.error.message).includes("duplicate")) throw new Error(ins.error.message);
  }
  return loadMusic();
}

export { hashFile };
