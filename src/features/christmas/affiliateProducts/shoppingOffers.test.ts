import { describe, expect, it } from "vitest";
import { groupShoppingOffers, providerReadinessSummary } from "./shoppingOffers";
import type { AffiliateProduct } from "../../../../supabase/functions/_shared/christmas/affiliateProducts/types.ts";

function p(partial: Partial<AffiliateProduct>): AffiliateProduct {
  return {
    provider: "ebay",
    externalProductId: "1",
    title: "Camera",
    merchant: "A",
    price: 100,
    currency: "EUR",
    affiliateUrl: "https://example.test/a",
    ...partial,
  };
}

describe("shopping offer grouping", () => {
  it("does not show a Price Compare experience for a single provider", () => {
    const grouped = groupShoppingOffers([p({ metadata: { gtin: "123" } })]);
    expect(grouped.mode).toBe("single_provider");
    expect(grouped.comparison.exactMatch).toBe(false);
  });

  it("groups exact identifier matches across merchants", () => {
    const grouped = groupShoppingOffers([
      p({ merchant: "A", metadata: { gtin: "123" } }),
      p({ merchant: "B", provider: "awin", externalProductId: "2", price: 90, metadata: { gtin: "123" } }),
    ]);
    expect(grouped.mode).toBe("compare");
    expect(grouped.comparison.lowest?.merchant).toBe("B");
  });

  it("does not advertise compare until two providers are enabled", () => {
    const summary = providerReadinessSummary([
      { provider: "ebay", enabled: false, code: "DISABLED_MISSING_CREDENTIALS" },
      { provider: "awin", enabled: false, code: "DISABLED_NOT_IMPLEMENTED" },
    ]);
    expect(summary.canAdvertisePriceCompare).toBe(false);
  });
});
