import { LIBRARY_VIDEOS } from "../../../src/features/admin-library/catalog";
import { capabilityMessage } from "../../../src/features/clip-factory/ingest/capability";
import { extractYoutubeId } from "../../../src/features/clip-factory/ingest/adapters/youtube";
import { downloadDirectMedia, IngestError } from "./ingest";
import { importVimeoAuthorized, importYoutubeAuthorized } from "./providers";

export type NormalizedIngest = {
  sourceType: string;
  sourceUrl: string | null;
  title: string | null;
  thumbnail: string | null;
  duration: number | null;
  mediaAsset: { localPath: string; contentType: string; bytes: number };
  status: "ingested";
};

export type AcquireInput = {
  sourceKind: string;
  sourcePayload: Record<string, unknown>;
  sourceLabel?: string | null;
  dest: string;
  downloadStorage: (storagePath: string, dest: string) => Promise<void>;
  resolveLibraryFile: (src: string) => string | null;
  copyFile: (from: string, to: string) => Promise<void>;
  findStoredMedia?: (sourceUrl: string) => Promise<{ storagePath: string; title?: string | null } | null>;
  loadLibraryAsset?: (id: string) => Promise<{ storagePath: string; title?: string | null } | null>;
};

function youtubeLimitation(): IngestError {
  return new IngestError(
    "import_unavailable",
    "YouTube Data API v3 and oEmbed return metadata only (title, thumbnail, duration). They do not expose a downloadable media file. Automatic import isn't available for this source without CLIP_FACTORY_YOUTUBE_IMPORT_URL (a YouTube-authorized partner importer) or the original file.",
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

export async function acquireSourceMedia(input: AcquireInput): Promise<NormalizedIngest> {
  const payload = input.sourcePayload || {};
  const objectPath = String(payload.objectPath || "");
  const libraryAssetId = String(payload.libraryAssetId || "");
  const sourceUrl = String(payload.mediaUrl || payload.url || payload.referenceUrl || "") || null;
  const title = input.sourceLabel || null;

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
    if (String(process.env.CLIP_FACTORY_YOUTUBE_IMPORT_URL || "").trim()) {
      const downloaded = await importYoutubeAuthorized(url, input.dest);
      return done("youtube", url, title, input.dest, downloaded.contentType, downloaded.bytes);
    }
    if (input.findStoredMedia) {
      const stored = await input.findStoredMedia(url);
      if (stored?.storagePath) {
        await input.downloadStorage(stored.storagePath, input.dest);
        return done("youtube", url, stored.title || title, input.dest, "video/mp4", 0);
      }
    }
    throw youtubeLimitation();
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
