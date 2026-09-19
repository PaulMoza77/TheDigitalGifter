const BLOCKED_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "metadata.google.internal",
  "169.254.169.254",
]);

const PRIVATE_V4 =
  /^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/;

const YOUTUBE_HOST = /(^|\.)youtube\.com$|(^|\.)youtu\.be$|(^|\.)youtube-nocookie\.com$/i;
const VIMEO_HOST = /(^|\.)vimeo\.com$/i;
const TIKTOK_HOST = /(^|\.)tiktok\.com$/i;

export type UrlIngestDecision =
  | { ok: true; kind: "direct_media_url"; url: string }
  | { ok: false; code: "unsupported_external_source" | "ssrf_blocked" | "invalid_url"; message: string; host?: string };

export function classifyMediaUrl(raw: string): UrlIngestDecision {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return { ok: false, code: "invalid_url", message: "Paste a direct video URL, or upload the file you have rights to use." };
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { ok: false, code: "invalid_url", message: "That does not look like a valid URL." };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { ok: false, code: "ssrf_blocked", message: "Only http(s) URLs are allowed." };
  }
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (BLOCKED_HOSTS.has(host) || host.endsWith(".local") || host.endsWith(".internal")) {
    return { ok: false, code: "ssrf_blocked", message: "That host cannot be fetched." };
  }
  if (PRIVATE_V4.test(host) || host.includes(":")) {
    return { ok: false, code: "ssrf_blocked", message: "Internal or IPv6 addresses cannot be fetched." };
  }
  if (YOUTUBE_HOST.test(host) || VIMEO_HOST.test(host) || TIKTOK_HOST.test(host)) {
    return {
      ok: false,
      code: "unsupported_external_source",
      host,
      message:
        "This source cannot be imported automatically. Download or export a file you have rights to use, then upload it here.",
    };
  }
  return { ok: true, kind: "direct_media_url", url: url.toString() };
}

export function isBlockedResolvedAddress(address: string): boolean {
  const host = String(address || "").toLowerCase();
  if (BLOCKED_HOSTS.has(host) || PRIVATE_V4.test(host)) return true;
  if (host === "::1" || host.startsWith("fe80:") || host.startsWith("fc") || host.startsWith("fd")) return true;
  return false;
}

export function looksLikeDirectMediaPath(pathname: string): boolean {
  return /\.(mp4|mov|m4v|webm)(\?|$)/i.test(pathname);
}
