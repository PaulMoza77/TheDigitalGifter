import { LIBRARY_VIDEOS } from "../../../src/features/admin-library/catalog";
import { capabilityMessage } from "../../../src/features/clip-factory/ingest/capability";
import { extractYoutubeId } from "../../../src/features/clip-factory/ingest/adapters/youtube";
import { isKnownInvalidMediaHash } from "../../../src/features/clip-factory/mediaQuality";
import { downloadDirectMedia, IngestError } from "./ingest";
import { importVimeoAuthorized } from "./providers";
import { importYoutubeMedia } from "./youtubeImport";

export type NormalizedIngest = {
  sourceType: string;
  sourceUrl: string | null;
  title: string | null;
  thumbnail: string | null;
  duration: number | null;
  mediaAsset: { localPath: string; contentType: string; bytes: number };
  status: "ingested";
};

export type StoredMediaHit = {
  storagePath: string;
  title?: string | null;
  durationSeconds?: number | null;
  fileSizeBytes?: number | null;
  mediaHash?: string | null;
  invalidated?: boolean;
};

export type AcquireInput = {
  sourceKind: string;
  sourcePayload: Record<string, unknown>;
  sourceLabel?: string | null;
  dest: string;
  expectedDurationSeconds?: number | null;
  downloadStorage: (storagePath: string, dest: string) => Promise<void>;
  resolveLibraryFile: (src: string) => string | null;
  copyFile: (from: string, to: string) => Promise<void>;
  findStoredMedia?: (sourceUrl: string) => Promise<StoredMediaHit | null>;
  loadLibraryAsset?: (id: string) => Promise<{ storagePath: string; title?: string | null } | null>;
};

function youtubeLimitation(detail?: string): IngestError {
  return new IngestError(
    "import_unavailable",
    detail ||
      "YouTube Data API v3 and oEmbed return metadata only (title, thumbnail, duration). They do not expose a downloadable media file. Automatic import was blocked. Upload the original MP4 you have rights to use.",
  );
}

function done(
  sourceType: string,
  sourceUrl: string | null,
  title: string | null,
  dest: string,
  contentType: string,
  bytes: number,
): NormalizedIngest {
  return {
    sourceType,
    sourceUrl,
    title,
    thumbnail: null,
    duration: null,
    mediaAsset: { localPath: dest, contentType, bytes },
    status: "ingested",
  };
}

function storedLooksReusable(hit: StoredMediaHit, expectedDuration: number | null | undefined): boolean {
  if (hit.invalidated) return false;
  if (isKnownInvalidMediaHash(hit.mediaHash)) return false;
  const duration = Number(hit.durationSeconds || 0);
  if (duration < 3) return false;
  if (expectedDuration && Math.abs(duration - expectedDuration) > Math.max(2.5, expectedDuration * 0.12)) return false;
  return true;
}

export async function acquireSourceMedia(input: AcquireInput): Promise<NormalizedIngest> {
  const payload = input.sourcePayload || {};
  const objectPath = String(payload.objectPath || "");
  const libraryAssetId = String(payload.libraryAssetId || "");
  const sourceUrl = String(payload.mediaUrl || payload.url || payload.referenceUrl || "") || null;
  const title = input.sourceLabel || null;
  const expectedDuration =
    input.expectedDurationSeconds ??
    (typeof payload.durationSeconds === "number" ? payload.durationSeconds : null);

  if (objectPath.startsWith("uploads/")) {
    await input.downloadStorage(objectPath, input.dest);
    return done("upload", sourceUrl, title, input.dest, "video/mp4", 0);
  }

  if (input.sourceKind === "library" || libraryAssetId) {
    const assetId = libraryAssetId || String(payload.libraryAssetId || "");
    const catalog = LIBRARY_VIDEOS.find((v) => v.id === assetId);
    if (catalog) {
      const local = input.resolveLibraryFile(catalog.src);
      if (!local) throw new IngestError("invalid_url", "Library file is not available on this origin.");
      await input.copyFile(local, input.dest);
      return done("library", sourceUrl, catalog.title, input.dest, "video/mp4", 0);
    }
    const asset = input.loadLibraryAsset ? await input.loadLibraryAsset(assetId) : null;
    if (!asset?.storagePath) throw new IngestError("invalid_url", "That Library item was not found.");
    await input.downloadStorage(asset.storagePath, input.dest);
    return done("library", sourceUrl, asset.title || title, input.dest, "video/mp4", 0);
  }

  if (input.sourceKind === "direct_media_url") {
    const url = String(payload.mediaUrl || payload.url || "");
    if (!url) throw new IngestError("invalid_url", "Paste a video URL, or upload the file you have rights to use.");
    const downloaded = await downloadDirectMedia(url, input.dest);
    return done("direct", url, title, input.dest, downloaded.contentType, downloaded.bytes);
  }

  if (input.sourceKind === "youtube") {
    const url = String(payload.url || payload.referenceUrl || "");
    const id = extractYoutubeId(url);
    if (!id) throw new IngestError("invalid_url", "That YouTube URL is missing a video id.");
    if (input.findStoredMedia) {
      const stored = await input.findStoredMedia(url);
      if (stored?.storagePath && storedLooksReusable(stored, expectedDuration)) {
        await input.downloadStorage(stored.storagePath, input.dest);
        return done("youtube", url, stored.title || title, input.dest, "video/mp4", stored.fileSizeBytes || 0);
      }
    }
    try {
      const downloaded = await importYoutubeMedia(url, input.dest);
      return done("youtube", url, title, input.dest, downloaded.contentType, downloaded.bytes);
    } catch (error) {
      if (error instanceof IngestError) throw error;
      throw youtubeLimitation(error instanceof Error ? error.message : undefined);
    }
  }

  if (input.sourceKind === "vimeo") {
    const url = String(payload.url || payload.referenceUrl || "");
    if (!String(process.env.VIMEO_ACCESS_TOKEN || "").trim()) {
      throw new IngestError("import_unavailable", capabilityMessage("REFERENCE_ONLY", "vimeo"));
    }
    const downloaded = await importVimeoAuthorized(url, input.dest);
    return done("vimeo", url, title, input.dest, downloaded.contentType, downloaded.bytes);
  }

  throw new IngestError(
    "import_unavailable",
    "Automatic import isn't available for this source. Upload the original video file instead.",
  );
}
