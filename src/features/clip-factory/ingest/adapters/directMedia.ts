import { IngestFailure, type SourceMetadata, type VideoSourceAdapter } from "../types";
import { looksLikeDirectMediaPath, parsePublicHttpUrl } from "../ssrf";

const MEDIA_HOST_BLOCK = /(^|\.)youtube\.com$|(^|\.)youtu\.be$|(^|\.)youtube-nocookie\.com$|(^|\.)vimeo\.com$|(^|\.)tiktok\.com$/i;

export const directMediaAdapter: VideoSourceAdapter = {
  id: "direct",
  detect(raw) {
    const parsed = parsePublicHttpUrl(raw);
    if (!parsed.ok) return false;
    const host = parsed.url.hostname.toLowerCase();
    if (MEDIA_HOST_BLOCK.test(host)) return false;
    return looksLikeDirectMediaPath(parsed.url.pathname) || Boolean(raw.trim());
  },
  validate(raw) {
    const parsed = parsePublicHttpUrl(raw);
    if (!parsed.ok) return parsed;
    const host = parsed.url.hostname.toLowerCase();
    if (MEDIA_HOST_BLOCK.test(host)) {
      return { ok: false, code: "invalid_url", message: "This URL belongs to another provider." };
    }
    return { ok: true, url: parsed.url.toString() };
  },
  async getMetadata(raw) {
    const validated = directMediaAdapter.validate(raw);
    if (!validated.ok) throw new IngestFailure(validated.code, validated.message);
    const url = new URL(validated.url);
    return {
      provider: "direct",
      url: validated.url,
      normalizedUrl: validated.url,
      title: decodeURIComponent(url.pathname.split("/").pop() || "Direct video"),
      canImport: true,
      importMode: "direct_download",
      fallback: null,
      privacy: "public",
    } satisfies SourceMetadata;
  },
  canImport() {
    return true;
  },
  async import() {
    throw new IngestFailure("import_failed", "Direct media import runs on the origin worker.");
  },
};
