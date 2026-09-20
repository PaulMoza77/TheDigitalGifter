import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  AffiliateProductService,
  EbayTokenCache,
  TtlCache,
  affiliateFreshnessState,
  affiliateSearchEnabled,
  applyAffiliateLookupToGift,
  assertNoPiiInReferenceId,
  awinProviderStatus,
  awinSearchEnabled,
  buildEbayBrowseItemUrl,
  buildEbayBrowseSearchUrl,
  buildProductSearchQuery,
  createAffiliateReferenceId,
  ebayEndUserContext,
  ebayProviderStatus,
  exceedsRemainingBudget,
  freshnessCheckedLabel,
  isFixedPriceItem,
  isSafeAffiliateReferenceId,
  missingEbayCredentialNames,
  normalizeAwinFeedRow,
  normalizeEbayItem,
  normalizeEbayLookupItem,
  normalizeEbaySearchResults,
  parseEbayMoney,
  priceBucketFromMinor,
  priceChangeCopy,
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

  it("wires an Awin adapter skeleton that stays network-off", () => {
    const types = readSrc("supabase/functions/_shared/christmas/affiliateProducts/types.ts");
    expect(types).toContain("AWIN_FEED_URL");
    expect(types).toContain("AWIN_PUBLISHER_ID");
    expect(readSrc(".env.example")).toContain("AWIN_PRODUCT_SEARCH_ENABLED=false");
    const awin = readSrc("supabase/functions/_shared/christmas/affiliateProducts/awin.ts");
    expect(awin).toContain("normalizeAwinFeedRow");
    expect(awin).not.toContain("fetch(");
    expect(awinSearchEnabled({ get: () => undefined })).toBe(false);
    expect(awinProviderStatus({ get: () => undefined }).reason).toBe("DISABLED_NOT_IMPLEMENTED");
  });
});

describe("freshness + refresh", () => {
  const now = Date.parse("2026-09-20T12:00:00.000Z");

  it("classifies fresh, aging, and stale thresholds", () => {
    expect(affiliateFreshnessState(new Date(now - 2 * 3600 * 1000).toISOString(), now)).toBe("fresh");
    expect(affiliateFreshnessState(new Date(now - 2 * 24 * 3600 * 1000).toISOString(), now)).toBe("aging");
    expect(affiliateFreshnessState(new Date(now - 9 * 24 * 3600 * 1000).toISOString(), now)).toBe("stale");
    expect(freshnessCheckedLabel(new Date(now - 9 * 24 * 3600 * 1000).toISOString(), now)).toBe("Price checked 9 days ago");
  });

  it("refreshes price server-side without overwriting actual_price, notes, or dropping affiliate URL", () => {
    const gift = {
      url: "https://www.ebay.de/itm/123?campid=1",
      store: "atelier_berlin",
      planned_price_minor: 3999,
      actual_price_minor: 4100,
      hiding_place: "closet",
      status: "planned",
      idea: "Necklace",
      selected_gift: "Necklace",
      image_url: "https://i.ebayimg.com/old.jpg",
      source_meta: {
        provider: "ebay",
        externalProductId: "v1|123|0",
        affiliateUrl: "https://www.ebay.de/itm/123?campid=1",
        addedPriceMinor: 3999,
      },
    };
    const lookup = {
      ok: true,
      enabled: true,
      provider: "ebay" as const,
      marketplace: "EBAY_DE",
      unavailable: false,
      status: {
        provider: "ebay" as const,
        enabled: true,
        configured: true,
        productionAccess: true,
        reason: "READY" as const,
        code: "READY" as const,
      },
      product: {
        provider: "ebay" as const,
        externalProductId: "v1|123|0",
        title: "Sterling engraved necklace",
        merchant: "atelier_berlin",
        price: 34.99,
        currency: "EUR",
        affiliateUrl: "https://www.ebay.de/itm/123?campid=1&customid=gc_abc",
        imageUrl: "https://i.ebayimg.com/new.jpg",
        availability: "in_stock" as const,
      },
    };
    const out = applyAffiliateLookupToGift(gift, lookup, "2026-09-20T12:00:00.000Z");
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.gift.actual_price_minor).toBe(4100);
    expect(out.gift.hiding_place).toBe("closet");
    expect(out.gift.status).toBe("planned");
    expect(out.gift.planned_price_minor).toBe(3499);
    expect(String(out.gift.url)).toContain("campid=");
    expect((out.gift.source_meta as { affiliateUrl: string }).affiliateUrl).toContain("campid=");
    const change = priceChangeCopy({
      addedMinor: 3999,
      currentMinor: 3499,
      format: (n) => `€${(n / 100).toFixed(2)}`,
    });
    expect(change?.summary).toContain("Was €39.99 when added");
    expect(change?.summary).toContain("Now €34.99");
  });

  it("marks missing items unavailable without deleting the gift", () => {
    const gift = {
      url: "https://www.ebay.de/itm/123?campid=1",
      planned_price_minor: 3999,
      actual_price_minor: null,
      status: "planned",
      hiding_place: "drawer",
      source_meta: { provider: "ebay", externalProductId: "v1|123|0", affiliateUrl: "https://www.ebay.de/itm/123?campid=1" },
    };
    const out = applyAffiliateLookupToGift(
      gift,
      {
        ok: true,
        enabled: true,
        provider: "ebay",
        marketplace: "EBAY_DE",
        product: null,
        unavailable: true,
        status: {
          provider: "ebay",
          enabled: true,
          configured: true,
          productionAccess: true,
          reason: "READY",
          code: "READY",
        },
      },
      "2026-09-20T12:00:00.000Z",
    );
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.kind).toBe("unavailable");
    expect(out.gift.status).toBe("planned");
    expect(out.gift.url).toContain("campid=");
    expect((out.gift.source_meta as { availability: string }).availability).toBe("unavailable");
  });

  it("reports provider disabled without inventing a price check", () => {
    const gift = { planned_price_minor: 3999, actual_price_minor: 12, status: "planned" };
    const out = applyAffiliateLookupToGift(
      gift,
      {
        ok: true,
        enabled: false,
        provider: "ebay",
        marketplace: "EBAY_DE",
        product: null,
        unavailable: false,
        reason: "DISABLED_FEATURE_FLAG",
        status: {
          provider: "ebay",
          enabled: false,
          configured: false,
          productionAccess: false,
          reason: "DISABLED_FEATURE_FLAG",
          code: "DISABLED_FEATURE_FLAG",
        },
      },
      "2026-09-20T12:00:00.000Z",
    );
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.kind).toBe("provider_disabled");
    expect(out.gift.actual_price_minor).toBe(12);
  });

  it("surfaces remaining-budget consequence when the listed price rises", () => {
    expect(exceedsRemainingBudget(4800, 500, 3999)).toEqual({ over: true, overByMinor: 301 });
    expect(exceedsRemainingBudget(3000, 500, 3999)).toEqual({ over: false, overByMinor: 0 });
  });
});

