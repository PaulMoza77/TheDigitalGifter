import type { AffiliateProduct } from "../../../../supabase/functions/_shared/christmas/affiliateProducts/types.ts";

export type ProductIdentity = {
  gtin?: string | null;
  upc?: string | null;
  ean?: string | null;
  isbn?: string | null;
  mpn?: string | null;
  brand?: string | null;
  model?: string | null;
};

export type ComparableOffer = Omit<AffiliateProduct, "checkedAt"> & {
  identity: ProductIdentity;
  checkedAt: string | null;
};

export type PriceComparison = {
  identityKey: string | null;
  exactMatch: boolean;
  offers: ComparableOffer[];
  lowest: ComparableOffer | null;
  currencies: string[];
};

function clean(value: unknown): string | null {
  const v = String(value || "").trim();
  return v ? v.toLowerCase() : null;
}

export function productIdentity(product: AffiliateProduct): ProductIdentity {
  const m = product.metadata || {};
  return {
    gtin: clean(product.gtin ?? m.gtin),
    upc: clean(product.upc ?? m.upc),
    ean: clean(product.ean ?? m.ean),
    isbn: clean(product.isbn ?? m.isbn),
    mpn: clean(product.mpn ?? m.mpn),
    brand: clean(product.brand ?? m.brand),
    model: clean(product.model ?? m.model),
  };
}

export function productIdentityKey(product: AffiliateProduct): string | null {
  const i = productIdentity(product);
  for (const key of ["gtin", "upc", "ean", "isbn"] as const) {
    if (i[key]) return key + ":" + i[key];
  }
  if (i.brand && i.mpn) return "brand_mpn:" + i.brand + ":" + i.mpn;
  if (i.brand && i.model) return "brand_model:" + i.brand + ":" + i.model;
  return null;
}

function checkedAt(product: AffiliateProduct): string | null {
  const raw = product.checkedAt ?? product.metadata?.checkedAt ?? product.metadata?.fetchedAt ?? null;
  const value = raw == null ? "" : String(raw);
  return /^\d{4}-\d{2}-\d{2}T/.test(value) ? value : null;
}

/**
 * Compare only provably identical products. Title similarity is deliberately
 * not enough: a false "cheapest" badge is worse than showing no comparison.
 * Cross-currency offers are retained but never ranked against each other.
 */
export function compareExactProductOffers(products: AffiliateProduct[]): PriceComparison {
  const groups = new Map<string, ComparableOffer[]>();
  for (const p of products) {
    const key = productIdentityKey(p);
    if (!key) continue;
    const row: ComparableOffer = { ...p, identity: productIdentity(p), checkedAt: checkedAt(p) };
    groups.set(key, [...(groups.get(key) || []), row]);
  }
  const candidates = [...groups.entries()]
    .filter(([, rows]) => new Set(rows.map((r) => r.provider + ":" + r.merchant)).size >= 2)
    .sort((a, b) => b[1].length - a[1].length);
  if (!candidates.length) return { identityKey: null, exactMatch: false, offers: [], lowest: null, currencies: [] };

  const [identityKey, offers] = candidates[0];
  const currencies = [...new Set(offers.map((o) => o.currency.toUpperCase()))];
  const lowest = currencies.length === 1
    ? [...offers].filter((o) => Number.isFinite(o.price) && o.price >= 0).sort((a, b) => a.price - b.price)[0] || null
    : null;
  return { identityKey, exactMatch: true, offers, lowest, currencies };
}
