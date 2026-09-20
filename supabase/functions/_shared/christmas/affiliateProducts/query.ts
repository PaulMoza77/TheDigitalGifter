import type {
  AffiliateProviderId,
  AffiliateSearchRequest,
  AffiliateSearchSource,
  NormalizedAffiliateSearch,
} from "./types.ts";
import { AFFILIATE_PROVIDERS } from "./types.ts";
import { coarseDeliveryCountry, resolveEbayMarketplace } from "./marketplace.ts";

export const AFFILIATE_QUERY_MAX_LEN = 80;
export const AFFILIATE_RESULT_LIMIT_MIN = 4;
export const AFFILIATE_RESULT_LIMIT_MAX = 8;
export const AFFILIATE_PRICE_MINOR_MAX = 10_000_000;

const EMAIL_RE = /\b\S+@\S+\.\S+\b/g;
const URL_RE = /https?:\/\/\S+/gi;
const CONTROL_RE = /[\u0000-\u001f]+/g;

export function sanitizeProductQuery(raw: string): string {
  const cleaned = String(raw || "")
    .replace(EMAIL_RE, " ")
    .replace(URL_RE, " ")
    .replace(CONTROL_RE, " ")
    .replace(/[<>{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, AFFILIATE_QUERY_MAX_LEN);
  return cleaned;
}

const VIBE_QUERY: Record<string, string> = {
  practical: "practical",
  meaningful: "meaningful",
  unique: "unique",
  luxury: "luxury",
  funny: "fun",
  experience: "experience",
  last_minute: "gift",
};

export function buildProductSearchQuery(input: {
  ideaTitle?: string | null;
  searchQuery?: string | null;
  interests?: string | null;
  vibeKeys?: string[] | null;
  relationshipCategory?: string | null;
}): string {
  const fromIdea = sanitizeProductQuery(String(input.searchQuery || input.ideaTitle || ""));
  if (fromIdea) return fromIdea;
  const bits = [
    sanitizeProductQuery(String(input.interests || "")),
    String(input.relationshipCategory || "")
      .replace(/_/g, " ")
      .trim()
      .slice(0, 24),
    ...(input.vibeKeys || []).map((k) => VIBE_QUERY[k] || "").filter(Boolean),
    "gift",
  ].filter(Boolean);
  const unique: string[] = [];
  for (const bit of bits) {
    const low = bit.toLowerCase();
    if (!unique.some((u) => u.toLowerCase() === low)) unique.push(bit);
  }
  return sanitizeProductQuery(unique.join(" ")) || "christmas gift";
}

export function createAffiliateReferenceId(randomBytes?: Uint8Array): string {
  const bytes = randomBytes && randomBytes.length >= 8 ? randomBytes : crypto.getRandomValues(new Uint8Array(12));
  let hex = "";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return `gc_${hex.slice(0, 24)}`;
}

export function isSafeAffiliateReferenceId(value: string | null | undefined): boolean {
  return /^gc_[a-z0-9]{8,32}$/i.test(String(value || ""));
}

export function assertNoPiiInReferenceId(value: string): boolean {
  const lower = value.toLowerCase();
  if (lower.includes("@")) return false;
  if (EMAIL_RE.test(value)) return false;
  if (/\s/.test(value)) return false;
  return isSafeAffiliateReferenceId(value);
}

export type ValidateSearchError = { ok: false; error: string };
export type ValidateSearchOk = { ok: true; value: NormalizedAffiliateSearch };

export function validateAffiliateSearchInput(
  raw: AffiliateSearchRequest & {
    ideaTitle?: string | null;
    searchQuery?: string | null;
    interests?: string | null;
    vibeKeys?: string[] | null;
    relationshipCategory?: string | null;
  },
): ValidateSearchError | ValidateSearchOk {
  const source: AffiliateSearchSource = raw.source === "idea" ? "idea" : "recipient_search";
  const providerRaw = String(raw.provider || "ebay").trim().toLowerCase();
  const provider: AffiliateProviderId = AFFILIATE_PROVIDERS.includes(providerRaw as AffiliateProviderId)
    ? (providerRaw as AffiliateProviderId)
    : "ebay";
  const query = sanitizeProductQuery(
    raw.query ||
      buildProductSearchQuery({
        ideaTitle: raw.ideaTitle,
        searchQuery: raw.searchQuery,
        interests: raw.interests,
        vibeKeys: raw.vibeKeys,
        relationshipCategory: raw.relationshipCategory,
      }),
  );
  if (query.length < 2) return { ok: false, error: "query_too_short" };

  const limitRaw = Number(raw.limit ?? AFFILIATE_RESULT_LIMIT_MAX);
  const limit = Math.min(
    AFFILIATE_RESULT_LIMIT_MAX,
    Math.max(AFFILIATE_RESULT_LIMIT_MIN, Number.isFinite(limitRaw) ? Math.round(limitRaw) : AFFILIATE_RESULT_LIMIT_MAX),
  );

  const priceMin = normalizePriceMinor(raw.priceMinMinor);
  const priceMax = normalizePriceMinor(raw.priceMaxMinor);
  if (priceMin != null && priceMax != null && priceMin > priceMax) {
    return { ok: false, error: "invalid_price_range" };
  }

  const countryCode = String(raw.countryCode || "")
    .trim()
    .toUpperCase()
    .slice(0, 2) || null;
  const locale = String(raw.locale || "en").trim().slice(0, 12) || "en";
  const marketplace = resolveEbayMarketplace({ countryCode, locale });
  const deliveryCountry = coarseDeliveryCountry(raw.deliveryCountry || countryCode);

  let affiliateReferenceId = String(raw.affiliateReferenceId || "");
  if (!isSafeAffiliateReferenceId(affiliateReferenceId)) {
    affiliateReferenceId = createAffiliateReferenceId();
  }

  return {
    ok: true,
    value: {
      query,
      source,
      provider,
      countryCode,
      locale,
      currency: String(raw.currency || "").trim().toUpperCase().slice(0, 8) || null,
      priceMinMinor: priceMin,
      priceMaxMinor: priceMax,
      condition: raw.condition === "new" ? "new" : "any",
      limit,
      deliveryCountry,
      affiliateReferenceId,
      marketplace,
    },
  };
}

function normalizePriceMinor(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  const rounded = Math.round(n);
  if (rounded > AFFILIATE_PRICE_MINOR_MAX) return null;
  return rounded;
}

export function priceBucketFromMinor(minor: number | null | undefined): string {
  if (minor == null || !Number.isFinite(minor)) return "unknown";
  const major = minor / 100;
  if (major < 25) return "under_25";
  if (major < 50) return "25_50";
  if (major < 100) return "50_100";
  return "100_plus";
}

export function searchCacheKey(input: {
  provider: string;
  marketplace: string;
  query: string;
  priceMinMinor: number | null;
  priceMaxMinor: number | null;
  condition: string;
}): string {
  return [
    input.provider,
    input.marketplace,
    input.query.toLowerCase(),
    input.priceMinMinor ?? "",
    input.priceMaxMinor ?? "",
    input.condition,
  ].join("|");
}
