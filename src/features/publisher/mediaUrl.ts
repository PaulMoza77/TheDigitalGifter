export const PROVIDER_MEDIA_TTL_SEC = 90 * 60;

const CLIP_FACTORY_PREFIX = "/api/clip-factory";
const CHRISTMAS_REEL_MEDIA_PREFIX = "/api/christmas-reel-pipeline";

function asPath(src: string): string {
  const raw = String(src || "").trim();
  if (!raw) return "";
  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    try {
      const url = new URL(raw);
      return `${url.pathname}${url.search}`;
    } catch {
      return raw;
    }
  }
  return raw.startsWith("/") ? raw : `/${raw}`;
}

function normalizeApiMediaRef(path: string, prefix: string): string {
  if (!path.startsWith(prefix)) return path;
  try {
    const url = new URL(path, "https://www.thedigitalgifter.com");
    url.searchParams.delete("exp");
    url.searchParams.delete("sig");
    const search = url.searchParams.toString();
    return search ? `${url.pathname}?${search}` : url.pathname;
  } catch {
    return path.split("&exp=")[0].split("&sig=")[0];
  }
}

export function stableMediaRef(src: string): string {
  const path = asPath(src);
  if (!path || path.includes("..")) return "";
  if (path.startsWith(CLIP_FACTORY_PREFIX)) {
    return normalizeApiMediaRef(path, CLIP_FACTORY_PREFIX);
  }
  if (path.startsWith(CHRISTMAS_REEL_MEDIA_PREFIX)) {
    return normalizeApiMediaRef(path, CHRISTMAS_REEL_MEDIA_PREFIX);
  }
  if (path.startsWith("/assets/")) return path.split("?")[0];
  return path.split("?")[0] || path;
}

export function needsProviderSignature(src: string): boolean {
  return stableMediaRef(src).startsWith(CLIP_FACTORY_PREFIX);
}

export function parseClipFactoryMediaRef(
  src: string,
): { kind: "source" | "render" | "thumb"; id: string } | null {
  const stable = stableMediaRef(src);
  if (!stable.startsWith(CLIP_FACTORY_PREFIX)) return null;
  try {
    const url = new URL(stable, "https://www.thedigitalgifter.com");
    const kind = url.searchParams.get("kind");
    const id = url.searchParams.get("id");
    if (kind !== "source" && kind !== "render" && kind !== "thumb") return null;
    if (!id || id.includes("..")) return null;
    return { kind, id };
  } catch {
    return null;
  }
}

export function isPublicStaticAsset(src: string): boolean {
  const stable = stableMediaRef(src);
  return stable.startsWith("/assets/") && !stable.includes("..") && !stable.includes("://");
}
