import { capabilityMessage } from "./capability";
import { detectUrlAdapter } from "./registry";
import { parsePublicHttpUrl } from "./ssrf";
import type { IngestionCapability } from "./capability";
import type { IngestErrorCode, SourceMetadata, VideoProvider } from "./types";

export type UrlClassification =
  | {
      ok: true;
      provider: VideoProvider;
      url: string;
      normalizedUrl: string;
      canImport: boolean;
      ingestionCapability: IngestionCapability;
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
  if (adapter.id === "direct") {
    return {
      ok: true,
      provider: "direct",
      url: validated.url,
      normalizedUrl: validated.url,
      canImport: true,
      ingestionCapability: "FULL_IMPORT",
      importMode: "direct_download",
      fallback: null,
      message: capabilityMessage("FULL_IMPORT", "direct"),
    };
  }
  const youtubeImporter = Boolean(String(process.env.CLIP_FACTORY_YOUTUBE_IMPORT_URL || "").trim());
  const vimeoToken = Boolean(String(process.env.VIMEO_ACCESS_TOKEN || "").trim());
  if (adapter.id === "youtube") {
    const capability: IngestionCapability = youtubeImporter ? "FULL_IMPORT" : "REFERENCE_ONLY";
    return {
      ok: true,
      provider: "youtube",
      url: validated.url,
      normalizedUrl: validated.url,
      canImport: capability === "FULL_IMPORT",
      ingestionCapability: capability,
      importMode: youtubeImporter ? "authorized_api" : "unavailable",
      fallback: youtubeImporter ? null : "upload",
      message: capabilityMessage(capability, "youtube"),
    };
  }
  if (adapter.id === "vimeo") {
    const capability: IngestionCapability = vimeoToken ? "AUTHORIZED_IMPORT_REQUIRED" : "REFERENCE_ONLY";
    return {
      ok: true,
      provider: "vimeo",
      url: validated.url,
      normalizedUrl: validated.url,
      canImport: false,
      ingestionCapability: capability,
      importMode: vimeoToken ? "authorized_api" : "unavailable",
      fallback: "upload",
      message: capabilityMessage(capability, "vimeo"),
    };
  }
  return {
    ok: true,
    provider: adapter.id,
    url: validated.url,
    normalizedUrl: validated.url,
    canImport: false,
    ingestionCapability: "REFERENCE_ONLY",
    importMode: "unavailable",
    fallback: "upload",
    message: capabilityMessage("REFERENCE_ONLY", adapter.id),
  };
}

export function sourceKindForProvider(provider: VideoProvider): string {
  if (provider === "direct") return "direct_media_url";
  if (provider === "youtube" || provider === "vimeo") return provider;
  if (provider === "upload" || provider === "library") return provider;
  return "supported_external_source";
}
