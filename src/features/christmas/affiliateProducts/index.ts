export type {
  AffiliateProduct,
  AffiliateProductAvailability,
  AffiliateProvider,
  AffiliateProviderId,
  AffiliateProviderStatus,
  AffiliateProviderStatusCode,
  AffiliateSearchRequest,
  AffiliateSearchResult,
  AffiliateSearchSource,
  FutureProviderNotes,
  NormalizedAffiliateSearch,
} from "../../../../supabase/functions/_shared/christmas/affiliateProducts/types.ts";

export {
  AFFILIATE_PROVIDERS,
  AFFILIATE_SEARCH_SOURCES,
} from "../../../../supabase/functions/_shared/christmas/affiliateProducts/types.ts";

export {
  buildProductSearchQuery,
  createAffiliateReferenceId,
  isSafeAffiliateReferenceId,
  assertNoPiiInReferenceId,
  priceBucketFromMinor,
  sanitizeProductQuery,
  searchCacheKey,
  validateAffiliateSearchInput,
  AFFILIATE_QUERY_MAX_LEN,
  AFFILIATE_RESULT_LIMIT_MAX,
} from "../../../../supabase/functions/_shared/christmas/affiliateProducts/query.ts";

export {
  resolveEbayMarketplace,
  coarseDeliveryCountry,
  isEbayMarketplace,
  currencyForEbayMarketplace,
} from "../../../../supabase/functions/_shared/christmas/affiliateProducts/marketplace.ts";

export {
  normalizeEbayItem,
  normalizeEbayLookupItem,
  normalizeEbaySearchResults,
  parseEbayMoney,
  buildEbayBrowseSearchUrl,
  buildEbayBrowseItemUrl,
  ebayEndUserContext,
  isFixedPriceItem,
  ebayImageUrl,
} from "../../../../supabase/functions/_shared/christmas/affiliateProducts/ebay.ts";

export { EbayTokenCache } from "../../../../supabase/functions/_shared/christmas/affiliateProducts/oauth.ts";
export {
  AffiliateProductService,
  AffiliateProductSearchService,
} from "../../../../supabase/functions/_shared/christmas/affiliateProducts/service.ts";
export {
  ebayProviderStatus,
  awinProviderStatus,
  amazonProviderStatus,
  affiliateSearchEnabled,
  awinSearchEnabled,
  missingEbayCredentialNames,
  readEbayCredentials,
  publicCredentialsFlags,
  allProviderHealth,
} from "../../../../supabase/functions/_shared/christmas/affiliateProducts/config.ts";
export { TtlCache } from "../../../../supabase/functions/_shared/christmas/affiliateProducts/cache.ts";
export { AwinProvider, normalizeAwinFeedRow, normalizeAwinFeedRows } from "../../../../supabase/functions/_shared/christmas/affiliateProducts/awin.ts";
export {
  affiliateFreshnessState,
  freshnessCheckedLabel,
  DEFAULT_AFFILIATE_FRESHNESS,
} from "../../../../supabase/functions/_shared/christmas/affiliateProducts/freshness.ts";
export {
  applyAffiliateLookupToGift,
  priceChangeCopy,
  exceedsRemainingBudget,
  snapshotFromProduct,
} from "../../../../supabase/functions/_shared/christmas/affiliateProducts/refreshApply.ts";
export type {
  AffiliateProviderHealth,
  AffiliateLookupResult,
  AffiliateProviderTransaction,
} from "../../../../supabase/functions/_shared/christmas/affiliateProducts/types.ts";
export { AFFILIATE_REVENUE_SEAM } from "../../../../supabase/functions/_shared/christmas/affiliateProducts/types.ts";
