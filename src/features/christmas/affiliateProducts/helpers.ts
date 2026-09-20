import type { AffiliateProduct } from "../../../../supabase/functions/_shared/christmas/affiliateProducts/types.ts";

export type { AffiliateProduct };
export { priceBucketFromMinor } from "../../../../supabase/functions/_shared/christmas/affiliateProducts/query.ts";

export function productFitsRemaining(
  priceMajor: number,
  remainingMinor: number | null,
): "fits" | "over" | "unknown" {
  if (remainingMinor == null || !Number.isFinite(priceMajor)) return "unknown";
  const remainingMajor = remainingMinor / 100;
  const delta = priceMajor - remainingMajor;
  if (delta <= 0.009) return "fits";
  return "over";
}

export function overBudgetDeltaMinor(priceMajor: number, remainingMinor: number | null): number | null {
  if (remainingMinor == null) return null;
  const productMinor = Math.round(priceMajor * 100);
  return productMinor - remainingMinor;
}

export function plannerGiftOutboundUrl(gift: { url?: string | null }): string | null {
  const url = String(gift.url || "").trim();
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    return url;
  } catch {
    return null;
  }
}

export function snapshotPriceLabel(
  gift: { planned_price_minor?: number | null; source_type?: string; price_checked_at?: string | null },
  formattedMoney: string,
): string | null {
  if (!gift.planned_price_minor) return null;
  if (gift.source_type !== "affiliate_product") return formattedMoney;
  return `${formattedMoney} when added`;
}

export function deliveryWarning(opts: {
  deliveryEnd?: string | null;
  christmasOn?: string | null;
  leaveOn?: string | null;
}): "after_christmas" | "after_leave" | null {
  const end = opts.deliveryEnd ? Date.parse(opts.deliveryEnd) : NaN;
  if (!Number.isFinite(end)) return null;
  if (opts.leaveOn) {
    const leave = Date.parse(opts.leaveOn);
    if (Number.isFinite(leave) && end > leave) return "after_leave";
  }
  if (opts.christmasOn) {
    const xmas = Date.parse(opts.christmasOn);
    if (Number.isFinite(xmas) && end > xmas) return "after_christmas";
  }
  return null;
}

export function affiliateSourceRef(product: Pick<AffiliateProduct, "provider" | "externalProductId">): string {
  return `${product.provider}:${product.externalProductId}`.slice(0, 80);
}
