import { IngestFailure, normalizeSourceMetadata, type SourceMetadata, type VideoSourceAdapter } from "../types";
import { looksLikeDirectMediaPath, parsePublicHttpUrl } from "../ssrf";

const MEDIA_HOST_BLOCK = /(^|\.)youtube\.com$|(^|\.)youtu\.be$|(^|\.)youtube-nocookie\.com$|(^|\.)vimeo\.com$|(^|\.)tiktok\.com$/i;

function isOwnedLibraryHost(host: string): boolean {
  return /(^|\.)thedigitalgifter\.com$/i.test(host);
}

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
    const mediaPath = looksLikeDirectMediaPath(url.pathname);
    const owned = isOwnedLibraryHost(url.hostname);
    const fullImport = mediaPath || owned;
    return normalizeSourceMetadata({
      provider: "direct",
      sourceType: owned ? "library" : "direct",
      url: validated.url,
      normalizedUrl: validated.url,
      title: decodeURIComponent(url.pathname.split("/").pop() || "Direct video"),
      author: owned ? "The Digital Gifter" : null,
      canImport: fullImport,
      ingestionCapability: fullImport ? "FULL_IMPORT" : "UNSUPPORTED",
      mediaUrl: fullImport ? validated.url : null,
      importMode: owned ? "library" : "direct_download",
      fallback: fullImport ? null : "upload",
      privacy: "public",
      message: fullImport
        ? "Authorized media is available. Generate Clips will ingest this URL automatically."
        : "This URL is not a direct media file. Paste an https video file, Library item, or supported source.",
      metadata: { host: url.hostname, ownedLibrary: owned },
    });
  },
  canImport(metadata) {
    return metadata.ingestionCapability === "FULL_IMPORT";
  },
  async import() {
    throw new IngestFailure("import_failed", "Direct media import runs on the origin worker.");
  },
};
