import { mkdir, copyFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { LIBRARY_VIDEOS, isLibraryPhoto, type LibraryVideo } from "../../../src/features/admin-library/catalog";
import { generateDescription, generateThumbnailConcepts, generateTitleOptions } from "../../../src/features/long-form-studio/copy";
import { MOOD_LABELS, STAGE_LABELS, type MusicMood, type MusicTrack, type ProductionStatus, type StylePreset } from "../../../src/features/long-form-studio/types";
import { buildPlaylist, moodForStyle } from "../../../src/features/long-form-studio/playlist";
import { validateProductionRights } from "../../../src/features/long-form-studio/rightsManifest";
import { checkProductionSimilarity } from "../../../src/features/long-form-studio/similarity";
import { ORIGINAL_MUSIC_SEED } from "../../../src/features/long-form-studio/seedMusic";
import { renderLongFormVideo, visualTreatmentId, type SceneInput } from "./render";
import { loadLocalState, saveLocalState, newId } from "./localState";
import { signedLongFormPath } from "./mediaSign";
import { ensureAllOriginalMusic } from "./originalMusic";

const BUCKET = "long-form";

export function sceneFromLibrary(id: string): LibraryVideo | undefined {
  return LIBRARY_VIDEOS.find((item) => item.id === id);
}

export function visualRightsFor(scene: LibraryVideo) {
  return {
    id: scene.id,
    title: scene.title,
    origin: "tdg_library" as const,
    commercialUseAllowed: true as const,
    notes: "TDG original / licensed Library asset",
  };
}

async function serviceOrNull() {
  try {
    const { getServiceClient } = await import("../christmas/supabaseClient");
    return getServiceClient();
  } catch {
    return null;
  }
}

async function loadMusic(): Promise<MusicTrack[]> {
  const service = await serviceOrNull();
  if (service) {
    try {
      const { data } = await service.from("music_tracks").select("*").order("created_at", { ascending: false });
      if (data?.length) {
        return data.map(rowToTrack);
      }
    } catch {
      /* fall through to seed */
    }
  }
  const local = await loadLocalState();
  return local.music.length ? local.music : ORIGINAL_MUSIC_SEED;
}

function rowToTrack(row: Record<string, unknown>): MusicTrack {
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
    compositionRights: (row.composition_rights as MusicTrack["compositionRights"]) || "unknown",
    recordingRights: (row.recording_rights as MusicTrack["recordingRights"]) || "unknown",
    rightsComplete: Boolean(row.rights_complete),
  };
}

export type CreateProductionInput = {
  sceneIds: string[];
  mood: string;
  style: StylePreset;
  durationSeconds: number;
  shuffle?: boolean;
  seed?: number;
  customNotes?: string;
  createdBy?: string;
};

export async function createAndRenderProduction(
  input: CreateProductionInput,
  options?: { skipRender?: boolean; workDir?: string; productionId?: string },
) {
  await ensureAllOriginalMusic();
  const music = await loadMusic();
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
  });
  if (!playlist.entries.length) {
    throw new Error("No cleared music for this mood. Import or review tracks in Music Library.");
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
  const config = {
    sceneIds: input.sceneIds,
    sceneSequence: input.sceneIds,
    musicTrackIds: usedTracks.map((t) => t.id),
    playlistOrder: playlist.entries.map((e) => e.trackId),
    visualTreatment: treatment,
    stylePreset: input.style,
    durationSeconds: input.durationSeconds,
    title: titles[0]!,
    thumbnailConceptId: thumbs[0]?.id,
  };

  const existing = await loadExistingFingerprints();
  const similarity = checkProductionSimilarity(config, existing);

  let status: ProductionStatus = rights.ok ? "ready_to_publish" : "rights_review_required";
  if (rights.ok && similarity.tooSimilar) status = "similarity_review_required";

  const productionId = options?.productionId || newId();
  const jobId = newId();
  const workDir = options?.workDir || join(process.cwd(), "output/long-form", productionId);
  await mkdir(workDir, { recursive: true });

  const production: Record<string, unknown> = {
    id: productionId,
    status: options?.skipRender ? "queued" : "queued",
    theme: "christmas",
    style_preset: input.style,
    duration_seconds: input.durationSeconds,
    scene_ids: input.sceneIds,
    scene_sequence: input.sceneIds,
    music_track_ids: usedTracks.map((t) => t.id),
    playlist: playlist.entries,
    visual_treatment: treatment,
    title_suggestions: titles,
    description,
    thumbnail_concepts: thumbs,
    rights_manifest: rights.manifest,
    similarity,
    created_at: new Date().toISOString(),
    job_id: jobId,
    progress: 0,
    stage: "preparing_scene",
    progress_label: STAGE_LABELS.preparing_scene,
  };

  await persistProduction(production);

  if (options?.skipRender) return { production, jobId, rights, similarity };

  if (!rights.ok) {
    production.status = "rights_review_required";
    await persistProduction(production);
    return { production, jobId, rights, similarity };
  }

  const sceneInputs: SceneInput[] = scenes.map((s) => ({
    id: s.id,
    title: s.title,
    src: s.src,
    kind: s.kind,
    filename: s.filename,
  }));

  const rendered = await renderLongFormVideo({
    workDir,
    scenes: sceneInputs,
    tracks: usedTracks,
    playlist: playlist.entries,
    durationSeconds: input.durationSeconds,
    style: input.style,
    onProgress: async (stage, progress, label) => {
      production.stage = stage;
      production.progress = progress;
      production.progress_label = label;
      production.status = "rendering";
      await persistProduction(production);
    },
  });

  const destDir = join(process.cwd(), "output/long-form/productions");
  await mkdir(destDir, { recursive: true });
  const filename = `long-form-${productionId.slice(0, 8)}.mp4`;
  const destVideo = join(destDir, filename);
  const destThumb = join(destDir, `${productionId.slice(0, 8)}.jpg`);
  await copyFile(rendered.outputPath, destVideo);
  await copyFile(rendered.thumbnailPath, destThumb);

  const libraryAsset = await saveToLibrary({
    productionId,
    title: titles[0]!,
    description,
    filename,
    destVideo,
    destThumb,
    probe: rendered.probe,
    sceneIds: input.sceneIds,
    musicTrackIds: usedTracks.map((t) => t.id),
    rightsManifest: rights.manifest,
    titles,
    durationSeconds: input.durationSeconds,
    style: input.style,
  });

  production.status = status;
  production.progress = 100;
  production.stage = "saving_to_library";
  production.progress_label = STAGE_LABELS.saving_to_library;
  production.library_asset_id = libraryAsset.id;
  production.storage_path = libraryAsset.storagePath;
  production.thumbnail_path = destThumb;
  production.probe = rendered.probe;
  production.width = rendered.probe.width;
  production.height = rendered.probe.height;
  production.src = libraryAsset.src;
  production.poster = libraryAsset.poster;
  await persistProduction(production);

  await writeFile(
    join(workDir, "rights-manifest.txt"),
    JSON.stringify(rights.manifest, null, 2),
    "utf8",
  );

  return { production, jobId, rights, similarity, libraryAsset, rendered };
}

