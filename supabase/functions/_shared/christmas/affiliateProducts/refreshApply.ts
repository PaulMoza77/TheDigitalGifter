import type { AffiliateLookupResult, AffiliateProduct } from "./types.ts";

export type SavedAffiliateGift = {
  url?: string | null;
  store?: string;
  planned_price_minor?: number | null;
  actual_price_minor?: number | null;
  image_url?: string | null;
  price_checked_at?: string | null;
  delivery_on?: string | null;
  hiding_place?: string;
  status?: string;
  idea?: string;
  selected_gift?: string;
  notes?: string | null;
  source_meta?: Record<string, unknown> | null;
};

export type GiftRefreshOutcome =
  | { ok: true; kind: "updated" | "unavailable" | "unchanged"; patch: Record<string, unknown>; gift: SavedAffiliateGift }
  | { ok: false; kind: "provider_disabled" | "provider_unavailable"; reason: string; gift: SavedAffiliateGift };

function metaOf(gift: SavedAffiliateGift): Record<string, unknown> {
  return gift.source_meta && typeof gift.source_meta === "object" ? { ...gift.source_meta } : {};
}

function moneyMinor(amount: number): number {
  return Math.round(amount * 100);
}

export function affiliateUrlForGift(gift: SavedAffiliateGift): string | null {
  const meta = metaOf(gift);
  const fromMeta = String(meta.affiliateUrl || "").trim();
  if (fromMeta) return fromMeta;
  const url = String(gift.url || "").trim();
  return url || null;
}

export function applyAffiliateLookupToGift(
  gift: SavedAffiliateGift,
  lookup: AffiliateLookupResult,
  nowIso: string,
): GiftRefreshOutcome {
  if (!lookup.enabled) {
    return {
      ok: false,
      kind: "provider_disabled",
      reason: lookup.reason || lookup.status.reason,
      gift,
    };
  }
  if (!lookup.ok && !lookup.unavailable) {
    return {
      ok: false,
      kind: "provider_unavailable",
      reason: lookup.reason || "provider_unavailable",
      gift,
    };
  }

  const meta = metaOf(gift);
  const addedPrice =
    typeof meta.addedPriceMinor === "number" && Number.isFinite(meta.addedPriceMinor)
      ? meta.addedPriceMinor
      : gift.planned_price_minor ?? null;
  meta.addedPriceMinor = addedPrice;

  const protectedFields = {
    hiding_place: gift.hiding_place,
    status: gift.status,
    idea: gift.idea,
    selected_gift: gift.selected_gift,
    actual_price_minor: gift.actual_price_minor,
    notes: gift.notes,
  };

  if (lookup.unavailable || lookup.product?.availability === "unavailable") {
    meta.availability = "unavailable";
    meta.lastLookupAt = nowIso;
    const patch: Record<string, unknown> = {
      price_checked_at: nowIso,
      source_meta: meta,
    };
    return {
      ok: true,
      kind: "unavailable",
      patch,
      gift: { ...gift, ...patch, ...protectedFields, source_meta: meta, price_checked_at: nowIso },
    };
  }

  const product = lookup.product;
  if (!product) {
    return {
      ok: false,
      kind: "provider_unavailable",
      reason: lookup.reason || "provider_unavailable",
      gift,
    };
  }

  const nextMinor = moneyMinor(product.price);
  meta.lastPriceMinor = nextMinor;
  meta.currency = product.currency;
  meta.availability = product.availability || "unknown";
  meta.condition = product.condition || meta.condition || null;
  meta.marketplace = lookup.marketplace || meta.marketplace || null;
  meta.provider = product.provider;
  meta.externalProductId = product.externalProductId;
  meta.lastLookupAt = nowIso;
  if (product.deliveryStart) meta.deliveryStart = product.deliveryStart;
  if (product.deliveryEnd) meta.deliveryEnd = product.deliveryEnd;
  if (product.affiliateUrl) meta.affiliateUrl = product.affiliateUrl;

  const existingAffiliate = affiliateUrlForGift(gift);
  const nextUrl = product.affiliateUrl || existingAffiliate || gift.url || null;

  const patch: Record<string, unknown> = {
    planned_price_minor: nextMinor,
    image_url: product.imageUrl || gift.image_url || null,
    url: nextUrl,
    store: (product.merchant || gift.store || "").slice(0, 80),
    delivery_on: product.deliveryEnd || gift.delivery_on || null,
    price_checked_at: nowIso,
    source_meta: meta,
  };

  return {
    ok: true,
    kind: "updated",
    patch,
    gift: {
      ...gift,
      ...patch,
      ...protectedFields,
      planned_price_minor: nextMinor,
      image_url: patch.image_url as string | null,
      url: nextUrl,
      store: patch.store as string,
      delivery_on: patch.delivery_on as string | null,
      price_checked_at: nowIso,
      source_meta: meta,
    },
  };
}

export function priceChangeCopy(input: {
  addedMinor: number | null;
  currentMinor: number | null;
  format: (minor: number) => string;
}): { summary: string; deltaLabel: string | null; increased: boolean; decreased: boolean } | null {
  if (input.addedMinor == null || input.currentMinor == null) return null;
  if (input.addedMinor === input.currentMinor) return null;
  const delta = input.currentMinor - input.addedMinor;
  const increased = delta > 0;
  const abs = Math.abs(delta);
  return {
    summary: `Was ${input.format(input.addedMinor)} when added. Now ${input.format(input.currentMinor)}.`,
    deltaLabel: increased ? `Price increased by ${input.format(abs)}` : `Price decreased by ${input.format(abs)}`,
    increased,
    decreased: !increased,
  };
}

export function exceedsRemainingBudget(
  currentMinor: number | null,
  remainingMinor: number | null,
  excludeCurrentPlannedMinor: number | null,
): { over: boolean; overByMinor: number } | null {
  if (currentMinor == null || remainingMinor == null) return null;
  const remainingWithoutThis = remainingMinor + (excludeCurrentPlannedMinor || 0);
  const overBy = currentMinor - remainingWithoutThis;
  if (overBy <= 0) return { over: false, overByMinor: 0 };
  return { over: true, overByMinor: overBy };
}

export function snapshotFromProduct(product: AffiliateProduct): Record<string, unknown> {
  return {
    provider: product.provider,
    externalProductId: product.externalProductId,
    currency: product.currency,
    condition: product.condition || null,
    marketplace: product.metadata?.marketplace || null,
    affiliateUrl: product.affiliateUrl,
    addedPriceMinor: Math.round(product.price * 100),
    lastPriceMinor: Math.round(product.price * 100),
    availability: product.availability || "unknown",
    deliveryStart: product.deliveryStart || null,
    deliveryEnd: product.deliveryEnd || null,
  };
}
