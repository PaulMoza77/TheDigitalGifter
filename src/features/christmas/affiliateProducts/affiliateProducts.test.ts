import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  AffiliateProductService,
  EbayTokenCache,
  TtlCache,
  affiliateSearchEnabled,
  assertNoPiiInReferenceId,
  buildEbayBrowseSearchUrl,
  buildProductSearchQuery,
  createAffiliateReferenceId,
  ebayEndUserContext,
  ebayProviderStatus,
  isFixedPriceItem,
  isSafeAffiliateReferenceId,
  missingEbayCredentialNames,
  normalizeEbayItem,
  normalizeEbaySearchResults,
  parseEbayMoney,
  priceBucketFromMinor,
  resolveEbayMarketplace,
  sanitizeProductQuery,
  searchCacheKey,
  validateAffiliateSearchInput,
} from "./index";
import {
  affiliateSourceRef,
  deliveryWarning,
  overBudgetDeltaMinor,
  plannerGiftOutboundUrl,
  productFitsRemaining,
  snapshotPriceLabel,
} from "./helpers";

function readSrc(rel: string) {
  return readFileSync(resolve(process.cwd(), rel), "utf8");
}

const fixtureItem = {
  itemId: "v1|123|0",
  title: "Sterling engraved necklace",
  shortDescription: "Gift-ready jewelry",
  image: { imageUrl: "https://i.ebayimg.com/images/g/example/s-l1600.jpg" },
  price: { value: "39.99", currency: "EUR" },
  marketingPrice: { originalPrice: { value: "49.99", currency: "EUR" } },
  seller: { username: "atelier_berlin" },
  itemAffiliateWebUrl: "https://www.ebay.de/itm/123?mkcid=1&mkrid=707-53477-19255-0&campid=5330000000&toolid=10001&customid=gc_abc",
  itemWebUrl: "https://www.ebay.de/itm/123",
  condition: "New",
  buyingOptions: ["FIXED_PRICE"],
  categories: [{ categoryName: "Jewelry" }],
  shippingOptions: [{ minEstimatedDeliveryDate: "2026-12-10", maxEstimatedDeliveryDate: "2026-12-18" }],
};

describe("affiliate marketplace", () => {
  it("maps Romania to a real eBay marketplace, never EBAY_RO", () => {
    expect(resolveEbayMarketplace({ countryCode: "RO" })).toBe("EBAY_DE");
    expect(resolveEbayMarketplace({ countryCode: "DE" })).toBe("EBAY_DE");
    expect(resolveEbayMarketplace({ countryCode: "FR" })).toBe("EBAY_FR");
    expect(resolveEbayMarketplace({ countryCode: "GB" })).toBe("EBAY_GB");
    expect(resolveEbayMarketplace({ countryCode: "US" })).toBe("EBAY_US");
    expect(resolveEbayMarketplace({ locale: "it" })).toBe("EBAY_IT");
  });
});

