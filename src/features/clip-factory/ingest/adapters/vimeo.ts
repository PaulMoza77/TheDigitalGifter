import { IngestFailure, type VideoSourceAdapter } from "../types";
import { parsePublicHttpUrl } from "../ssrf";

const VIMEO_HOST = /(^|\.)vimeo\.com$/i;

export function extractVimeoId(raw: string): string | null {
  const parsed = parsePublicHttpUrl(raw);
  if (!parsed.ok) return null;
  if (!VIMEO_HOST.test(parsed.url.hostname.toLowerCase())) return null;
  const parts = parsed.url.pathname.split("/").filter(Boolean);
  const numeric = [...parts].reverse().find((part) => /^\d{6,12}$/.test(part));
  return numeric || null;
}

export function vimeoAccessToken(): string {
  return String(process.env.VIMEO_ACCESS_TOKEN || "").trim();
}

export const vimeoAdapter: VideoSourceAdapter = {
  id: "vimeo",
  detect(raw) {
    return Boolean(extractVimeoId(raw));
  },
  validate(raw) {
    const parsed = parsePublicHttpUrl(raw);
    if (!parsed.ok) return parsed;
    const id = extractVimeoId(raw);
    if (!id) return { ok: false, code: "invalid_url", message: "That Vimeo URL is missing a video id." };
    return { ok: true, url: `https://vimeo.com/${id}` };
  },
  async getMetadata(raw) {
    const id = extractVimeoId(raw);
    if (!id) throw new IngestFailure("invalid_url", "That Vimeo URL is missing a video id.");
    const normalizedUrl = `https://vimeo.com/${id}`;
    const token = vimeoAccessToken();
    if (token) {
      const res = await fetch(`https://api.vimeo.com/videos/${id}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.vimeo.*+json;version=3.4" },
      });
      if (res.status === 404) throw new IngestFailure("video_unavailable", "Video is unavailable.");
      if (res.status === 403) throw new IngestFailure("source_auth_required", "Source requires authentication.");
      if (!res.ok) throw new IngestFailure("import_failed", "Could not resolve this Vimeo video. Retry.");
      const json = (await res.json()) as {
        name?: string;
        duration?: number;
        privacy?: { view?: string; download?: boolean };
        pictures?: { sizes?: Array<{ link?: string }> };
        download?: Array<{ link?: string }>;
        user?: { name?: string };
      };
      if (json.privacy?.view === "nobody" || json.privacy?.view === "password") {
        throw new IngestFailure("video_private", "Video is private.");
      }
      const canImport = Boolean(json.privacy?.download && json.download?.some((d) => d.link));
      return {
        provider: "vimeo",
        url: normalizedUrl,
        normalizedUrl,
        externalId: id,
        title: json.name || "Vimeo video",
        author: json.user?.name || null,
        durationSeconds: json.duration ?? null,
        thumbnailUrl: json.pictures?.sizes?.at(-1)?.link || null,
        privacy: json.privacy?.view === "unlisted" ? "unlisted" : "public",
        canImport,
        importMode: canImport ? "authorized_api" : "unavailable",
        fallback: canImport ? null : "upload",
        message: canImport
          ? null
          : "Automatic import isn't available for this source. Upload the original video file instead.",
      };
    }
    const oembed = new URL("https://vimeo.com/api/oembed.json");
    oembed.searchParams.set("url", normalizedUrl);
    const res = await fetch(oembed.toString(), { headers: { Accept: "application/json" } });
    if (res.status === 403 || res.status === 401) {
      throw new IngestFailure("source_auth_required", "Source requires authentication.");
    }
    if (res.status === 404) throw new IngestFailure("video_unavailable", "Video is unavailable.");
    if (!res.ok) {
      return {
        provider: "vimeo",
        url: normalizedUrl,
        normalizedUrl,
        externalId: id,
        title: "Vimeo video",
        canImport: false,
        importMode: "unavailable",
        fallback: "upload",
        message: "Automatic import isn't available for this source. Upload the original video file instead.",
      };
    }
    const json = (await res.json()) as { title?: string; author_name?: string; thumbnail_url?: string; duration?: number };
    return {
      provider: "vimeo",
      url: normalizedUrl,
      normalizedUrl,
      externalId: id,
      title: json.title || "Vimeo video",
      author: json.author_name || null,
      durationSeconds: json.duration ?? null,
      thumbnailUrl: json.thumbnail_url || null,
      privacy: "public",
      canImport: false,
      importMode: "unavailable",
      fallback: "upload",
      message: "Automatic import isn't available for this source. Upload the original video file instead.",
    };
  },
  canImport(metadata) {
    return Boolean(metadata.canImport && vimeoAccessToken());
  },
  async import() {
    throw new IngestFailure(
      "import_unavailable",
      "Automatic import isn't available for this source. Upload the original video file instead.",
    );
  },
};
