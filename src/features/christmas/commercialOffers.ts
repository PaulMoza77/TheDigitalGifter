/**
 * Canonical Christmas commercial configuration.
 * Runtime checkout/spend/IAP grants MUST resolve from DB-backed rows,
 * never from these seed numbers.
 *
 * Seed values exist only for Admin bootstrap / tests that explicitly
 * pass a catalog. Production transactions fail closed if config is missing.
 */

export const CHRISTMAS_OFFER_CATEGORY = "christmas_offer" as const;
export const CREDIT_PACK_CATEGORIES = ["credit_pack", "credits"] as const;

export const XMAS_PORTRAIT = "xmas_portrait" as const;
export const XMAS_SANTA_VIDEO = "xmas_santa_video" as const;
export const XMAS_MAGIC_BUNDLE = "xmas_magic_bundle" as const;

export const CHRISTMAS_COMMERCIAL_KEYS = [
  XMAS_PORTRAIT,
  XMAS_SANTA_VIDEO,
  XMAS_MAGIC_BUNDLE,
] as const;

export type ChristmasCommercialKey = (typeof CHRISTMAS_COMMERCIAL_KEYS)[number];

export const BUNDLE_COMPONENTS = [
  XMAS_PORTRAIT,
  XMAS_SANTA_VIDEO,
  "xmas_card_message",
] as const;

export type BundleComponentKey = (typeof BUNDLE_COMPONENTS)[number];

export const ALLOWED_CURRENCIES = ["eur", "usd", "ron", "gbp"] as const;
export type CommercialCurrency = (typeof ALLOWED_CURRENCIES)[number];

/** Seed / migration defaults. Not a runtime checkout fallback. */
export const CHRISTMAS_COMMERCIAL_SEED: Record<
  ChristmasCommercialKey,
  {
    key: ChristmasCommercialKey;
    name: string;
    webPriceMinor: number;
    webCurrency: CommercialCurrency;
    appCreditsCost: number;
    sortOrder: number;
    featured: boolean;
    badge: string | null;
    bundleComponents: BundleComponentKey[] | null;
    productType: string;
  }
> = {
  xmas_portrait: {
    key: XMAS_PORTRAIT,
    name: "Christmas Portrait Pack",
    webPriceMinor: 499,
    webCurrency: "eur",
    appCreditsCost: 100,
    sortOrder: 10,
    featured: false,
    badge: null,
    bundleComponents: null,
    productType: "photo_generator",
  },
  xmas_santa_video: {
    key: XMAS_SANTA_VIDEO,
    name: "Personalized Santa Video",
    webPriceMinor: 999,
    webCurrency: "eur",
    appCreditsCost: 250,
    sortOrder: 20,
    featured: false,
    badge: null,
    bundleComponents: null,
    productType: "santa_video",
  },
  xmas_magic_bundle: {
    key: XMAS_MAGIC_BUNDLE,
    name: "Christmas Magic Bundle",
    webPriceMinor: 1499,
    webCurrency: "eur",
    appCreditsCost: 350,
    sortOrder: 30,
    featured: true,
    badge: "Best Value",
    bundleComponents: [...BUNDLE_COMPONENTS],
    productType: "bundle",
  },
};

/** Map generation / funnel product keys onto the 3 commercial offers. */
export const PRODUCT_KEY_TO_COMMERCIAL: Record<string, ChristmasCommercialKey> = {
  xmas_portrait: XMAS_PORTRAIT,
  christmas_photo: XMAS_PORTRAIT,
  christmas_family: XMAS_PORTRAIT,
  christmas_couple: XMAS_PORTRAIT,
  christmas_pet: XMAS_PORTRAIT,
  xmas_photo: XMAS_PORTRAIT,
  xmas_family_photo: XMAS_PORTRAIT,
  xmas_couple_photo: XMAS_PORTRAIT,
  xmas_pet_photo: XMAS_PORTRAIT,
  xmas_santa_video: XMAS_SANTA_VIDEO,
  christmas_santa_video: XMAS_SANTA_VIDEO,
  xmas_magic_bundle: XMAS_MAGIC_BUNDLE,
  christmas_magic_bundle: XMAS_MAGIC_BUNDLE,
};