describe("eBay normalize", () => {
  it("uses official affiliate URL, real price, image, and delivery when present", () => {
    const product = normalizeEbayItem(fixtureItem, 0);
    expect(product?.affiliateUrl).toContain("campid=");
    expect(product?.affiliateUrl).toBe(fixtureItem.itemAffiliateWebUrl);
    expect(product?.price).toBe(39.99);
    expect(product?.currency).toBe("EUR");
    expect(product?.originalPrice).toBe(49.99);
    expect(product?.imageUrl).toContain("ebayimg.com");
    expect(product?.deliveryEnd).toBe("2026-12-18");
    expect(product?.merchant).toBe("atelier_berlin");
    expect(product?.providerRank).toBe(0);
  });

  it("omits missing image and delivery instead of inventing them", () => {
    const product = normalizeEbayItem(
      {
        ...fixtureItem,
        image: undefined,
        thumbnailImages: [],
        shippingOptions: [],
      },
      2,
    );
    expect(product?.imageUrl).toBeUndefined();
    expect(product?.deliveryStart).toBeUndefined();
    expect(product?.deliveryEnd).toBeUndefined();
    expect(product?.providerRank).toBe(2);
  });

  it("drops auctions and items without affiliate URLs", () => {
    expect(isFixedPriceItem({ buyingOptions: ["AUCTION"] })).toBe(false);
    expect(
      normalizeEbayItem({ ...fixtureItem, buyingOptions: ["AUCTION"], itemAffiliateWebUrl: fixtureItem.itemAffiliateWebUrl }, 0),
    ).toBeNull();
    expect(normalizeEbayItem({ ...fixtureItem, itemAffiliateWebUrl: undefined }, 0)).toBeNull();
  });

  it("parses price and currency strictly", () => {
    expect(parseEbayMoney({ value: "12.50", currency: "EUR" })).toEqual({ amount: 12.5, currency: "EUR" });
    expect(parseEbayMoney({ value: "nope", currency: "EUR" })).toBeNull();
    expect(parseEbayMoney({ value: "10", currency: "EURO" })).toBeNull();
  });

  it("preserves provider order and caps results", () => {
    const products = normalizeEbaySearchResults(
      {
        itemSummaries: [
          { ...fixtureItem, itemId: "a", title: "A" },
          { ...fixtureItem, itemId: "b", title: "B", buyingOptions: ["AUCTION"] },
          { ...fixtureItem, itemId: "c", title: "C" },
          { ...fixtureItem, itemId: "d", title: "D" },
        ],
      },
      8,
    );
    expect(products.map((p) => p.title)).toEqual(["A", "C", "D"]);
    expect(products.map((p) => p.providerRank)).toEqual([0, 2, 3]);
  });
});

describe("eBay search request", () => {
  it("applies fixed-price and budget filters without custom sort", () => {
    const url = buildEbayBrowseSearchUrl(
      {
        query: "engraved jewelry",
        source: "idea",
        countryCode: "DE",
        locale: "de",
        currency: "EUR",
        priceMinMinor: null,
        priceMaxMinor: 5000,
        condition: "any",
        limit: 8,
        deliveryCountry: "DE",
        affiliateReferenceId: "gc_abc12345",
        marketplace: "EBAY_DE",
      },
      "EBAY_DE",
    );
    expect(url).toContain("buyingOptions%3A%7BFIXED_PRICE%7D");
    expect(url).toContain("price%3A");
    expect(url).toContain("priceCurrency%3AEUR");
    expect(url).not.toContain("sort=");
    expect(ebayEndUserContext("camp", "gc_abc12345")).toBe(
      "affiliateCampaignId=camp,affiliateReferenceId=gc_abc12345",
    );
  });
});

describe("query + privacy", () => {
  it("builds idea and recipient queries without names or notes", () => {
    expect(
      buildProductSearchQuery({
        ideaTitle: "Custom Engraved Jewelry",
        searchQuery: "engraved jewelry gift",
      }),
    ).toBe("engraved jewelry gift");
    const q = buildProductSearchQuery({
      interests: "coffee",
      vibeKeys: ["practical"],
      relationshipCategory: "close_family",
    });
    expect(q).toContain("coffee");
    expect(q).toContain("practical");
    expect(q).not.toMatch(/Andreas/i);
  });

  it("caps query length and strips emails/URLs", () => {
    expect(sanitizeProductQuery("x".repeat(200)).length).toBe(80);
    expect(sanitizeProductQuery("see https://evil.test and a@b.com gift")).not.toContain("http");
    expect(sanitizeProductQuery("see https://evil.test and a@b.com gift")).not.toContain("@");
  });

  it("validates marketplace, result count, and prices", () => {
    const ok = validateAffiliateSearchInput({
      query: "engraved jewelry",
      source: "idea",
      countryCode: "RO",
      limit: 99,
      priceMaxMinor: 5000,
    });
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.value.limit).toBe(8);
      expect(ok.value.marketplace).toBe("EBAY_DE");
      expect(ok.value.priceMaxMinor).toBe(5000);
    }
    const bad = validateAffiliateSearchInput({ query: " ", source: "idea" });
    expect(bad.ok).toBe(false);
  });

  it("keeps affiliateReferenceId opaque", () => {
    const id = createAffiliateReferenceId(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]));
    expect(id.startsWith("gc_")).toBe(true);
    expect(assertNoPiiInReferenceId(id)).toBe(true);
    expect(isSafeAffiliateReferenceId("Andreas_family_50")).toBe(false);
    expect(isSafeAffiliateReferenceId("user@email.com")).toBe(false);
  });

  it("does not key cache by recipient name", () => {
    const key = searchCacheKey({
      provider: "ebay",
      marketplace: "EBAY_DE",
      query: "coffee gift",
      priceMinMinor: null,
      priceMaxMinor: 5000,
      condition: "any",
    });
    expect(key).not.toMatch(/Andreas/i);
    expect(key).toContain("ebay|EBAY_DE|coffee gift");
  });
});

