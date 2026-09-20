import type { AffiliateProduct } from "../../../../supabase/functions/_shared/christmas/affiliateProducts/types.ts";
import { affiliateUrlForGift, type SavedAffiliateGift } from "../../../../supabase/functions/_shared/christmas/affiliateProducts/refreshApply.ts";

export type { AffiliateProduct };
export { priceBucketFromMinor } from "../../../../supabase/functions/_shared/christmas/affiliateProducts/query.ts";
export {
  affiliateFreshnessState,
  freshnessAgeDays,
  freshnessCheckedLabel,
  shouldPromptPriceCheck,
  DEFAULT_AFFILIATE_FRESHNESS,
} from "../../../../supabase/functions/_shared/christmas/affiliateProducts/freshness.ts";
export {
  affiliateUrlForGift,
  applyAffiliateLookupToGift,
  exceedsRemainingBudget,
  priceChangeCopy,
  snapshotFromProduct,
} from "../../../../supabase/functions/_shared/christmas/affiliateProducts/refreshApply.ts";

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

function safeHttpUrl(url: string | null | undefined): string | null {
  const value = String(url || "").trim();
  if (!value) return null;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    return value;
  } catch {
    return null;
  }
}

export function plannerGiftOutboundUrl(
  gift: SavedAffiliateGift & { url?: string | null },
): string | null {
  const affiliate = safeHttpUrl(affiliateUrlForGift(gift));
  if (affiliate) return affiliate;
  const meta = gift.source_meta && typeof gift.source_meta === "object" ? gift.source_meta : {};
  const productUrl = safeHttpUrl(String(meta.productUrl || ""));
  if (productUrl && !affiliate) {
    return safeHttpUrl(gift.url) || null;
  }
  return safeHttpUrl(gift.url);
}

export function snapshotPriceLabel(
  gift: {
    planned_price_minor?: number | null;
    source_type?: string;
    price_checked_at?: string | null;
    source_meta?: Record<string, unknown> | null;
  },
  formattedMoney: string,
): string | null {
  if (!gift.planned_price_minor) return null;
  if (gift.source_type !== "affiliate_product") return formattedMoney;
  const added = gift.source_meta && typeof gift.source_meta.addedPriceMinor === "number"
    ? gift.source_meta.addedPriceMinor
    : gift.planned_price_minor;
  if (added && formattedMoney) {
    return `${formattedMoney} when added`;
  }
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

export function liveShoppingUnavailableCopy(reason?: string | null): string {
  if (reason === "DISABLED_NO_PRODUCTION_ACCESS" || reason === "DISABLED_FEATURE_FLAG" || reason === "DISABLED_MISSING_CREDENTIALS") {
    return "Live product shopping is not currently available.";
  }
  return "We couldn’t load live products right now.";
}