export type PricingItemLike = {
  key?: string | null;
  name?: string | null;
  category?: string | null;
  price_cents?: number | null;
  currency?: string | null;
  credits?: number | null;
  active?: boolean | null;
  is_active?: boolean | null;
  is_featured?: boolean | null;
  sort_order?: number | null;
  updated_at?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type ChristmasCommercialOffer = {
  key: ChristmasCommercialKey;
  name: string;
  active: boolean;
  sortOrder: number;
  featured: boolean;
  webCheckoutEnabled: boolean;
  webPriceMinor: number;
  webCurrency: CommercialCurrency;
  compareAtPriceMinor: number | null;
  appCreditsCost: number;
  productType: string;
  bundleComponents: BundleComponentKey[] | null;
  displayBadge: string | null;
  updatedAt: string | null;
};

export type CreditPackConfig = {
  key: string;
  name: string;
  active: boolean;
  appleProductId: string | null;
  baseCredits: number;
  bonusCredits: number;
  totalCredits: number;
  label: string;
  sortOrder: number;
  badge: string | null;
  featured: boolean;
  updatedAt: string | null;
};

export function isCommercialKey(value: string): value is ChristmasCommercialKey {
  return (CHRISTMAS_COMMERCIAL_KEYS as readonly string[]).includes(value);
}

export function commercialKeyForProduct(productKey: string): ChristmasCommercialKey | null {
  const mapped = PRODUCT_KEY_TO_COMMERCIAL[String(productKey || "").trim()];
  return mapped ?? null;
}

export function isAllowedCurrency(value: string): value is CommercialCurrency {
  return (ALLOWED_CURRENCIES as readonly string[]).includes(value.toLowerCase());
}

function asInt(value: unknown, fallback = 0): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.round(n);
}

export function parseBundleComponents(raw: unknown): BundleComponentKey[] | null {
  if (!Array.isArray(raw)) return null;
  const out: BundleComponentKey[] = [];
  for (const item of raw) {
    const key = String(item || "").trim();
    if ((BUNDLE_COMPONENTS as readonly string[]).includes(key)) {
      out.push(key as BundleComponentKey);
    }
  }
  return out.length ? out : null;
}

export function mapPricingRowToOffer(row: PricingItemLike): ChristmasCommercialOffer | null {
  const key = String(row.key || "").trim();
  if (!isCommercialKey(key)) return null;
  const meta = (row.metadata || {}) as Record<string, unknown>;
  const currency = String(row.currency || meta.web_currency || "eur").toLowerCase();
  if (!isAllowedCurrency(currency)) return null;

  const webPrice = asInt(meta.web_price_minor ?? row.price_cents, -1);
  const credits = asInt(meta.app_credits_cost ?? meta.credit_cost ?? row.credits, -1);
  const compare = meta.compare_at_price_minor == null || meta.compare_at_price_minor === ""
    ? null
    : asInt(meta.compare_at_price_minor);
  const webCheckoutEnabled =
    meta.web_checkout_enabled === false ? false : true;
  const active = row.active !== false && row.is_active !== false && meta.enabled !== false;
  const bundle =
    key === XMAS_MAGIC_BUNDLE
      ? parseBundleComponents(meta.bundle_components) || [...BUNDLE_COMPONENTS]
      : null;

  return {
    key,
    name: String(row.name || CHRISTMAS_COMMERCIAL_SEED[key].name),
    active,
    sortOrder: asInt(row.sort_order, CHRISTMAS_COMMERCIAL_SEED[key].sortOrder),
    featured: Boolean(row.is_featured ?? meta.featured),
    webCheckoutEnabled,
    webPriceMinor: webPrice,
    webCurrency: currency,
    compareAtPriceMinor: compare != null && compare > 0 ? compare : null,
    appCreditsCost: credits,
    productType: String(meta.product_type || CHRISTMAS_COMMERCIAL_SEED[key].productType),
    bundleComponents: bundle,
    displayBadge: meta.display_badge ? String(meta.display_badge) : meta.badge ? String(meta.badge) : null,
    updatedAt: row.updated_at ? String(row.updated_at) : null,
  };
}

