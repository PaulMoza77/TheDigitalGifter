/**
 * Canonical Christmas V2 commercial offer contract (EUR packs).
 * Frontend + Edge + Node must stay byte-identical on these numbers.
 * Historical USD packs remain readable via LEGACY_USD_PACKS for old orders.
 */

export const CHRISTMAS_V2_OFFER_CATALOG_VERSION = "v2_eur_2026_10" as const;
export const CHRISTMAS_V2_CURRENCY = "eur" as const;

export const CHRISTMAS_STARTER_SKU = "christmas-starter-eur7" as const;
export const CHRISTMAS_MAGIC_SKU = "christmas-magic-eur17" as const;
export const CHRISTMAS_ULTIMATE_SKU = "christmas-ultimate-eur27" as const;

/** Legacy SKUs kept valid in DB for already-paid / in-flight USD orders. */
export const CHRISTMAS_LEGACY_SKUS = [
  "christmas-starter-3",
  "christmas-magic-8",
  "christmas-ultimate-12",
] as const;

export const CHRISTMAS_ACTIVE_SKUS = [
  CHRISTMAS_STARTER_SKU,
  CHRISTMAS_MAGIC_SKU,
  CHRISTMAS_ULTIMATE_SKU,
] as const;

export const CHRISTMAS_ALLOWED_SKUS = [
  ...CHRISTMAS_ACTIVE_SKUS,
  ...CHRISTMAS_LEGACY_SKUS,
] as const;

export type ChristmasPackKey = "starter" | "magic" | "ultimate";

export type ChristmasPackOffer = {
  key: ChristmasPackKey;
  sku: string;
  name: string;
  amountCents: number;
  currency: typeof CHRISTMAS_V2_CURRENCY;
  imageCount: number;
  videoCount: number;
  priceDisplay: string;
  cta: string;
  badge?: string;
  description: string;
  catalogVersion: typeof CHRISTMAS_V2_OFFER_CATALOG_VERSION;
};

export const CHRISTMAS_PACK_OFFERS: Record<ChristmasPackKey, ChristmasPackOffer> = {
  starter: {
    key: "starter",
    sku: CHRISTMAS_STARTER_SKU,
    name: "Christmas Starter Pack",
    amountCents: 700,
    currency: CHRISTMAS_V2_CURRENCY,
    imageCount: 3,
    videoCount: 0,
    priceDisplay: "€7",
    cta: "Create My 3 Christmas Photos · €7",
    description: "3 AI Christmas portraits",
    catalogVersion: CHRISTMAS_V2_OFFER_CATALOG_VERSION,
  },
  magic: {
    key: "magic",
    sku: CHRISTMAS_MAGIC_SKU,
    name: "Christmas Magic Pack",
    amountCents: 1700,
    currency: CHRISTMAS_V2_CURRENCY,
    imageCount: 5,
    videoCount: 1,
    priceDisplay: "€17",
    cta: "Get 5 Photos + 1 Clip · €17",
    description: "5 Christmas Photos + 1 short AI clip",
    catalogVersion: CHRISTMAS_V2_OFFER_CATALOG_VERSION,
  },
  ultimate: {
    key: "ultimate",
    sku: CHRISTMAS_ULTIMATE_SKU,
    name: "Ultimate Christmas Pack",
    amountCents: 2700,
    currency: CHRISTMAS_V2_CURRENCY,
    imageCount: 10,
    videoCount: 3,
    priceDisplay: "€27",
    cta: "Get 10 Photos + 3 Clips · €27",
    badge: "BEST VALUE",
    description: "10 Christmas Photos + 3 short AI clips",
    catalogVersion: CHRISTMAS_V2_OFFER_CATALOG_VERSION,
  },
};

/** Approximate Higgsfield COGS (Soul v2 I2I + Kling 3 Pro ~5s). Estimates only. */
export const CHRISTMAS_COGS_ESTIMATE = {
  starter: { images: 3, videos: 0, imageUsd: 0.006, videoUsd: 0.35, totalUsd: 0.018 },
  magic: { images: 5, videos: 1, imageUsd: 0.006, videoUsd: 0.35, totalUsd: 0.38 },
  ultimate: { images: 10, videos: 3, imageUsd: 0.006, videoUsd: 0.35, totalUsd: 1.11 },
} as const;

export type OfferSnapshot = {
  catalogVersion: string;
  packKey: ChristmasPackKey;
  sku: string;
  amountCents: number;
  currency: string;
  imageCount: number;
  videoCount: number;
};

export function snapshotOffer(packKey: ChristmasPackKey): OfferSnapshot {
  const pack = CHRISTMAS_PACK_OFFERS[packKey];
  return {
    catalogVersion: pack.catalogVersion,
    packKey: pack.key,
    sku: pack.sku,
    amountCents: pack.amountCents,
    currency: pack.currency,
    imageCount: pack.imageCount,
    videoCount: pack.videoCount,
  };
}

/**
 * Server-side charge gate: Stripe amount/currency must match the order snapshot
 * that was written at createOrder / createUpsellCheckout time.
 */
export function assertChargeMatchesSnapshot(input: {
  orderAmountCents: number;
  orderCurrency: string;
  stripeAmountCents: number | null | undefined;
  stripeCurrency: string | null | undefined;
}): { ok: true } | { ok: false; code: string; message: string } {
  const orderCurrency = String(input.orderCurrency || "").toLowerCase();
  const stripeCurrency = String(input.stripeCurrency || "").toLowerCase();
  if (!Number.isFinite(input.orderAmountCents) || input.orderAmountCents <= 0) {
    return { ok: false, code: "invalid_order_amount", message: "Order amount is invalid." };
  }
  if (input.stripeAmountCents == null || !Number.isFinite(input.stripeAmountCents)) {
    return { ok: false, code: "missing_stripe_amount", message: "Stripe amount missing." };
  }
  if (Math.round(input.stripeAmountCents) !== Math.round(input.orderAmountCents)) {
    return {
      ok: false,
      code: "amount_mismatch",
      message: "Stripe amount does not match the purchased offer snapshot.",
    };
  }
  if (!orderCurrency || !stripeCurrency || orderCurrency !== stripeCurrency) {
    return {
      ok: false,
      code: "currency_mismatch",
      message: "Stripe currency does not match the purchased offer snapshot.",
    };
  }
  return { ok: true };
}

export function isActiveChristmasSku(sku: string): boolean {
  return (CHRISTMAS_ALLOWED_SKUS as readonly string[]).includes(sku);
}
