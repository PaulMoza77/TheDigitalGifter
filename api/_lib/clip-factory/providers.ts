import { extractVimeoId, vimeoAccessToken } from "../../../src/features/clip-factory/ingest/adapters/vimeo";
import { extractYoutubeId, youtubeAuthorizedImportConfigured } from "../../../src/features/clip-factory/ingest/adapters/youtube";
import { IngestFailure } from "../../../src/features/clip-factory/ingest/types";
import { downloadDirectMedia, IngestError } from "./ingest";

function asIngestError(error: unknown): never {
  if (error instanceof IngestError) throw error;
  if (error instanceof IngestFailure) throw new IngestError(error.code, error.message);
  throw new IngestError("import_failed", error instanceof Error ? error.message : "Import failed. Retry.");
}

export async function importYoutubeAuthorized(url: string, dest: string): Promise<{ contentType: string; bytes: number }> {
  const id = extractYoutubeId(url);
  if (!id) throw new IngestError("invalid_url", "That YouTube URL is missing a video id.");
  const endpoint = String(process.env.CLIP_FACTORY_YOUTUBE_IMPORT_URL || "").trim();
  if (!endpoint || !youtubeAuthorizedImportConfigured()) {
    throw new IngestError(
      "import_unavailable",
      "Automatic import isn't available for this source. Upload the original video file instead.",
    );
  }
  try {
    const secret = String(process.env.CLIP_FACTORY_YOUTUBE_IMPORT_SECRET || "").trim();
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
      },
      body: JSON.stringify({ video_id: id, url: `https://www.youtube.com/watch?v=${id}` }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      url?: string;
      download_url?: string;
      error?: string;
      message?: string;
      code?: string;
    };
    if (res.status === 401 || res.status === 403) {
      throw new IngestError("source_auth_required", "Source requires authentication.");
    }
    if (res.status === 404) throw new IngestError("video_unavailable", "Video is unavailable.");
    if (!res.ok) {
      const code = json.code || "import_failed";
      throw new IngestError(code, json.message || json.error || "Import failed. Retry.");
    }
    const mediaUrl = json.download_url || json.url;
    if (!mediaUrl) {
      throw new IngestError(
        "import_unavailable",
        "Automatic import isn't available for this source. Upload the original video file instead.",
      );
    }
    return downloadDirectMedia(mediaUrl, dest);
  } catch (error) {
    asIngestError(error);
  }
}

export async function importVimeoAuthorized(url: string, dest: string): Promise<{ contentType: string; bytes: number }> {
  const id = extractVimeoId(url);
  if (!id) throw new IngestError("invalid_url", "That Vimeo URL is missing a video id.");
  const token = vimeoAccessToken();
  if (!token) {
    throw new IngestError(
      "import_unavailable",
      "Automatic import isn't available for this source. Upload the original video file instead.",
    );
  }
  try {
    const res = await fetch(`https://api.vimeo.com/videos/${id}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.vimeo.*+json;version=3.4" },
    });
    if (res.status === 404) throw new IngestError("video_unavailable", "Video is unavailable.");
    if (res.status === 401 || res.status === 403) {
      throw new IngestError("source_auth_required", "Source requires authentication.");
    }
    if (!res.ok) throw new IngestError("import_failed", "Import failed. Retry.");
    const json = (await res.json()) as {
      privacy?: { view?: string; download?: boolean };
      download?: Array<{ link?: string; width?: number }>;
    };
    if (json.privacy?.view === "nobody" || json.privacy?.view === "password") {
      throw new IngestError("video_private", "Video is private.");
    }
    const link = [...(json.download || [])].sort((a, b) => (b.width || 0) - (a.width || 0)).find((row) => row.link)?.link;
    if (!link) {
      throw new IngestError(
        "import_unavailable",
        "Automatic import isn't available for this source. Upload the original video file instead.",
      );
    }
    return downloadDirectMedia(link, dest);
  } catch (error) {
    asIngestError(error);
  }
}