describe("Awin normalize", () => {
  it("maps official feed columns to AffiliateProduct without rewriting the deep link", () => {
    const product = normalizeAwinFeedRow(
      {
        aw_product_id: "aw-99",
        product_name: "Wool throw",
        merchant_name: "Alpine Home",
        search_price: "42.00",
        currency: "EUR",
        aw_deep_link: "https://www.awin1.com/pclick.php?p=99",
        merchant_image_url: "https://images.example.com/throw.jpg",
        in_stock: "1",
        category_name: "Home",
      },
      0,
    );
    expect(product?.provider).toBe("awin");
    expect(product?.affiliateUrl).toBe("https://www.awin1.com/pclick.php?p=99");
    expect(product?.price).toBe(42);
    expect(product?.imageUrl).toContain("images.example.com");
  });

  it("drops rows without a deep link", () => {
    expect(
      normalizeAwinFeedRow({ aw_product_id: "1", product_name: "X", search_price: "1", currency: "EUR" }, 0),
    ).toBeNull();
  });
});

describe("lookup URL + disabled provider does not call eBay", () => {
  it("builds a Browse get-item URL under the official host", () => {
    expect(buildEbayBrowseItemUrl("v1|123|0")).toBe(
      "https://api.ebay.com/buy/browse/v1/item/v1%7C123%7C0",
    );
  });

  it("does not fetch eBay when the feature flag is off", async () => {
    const calls: string[] = [];
    const service = new AffiliateProductService(
      { get: () => undefined },
      async (url) => {
        calls.push(url);
        return new Response("nope", { status: 500 });
      },
    );
    const input = validateAffiliateSearchInput({ query: "gift", source: "recipient_search", affiliateReferenceId: "gc_aaaabbbb" });
    if (!input.ok) throw new Error("valid");
    const search = await service.search(input.value);
    const lookup = await service.lookup({
      provider: "ebay",
      externalProductId: "v1|123|0",
      marketplace: "EBAY_DE",
      affiliateReferenceId: "gc_aaaabbbb",
    });
    expect(search.enabled).toBe(false);
    expect(search.status.reason).toBe("DISABLED_FEATURE_FLAG");
    expect(lookup.enabled).toBe(false);
    expect(calls).toEqual([]);
  });

  it("normalizes a get-item payload", () => {
    const product = normalizeEbayLookupItem(fixtureItem);
    expect(product?.externalProductId).toBe("v1|123|0");
    expect(product?.affiliateUrl).toContain("campid=");
  });
});
