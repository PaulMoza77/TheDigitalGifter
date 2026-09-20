import { EbayTokenCache } from "./oauth.ts";
import {
  EBAY_BROWSE_ITEM_URL,
  EBAY_BROWSE_SEARCH_URL,
  EBAY_TOKEN_URL,
  buildEbayBrowseItemUrl,
  buildEbayBrowseSearchUrl,
  ebayEndUserContext,
  isEbayItemNotFound,
  isEbayProductionAccessError,
  normalizeEbayLookupItem,
  normalizeEbaySearchResults,
  type EbayItemSummary,
  type EbaySearchResponse,
} from "./ebay.ts";
import {
  activeAffiliateProvider,
  amazonProviderStatus,
  ebayProviderStatus,
  readEbayCredentials,
  type AffiliateEnv,
} from "./config.ts";
import { searchCacheKey } from "./query.ts";
import { TtlCache, withLimitedRetry } from "./cache.ts";
import { AwinProvider } from "./awin.ts";
import { disabledLookupResult, disabledSearchResult } from "./health.ts";
import type {
  AffiliateLookupRequest,
  AffiliateLookupResult,
  AffiliateProvider,
  AffiliateProviderId,
  AffiliateSearchResult,
  NormalizedAffiliateSearch,
} from "./types.ts";
import { resolveEbayMarketplace, type EbayMarketplaceId } from "./marketplace.ts";

const SEARCH_TTL_MS = 10 * 60 * 1000;

export type AffiliateFetch = (url: string, init: RequestInit) => Promise<Response>;

class AmazonStubProvider implements AffiliateProvider {
  readonly id = "amazon" as const;
  status() {
    return amazonProviderStatus();
  }
  async search(input: NormalizedAffiliateSearch): Promise<AffiliateSearchResult> {
    return disabledSearchResult(this.status(), input.marketplace);
  }
  async lookup(input: AffiliateLookupRequest): Promise<AffiliateLookupResult> {
    return disabledLookupResult(this.status(), input.marketplace);
  }
}

export class EbayBrowseProvider implements AffiliateProvider {
  readonly id = "ebay" as const;
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
      return disabledSearchResult(status, input.marketplace);
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
    this.ensureTokenCache(creds.clientId, creds.clientSecret);

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
      return this.failedSearch(input.marketplace, error, status);
    }
  }

  async lookup(input: AffiliateLookupRequest): Promise<AffiliateLookupResult> {
    const status = this.status();
    if (!status.enabled) {
      return disabledLookupResult(status, input.marketplace);
    }
    const creds = readEbayCredentials(this.env);
    this.ensureTokenCache(creds.clientId, creds.clientSecret);
    try {
      const token = await this.tokenCache!.getToken();
      const marketplace = (input.marketplace || "EBAY_DE") as EbayMarketplaceId;
      const url = buildEbayBrowseItemUrl(input.externalProductId);
      if (!url.startsWith(`${EBAY_BROWSE_ITEM_URL}/`)) throw new Error("ebay_url_rejected");
      const res = await this.fetchImpl(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "X-EBAY-C-MARKETPLACE-ID": marketplace,
          "X-EBAY-C-ENDUSERCTX": ebayEndUserContext(creds.campaignId, input.affiliateReferenceId),
          "Content-Type": "application/json",
        },
      });
      const text = await res.text();
      if (isEbayItemNotFound(res.status, text)) {
        return {
          ok: true,
          enabled: true,
          provider: "ebay",
          marketplace,
          product: null,
          unavailable: true,
          status,
          reason: "item_unavailable",
        };
      }
      if (res.status === 401) throw new Error("ebay_browse_401");
      if (res.status === 429) throw new Error("ebay_browse_429");
      if (res.status >= 500) throw new Error(`ebay_browse_${res.status}`);
      if (isEbayProductionAccessError(res.status, text)) {
        return disabledLookupResult(
          { ...status, enabled: false, reason: "DISABLED_NO_PRODUCTION_ACCESS", code: "DISABLED_NO_PRODUCTION_ACCESS" },
          marketplace,
        );
      }
      if (!res.ok) throw new Error(`ebay_browse_${res.status}`);
      const payload = JSON.parse(text) as EbayItemSummary;
      const product = normalizeEbayLookupItem(payload);
        const unavailable = !product || product.availability === "unavailable";
      return {
        ok: true,
        enabled: true,
        provider: "ebay",
        marketplace,
        product: product && product.affiliateUrl ? product : product,
        unavailable,
        status,
        reason: unavailable ? "item_unavailable" : undefined,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "ebay_lookup_failed";
      return {
        ok: false,
        enabled: false,
        provider: "ebay",
        marketplace: input.marketplace,
        product: null,
        unavailable: false,
        status,
        reason: msg === "ebay_no_production_access" ? "DISABLED_NO_PRODUCTION_ACCESS" : "provider_unavailable",
      };
    }
  }

  private ensureTokenCache(clientId: string, clientSecret: string) {
    if (!this.tokenCache) {
      this.tokenCache = new EbayTokenCache(clientId, clientSecret, this.fetchImpl, this.now, EBAY_TOKEN_URL);
    }
  }

  private failedSearch(
    marketplace: string | null,
    error: unknown,
    status: ReturnType<EbayBrowseProvider["status"]>,
  ): AffiliateSearchResult {
    const msg = error instanceof Error ? error.message : "ebay_search_failed";
    const noAccess = msg === "ebay_no_production_access";
    return {
      ok: false,
      enabled: false,
      provider: "ebay",
      marketplace,
      products: [],
      status: noAccess
        ? { ...status, enabled: false, reason: "DISABLED_NO_PRODUCTION_ACCESS", code: "DISABLED_NO_PRODUCTION_ACCESS" }
        : status,
      reason: noAccess ? "DISABLED_NO_PRODUCTION_ACCESS" : "provider_unavailable",
    };
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
      status: this.status(),
    };
  }
}

/**
 * Selects one provider per request. Does not merge eBay + Awin + Amazon results.
 */
export class AffiliateProductSearchService {
  private readonly ebay: EbayBrowseProvider;
  private readonly awin: AwinProvider;
  private readonly amazon = new AmazonStubProvider();

  constructor(
    private readonly env: AffiliateEnv,
    fetchImpl: AffiliateFetch,
    now: () => number = () => Date.now(),
  ) {
    this.ebay = new EbayBrowseProvider(env, fetchImpl, now);
    this.awin = new AwinProvider(env);
  }

  provider(id?: AffiliateProviderId | null): AffiliateProvider {
    const chosen = id || activeAffiliateProvider(this.env);
    if (chosen === "awin") return this.awin;
    if (chosen === "amazon") return this.amazon;
    return this.ebay;
  }

  status(id?: AffiliateProviderId | null) {
    return this.provider(id).status();
  }

  async search(input: NormalizedAffiliateSearch): Promise<AffiliateSearchResult> {
    return this.provider(input.provider).search(input);
  }

  async lookup(input: AffiliateLookupRequest): Promise<AffiliateLookupResult> {
    return this.provider(input.provider).lookup(input);
  }
}

/** Back-compat alias used by existing tests and the Edge Function. */
export class AffiliateProductService extends AffiliateProductSearchService {}