describe("auth + provider status", () => {
  it("caches OAuth tokens until shortly before expiry", async () => {
    let calls = 0;
    const fetchImpl = async () => {
      calls += 1;
      return new Response(JSON.stringify({ access_token: "tok", expires_in: 7200 }), { status: 200 });
    };
    let now = 1_000;
    const cache = new EbayTokenCache("id", "secret", fetchImpl, () => now, "https://api.ebay.com/identity/v1/oauth2/token");
    expect(await cache.getToken()).toBe("tok");
    expect(await cache.getToken()).toBe("tok");
    expect(calls).toBe(1);
    now += 8000 * 1000;
    expect(await cache.getToken()).toBe("tok");
    expect(calls).toBe(2);
  });

  it("reports missing credentials without enabling live search", () => {
    const env = { get: () => undefined };
    expect(affiliateSearchEnabled(env)).toBe(false);
    expect(ebayProviderStatus(env).code).toBe("DISABLED_FEATURE_FLAG");
    const withFlag = {
      get(name: string) {
        if (name === "AFFILIATE_PRODUCT_SEARCH_ENABLED") return "true";
        return undefined;
      },
    };
    expect(ebayProviderStatus(withFlag).code).toBe("DISABLED_MISSING_CREDENTIALS");
    expect(missingEbayCredentialNames(withFlag)).toEqual([
      "EBAY_CLIENT_ID",
      "EBAY_CLIENT_SECRET",
      "EBAY_EPN_CAMPAIGN_ID",
    ]);
  });

  it("requires explicit production access even when credentials exist", () => {
    const env = {
      get(name: string) {
        const map: Record<string, string> = {
          AFFILIATE_PRODUCT_SEARCH_ENABLED: "true",
          EBAY_CLIENT_ID: "id",
          EBAY_CLIENT_SECRET: "secret",
          EBAY_EPN_CAMPAIGN_ID: "camp",
        };
        return map[name];
      },
    };
    expect(ebayProviderStatus(env).code).toBe("DISABLED_NO_PRODUCTION_ACCESS");
  });
});

describe("search service", () => {
  it("maps browse results without reordering and caches identical searches", async () => {
    const calls: string[] = [];
    const fetchImpl = async (url: string) => {
      calls.push(url);
      if (url.includes("/identity/")) {
        return new Response(JSON.stringify({ access_token: "tok", expires_in: 7200 }), { status: 200 });
      }
      return new Response(
        JSON.stringify({
          itemSummaries: [
            { ...fixtureItem, itemId: "1", title: "First" },
            { ...fixtureItem, itemId: "2", title: "Second" },
          ],
        }),
        { status: 200 },
      );
    };
    const env = {
      get(name: string) {
        const map: Record<string, string> = {
          AFFILIATE_PRODUCT_SEARCH_ENABLED: "true",
          EBAY_CLIENT_ID: "id",
          EBAY_CLIENT_SECRET: "secret",
          EBAY_EPN_CAMPAIGN_ID: "camp",
          EBAY_PRODUCTION_ACCESS: "true",
        };
        return map[name];
      },
    };
    const service = new AffiliateProductService(env, fetchImpl);
    const input = validateAffiliateSearchInput({
      query: "engraved jewelry",
      source: "idea",
      countryCode: "DE",
      priceMaxMinor: 5000,
      affiliateReferenceId: "gc_deadbeef12",
    });
    if (!input.ok) throw new Error("expected valid input");
    const first = await service.search(input.value);
    const second = await service.search(input.value);
    expect(first.products.map((p) => p.title)).toEqual(["First", "Second"]);
    expect(second.cached).toBe(true);
    expect(calls.filter((u) => u.includes("item_summary")).length).toBe(1);
  });

  it("does not retry-storm on 401", async () => {
    let browse = 0;
    const fetchImpl = async (url: string) => {
      if (url.includes("/identity/")) {
        return new Response(JSON.stringify({ access_token: "tok", expires_in: 7200 }), { status: 200 });
      }
      browse += 1;
      return new Response("unauthorized", { status: 401 });
    };
    const env = {
      get(name: string) {
        const map: Record<string, string> = {
          AFFILIATE_PRODUCT_SEARCH_ENABLED: "true",
          EBAY_CLIENT_ID: "id",
          EBAY_CLIENT_SECRET: "secret",
          EBAY_EPN_CAMPAIGN_ID: "camp",
          EBAY_PRODUCTION_ACCESS: "true",
        };
        return map[name];
      },
    };
    const service = new AffiliateProductService(env, fetchImpl, () => 1);
    const input = validateAffiliateSearchInput({ query: "gift", source: "recipient_search", affiliateReferenceId: "gc_aaaabbbb" });
    if (!input.ok) throw new Error("valid");
    const result = await service.search(input.value);
    expect(result.ok).toBe(false);
    expect(browse).toBe(2);
  });
});

