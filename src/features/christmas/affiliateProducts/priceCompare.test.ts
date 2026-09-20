import { describe, expect, it } from "vitest";
import { compareExactProductOffers, productIdentityKey } from "./priceCompare";
import type { AffiliateProduct } from "../../../../supabase/functions/_shared/christmas/affiliateProducts/types.ts";

function p(partial: Partial<AffiliateProduct>): AffiliateProduct {
  return {
    provider: "ebay", externalProductId: "1", title: "Camera", merchant: "A",
    price: 100, currency: "EUR", affiliateUrl: "https://example.test/a", ...partial,
  };
}

describe("exact product price comparison", () => {
  it("uses strong identifiers, never title alone", () => {
    expect(productIdentityKey(p({ metadata: { gtin: "123" } }))).toBe("gtin:123");
    expect(productIdentityKey(p({ title: "Same Camera" }))).toBeNull();
  });
  it("ranks same-currency exact offers", () => {
    const result = compareExactProductOffers([
      p({ merchant: "A", price: 120, metadata: { gtin: "123", checkedAt: "2026-09-20T12:00:00Z" } }),
      p({ merchant: "B", price: 99, externalProductId: "2", metadata: { gtin: "123", checkedAt: "2026-09-20T12:01:00Z" } }),
    ]);
    expect(result.exactMatch).toBe(true);
    expect(result.lowest?.merchant).toBe("B");
  });
  it("does not rank different currencies", () => {
    const result = compareExactProductOffers([
      p({ merchant: "A", currency: "EUR", metadata: { gtin: "123" } }),
      p({ merchant: "B", currency: "USD", metadata: { gtin: "123" } }),
    ]);
    expect(result.lowest).toBeNull();
  });
  it("requires at least two independent merchant/provider offers", () => {
    const result = compareExactProductOffers([p({ metadata: { gtin: "123" } })]);
    expect(result.exactMatch).toBe(false);
  });
});
