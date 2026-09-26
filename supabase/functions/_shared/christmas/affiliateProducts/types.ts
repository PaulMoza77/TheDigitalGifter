/**
 * Affiliate product provider contract (V1).
 *
 * Frontend and Concierge consume AffiliateProduct only.
 * Additional providers (Awin, Amazon) must normalize to this shape
 * without changing Gift Concierge UI.
 *
 * Do not scrape retailer HTML. Official provider APIs / feeds only.
 */

export const AFFILIATE_PROVIDERS = ["ebay", "awin", "amazon"] as const;
export type AffiliateProviderId = (typeof AFFILIATE_PROVIDERS)[number];

export const AFFILIATE_SEARCH_SOURCES = ["idea", "recipient_search"] as const;
export type AffiliateSearchSource = (typeof AFFILIATE_SEARCH_SOURCES)[number];

export type AffiliateProductAvailability = "in_stock" | "limited" | "unavailable" | "unknown";

export type AffiliateProduct = {
  provider: AffiliateProviderId;
  externalProductId: string;
  title: string;
  description?: string;
  imageUrl?: string;
  merchant: string;
  price: number;
  currency: string;
  originalPrice?: number;
  availability?: AffiliateProductAvailability;
  deliveryStart?: string;
  deliveryEnd?: string;
  affiliateUrl: string;
  productUrl?: string;
  category?: string;
  condition?: string;
  providerRank?: number;
  /** ISO timestamp from the provider fetch/normalization boundary when available. */
  checkedAt?: string;
  /** Strong product identifiers used for exact cross-provider comparison. */
  gtin?: string;
  upc?: string;
  ean?: string;
  isbn?: string;
  mpn?: string;
  brand?: string;
  model?: string;
  metadata?: Record<string, string | number | boolean | null>;
};

export type AffiliateSearchRequest = {
  query: string;
  source: AffiliateSearchSource;
  provider?: AffiliateProviderId;
  countryCode?: string | null;
  locale?: string | null;
  currency?: string | null;
  priceMinMinor?: number | null;
  priceMaxMinor?: number | null;
  condition?: "new" | "any" | null;
  limit?: number | null;
  deliveryCountry?: string | null;
  /** Opaque gc_* reference only · never PII. */
  affiliateReferenceId?: string | null;
};

export type AffiliateProviderStatusCode =
  | "ENABLED"
  | "DISABLED_FEATURE_FLAG"
  | "DISABLED_MISSING_CREDENTIALS"
  | "DISABLED_NO_PRODUCTION_ACCESS"
  | "DISABLED_NOT_IMPLEMENTED";

export type AffiliateProviderStatus = {
  provider: AffiliateProviderId;
  code: AffiliateProviderStatusCode;
  enabled: boolean;
};

export type AffiliateSearchResult = {
  ok: boolean;
  enabled: boolean;
  provider: AffiliateProviderId;
  marketplace: string | null;
  products: AffiliateProduct[];
  cached?: boolean;
  reason?: string;
  status: AffiliateProviderStatus;
};

export type AffiliateProvider = {
  id: AffiliateProviderId;
  status(): AffiliateProviderStatus;
  search(input: NormalizedAffiliateSearch): Promise<AffiliateSearchResult>;
};

export type NormalizedAffiliateSearch = {
  query: string;
  source: AffiliateSearchSource;
  countryCode: string | null;
  locale: string;
  currency: string | null;
  priceMinMinor: number | null;
  priceMaxMinor: number | null;
  condition: "new" | "any";
  limit: number;
  deliveryCountry: string | null;
  affiliateReferenceId: string;
  marketplace: string;
};

/**
 * Future AwinProvider:
 * - Ingest official Awin product feeds (name, description, price, images, deep link).
 * - Map deep link → affiliateUrl. Do not rewrite tracking params unless Awin documents it.
 * - Preserve feed order unless Awin permits ranking.
 *
 * Future AmazonProvider:
 * - Marketplace-specific Associates / Creators API only.
 * - Requires valid Associates credentials per marketplace.
 * - Never scrape amazon.com / amazon.de HTML.
 */
export type FutureProviderNotes = {
  awin: "feed_plus_deeplink";
  amazon: "associates_or_creators_api";
};
