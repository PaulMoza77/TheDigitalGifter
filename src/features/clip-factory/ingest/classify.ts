import { detectUrlAdapter } from "./registry";
import { parsePublicHttpUrl } from "./ssrf";
import type { IngestErrorCode, SourceMetadata, VideoProvider } from "./types";

export type UrlClassification =
  | {
      ok: true;
      provider: VideoProvider;
      url: string;
      normalizedUrl: string;
      canImport: boolean;
      importMode: SourceMetadata["importMode"];
      fallback?: "upload" | null;
      message?: string | null;
    }
  | { ok: false; code: IngestErrorCode; message: string; host?: string };

export function classifyVideoUrl(raw: string): UrlClassification {
  const parsed = parsePublicHttpUrl(raw);
  if (!parsed.ok) {
    return {
      ok: false,
      code: parsed.code === "unsupported_protocol" ? "ssrf_blocked" : parsed.code,
      message: parsed.message,
    };
  }
  const adapter = detectUrlAdapter(raw);
  if (!adapter) {
    return { ok: false, code: "invalid_url", message: "That does not look like a supported video URL." };
  }
  const validated = adapter.validate(raw);
  if (!validated.ok) {
    return { ok: false, code: validated.code, message: validated.message, host: parsed.url.hostname };
  }
  const canImport =
    adapter.id === "direct" ||
    (adapter.id === "youtube" && Boolean(String(process.env.CLIP_FACTORY_YOUTUBE_IMPORT_URL || "").trim())) ||
    (adapter.id === "vimeo" && Boolean(String(process.env.VIMEO_ACCESS_TOKEN || "").trim()));
  return {
    ok: true,
    provider: adapter.id,
    url: validated.url,
    normalizedUrl: validated.url,
    canImport: adapter.id === "direct" ? true : canImport,
    importMode: adapter.id === "direct" ? "direct_download" : canImport ? "authorized_api" : "unavailable",
    fallback: adapter.id === "direct" || canImport ? null : "upload",
    message:
      adapter.id === "direct" || canImport
        ? null
        : "YouTube source detected. Provide the original media to continue.",
  };
}

export function sourceKindForProvider(provider: VideoProvider): string {
  if (provider === "direct") return "direct_media_url";
  if (provider === "youtube" || provider === "vimeo") return provider;
  if (provider === "upload" || provider === "library") return provider;
  return "supported_external_source";
}