async function loadExistingFingerprints() {
  const local = await loadLocalState();
  return local.productions
    .filter((p) => p.status === "ready_to_publish" || p.status === "similarity_review_required")
    .map((p) => ({
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
    }));
}

async function persistProduction(production: Record<string, unknown>) {
  const local = await loadLocalState();
  const idx = local.productions.findIndex((p) => p.id === production.id);
  if (idx >= 0) local.productions[idx] = production;
  else local.productions.unshift(production);
  await saveLocalState(local);
  const service = await serviceOrNull();
  if (!service) return;
  try {
  await service.from("long_form_productions").upsert({
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
    storage_path: production.storage_path,
    width: production.width,
    height: production.height,
    probe: production.probe,
    updated_at: new Date().toISOString(),
  });
  } catch {
    /* local state is enough when tables are not applied yet */
  }
}

async function saveToLibrary(input: {
  productionId: string;
  title: string;
  description: string;
  filename: string;
  destVideo: string;
  destThumb: string;
  probe: { duration: number; width: number; height: number; fileSize: number | null };
  sceneIds: string[];
  musicTrackIds: string[];
  rightsManifest: unknown;
  titles: string[];
  durationSeconds: number;
  style: StylePreset;
}) {
  const publicRel = `/api/long-form-studio?action=file&name=${encodeURIComponent(input.filename)}`;
  const posterRel = `/api/long-form-studio?action=file&name=${encodeURIComponent(`${input.productionId.slice(0, 8)}.jpg`)}`;
  const service = await serviceOrNull();
  let storagePath = `productions/${input.filename}`;
  let id = input.productionId;
  if (service) {
    try {
    const videoBytes = await (await import("node:fs/promises")).readFile(input.destVideo);
    const thumbBytes = await (await import("node:fs/promises")).readFile(input.destThumb);
    await service.storage.from(BUCKET).upload(storagePath, videoBytes, { contentType: "video/mp4", upsert: true });
    await service.storage.from(BUCKET).upload(`productions/${input.productionId.slice(0, 8)}.jpg`, thumbBytes, {
      contentType: "image/jpeg",
      upsert: true,
    });
    const src = signedLongFormPath("video", input.productionId);
    const insert = await service
      .from("library_assets")
      .insert({
        title: input.title,
        description: input.description,
        src,
        filename: input.filename,
        category: "long_form",
        kind: "long_form",
        duration_seconds: input.probe.duration,
        width: input.probe.width,
        height: input.probe.height,
        poster_src: signedLongFormPath("thumb", input.productionId),
        storage_bucket: BUCKET,
        storage_path: storagePath,
        thumbnail_path: `productions/${input.productionId.slice(0, 8)}.jpg`,
        provenance: {
          type: "long_form",
          theme: "christmas",
          duration: input.durationSeconds,
          scene_ids: input.sceneIds,
          music_track_ids: input.musicTrackIds,
          rights_manifest: input.rightsManifest,
          title_suggestions: input.titles,
          description: input.description,
          production_id: input.productionId,
          created_date: new Date().toISOString(),
          style: input.style,
        },
      })
      .select("id")
      .single();
    if (!insert.error && insert.data) id = insert.data.id;
    } catch {
      /* keep local library path */
    }
  }
  return { id, src: publicRel, poster: posterRel, storagePath };
}

export async function listStudioBootstrap() {
  const music = await loadMusic();
  const local = await loadLocalState();
  const scenes = LIBRARY_VIDEOS.filter(
    (item) => item.category === "christmas_reels" || item.category === "christmas_marketing",
  ).map((item) => ({
    ...item,
    photo: isLibraryPhoto(item),
  }));
  return { music, scenes, productions: local.productions.slice(0, 20) };
}

export { loadMusic };
