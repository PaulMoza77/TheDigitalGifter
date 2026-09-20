import { classifyVideoUrl, type UrlClassification } from "./ingest/classify";
import { isBlockedResolvedAddress, looksLikeDirectMediaPath } from "./ingest/ssrf";

export type UrlIngestDecision =
  | { ok: true; kind: "direct_media_url" | "youtube" | "vimeo" | "tiktok"; url: string; canImport: boolean }
  | { ok: false; code: "unsupported_external_source" | "ssrf_blocked" | "invalid_url" | "import_unavailable"; message: string; host?: string };

/** Classify a pasted URL. YouTube/Vimeo are detected, not blanket-rejected. */
export function classifyMediaUrl(raw: string): UrlIngestDecision {
  const decision = classifyVideoUrl(raw);
  if (!decision.ok) {
    return {
      ok: false,
      code: decision.code === "import_unavailable" ? "import_unavailable" : decision.code === "ssrf_blocked" ? "ssrf_blocked" : "invalid_url",
      message: decision.message,
    };
  }
  if (decision.provider === "direct") {
    return { ok: true, kind: "direct_media_url", url: decision.url, canImport: true };
  }
  if (decision.provider === "youtube" || decision.provider === "vimeo" || decision.provider === "tiktok") {
    return { ok: true, kind: decision.provider, url: decision.url, canImport: decision.canImport };
  }
  return { ok: false, code: "invalid_url", message: "Unsupported URL." };
}

export { isBlockedResolvedAddress, looksLikeDirectMediaPath };
export type { UrlClassification };
