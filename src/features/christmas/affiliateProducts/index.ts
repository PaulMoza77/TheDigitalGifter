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
  normalizeEbaySearchResults,
  parseEbayMoney,
  buildEbayBrowseSearchUrl,
  ebayEndUserContext,
  isFixedPriceItem,
  ebayImageUrl,
} from "../../../../supabase/functions/_shared/christmas/affiliateProducts/ebay.ts";

export { EbayTokenCache } from "../../../../supabase/functions/_shared/christmas/affiliateProducts/oauth.ts";
export { AffiliateProductService } from "../../../../supabase/functions/_shared/christmas/affiliateProducts/service.ts";
export {
  ebayProviderStatus,
  affiliateSearchEnabled,
  missingEbayCredentialNames,
  readEbayCredentials,
} from "../../../../supabase/functions/_shared/christmas/affiliateProducts/config.ts";
export { TtlCache } from "../../../../supabase/functions/_shared/christmas/affiliateProducts/cache.ts";
