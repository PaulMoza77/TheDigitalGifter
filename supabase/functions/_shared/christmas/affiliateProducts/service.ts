import { EbayTokenCache } from "./oauth.ts";
import {
  EBAY_BROWSE_SEARCH_URL,
  EBAY_TOKEN_URL,
  buildEbayBrowseSearchUrl,
  ebayEndUserContext,
  isEbayProductionAccessError,
  normalizeEbaySearchResults,
  type EbaySearchResponse,
} from "./ebay.ts";
import { ebayProviderStatus, readEbayCredentials, type AffiliateEnv } from "./config.ts";
import { searchCacheKey } from "./query.ts";
import { TtlCache, withLimitedRetry } from "./cache.ts";
import type { AffiliateSearchResult, NormalizedAffiliateSearch } from "./types.ts";
import { resolveEbayMarketplace, type EbayMarketplaceId } from "./marketplace.ts";

const SEARCH_TTL_MS = 10 * 60 * 1000;

export type AffiliateFetch = (url: string, init: RequestInit) => Promise<Response>;

export class AffiliateProductService {
  private tokenCache: EbayTokenCache | null = null;
  private readonly searchCache = new TtlCache<AffiliateSearchResult>(SEARCH_TTL_MS, 200, this.now);

  constructor(
    private readonly env: AffiliateEnv,
    private readonly fetchImpl: AffiliateFetch,
    private readonly now: () => number = () => Date.now(),
  ) {}

  status() {
    return ebayProviderStatus(this.env);
  }

  async search(input: NormalizedAffiliateSearch): Promise<AffiliateSearchResult> {
    const status = this.status();
    if (!status.enabled) {
      return {
        ok: true,
        enabled: false,
        provider: "ebay",
        marketplace: input.marketplace,
        products: [],
        status,
        reason: status.code,
      };
    }

    const cacheKey = searchCacheKey({
      provider: "ebay",
      marketplace: input.marketplace,
      query: input.query,
      priceMinMinor: input.priceMinMinor,
      priceMaxMinor: input.priceMaxMinor,
      condition: input.condition,
    });
    const cached = this.searchCache.get(cacheKey);
    if (cached) return { ...cached, cached: true };

    const creds = readEbayCredentials(this.env);
    if (!this.tokenCache) {
      this.tokenCache = new EbayTokenCache(creds.clientId, creds.clientSecret, this.fetchImpl, this.now, EBAY_TOKEN_URL);
    }

    try {
      const result = await withLimitedRetry({
        run: async (attempt) => {
          if (attempt > 0) this.tokenCache?.invalidate();
          return this.browseOnce(input, creds.campaignId);
        },
        isRetryable: (error, attempt) => {
          if (attempt >= 1) return false;
          const msg = error instanceof Error ? error.message : String(error);
          return /ebay_browse_(401|429|5\d\d)/.test(msg);
        },
        delaysMs: [400],
      });
      this.searchCache.set(cacheKey, result);
      return result;
    } catch (error) {
      const msg = error instanceof Error ? error.message : "ebay_search_failed";
      const noAccess = msg === "ebay_no_production_access";
      return {
        ok: false,
        enabled: false,
        provider: "ebay",
        marketplace: input.marketplace,
        products: [],
        status: noAccess
          ? { provider: "ebay", code: "DISABLED_NO_PRODUCTION_ACCESS", enabled: false }
          : status,
        reason: noAccess ? "DISABLED_NO_PRODUCTION_ACCESS" : "provider_unavailable",
      };
    }
  }

  private async browseOnce(input: NormalizedAffiliateSearch, campaignId: string): Promise<AffiliateSearchResult> {
    const token = await this.tokenCache!.getToken();
    const marketplace = (
      input.marketplace || resolveEbayMarketplace({ countryCode: input.countryCode, locale: input.locale })
    ) as EbayMarketplaceId;
    const url = buildEbayBrowseSearchUrl(input, marketplace);
    if (!url.startsWith(EBAY_BROWSE_SEARCH_URL)) {
      throw new Error("ebay_url_rejected");
    }
    const res = await this.fetchImpl(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "X-EBAY-C-MARKETPLACE-ID": marketplace,
        "X-EBAY-C-ENDUSERCTX": ebayEndUserContext(campaignId, input.affiliateReferenceId),
        "Content-Type": "application/json",
      },
    });
    const text = await res.text();
    if (res.status === 401) throw new Error("ebay_browse_401");
    if (res.status === 429) throw new Error("ebay_browse_429");
    if (res.status >= 500) throw new Error(`ebay_browse_${res.status}`);
    if (isEbayProductionAccessError(res.status, text)) {
      throw new Error("ebay_no_production_access");
    }
    if (!res.ok) throw new Error(`ebay_browse_${res.status}`);
    let payload: EbaySearchResponse;
    try {
      payload = JSON.parse(text) as EbaySearchResponse;
    } catch {
      throw new Error("ebay_browse_invalid_json");
    }
    const products = normalizeEbaySearchResults(payload, input.limit);
    return {
      ok: true,
      enabled: true,
      provider: "ebay",
      marketplace,
      products,
      status: { provider: "ebay", code: "ENABLED", enabled: true },
    };
  }
}
