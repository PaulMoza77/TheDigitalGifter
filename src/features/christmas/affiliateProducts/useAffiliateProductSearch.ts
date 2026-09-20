import { useCallback, useState } from "react";
import { searchAffiliateProducts, type AffiliateSearchClientInput } from "./client";
import type { AffiliateProduct, AffiliateSearchResult } from "./index";

export type AffiliateShopPhase = "idle" | "loading" | "results" | "error" | "disabled";

export function useAffiliateProductSearch() {
  const [phase, setPhase] = useState<AffiliateShopPhase>("idle");
  const [products, setProducts] = useState<AffiliateProduct[]>([]);
  const [marketplace, setMarketplace] = useState<string | null>(null);
  const [reason, setReason] = useState<string | null>(null);

  const reset = useCallback(() => {
    setPhase("idle");
    setProducts([]);
    setMarketplace(null);
    setReason(null);
  }, []);

  const search = useCallback(async (input: AffiliateSearchClientInput) => {
    setPhase("loading");
    setReason(null);
    try {
      const result: AffiliateSearchResult = await searchAffiliateProducts(input);
      if (!result.enabled && result.reason) {
        setPhase("disabled");
        setProducts([]);
        setMarketplace(result.marketplace);
        setReason(result.reason);
        return result;
      }
      if (!result.ok) {
        setPhase("error");
        setProducts([]);
        setReason(result.reason || "provider_unavailable");
        return result;
      }
      setProducts(result.products || []);
      setMarketplace(result.marketplace);
      setPhase("results");
      return result;
    } catch {
      setPhase("error");
      setProducts([]);
      setReason("provider_unavailable");
      throw new Error("affiliate_unavailable");
    }
  }, []);

  return { phase, products, marketplace, reason, search, reset, setPhase };
}
