/**
 * Node twin of supabase/functions/_shared/christmas/providerMedia.ts
 */

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

export const CHRISTMAS_MAX_IMAGE_BYTES = 25 * 1024 * 1024;
export const CHRISTMAS_MAX_VIDEO_BYTES = 120 * 1024 * 1024;
export const CHRISTMAS_MEDIA_FETCH_TIMEOUT_MS = 90_000;
export const CHRISTMAS_MAX_MEDIA_REDIRECTS = 3;

export function hostnameIsBlockedForProviderMedia(hostname: string): boolean {
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

export function assertSafeProviderMediaUrl(
  raw: string,
): { ok: true; url: URL } | { ok: false; reason: string } {
  const trimmed = String(raw || "").trim();
  if (!trimmed || trimmed.length > 2048) return { ok: false, reason: "invalid_url" };
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { ok: false, reason: "invalid_url" };
  }
  if (url.protocol !== "https:") return { ok: false, reason: "https_required" };
  if (url.username || url.password) return { ok: false, reason: "credentials_forbidden" };
  if (hostnameIsBlockedForProviderMedia(url.hostname)) {
    return { ok: false, reason: "ssrf_blocked" };
  }
  return { ok: true, url };
}

export function sniffImageMime(bytes: Uint8Array): "image/jpeg" | "image/png" | "image/webp" | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

export function looksLikeMp4(bytes: Uint8Array): boolean {
  if (bytes.length < 12) return false;
  if (
    bytes[4] === 0x66 &&
    bytes[5] === 0x74 &&
    bytes[6] === 0x79 &&
    bytes[7] === 0x70
  ) {
    return true;
  }
  const limit = Math.min(bytes.length - 4, 64);
  for (let i = 0; i < limit; i += 1) {
    if (
      bytes[i] === 0x66 &&
      bytes[i + 1] === 0x74 &&
      bytes[i + 2] === 0x79 &&
      bytes[i + 3] === 0x70
    ) {
      return true;
    }
  }
  return false;
}

export async function fetchProviderMediaBytes(
  rawUrl: string,
  options: { maxBytes: number; kind: "image" | "video"; fetchImpl?: typeof fetch },
): Promise<{ bytes: Uint8Array; contentType: string | null }> {
  const safe = assertSafeProviderMediaUrl(rawUrl);
  if (!safe.ok) throw new Error(`Unsafe provider media URL (${safe.reason})`);

  const fetchImpl = options.fetchImpl ?? fetch;
  let current = safe.url;
  for (let hop = 0; hop <= CHRISTMAS_MAX_MEDIA_REDIRECTS; hop += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CHRISTMAS_MEDIA_FETCH_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetchImpl(current.toString(), {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: { Accept: options.kind === "video" ? "video/*,*/*" : "image/*,*/*" },
      });
    } finally {
      clearTimeout(timer);
    }

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location) throw new Error("Provider media redirect missing location");
      const next = assertSafeProviderMediaUrl(new URL(location, current).toString());
      if (!next.ok) throw new Error(`Unsafe provider media redirect (${next.reason})`);
      current = next.url;
      continue;
    }

    if (!response.ok) {
      throw new Error(`Failed to download provider media (${response.status})`);
    }

    const lengthHeader = response.headers.get("content-length");
    if (lengthHeader && Number(lengthHeader) > options.maxBytes) {
      throw new Error("Provider media exceeds size limit");
    }

    const buffer = new Uint8Array(await response.arrayBuffer());
    if (buffer.byteLength <= 0) throw new Error("Provider media empty");
    if (buffer.byteLength > options.maxBytes) throw new Error("Provider media exceeds size limit");

    if (options.kind === "image") {
      const mime = sniffImageMime(buffer);
      if (!mime) throw new Error("Provider image failed technical validation");
      return { bytes: buffer, contentType: mime };
    }

    if (!looksLikeMp4(buffer)) throw new Error("Provider video failed MP4 technical validation");
    return {
      bytes: buffer,
      contentType: response.headers.get("content-type") || "video/mp4",
    };
  }

  throw new Error("Provider media redirect limit exceeded");
}
