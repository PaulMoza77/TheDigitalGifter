const BLOCKED_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "metadata.google.internal",
  "169.254.169.254",
  "metadata.internal",
]);

const PRIVATE_V4 =
  /^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/;

const BLOCKED_SUFFIXES = [".local", ".internal", ".localhost", ".lan", ".home", ".corp"];

export function hostnameIsBlocked(hostname: string): boolean {
  const host = String(hostname || "")
    .toLowerCase()
    .replace(/^\[|\]$/g, "")
    .replace(/\.$/, "");
  if (!host) return true;
  if (BLOCKED_HOSTS.has(host)) return true;
  if (BLOCKED_SUFFIXES.some((suffix) => host.endsWith(suffix))) return true;
  if (PRIVATE_V4.test(host)) return true;
  if (host.includes(":")) return true;
  return false;
}

export function isBlockedResolvedAddress(address: string): boolean {
  const host = String(address || "").toLowerCase();
  if (BLOCKED_HOSTS.has(host) || PRIVATE_V4.test(host)) return true;
  if (host === "::1" || host.startsWith("fe80:") || host.startsWith("fc") || host.startsWith("fd")) return true;
  if (/^::ffff:(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(host)) return true;
  return false;
}

export function parsePublicHttpUrl(raw: string): { ok: true; url: URL } | { ok: false; code: "invalid_url" | "ssrf_blocked" | "unsupported_protocol"; message: string } {
  const trimmed = String(raw || "").trim();
  if (!trimmed) {
    return { ok: false, code: "invalid_url", message: "Paste a video URL, or upload the file you have rights to use." };
  }
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { ok: false, code: "invalid_url", message: "That does not look like a valid URL." };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { ok: false, code: "unsupported_protocol", message: "Only http(s) URLs are allowed." };
  }
  if (url.username || url.password) {
    return { ok: false, code: "ssrf_blocked", message: "URLs with embedded credentials cannot be fetched." };
  }
  if (hostnameIsBlocked(url.hostname)) {
    return { ok: false, code: "ssrf_blocked", message: "That host cannot be fetched." };
  }
  return { ok: true, url };
}

export function looksLikeDirectMediaPath(pathname: string): boolean {
  return /\.(mp4|mov|m4v|webm)(\?|$)/i.test(pathname);
}

export const MAX_INGEST_BYTES = 2 * 1024 * 1024 * 1024;
export const MAX_REDIRECTS = 4;
export const DOWNLOAD_TIMEOUT_MS = 40 * 60_000;