export type AdminOfferPatch = {
  key: string;
  name?: string;
  active?: boolean;
  sortOrder?: number;
  featured?: boolean;
  webCheckoutEnabled?: boolean;
  webPriceMinor?: number;
  webCurrency?: string;
  compareAtPriceMinor?: number | null;
  appCreditsCost?: number;
  bundleComponents?: string[] | null;
  displayBadge?: string | null;
};

export type AdminValidation =
  | { ok: true; offer: ChristmasCommercialOffer }
  | { ok: false; code: string; message: string };

export function validateChristmasOfferPatch(
  patch: AdminOfferPatch,
  existingKeys: string[] = [],
): AdminValidation {
  const key = String(patch.key || "").trim();
  if (!isCommercialKey(key)) {
    return { ok: false, code: "invalid_key", message: "Unknown Christmas product key." };
  }
  if (existingKeys.filter((k) => k === key).length > 1) {
    return { ok: false, code: "duplicate_key", message: "Duplicate product key." };
  }
  const currency = String(patch.webCurrency || "eur").toLowerCase();
  if (!isAllowedCurrency(currency)) {
    return { ok: false, code: "invalid_currency", message: "Currency is not supported." };
  }
  const webPrice = asInt(patch.webPriceMinor, -1);
  const credits = asInt(patch.appCreditsCost, -1);
  const webCheckout = patch.webCheckoutEnabled !== false;
  const active = patch.active !== false;
  if (webPrice < 0 || credits < 0) {
    return { ok: false, code: "negative_value", message: "Prices and credits cannot be negative." };
  }
  if (webCheckout && webPrice <= 0) {
    return { ok: false, code: "invalid_web_price", message: "Web price must be > 0 when web checkout is enabled." };
  }
  if (active && credits <= 0) {
    return { ok: false, code: "invalid_credits", message: "Credits required must be > 0 while the product is active for app generation." };
  }
  const compare =
    patch.compareAtPriceMinor == null || patch.compareAtPriceMinor === ("" as unknown)
      ? null
      : asInt(patch.compareAtPriceMinor);
  if (compare != null && compare < 0) {
    return { ok: false, code: "negative_value", message: "Compare-at price cannot be negative." };
  }
  let bundle: BundleComponentKey[] | null = null;
  if (Array.isArray(patch.bundleComponents) && patch.bundleComponents.includes(key)) {
    return { ok: false, code: "bundle_self_reference", message: "Bundle cannot include itself." };
  }
  if (key === XMAS_MAGIC_BUNDLE) {
    bundle = parseBundleComponents(patch.bundleComponents) || [...BUNDLE_COMPONENTS];
  }

  return {
    ok: true,
    offer: {
      key,
      name: String(patch.name || CHRISTMAS_COMMERCIAL_SEED[key].name),
      active,
      sortOrder: asInt(patch.sortOrder, CHRISTMAS_COMMERCIAL_SEED[key].sortOrder),
      featured: Boolean(patch.featured),
      webCheckoutEnabled: webCheckout,
      webPriceMinor: webPrice,
      webCurrency: currency,
      compareAtPriceMinor: compare,
      appCreditsCost: credits,
      productType: CHRISTMAS_COMMERCIAL_SEED[key].productType,
      bundleComponents: bundle,
      displayBadge: patch.displayBadge ? String(patch.displayBadge) : null,
      updatedAt: null,
    },
  };
}

