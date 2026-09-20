/**
 * Affiliate product provider contract (V1.5).
 *
 * Frontend and Concierge consume AffiliateProduct only.
 * V1 searches one provider at a time. Do not merge ranked result sets
 * until provider terms and ranking rules are explicit.
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
  /** Opaque gc_* reference only — never PII. */
  affiliateReferenceId?: string | null;
};

export type AffiliateProviderStatusCode =
  | "DISABLED_FEATURE_FLAG"
  | "DISABLED_MISSING_CREDENTIALS"
  | "DISABLED_NO_PRODUCTION_ACCESS"
  | "DISABLED_NOT_IMPLEMENTED"
  | "READY"
  | "DEGRADED";

/**
 * Safe provider health. Never include secrets, tokens, or campaign values.
 */
export type AffiliateProviderHealth = {
  provider: AffiliateProviderId;
  enabled: boolean;
  configured: boolean;
  productionAccess: boolean;
  reason: AffiliateProviderStatusCode;
  /** @deprecated use reason */
  code: AffiliateProviderStatusCode;
};

export type AffiliateProviderStatus = AffiliateProviderHealth;

export type AffiliateSearchResult = {
  ok: boolean;
  enabled: boolean;
  provider: AffiliateProviderId;
  marketplace: string | null;
  products: AffiliateProduct[];
  cached?: boolean;
  reason?: string;
  status: AffiliateProviderHealth;
};

export type AffiliateLookupRequest = {
  provider: AffiliateProviderId;
  externalProductId: string;
  marketplace: string | null;
  affiliateReferenceId: string;
};

export type AffiliateLookupResult = {
  ok: boolean;
  enabled: boolean;
  provider: AffiliateProviderId;
  marketplace: string | null;
  product: AffiliateProduct | null;
  unavailable: boolean;
  reason?: string;
  status: AffiliateProviderHealth;
};

export type AffiliateProvider = {
  id: AffiliateProviderId;
  status(): AffiliateProviderHealth;
  search(input: NormalizedAffiliateSearch): Promise<AffiliateSearchResult>;
  lookup(input: AffiliateLookupRequest): Promise<AffiliateLookupResult>;
};

export type NormalizedAffiliateSearch = {
  query: string;
  source: AffiliateSearchSource;
  provider: AffiliateProviderId;
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
 * Click attribution (no PII tables):
 * - affiliateReferenceId: opaque gc_* sent to the provider (EPN customid / Awin clickref later)
 * - funnel_session_id: existing Christmas analytics session
 * - metadata.provider, metadata.source, metadata.price_bucket
 * Reconcile provider reports by matching gc_* → these events. Never encode names.
 */
export type AffiliateAttributionMap = {
  affiliateReferenceId: string;
  provider: AffiliateProviderId;
  source: AffiliateSearchSource;
  funnelSessionId?: string;
};

/**
 * Future earnings import. Do not invent commission from clicks.
 * Import later from eBay EPN reports / Awin transactions.
 */
export type AffiliateProviderTransaction = {
  provider: AffiliateProviderId;
  providerTransactionId: string;
  affiliateReferenceId: string;
  saleAmountMinor: number;
  commissionAmountMinor: number;
  currency: string;
  status: "pending" | "approved" | "paid" | "rejected" | "unknown";
  transactionDate: string;
};

export const AFFILIATE_REVENUE_SEAM = "awaiting_provider_reporting" as const;

/**
 * Awin: official product feed + publisher deep links only.
 * Required config when live ingest is approved:
 * - AWIN_PRODUCT_SEARCH_ENABLED
 * - AWIN_PRODUCTION_ACCESS
 * - AWIN_FEED_URL (official advertiser/publisher feed)
 * - AWIN_PUBLISHER_ID
 * Network ingest stays OFF until those are verified.
 *
 * Amazon: Associates / Creators API only. Not implemented in V1.5.
 */
export type FutureProviderNotes = {
  awin: "feed_plus_deeplink";
  amazon: "associates_or_creators_api";
};
