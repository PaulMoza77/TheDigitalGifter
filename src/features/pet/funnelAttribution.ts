export const FUNNEL_ATTRIBUTION_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "fbclid",
  "campaign_id",
  "adset_id",
  "ad_id",
] as const;

export type FunnelAttributionKey = (typeof FUNNEL_ATTRIBUTION_KEYS)[number];
export type FunnelAttribution = Partial<Record<FunnelAttributionKey, string>>;

export const FUNNEL_ATTRIBUTION_STORAGE_KEY = "tdg.funnel.attribution.v1";

const MAX_VALUE_LENGTH = 200;

export function sanitizeAttributionValue(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const clipped = trimmed.slice(0, MAX_VALUE_LENGTH);
  if (/[<>]/.test(clipped)) return null;
  if (/@/.test(clipped)) return null;
  if (/^https?:/i.test(clipped)) return null;
  if (/[\u0000-\u001F]/.test(clipped)) return null;
  return clipped;
}

export function parseFunnelAttributionSearch(search: string): FunnelAttribution {
  const captured: FunnelAttribution = {};
  try {
    const normalized = search.startsWith("?") || search.length === 0 ? search : `?${search}`;
    const params = new URLSearchParams(normalized);
    for (const key of FUNNEL_ATTRIBUTION_KEYS) {
      const raw = params.get(key);
      if (raw == null) continue;
      const sanitized = sanitizeAttributionValue(raw);
      if (sanitized) captured[key] = sanitized;
    }
  } catch {
    return {};
  }
  return captured;
}

function readStore(storage: Storage | undefined): FunnelAttribution {
  if (!storage) return {};
  try {
    const raw = storage.getItem(FUNNEL_ATTRIBUTION_STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const next: FunnelAttribution = {};
    for (const key of FUNNEL_ATTRIBUTION_KEYS) {
      const sanitized = sanitizeAttributionValue((parsed as Record<string, unknown>)[key]);
      if (sanitized) next[key] = sanitized;
    }
    return next;
  } catch {
    return {};
  }
}

function writeStore(storage: Storage | undefined, value: FunnelAttribution) {
  if (!storage) return;
  try {
    storage.setItem(FUNNEL_ATTRIBUTION_STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Private mode / quota must never break the funnel.
  }
}

function storages(): { session?: Storage; local?: Storage } {
  if (typeof window === "undefined") return {};
  try {
    return {
      session: window.sessionStorage,
      local: window.localStorage,
    };
  } catch {
    return {};
  }
}

export function getFunnelAttribution(): FunnelAttribution {
  try {
    const { session, local } = storages();
    const fromSession = readStore(session);
    if (Object.keys(fromSession).length > 0) return fromSession;
    return readStore(local);
  } catch {
    return {};
  }
}

export function captureFunnelAttribution(search?: string): FunnelAttribution {
  try {
    const hrefSearch = search ?? (typeof window !== "undefined" ? window.location.search : "");
    persistFirstTouchFromLocation(hrefSearch || "");

    const existing = getFunnelAttribution();
    if (Object.keys(existing).length > 0) {
      const { fbclid: _ignored, ...withoutClickId } = existing;
      return withoutClickId;
    }

    const incoming = parseFunnelAttributionSearch(hrefSearch || "");
    const { fbclid: _fbclid, ...rest } = incoming;
    if (Object.keys(rest).length === 0) return {};

    const { session, local } = storages();
    writeStore(session, rest);
    writeStore(local, rest);
    return rest;
  } catch {
    return {};
  }
}

/** Custom Meta event data must not include click IDs. */
export function attributionParamsForGa4(): FunnelAttribution {
  return getFunnelAttribution();
}

export function attributionParamsForInternal(): Omit<FunnelAttribution, "fbclid"> {
  const { fbclid: _fbclid, ...rest } = getFunnelAttribution();
  return rest;
}

export const FUNNEL_FIRST_TOUCH_KEY = "tdg.funnel.context.v1";

export type FunnelFirstTouchContext = {
  landingPathname: string | null;
  referrerHost: string | null;
  hasFbclid: boolean;
};

function referrerHostFromDocument(): string | null {
  if (typeof document === "undefined") return null;
  try {
    const referrer = String(document.referrer || "").trim();
    if (!referrer) return null;
    const host = new URL(referrer).hostname.replace(/^www\./, "").slice(0, 120);
    if (!host) return null;
    if (typeof window !== "undefined" && host === window.location.hostname.replace(/^www\./, "")) return null;
    return sanitizeAttributionValue(host);
  } catch {
    return null;
  }
}

function readFirstTouch(): FunnelFirstTouchContext | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(FUNNEL_FIRST_TOUCH_KEY) || window.localStorage.getItem(FUNNEL_FIRST_TOUCH_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const row = parsed as Record<string, unknown>;
    return {
      landingPathname: sanitizeAttributionValue(row.landingPathname)?.startsWith("/pet")
        ? String(row.landingPathname).slice(0, 64)
        : null,
      referrerHost: sanitizeAttributionValue(row.referrerHost),
      hasFbclid: row.hasFbclid === true,
    };
  } catch {
    return null;
  }
}

function writeFirstTouch(value: FunnelFirstTouchContext) {
  if (typeof window === "undefined") return;
  const json = JSON.stringify(value);
  try {
    window.sessionStorage.setItem(FUNNEL_FIRST_TOUCH_KEY, json);
  } catch {
    /* private mode */
  }
  try {
    window.localStorage.setItem(FUNNEL_FIRST_TOUCH_KEY, json);
  } catch {
    /* private mode */
  }
}

export function getFunnelFirstTouchContext(): FunnelFirstTouchContext {
  return (
    readFirstTouch() || {
      landingPathname: null,
      referrerHost: null,
      hasFbclid: false,
    }
  );
}

function persistFirstTouchFromLocation(search: string) {
  if (readFirstTouch()) return;
  const incoming = parseFunnelAttributionSearch(search || "");
  const pathname =
    typeof window !== "undefined" ? String(window.location.pathname || "").split("?")[0].slice(0, 64) : null;
  writeFirstTouch({
    landingPathname: pathname && (pathname === "/pet" || pathname.startsWith("/pet/")) ? pathname : null,
    referrerHost: referrerHostFromDocument(),
    hasFbclid: Boolean(incoming.fbclid),
  });
}