export function catalogFromRows(rows: PricingItemLike[]): ChristmasCommercialOffer[] {
  return rows
    .map(mapPricingRowToOffer)
    .filter((row): row is ChristmasCommercialOffer => row != null)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export type CheckoutResolve =
  | {
      ok: true;
      offer: ChristmasCommercialOffer;
      amountCents: number;
      currency: CommercialCurrency;
      sku: string;
    }
  | { ok: false; code: string; message: string };

/**
 * Server-authoritative web checkout. Client amount is refused when present and mismatched.
 * Missing / invalid config fails closed · seed prices are NOT used.
 */
export function resolveWebCheckout(input: {
  productKey: string;
  catalog: ChristmasCommercialOffer[];
  clientAmountCents?: number | null;
  clientCurrency?: string | null;
}): CheckoutResolve {
  const commercialKey = commercialKeyForProduct(input.productKey);
  if (!commercialKey) {
    return { ok: false, code: "unknown_product", message: "Not a Christmas commercial product." };
  }
  const offer = input.catalog.find((item) => item.key === commercialKey);
  if (!offer) {
    return {
      ok: false,
      code: "config_missing",
      message: "Christmas pricing is not configured.",
    };
  }
  if (!offer.active || !offer.webCheckoutEnabled) {
    return { ok: false, code: "inactive_product", message: "This offer is not available." };
  }
  if (!offer.webPriceMinor || offer.webPriceMinor <= 0) {
    return { ok: false, code: "invalid_price", message: "Configured web price is invalid." };
  }
  if (!isAllowedCurrency(offer.webCurrency)) {
    return { ok: false, code: "invalid_currency", message: "Configured currency is invalid." };
  }
  // Client amount/currency never control Stripe.
  void input.clientAmountCents;
  void input.clientCurrency;
  return {
    ok: true,
    offer,
    amountCents: offer.webPriceMinor,
    currency: offer.webCurrency,
    sku: `xmas_${offer.key}`,
  };
}

export type SpendResolve =
  | {
      ok: true;
      offer: ChristmasCommercialOffer;
      creditCost: number;
      viaEntitlement?: boolean;
      component?: BundleComponentKey;
    }
  | { ok: false; code: string; message: string; serverCreditCost?: number };

/**
 * App spend. Client credit number never wins.
 * If displayed cost is sent and differs, return pricing_changed (do not debit a larger amount).
 */
export function resolveAppSpend(input: {
  productKey: string;
  catalog: ChristmasCommercialOffer[];
  displayedCreditCost?: number | null;
  bundleEntitlementRemaining?: BundleComponentKey[] | null;
}): SpendResolve {
  const commercialKey = commercialKeyForProduct(input.productKey) || (
    input.productKey === "xmas_card_message" ||
    input.productKey === "xmas_card" ||
    input.productKey === "christmas_card" ||
    input.productKey === "christmas_messages"
      ? XMAS_MAGIC_BUNDLE
      : null
  );
  if (!commercialKey) {
    return { ok: false, code: "unknown_product", message: "Not a paid Christmas product." };
  }

  const remaining = input.bundleEntitlementRemaining || [];
  const component: BundleComponentKey | null =
    commercialKey === XMAS_PORTRAIT && remaining.includes(XMAS_PORTRAIT)
      ? XMAS_PORTRAIT
      : commercialKey === XMAS_SANTA_VIDEO && remaining.includes(XMAS_SANTA_VIDEO)
        ? XMAS_SANTA_VIDEO
        : (input.productKey === "xmas_card_message" ||
            input.productKey === "xmas_card" ||
            input.productKey === "christmas_card" ||
            input.productKey === "christmas_messages") &&
            remaining.includes("xmas_card_message")
          ? "xmas_card_message"
          : commercialKey === XMAS_MAGIC_BUNDLE
            ? null
            : null;

  if (component) {
    const bundleOffer = input.catalog.find((o) => o.key === XMAS_MAGIC_BUNDLE);
    if (!bundleOffer) {
      return { ok: false, code: "config_missing", message: "Bundle entitlement config is missing." };
    }
    return {
      ok: true,
      offer: bundleOffer,
      creditCost: 0,
      viaEntitlement: true,
      component,
    };
  }

  const offer = input.catalog.find((item) => item.key === commercialKey);
  if (!offer) {
    return { ok: false, code: "config_missing", message: "Christmas credit pricing is not configured." };
  }
  if (!offer.active) {
    return { ok: false, code: "inactive_product", message: "This offer is not available." };
  }
  if (!offer.appCreditsCost || offer.appCreditsCost <= 0) {
    return { ok: false, code: "invalid_credits", message: "Configured credit cost is invalid." };
  }
  if (
    input.displayedCreditCost != null &&
    Number(input.displayedCreditCost) !== offer.appCreditsCost
  ) {
    return {
      ok: false,
      code: "pricing_changed",
      message: "Credit cost changed. Refresh to confirm the new amount.",
      serverCreditCost: offer.appCreditsCost,
    };
  }
  return { ok: true, offer, creditCost: offer.appCreditsCost };
}

export function mapCreditPackRow(row: PricingItemLike): CreditPackConfig | null {
  const key = String(row.key || "").trim();
  if (!key) return null;
  const category = String(row.category || "");
  if (!CREDIT_PACK_CATEGORIES.includes(category as (typeof CREDIT_PACK_CATEGORIES)[number])) {
    return null;
  }
  const meta = (row.metadata || {}) as Record<string, unknown>;
  const bonus = Math.max(0, asInt(meta.bonus_credits, 0));
  const baseFromMeta = meta.base_credits != null ? asInt(meta.base_credits, -1) : -1;
  const totalFromCredits = asInt(row.credits, -1);
  const total = totalFromCredits > 0 ? totalFromCredits : baseFromMeta > 0 ? baseFromMeta + bonus : -1;
  if (total < 1) return null;
  const base = baseFromMeta > 0 ? baseFromMeta : Math.max(0, total - bonus);
  const apple =
    String(meta.apple_product_id || meta.appleProductId || meta.apple_sku || "").trim() || null;
  const active = row.active !== false && row.is_active !== false;
  return {
    key,
    name: String(row.name || key),
    active,
    appleProductId: apple,
    baseCredits: base,
    bonusCredits: bonus,
    totalCredits: base + bonus === total ? total : total,
    label: String(meta.label || row.name || key),
    sortOrder: asInt(row.sort_order, 100),
    badge: meta.badge ? String(meta.badge) : row.is_featured ? "Popular" : null,
    featured: Boolean(row.is_featured),
    updatedAt: row.updated_at ? String(row.updated_at) : null,
  };
}

export function resolveIapGrant(input: {
  appleProductId: string;
  packs: CreditPackConfig[];
  /** Ignored · client must never choose the grant amount. */
  clientCredits?: number | null;
}):
  | { ok: true; pack: CreditPackConfig; creditsGranted: number }
  | { ok: false; code: string } {
  void input.clientCredits;
  const wanted = String(input.appleProductId || "").trim().toLowerCase();
  const pack = input.packs.find(
    (p) => p.active && p.appleProductId && p.appleProductId.toLowerCase() === wanted,
  );
  if (!pack) return { ok: false, code: "unknown_product" };
  if (pack.totalCredits < 1) return { ok: false, code: "invalid_credits" };
  return { ok: true, pack, creditsGranted: pack.totalCredits };
}

export type SnapshotOrder = {
  pricingKey: string;
  chargedAmountMinor: number;
  currency: string;
  configUpdatedAt: string | null;
  entitlement: string;
  bundleComponents?: string[] | null;
};

export function snapshotWebOrder(offer: ChristmasCommercialOffer): SnapshotOrder {
  return {
    pricingKey: offer.key,
    chargedAmountMinor: offer.webPriceMinor,
    currency: offer.webCurrency,
    configUpdatedAt: offer.updatedAt,
    entitlement: offer.key,
    bundleComponents: offer.bundleComponents,
  };
}

export function snapshotIapGrant(pack: CreditPackConfig, transactionId: string, appleProductId: string) {
  return {
    appleProductId,
    transactionId,
    baseCreditsGranted: pack.baseCredits,
    bonusCreditsGranted: pack.bonusCredits,
    totalGranted: pack.totalCredits,
    configUpdatedAt: pack.updatedAt,
    packKey: pack.key,
  };
}

export function snapshotSpend(offer: ChristmasCommercialOffer, creditCost: number) {
  return {
    pricingItem: offer.key,
    creditCostDebited: creditCost,
    configUpdatedAt: offer.updatedAt,
  };
}

export function historicalSnapshotImmutable(
  recorded: { chargedAmountMinor: number },
  newOffer: { webPriceMinor: number },
): boolean {
  return recorded.chargedAmountMinor !== newOffer.webPriceMinor
    ? recorded.chargedAmountMinor !== newOffer.webPriceMinor
    : true;
}

export function replayIapGrant(firstGranted: number, alreadyProcessed: boolean): number {
  return alreadyProcessed ? 0 : firstGranted;
}

export function bundleDoesNotDoubleCharge(componentsChargedSeparately: number[], bundlePrice: number): boolean {
  const sum = componentsChargedSeparately.reduce((a, b) => a + b, 0);
  return bundlePrice < sum && bundlePrice > 0;
}
