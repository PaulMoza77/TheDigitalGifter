import type { ChristmasEventRow } from "./christmasAdminTypes";

const SEARCH = "affiliate_product_search";
const VIEWED = "affiliate_product_results_viewed";
const CLICK = "affiliate_product_clicked";
const ADDED = "affiliate_product_added_to_planner";
const FAILED = "affiliate_product_search_failed";

function meta(row: ChristmasEventRow): Record<string, unknown> {
  return row.metadata && typeof row.metadata === "object" ? row.metadata : {};
}

function ratio(num: number, den: number): number | null {
  if (!den) return null;
  return num / den;
}

function pct(num: number, den: number): string {
  const r = ratio(num, den);
  if (r == null) return "—";
  return `${Math.round(r * 1000) / 10}%`;
}

function count(rows: ChristmasEventRow[], name: string) {
  return rows.filter((r) => r.event_name === name).length;
}

export type AffiliateFunnelMetrics = {
  searches: number;
  resultsViewed: number;
  clicks: number;
  added: number;
  failures: number;
  failureRate: string;
  searchToClickCtr: string;
  resultsToAddRate: string;
  clicksPerSearch: string;
  clicksBySource: { giftIdea: number; recipientSearch: number };
  lastSearchAt: string | null;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastErrorReason: string | null;
  lastRateLimitedAt: string | null;
  breakdowns: {
    byProvider: Array<{ key: string; searches: number; clicks: number; added: number }>;
    byMarketplace: Array<{ key: string; searches: number; clicks: number }>;
    byPriceBucket: Array<{ key: string; searches: number; clicks: number; added: number }>;
    byDate: Array<{ key: string; searches: number; clicks: number; added: number }>;
  };
};

function groupCount(
  rows: ChristmasEventRow[],
  names: string[],
  keyOf: (row: ChristmasEventRow) => string,
): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) {
    if (!names.includes(row.event_name)) continue;
    const key = keyOf(row) || "unknown";
    map.set(key, (map.get(key) || 0) + 1);
  }
  return map;
}

function mergeKeys(...maps: Array<Map<string, number>>): string[] {
  const keys = new Set<string>();
  for (const map of maps) for (const key of map.keys()) keys.add(key);
  return [...keys].sort();
}

export function affiliateEventsOnly(rows: ChristmasEventRow[]): ChristmasEventRow[] {
  return rows.filter((row) => row.event_name.startsWith("affiliate_product") || row.event_name === "affiliate_products_opened");
}

export function computeAffiliateFunnelMetrics(rows: ChristmasEventRow[]): AffiliateFunnelMetrics {
  const events = affiliateEventsOnly(rows);
  const searches = count(events, SEARCH);
  const resultsViewed = count(events, VIEWED);
  const clicks = count(events, CLICK);
  const added = count(events, ADDED);
  const failures = count(events, FAILED);
  const ideaClicks = events.filter((r) => r.event_name === CLICK && meta(r).source === "idea").length;
  const recipientClicks = events.filter((r) => r.event_name === CLICK && meta(r).source === "recipient_search").length;

  const last = (name: string) => events.find((r) => r.event_name === name)?.created_at || null;
  const failed = events.filter((r) => r.event_name === FAILED);
  const rateLimited = failed.find((r) => String(meta(r).reason || "") === "rate_limited");

  const providerSearch = groupCount(events, [SEARCH], (r) => String(meta(r).provider || "ebay"));
  const providerClick = groupCount(events, [CLICK], (r) => String(meta(r).provider || "ebay"));
  const providerAdd = groupCount(events, [ADDED], (r) => String(meta(r).provider || "ebay"));
  const marketSearch = groupCount(events, [VIEWED], (r) => String(meta(r).marketplace || "unknown"));
  const marketClick = groupCount(events, [CLICK], (r) => String(meta(r).marketplace || "unknown"));
  const bucketSearch = groupCount(events, [SEARCH], (r) => String(meta(r).price_bucket || "unknown"));
  const bucketClick = groupCount(events, [CLICK], (r) => String(meta(r).price_bucket || "unknown"));
  const bucketAdd = groupCount(events, [ADDED], (r) => String(meta(r).price_bucket || "unknown"));
  const dateSearch = groupCount(events, [SEARCH], (r) => String(r.created_at || "").slice(0, 10));
  const dateClick = groupCount(events, [CLICK], (r) => String(r.created_at || "").slice(0, 10));
  const dateAdd = groupCount(events, [ADDED], (r) => String(r.created_at || "").slice(0, 10));

  return {
    searches,
    resultsViewed,
    clicks,
    added,
    failures,
    failureRate: pct(failures, searches + failures || searches),
    searchToClickCtr: pct(clicks, searches),
    resultsToAddRate: pct(added, resultsViewed),
    clicksPerSearch: ratio(clicks, searches) == null ? "—" : String(Math.round((clicks / searches) * 100) / 100),
    clicksBySource: { giftIdea: ideaClicks, recipientSearch: recipientClicks },
    lastSearchAt: last(SEARCH),
    lastSuccessAt: last(VIEWED),
    lastErrorAt: failed[0]?.created_at || null,
    lastErrorReason: failed[0] ? String(meta(failed[0]).reason || "provider_unavailable") : null,
    lastRateLimitedAt: rateLimited?.created_at || null,
    breakdowns: {
      byProvider: mergeKeys(providerSearch, providerClick, providerAdd).map((key) => ({
        key,
        searches: providerSearch.get(key) || 0,
        clicks: providerClick.get(key) || 0,
        added: providerAdd.get(key) || 0,
      })),
      byMarketplace: mergeKeys(marketSearch, marketClick).map((key) => ({
        key,
        searches: marketSearch.get(key) || 0,
        clicks: marketClick.get(key) || 0,
      })),
      byPriceBucket: mergeKeys(bucketSearch, bucketClick, bucketAdd).map((key) => ({
        key,
        searches: bucketSearch.get(key) || 0,
        clicks: bucketClick.get(key) || 0,
        added: bucketAdd.get(key) || 0,
      })),
      byDate: mergeKeys(dateSearch, dateClick, dateAdd)
        .sort()
        .reverse()
        .slice(0, 14)
        .map((key) => ({
          key,
          searches: dateSearch.get(key) || 0,
          clicks: dateClick.get(key) || 0,
          added: dateAdd.get(key) || 0,
        })),
    },
  };
}

export function adminPayloadHasSecrets(payload: unknown): boolean {
  const raw = JSON.stringify(payload || {});
  return /EBAY_CLIENT_SECRET|client_secret|access_token|Bearer\s+[A-Za-z0-9._-]+/i.test(raw);
}

export function adminPayloadHasPii(payload: unknown): boolean {
  const raw = JSON.stringify(payload || {});
  return /display_name|"notes"|@gmail\.|recipient_name/i.test(raw);
}
