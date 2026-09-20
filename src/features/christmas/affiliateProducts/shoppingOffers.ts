import type { AffiliateProduct } from "../../../../supabase/functions/_shared/christmas/affiliateProducts/types.ts";
import { compareExactProductOffers, type PriceComparison } from "./priceCompare";

export type ShoppingOfferGroup = {
  mode: "compare" | "single_provider";
  comparison: PriceComparison;
  products: AffiliateProduct[];
};

/**
 * Gift Concierge stays provider-agnostic: grouping happens after providers
 * already normalized to AffiliateProduct. A second official provider can
 * append products without UI rewrites.
 */
export function groupShoppingOffers(products: AffiliateProduct[]): ShoppingOfferGroup {
  const comparison = compareExactProductOffers(products);
  const providers = new Set(products.map((p) => p.provider));
  if (comparison.exactMatch && comparison.offers.length >= 2) {
    return { mode: "compare", comparison, products };
  }
  return {
    mode: "single_provider",
    comparison: { identityKey: null, exactMatch: false, offers: [], lowest: null, currencies: [] },
    products,
  };
}

export function providerReadinessSummary(input: Array<{ provider: string; enabled: boolean; code: string }>) {
  return {
    enabledCount: input.filter((p) => p.enabled).length,
    providers: input,
    canAdvertisePriceCompare: input.filter((p) => p.enabled).length >= 2,
  };
}
