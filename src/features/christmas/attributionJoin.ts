/**
 * Christmas attribution join helpers (client + admin + contract tests).
 * Server checkout/fulfill mirrors these rules — first-touch wins, never wipe affiliate_ref.
 */

export const CHRISTMAS_AFFILIATE_STORAGE_KEY = "affiliate_ref";
export const CHRISTMAS_FUNNEL_SESSION_KEY = "tdg.christmas.funnel.session.v1";

export function newFunnelSessionFallback(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const r = (Math.random() * 16) | 0;
    const v = char === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function christmasPurchaseEventId(orderId: string): string {
  const id = String(orderId || "").trim();
  return id ? `xmas_purchase_${id}` : "";
}

export function christmasInitiateCheckoutEventId(orderId: string): string {
  const id = String(orderId || "").trim();
  return id ? `xmas_ic_${id}` : "";
}

export type ChristmasAttributionFields = {
  landing_path: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  affiliate_ref: string | null;
  campaign_id: string | null;
  adset_id: string | null;
  ad_id: string | null;
  funnel_session_id: string | null;
  has_meta_click: boolean;
};

const EMPTY_ATTR: ChristmasAttributionFields = {
  landing_path: null,
  utm_source: null,
  utm_medium: null,
  utm_campaign: null,
  utm_content: null,
  utm_term: null,
  affiliate_ref: null,
  campaign_id: null,
  adset_id: null,
  ad_id: null,
  funnel_session_id: null,
  has_meta_click: false,
};

function asText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/[<>]/.test(trimmed)) return null;
  if (/@/.test(trimmed)) return null;
  if (/^https?:/i.test(trimmed)) return null;
  if (/[\u0000-\u001F]/.test(trimmed)) return null;
  return trimmed.slice(0, 120);
}

/** Existing first-touch values win. Empty incoming must not wipe affiliate_ref or UTMs. */
export function coalesceChristmasAttribution(
  existing: Partial<ChristmasAttributionFields> | null | undefined,
  incoming: Partial<ChristmasAttributionFields> | null | undefined,
): ChristmasAttributionFields {
  const prev = existing || {};
  const next = incoming || {};
  const pick = (key: keyof Omit<ChristmasAttributionFields, "has_meta_click">): string | null =>
    asText(prev[key]) || asText(next[key]) || null;
  return {
    landing_path: pick("landing_path"),
    utm_source: pick("utm_source"),
    utm_medium: pick("utm_medium"),
    utm_campaign: pick("utm_campaign"),
    utm_content: pick("utm_content"),
    utm_term: pick("utm_term"),
    affiliate_ref: pick("affiliate_ref"),
    campaign_id: pick("campaign_id"),
    adset_id: pick("adset_id"),
    ad_id: pick("ad_id"),
    funnel_session_id: pick("funnel_session_id"),
    has_meta_click: Boolean(prev.has_meta_click || next.has_meta_click),
  };
}

export function emptyChristmasAttribution(): ChristmasAttributionFields {
  return { ...EMPTY_ATTR };
}

export type ChristmasUtmMixRow = {
  utm_source: string | null;
  utm_campaign: string | null;
  affiliate_ref: string | null;
  payment_status?: string | null;
  product_key?: string | null;
};

export type ChristmasUtmMixBucket = {
  source: string;
  orders: number;
  paid: number;
  affiliate: number;
  campaigns: string[];
};

export function christmasUtmMix(rows: ChristmasUtmMixRow[]): {
  total: number;
  paid: number;
  withUtm: number;
  withAffiliate: number;
  buckets: ChristmasUtmMixBucket[];
} {
  const bySource = new Map<string, ChristmasUtmMixBucket>();
  let paid = 0;
  let withUtm = 0;
  let withAffiliate = 0;
  for (const row of rows) {
    const source = asText(row.utm_source) || "(none)";
    const campaign = asText(row.utm_campaign);
    const isPaid = row.payment_status === "paid";
    const hasAffiliate = Boolean(asText(row.affiliate_ref));
    if (isPaid) paid += 1;
    if (source !== "(none)") withUtm += 1;
    if (hasAffiliate) withAffiliate += 1;
    const bucket = bySource.get(source) || {
      source,
      orders: 0,
      paid: 0,
      affiliate: 0,
      campaigns: [],
    };
    bucket.orders += 1;
    if (isPaid) bucket.paid += 1;
    if (hasAffiliate) bucket.affiliate += 1;
    if (campaign && !bucket.campaigns.includes(campaign)) bucket.campaigns.push(campaign);
    bySource.set(source, bucket);
  }
  const buckets = [...bySource.values()].sort((a, b) => b.orders - a.orders || a.source.localeCompare(b.source));
  return { total: rows.length, paid, withUtm, withAffiliate, buckets };
}
