/** Read / resolve Meta click cookies for CAPI matching. Never log returned values. */

export const META_CAPI_STORAGE_KEY = "tdg.funnel.meta_capi.v1";

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  try {
    const prefix = `${name}=`;
    const parts = document.cookie.split(";").map((part) => part.trim());
    const hit = parts.find((part) => part.startsWith(prefix));
    if (!hit) return null;
    const value = decodeURIComponent(hit.slice(prefix.length)).trim();
    return sanitizeMetaClickId(value);
  } catch {
    return null;
  }
}

/** Meta `_fbc` / `_fbp` values look like `fb.1.<ts>.<id>`. */
export function sanitizeMetaClickId(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  if (!raw || raw.length > 200) return null;
  if (!raw.startsWith("fb.")) return null;
  if (/[<>@\s]/.test(raw)) return null;
  if (!raw.includes(".")) return null;
  return raw;
}

/** Build `_fbc` from a landing `fbclid` when the Meta Pixel cookie is missing. */
export function buildMetaFbcFromFbclid(
  fbclid: string | null | undefined,
  createdAtMs: number = Date.now(),
): string | null {
  const id = String(fbclid ?? "").trim();
  if (!id || id.length > 200) return null;
  if (/[<>@\s]/.test(id)) return null;
  if (/^https?:/i.test(id)) return null;
  const ts = Number.isFinite(createdAtMs) ? Math.floor(createdAtMs) : Date.now();
  return sanitizeMetaClickId(`fb.1.${ts}.${id}`);
}

export function readMetaFbc(): string | null {
  return readCookie("_fbc");
}

export function readMetaFbp(): string | null {
  return readCookie("_fbp");
}

type MetaCapiStore = { fbc: string | null; fbp: string | null };

function readMetaCapiStore(): MetaCapiStore {
  if (typeof window === "undefined") return { fbc: null, fbp: null };
  try {
    const raw =
      window.sessionStorage.getItem(META_CAPI_STORAGE_KEY) ||
      window.localStorage.getItem(META_CAPI_STORAGE_KEY);
    if (!raw) return { fbc: null, fbp: null };
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { fbc: null, fbp: null };
    }
    const row = parsed as Record<string, unknown>;
    return {
      fbc: sanitizeMetaClickId(row.fbc),
      fbp: sanitizeMetaClickId(row.fbp),
    };
  } catch {
    return { fbc: null, fbp: null };
  }
}

function writeMetaCapiStore(value: MetaCapiStore) {
  if (typeof window === "undefined") return;
  const payload = JSON.stringify({
    fbc: value.fbc,
    fbp: value.fbp,
  });
  try {
    window.sessionStorage.setItem(META_CAPI_STORAGE_KEY, payload);
  } catch {
    /* private mode */
  }
  try {
    window.localStorage.setItem(META_CAPI_STORAGE_KEY, payload);
  } catch {
    /* private mode */
  }
}

function ensureFirstPartyFbcCookie(fbc: string) {
  if (typeof document === "undefined") return;
  if (readMetaFbc()) return;
  try {
    // 90 days — mirrors Meta's typical click cookie lifetime.
    document.cookie = `_fbc=${encodeURIComponent(fbc)}; path=/; max-age=${90 * 24 * 3600}; SameSite=Lax`;
  } catch {
    /* ignore */
  }
}

/**
 * When a Meta ad lands with `fbclid`, persist a CAPI-ready `_fbc` even if Pixel
 * has not set the cookie yet. Raw `fbclid` is never written to analytics stores.
 */
export function captureMetaCapiClickIdsFromSearch(search: string): void {
  try {
    const normalized = search.startsWith("?") || search.length === 0 ? search : `?${search}`;
    const params = new URLSearchParams(normalized);
    const fbclid = params.get("fbclid");
    const constructed = buildMetaFbcFromFbclid(fbclid);
    const cookieFbc = readMetaFbc();
    const cookieFbp = readMetaFbp();
    const existing = readMetaCapiStore();
    const next: MetaCapiStore = {
      fbc: cookieFbc || existing.fbc || constructed,
      fbp: cookieFbp || existing.fbp,
    };
    if (next.fbc || next.fbp) writeMetaCapiStore(next);
    if (next.fbc) ensureFirstPartyFbcCookie(next.fbc);
  } catch {
    /* never break the funnel */
  }
}

/** Prefer live cookies; fall back to first-touch constructed `_fbc`. */
export function getMetaCapiClickIds(): {
  fbc: string | null;
  fbp: string | null;
  hasMetaClick: boolean;
} {
  const stored = readMetaCapiStore();
  const fbc = readMetaFbc() || stored.fbc;
  const fbp = readMetaFbp() || stored.fbp;
  return {
    fbc,
    fbp,
    hasMetaClick: Boolean(fbc),
  };
}
