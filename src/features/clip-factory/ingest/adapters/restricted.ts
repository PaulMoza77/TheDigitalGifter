import { capabilityMessage } from "../capability";
import { IngestFailure, normalizeSourceMetadata, type VideoSourceAdapter } from "../types";
import { parsePublicHttpUrl } from "../ssrf";

const TIKTOK_HOST = /(^|\.)tiktok\.com$/i;

export const tiktokAdapter: VideoSourceAdapter = {
  id: "tiktok",
  detect(raw) {
    const parsed = parsePublicHttpUrl(raw);
    return parsed.ok && TIKTOK_HOST.test(parsed.url.hostname.toLowerCase());
  },
  validate(raw) {
    const parsed = parsePublicHttpUrl(raw);
    if (!parsed.ok) return parsed;
    if (!TIKTOK_HOST.test(parsed.url.hostname.toLowerCase())) {
      return { ok: false, code: "invalid_url", message: "Not a TikTok URL." };
    }
    return { ok: true, url: parsed.url.toString() };
  },
  async getMetadata(raw) {
    const validated = tiktokAdapter.validate(raw);
    if (!validated.ok) throw new IngestFailure(validated.code, validated.message);
    return normalizeSourceMetadata({
      provider: "tiktok",
      url: validated.url,
      normalizedUrl: validated.url,
      title: "TikTok video",
      canImport: false,
      ingestionCapability: "REFERENCE_ONLY",
      mediaUrl: null,
      importMode: "unavailable",
      fallback: "upload",
      message: capabilityMessage("REFERENCE_ONLY", "tiktok"),
    });
  },
  canImport() {
    return false;
  },
  async import() {
    throw new IngestFailure(
      "import_unavailable",
      "Automatic import isn't available for this source. Upload the original video file instead.",
    );
  },
};
