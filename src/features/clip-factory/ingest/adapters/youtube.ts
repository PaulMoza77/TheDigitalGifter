import { capabilityMessage } from "../capability";
import { IngestFailure, normalizeSourceMetadata, type SourceMetadata, type VideoSourceAdapter } from "../types";
import { parsePublicHttpUrl } from "../ssrf";

const YOUTUBE_HOST = /(^|\.)youtube\.com$|(^|\.)youtu\.be$|(^|\.)youtube-nocookie\.com$/i;

export function extractYoutubeId(raw: string): string | null {
  const parsed = parsePublicHttpUrl(raw);
  if (!parsed.ok) return null;
  const url = parsed.url;
  const host = url.hostname.toLowerCase();
  if (!YOUTUBE_HOST.test(host)) return null;
  if (host === "youtu.be" || host.endsWith(".youtu.be")) {
    const id = url.pathname.replace(/^\//, "").split("/")[0];
    return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
  }
  const v = url.searchParams.get("v");
  if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;
  const parts = url.pathname.split("/").filter(Boolean);
  const marker = parts.findIndex((p) => p === "shorts" || p === "embed" || p === "live" || p === "v");
  if (marker >= 0 && parts[marker + 1] && /^[a-zA-Z0-9_-]{11}$/.test(parts[marker + 1])) {
    return parts[marker + 1];
  }
  return null;
}

export function normalizeYoutubeUrl(id: string): string {
  return `https://www.youtube.com/watch?v=${id}`;
}

export function youtubeApiKey(): string {
  return String(process.env.YOUTUBE_API_KEY || process.env.GOOGLE_API_KEY || "").trim();
}

export function youtubeAuthorizedImportConfigured(): boolean {
  return Boolean(String(process.env.CLIP_FACTORY_YOUTUBE_IMPORT_URL || "").trim());
}

function youtubeFallbackMessage(): string {
  return capabilityMessage("REFERENCE_ONLY", "youtube");
}

function youtubeCapability() {
  return youtubeAuthorizedImportConfigured() ? ("FULL_IMPORT" as const) : ("REFERENCE_ONLY" as const);
}

function mapYoutubePrivacy(status?: string): SourceMetadata["privacy"] {
  if (status === "private") return "private";
  if (status === "unlisted") return "unlisted";
  if (status === "public") return "public";
  return "unknown";
}

export async function fetchYoutubeMetadata(id: string): Promise<SourceMetadata> {
  const normalizedUrl = normalizeYoutubeUrl(id);
  const key = youtubeApiKey();
  if (key) {
    const api = new URL("https://www.googleapis.com/youtube/v3/videos");
    api.searchParams.set("part", "snippet,contentDetails,status");
    api.searchParams.set("id", id);
    api.searchParams.set("key", key);
    const res = await fetch(api.toString(), { headers: { Accept: "application/json" } });
    const json = (await res.json().catch(() => ({}))) as {
      items?: Array<{
        snippet?: { title?: string; channelTitle?: string; thumbnails?: { high?: { url?: string }; medium?: { url?: string } } };
        contentDetails?: { duration?: string };
        status?: { privacyStatus?: string; embeddable?: boolean; uploadStatus?: string };
      }>;
      error?: { message?: string };
    };
    if (!res.ok) {
      throw new IngestFailure("import_failed", json.error?.message || "YouTube metadata request failed. Retry.");
    }
    const item = json.items?.[0];
    if (!item) {
      throw new IngestFailure("video_unavailable", "Video is unavailable.");
    }
    const privacy = mapYoutubePrivacy(item.status?.privacyStatus);
    if (privacy === "private") {
      throw new IngestFailure("video_private", "Video is private.");
    }
    if (item.status?.uploadStatus && item.status.uploadStatus !== "processed") {
      throw new IngestFailure("video_unavailable", "Video is unavailable.");
    }
    const ingestionCapability = youtubeCapability();
    return normalizeSourceMetadata({
      provider: "youtube",
      url: normalizedUrl,
      normalizedUrl,
      externalId: id,
      title: item.snippet?.title || "YouTube video",
      author: item.snippet?.channelTitle || null,
      durationSeconds: parseIsoDuration(item.contentDetails?.duration),
      thumbnailUrl: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.medium?.url || null,
      privacy,
      embeddable: item.status?.embeddable ?? null,
      canImport: ingestionCapability === "FULL_IMPORT",
      ingestionCapability,
      mediaUrl: null,
      importMode: ingestionCapability === "FULL_IMPORT" ? "authorized_api" : "unavailable",
      fallback: ingestionCapability === "FULL_IMPORT" ? null : "upload",
      message: capabilityMessage(ingestionCapability, "youtube"),
      metadata: { privacy, embeddable: item.status?.embeddable ?? null },
    });
  }

  const oembed = new URL("https://www.youtube.com/oembed");
  oembed.searchParams.set("url", normalizedUrl);
  oembed.searchParams.set("format", "json");
  try {
    const res = await fetch(oembed.toString(), { headers: { Accept: "application/json" } });
    if (res.status === 401 || res.status === 403) {
      throw new IngestFailure("source_auth_required", "Source requires authentication.");
    }
    if (res.ok) {
      const json = (await res.json().catch(() => ({}))) as { title?: string; author_name?: string; thumbnail_url?: string };
      const ingestionCapability = youtubeCapability();
      const scrapedDuration = await scrapeYoutubeDuration(id);
      return normalizeSourceMetadata({
        provider: "youtube",
        url: normalizedUrl,
        normalizedUrl,
        externalId: id,
        title: json.title || "YouTube video",
        author: json.author_name || null,
        durationSeconds: scrapedDuration,
        thumbnailUrl: json.thumbnail_url || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
        privacy: "public",
        embeddable: true,
        canImport: ingestionCapability === "FULL_IMPORT",
        ingestionCapability,
        mediaUrl: null,
        importMode: ingestionCapability === "FULL_IMPORT" ? "authorized_api" : "unavailable",
        fallback: ingestionCapability === "FULL_IMPORT" ? null : "upload",
        message: capabilityMessage(ingestionCapability, "youtube"),
        metadata: { oembed: true },
      });
    }
  } catch (error) {
    if (error instanceof IngestFailure) throw error;
  }
  const ingestionCapability = youtubeCapability();
  const scrapedDuration = await scrapeYoutubeDuration(id);
  return normalizeSourceMetadata({
    provider: "youtube",
    url: normalizedUrl,
    normalizedUrl,
    externalId: id,
    title: "YouTube video",
    author: null,
    durationSeconds: scrapedDuration,
    thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    privacy: "unknown",
    embeddable: null,
    canImport: ingestionCapability === "FULL_IMPORT",
    ingestionCapability,
    mediaUrl: null,
    importMode: ingestionCapability === "FULL_IMPORT" ? "authorized_api" : "unavailable",
    fallback: ingestionCapability === "FULL_IMPORT" ? null : "upload",
    message: capabilityMessage(ingestionCapability, "youtube"),
    metadata: { oembed: false },
  });
}

export function parseIsoDuration(value?: string | null): number | null {
  if (!value) return null;
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i.exec(value);
  if (!match) return null;
  const hours = Number(match[1] || 0);
  const minutes = Number(match[2] || 0);
  const seconds = Number(match[3] || 0);
  return hours * 3600 + minutes * 60 + seconds;
}

export function parseYoutubeDurationFromHtml(html: string): number | null {
  const length = /"lengthSeconds":"(\d+)"/.exec(html);
  if (length) return Number(length[1]);
  const ms = /"approxDurationMs":"(\d+)"/.exec(html);
  if (ms) return Number(ms[1]) / 1000;
  return null;
}

async function scrapeYoutubeDuration(id: string): Promise<number | null> {
  try {
    const res = await fetch(`https://www.youtube.com/watch?v=${id}`, {
      headers: {
        Accept: "text/html",
        "User-Agent": "Mozilla/5.0 (compatible; TheDigitalGifter-ClipFactory/1.0)",
      },
    });
    if (!res.ok) return null;
    const html = await res.text();
    return parseYoutubeDurationFromHtml(html);
  } catch {
    return null;
  }
}

export const youtubeAdapter: VideoSourceAdapter = {
  id: "youtube",
  detect(raw) {
    return Boolean(extractYoutubeId(raw));
  },
  validate(raw) {
    const parsed = parsePublicHttpUrl(raw);
    if (!parsed.ok) return parsed;
    const id = extractYoutubeId(raw);
    if (!id) return { ok: false, code: "invalid_url", message: "That YouTube URL is missing a video id." };
    return { ok: true, url: normalizeYoutubeUrl(id) };
  },
  async getMetadata(raw) {
    const id = extractYoutubeId(raw);
    if (!id) throw new IngestFailure("invalid_url", "That YouTube URL is missing a video id.");
    return fetchYoutubeMetadata(id);
  },
  canImport(metadata) {
    return metadata.ingestionCapability === "FULL_IMPORT" && youtubeAuthorizedImportConfigured();
  },
  async import() {
    throw new IngestFailure(
      "import_unavailable",
      youtubeFallbackMessage(),
    );
  },
};
