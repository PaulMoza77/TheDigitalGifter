import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { ffprobeFile, runCommand } from "../clip-factory/ffmpeg";
import { isRightsComplete, youtubeAudioLibraryLicenseType } from "../../../src/features/long-form-studio/musicRights";
import { MUSIC_MOODS, type MusicTrack } from "../../../src/features/long-form-studio/types";
import { loadLocalState, saveLocalState } from "./localState";
import {
  LONG_FORM_BUCKET,
  assertSafeObjectPath,
  createLongFormUploadUrl,
  downloadObjectToFile,
  hashFile,
  longFormLocalAllowed,
  uploadObjectStreaming,
  verifyStoredObject,
} from "./storage";
import { getServiceClient } from "../christmas/supabaseClient";

const AUDIO_EXT = new Set([".mp3", ".wav", ".m4a", ".aac"]);
const AUDIO_MIME: Record<string, string> = {
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
};

function asString(value: unknown): string {
  return String(value ?? "").trim();
}

function serviceIfConfigured() {
  try {
    return getServiceClient();
  } catch (error) {
    if (longFormLocalAllowed()) return null;
    throw error;
  }
}

function toTrack(row: Record<string, unknown>): MusicTrack {
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

export function audioExtension(filename: string): string {
  const ext = extname(filename).toLowerCase();
  if (!AUDIO_EXT.has(ext)) {
    throw Object.assign(new Error("Upload an MP3, WAV, or M4A file."), { status: 400 });
  }
  return ext;
}

export async function beginYalUpload(input: { filename: string; purpose: "audio" | "proof" }) {
  const id = randomUUID();
  let objectPath: string;
  let contentType: string;
  if (input.purpose === "audio") {
    const ext = audioExtension(input.filename);
    objectPath = `music/${id}/source${ext}`;
    contentType = AUDIO_MIME[ext] || "application/octet-stream";
  } else {
    const ext = extname(input.filename).toLowerCase() === ".pdf" ? ".pdf" : ".txt";
    objectPath = `music/${id}/license${ext}`;
    contentType = ext === ".pdf" ? "application/pdf" : "text/plain";
  }
  const upload = await createLongFormUploadUrl(objectPath);
  return { ...upload, contentType, trackDraftId: id };
}

export async function completeYalImport(body: Record<string, unknown>): Promise<{ track: MusicTrack; duplicate: boolean }> {
  const audioPath = assertSafeObjectPath(asString(body.audio_path));
  if (!audioPath.startsWith("music/")) throw Object.assign(new Error("Invalid audio path."), { status: 400 });
  const proofPath = asString(body.proof_path) ? assertSafeObjectPath(asString(body.proof_path)) : "";
  const title = asString(body.title);
  if (!title) throw Object.assign(new Error("Add the track title from YouTube Audio Library."), { status: 400 });
  const mood = asString(body.mood) || "cozy_instrumental";
  if (!MUSIC_MOODS.includes(mood as (typeof MUSIC_MOODS)[number])) {
    throw Object.assign(new Error("Choose a music mood."), { status: 400 });
  }
  const attributionRequired = Boolean(body.attribution_required);
  const attributionText = asString(body.attribution_text);
  if (attributionRequired && !attributionText) {
    throw Object.assign(new Error("Add the required attribution text."), { status: 400 });
  }

  const dir = await mkdtemp(join(tmpdir(), "tdg-yal-"));
  const ext = extname(audioPath) || ".m4a";
  const localAudio = join(dir, `source${ext}`);
  try {
    await downloadObjectToFile(audioPath, localAudio);
    const size = (await stat(localAudio)).size;
    const audioInfo = await verifyStoredObject(audioPath, size);
    if (!audioInfo.ok) throw new Error(audioInfo.message);
    const probe = await ffprobeFile(localAudio);
    if (!probe.hasAudio || probe.duration < 8) {
      throw Object.assign(new Error("That file is not a usable audio track."), { status: 400 });
    }
    const sha = await hashFile(localAudio);
    const folder = audioPath.split("/")[1] || randomUUID();
    const previewPath = `music/${folder}/preview.m4a`;
    const localPreview = join(dir, "preview.m4a");
    await runCommand(
      "ffmpeg",
      ["-y", "-i", localAudio, "-t", "20", "-c:a", "aac", "-b:a", "128k", "-ac", "2", localPreview],
      60_000,
    );
    await uploadObjectStreaming({ localPath: localPreview, objectPath: previewPath, contentType: "audio/mp4" });

    let proofAccessible = false;
    if (proofPath) {
      const proofCheck = await verifyStoredObject(proofPath, 1);
      proofAccessible = proofCheck.ok && proofCheck.size > 20;
    }

    const track: MusicTrack = {
      id: folder,
      title,
      artistSource: asString(body.artist_source) || "YouTube Audio Library",
      durationSeconds: probe.duration,
      genre: asString(body.genre),
      mood,
      source: "youtube_audio_library",
      licenseType: youtubeAudioLibraryLicenseType(attributionRequired),
      commercialUseAllowed: body.commercial_use_allowed === true ? true : null,
      youtubeMonetizationAllowed:
        body.youtube_monetization_allowed === "yes" || body.youtube_monetization_allowed === "no"
          ? body.youtube_monetization_allowed
          : "unknown",
      attributionRequired,
      attributionText,
      licenseUrl: asString(body.license_url) || "https://www.youtube.com/audiolibrary",
      acquisitionDate: asString(body.acquisition_date) || new Date().toISOString().slice(0, 10),
      proofStoragePath: proofPath || null,
      internalNotes: asString(body.internal_notes),
      filename: asString(body.filename) || audioPath.split("/").pop() || null,
      publicSrc: null,
      storagePath: audioPath,
      storageBucket: LONG_FORM_BUCKET,
      compositionRights: "licensed",
      recordingRights: "licensed",
      demo: false,
      proofAccessible,
      fileSha256: sha,
      creationRecord: {
        import: "youtube_audio_library_manual",
        audio_path: audioPath,
        preview_path: previewPath,
        bytes: size,
        codec: probe.audioCodec,
      },
      editorialStatus: "unreviewed",
      rightsComplete: false,
    };
    track.rightsComplete = isRightsComplete(track);
    return upsertTrack(track, sha);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

async function upsertTrack(track: MusicTrack, sha: string): Promise<{ track: MusicTrack; duplicate: boolean }> {
  const service = serviceIfConfigured();
  if (service) {
    const existing = await service.from("music_tracks").select("*").eq("file_sha256", sha).maybeSingle();
    if (existing.error) throw new Error(existing.error.message);
    if (existing.data) return { track: toTrack(existing.data as Record<string, unknown>), duplicate: true };
    const row = {
      id: track.id,
      title: track.title,
      artist_source: track.artistSource,
      duration_seconds: track.durationSeconds,
      genre: track.genre,
      mood: track.mood,
      source: track.source,
      license_type: track.licenseType,
      commercial_use_allowed: track.commercialUseAllowed,
      youtube_monetization_allowed: track.youtubeMonetizationAllowed,
      attribution_required: track.attributionRequired,
      attribution_text: track.attributionText,
      license_url: track.licenseUrl,
      acquisition_date: track.acquisitionDate,
      proof_storage_path: track.proofStoragePath,
      internal_notes: track.internalNotes,
      storage_bucket: track.storageBucket,
      storage_path: track.storagePath,
      filename: track.filename,
      public_src: null,
      composition_rights: track.compositionRights,
      recording_rights: track.recordingRights,
      rights_complete: track.rightsComplete,
      file_sha256: sha,
      demo: false,
      creation_record: track.creationRecord,
      proof_accessible: track.proofAccessible,
      editorial_status: "unreviewed",
    };
    const ins = await service.from("music_tracks").insert(row).select("*").single();
    if (ins.error || !ins.data) throw new Error(ins.error?.message || "Could not save the track.");
    return { track: toTrack(ins.data as Record<string, unknown>), duplicate: false };
  }
  if (!longFormLocalAllowed()) throw new Error("Database is not configured.");
  const local = await loadLocalState();
  const dup = local.music.find((t) => t.fileSha256 === sha);
  if (dup) return { track: dup, duplicate: true };
  local.music = [track, ...local.music];
  await saveLocalState(local);
  return { track, duplicate: false };
}
