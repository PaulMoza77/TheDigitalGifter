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
    const existing = getFunnelAttribution();
    if (Object.keys(existing).length > 0) return existing;

    const hrefSearch =
      search ?? (typeof window !== "undefined" ? window.location.search : "");
    const incoming = parseFunnelAttributionSearch(hrefSearch || "");
    if (Object.keys(incoming).length === 0) return {};

    const { session, local } = storages();
    writeStore(session, incoming);
    writeStore(local, incoming);
    return incoming;
  } catch {
    return {};
  }
}

/** Custom Meta event data must not include click IDs. */
export function attributionParamsForGa4(): FunnelAttribution {
  return getFunnelAttribution();
}