describe("budget + freshness + outbound", () => {
  it("compares actual returned price to remaining budget without blocking", () => {
    expect(productFitsRemaining(39.99, 5000)).toBe("fits");
    expect(productFitsRemaining(62, 5000)).toBe("over");
    expect(overBudgetDeltaMinor(62, 5000)).toBe(1200);
    expect(productFitsRemaining(10, null)).toBe("unknown");
  });

  it("labels saved snapshot prices and never invents delivery warnings", () => {
    expect(snapshotPriceLabel({ planned_price_minor: 3999, source_type: "affiliate_product" }, "€39.99")).toBe(
      "€39.99 when added",
    );
    expect(deliveryWarning({ deliveryEnd: "2026-12-28", christmasOn: "2026-12-25" })).toBe("after_christmas");
    expect(deliveryWarning({ deliveryEnd: "2026-12-20", leaveOn: "2026-12-18" })).toBe("after_leave");
    expect(deliveryWarning({})).toBeNull();
  });

  it("uses affiliate URL for outbound planner links", () => {
    const href = plannerGiftOutboundUrl({ url: fixtureItem.itemAffiliateWebUrl });
    expect(href).toBe(fixtureItem.itemAffiliateWebUrl);
    expect(plannerGiftOutboundUrl({ url: "javascript:alert(1)" })).toBeNull();
    expect(affiliateSourceRef({ provider: "ebay", externalProductId: "v1|123|0" } as never)).toBe("ebay:v1|123|0");
  });
});

describe("ttl cache", () => {
  it("expires entries", () => {
    let now = 0;
    const cache = new TtlCache<string>(1000, 10, () => now);
    cache.set("a", "1");
    expect(cache.get("a")).toBe("1");
    now = 1001;
    expect(cache.get("a")).toBeUndefined();
  });
});

describe("wiring + security", () => {
  it("keeps credentials server-side and feature-flagged off by default", () => {
    const client = readSrc("src/features/christmas/affiliateProducts/client.ts");
    const concierge = readSrc("src/features/christmas/planner/giftConcierge/GiftConcierge.tsx");
    const edge = readSrc("supabase/functions/affiliate-product-search/index.ts");
    expect(client).not.toContain("EBAY_CLIENT_SECRET");
    expect(client).not.toContain("VITE_EBAY");
    expect(concierge).not.toContain("EBAY_CLIENT");
    expect(edge).toContain('action === "status"');
    expect(edge).toContain("auth_required");
    expect(readSrc("supabase/functions/_shared/christmas/affiliateProducts/config.ts")).toContain(
      "AFFILIATE_PRODUCT_SEARCH_ENABLED",
    );
    expect(readSrc(".env.example")).toContain("AFFILIATE_PRODUCT_SEARCH_ENABLED=false");
  });

  it("documents future Awin and Amazon adapters without implementing them", () => {
    const types = readSrc("supabase/functions/_shared/christmas/affiliateProducts/types.ts");
    expect(types).toContain("Future AwinProvider");
    expect(types).toContain("Future AmazonProvider");
    expect(types).not.toContain("awin.com/s");
  });
});
