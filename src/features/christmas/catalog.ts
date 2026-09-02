/**
 * Christmas product catalog — language-independent keys + display seams.
 * Server and tests resolve prices from this contract (or DB rows mapped into it).
 * Do not hardcode checkout amounts in React UI.
 */

export const CHRISTMAS_LOCALES = ["en", "ro"] as const;
export type ChristmasLocale = (typeof CHRISTMAS_LOCALES)[number];

export const CHRISTMAS_PRODUCT_TYPES = [
  "photo_generator",
  "santa_video",
  "card",
  "tree",
  "advent",
  "wishlist",
  "gift_finder",
  "messages",
  "hub",
  "other",
] as const;
export type ChristmasProductType = (typeof CHRISTMAS_PRODUCT_TYPES)[number];

export type ChristmasPackageDef = {
  packageKey: string;
  packageName: string;
  description: string;
  currency: "usd" | "eur" | "ron";
  priceCents: number;
  compareAtCents: number | null;
  active: boolean;
  /** When false, checkout must reject even if the client sends a price. */
  purchasable: boolean;
  features: string[];
  sortOrder: number;
  localeDefault: ChristmasLocale;
  metadata: Record<string, unknown>;
};

export type ChristmasProductDef = {
  productKey: string;
  slug: string;
  productType: ChristmasProductType;
  name: string;
  description: string;
  active: boolean;
  publicDiscoverable: boolean;
  sortOrder: number;
  routePath: string;
  localeDefault: ChristmasLocale;
  metadata: Record<string, unknown>;
  packages: ChristmasPackageDef[];
};

/** Draft seed used by unit tests and offline fallback. Mirrors migration defaults. */
export const CHRISTMAS_CATALOG_SEED: ChristmasProductDef[] = [
  {
    productKey: "christmas_hub",
    slug: "hub",
    productType: "hub",
    name: "Christmas Hub",
    description: "Unified Christmas product suite entry.",
    active: true,
    publicDiscoverable: true,
    sortOrder: 0,
    routePath: "/christmas",
    localeDefault: "en",
    metadata: { shell: false },
    packages: [],
  },
  {
    productKey: "christmas_photo",
    slug: "photo-generator",
    productType: "photo_generator",
    name: "Christmas AI Photo Generator",
    description: "Personalized Christmas photo portraits.",
    active: true,
    publicDiscoverable: true,
    sortOrder: 10,
    routePath: "/christmas/photo-generator",
    localeDefault: "en",
    metadata: { foundation: true, live_offer: false },
    packages: [
      {
        packageKey: "single",
        packageName: "Single portrait",
        description: "Draft package — not a live public offer.",
        currency: "usd",
        priceCents: 0,
        compareAtCents: null,
        active: true,
        purchasable: false,
        features: ["1 Christmas portrait"],
        sortOrder: 10,
        localeDefault: "en",
        metadata: { live_offer: false },
      },
    ],
  },
  {
    productKey: "christmas_family",
    slug: "family",
    productType: "photo_generator",
    name: "Family Christmas Generator",
    description: "Coming soon.",
    active: true,
    publicDiscoverable: true,
    sortOrder: 20,
    routePath: "/christmas/family",
    localeDefault: "en",
    metadata: { coming_soon: true },
    packages: [],
  },
  {
    productKey: "christmas_couple",
    slug: "couples",
    productType: "photo_generator",
    name: "Couples Christmas Generator",
    description: "Coming soon.",
    active: true,
    publicDiscoverable: true,
    sortOrder: 30,
    routePath: "/christmas/couples",
    localeDefault: "en",
    metadata: { coming_soon: true },
    packages: [],
  },
  {
    productKey: "christmas_kids",
    slug: "kids",
    productType: "photo_generator",
    name: "Kids Christmas Generator",
    description: "Coming soon.",
    active: true,
    publicDiscoverable: true,
    sortOrder: 40,
    routePath: "/christmas/kids",
    localeDefault: "en",
    metadata: { coming_soon: true, privacy_required: true },
    packages: [],
  },
  {
    productKey: "christmas_pet",
    slug: "pets",
    productType: "photo_generator",
    name: "Pet Christmas Generator",
    description: "Coming soon.",
    active: true,
    publicDiscoverable: true,
    sortOrder: 50,
    routePath: "/christmas/pets",
    localeDefault: "en",
    metadata: { coming_soon: true },
    packages: [],
  },
  {
    productKey: "christmas_santa_video",
    slug: "santa-video",
    productType: "santa_video",
    name: "Personalized Santa Video",
    description: "Coming soon.",
    active: true,
    publicDiscoverable: true,
    sortOrder: 60,
    routePath: "/christmas/santa-video",
    localeDefault: "en",
    metadata: { coming_soon: true, privacy_required: true },
    packages: [],
  },
  {
    productKey: "christmas_card",
    slug: "cards",
    productType: "card",
    name: "Personalized Christmas Cards",
    description: "Coming soon.",
    active: true,
    publicDiscoverable: true,
    sortOrder: 70,
    routePath: "/christmas/cards",
    localeDefault: "en",
    metadata: { coming_soon: true },
    packages: [],
  },
  {
    productKey: "christmas_tree",
    slug: "tree",
    productType: "tree",
    name: "Shareable Christmas Tree",
    description: "Coming soon.",
    active: true,
    publicDiscoverable: true,
    sortOrder: 80,
    routePath: "/christmas/tree",
    localeDefault: "en",
    metadata: { coming_soon: true },
    packages: [],
  },
  {
    productKey: "christmas_advent",
    slug: "advent",
    productType: "advent",
    name: "Advent Calendar",
    description: "Coming soon.",
    active: true,
    publicDiscoverable: true,
    sortOrder: 90,
    routePath: "/christmas/advent",
    localeDefault: "en",
    metadata: { coming_soon: true },
    packages: [],
  },
  {
    productKey: "christmas_wishlist",
    slug: "wishlist",
    productType: "wishlist",
    name: "Christmas Wishlist",
    description: "Coming soon.",
    active: true,
    publicDiscoverable: true,
    sortOrder: 100,
    routePath: "/christmas/wishlist",
    localeDefault: "en",
    metadata: { coming_soon: true },
    packages: [],
  },
  {
    productKey: "christmas_gift_finder",
    slug: "gift-finder",
    productType: "gift_finder",
    name: "AI Christmas Gift Finder",
    description: "Coming soon.",
    active: true,
    publicDiscoverable: true,
    sortOrder: 110,
    routePath: "/christmas/gift-finder",
    localeDefault: "en",
    metadata: { coming_soon: true },
    packages: [],
  },
  {
    productKey: "christmas_messages",
    slug: "messages",
    productType: "messages",
    name: "AI Christmas Message Generator",
    description: "Coming soon.",
    active: true,
    publicDiscoverable: true,
    sortOrder: 120,
    routePath: "/christmas/messages",
    localeDefault: "en",
    metadata: { coming_soon: true },
    packages: [],
  },
];

export function findProduct(
  catalog: ChristmasProductDef[],
  productKey: string,
): ChristmasProductDef | null {
  const key = String(productKey || "").trim();
  return catalog.find((p) => p.productKey === key) ?? null;
}

export function findPackage(
  product: ChristmasProductDef,
  packageKey: string,
): ChristmasPackageDef | null {
  const key = String(packageKey || "").trim();
  return product.packages.find((pkg) => pkg.packageKey === key) ?? null;
}

export type ResolveOfferResult =
  | {
      ok: true;
      product: ChristmasProductDef;
      package: ChristmasPackageDef;
      sku: string;
      amountCents: number;
      currency: ChristmasPackageDef["currency"];
    }
  | { ok: false; code: "unknown_product" | "unknown_package" | "inactive_product" | "inactive_package" | "not_purchasable" };

/**
 * Authoritative offer resolution. Client-supplied amount/currency are ignored.
 */
export function resolvePurchasableOffer(input: {
  catalog: ChristmasProductDef[];
  productKey: string;
  packageKey: string;
  /** Optional tampered client amount — must never win. */
  clientAmountCents?: number | null;
  clientCurrency?: string | null;
}): ResolveOfferResult {
  const product = findProduct(input.catalog, input.productKey);
  if (!product) return { ok: false, code: "unknown_product" };
  if (!product.active) return { ok: false, code: "inactive_product" };

  const pkg = findPackage(product, input.packageKey);
  if (!pkg) return { ok: false, code: "unknown_package" };
  if (!pkg.active) return { ok: false, code: "inactive_package" };
  if (!pkg.purchasable) return { ok: false, code: "not_purchasable" };

  void input.clientAmountCents;
  void input.clientCurrency;

  return {
    ok: true,
    product,
    package: pkg,
    sku: `xmas_${product.productKey}_${pkg.packageKey}`,
    amountCents: pkg.priceCents,
    currency: pkg.currency,
  };
}

export function hubProducts(catalog: ChristmasProductDef[]): ChristmasProductDef[] {
  return catalog
    .filter((p) => p.productKey !== "christmas_hub" && p.publicDiscoverable && p.active)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function isComingSoon(product: ChristmasProductDef): boolean {
  return Boolean(product.metadata?.coming_soon) || product.packages.every((p) => !p.purchasable);
}

export function ctaStateForProduct(product: ChristmasProductDef): "open" | "coming_soon" | "unavailable" {
  if (!product.active || !product.publicDiscoverable) return "unavailable";
  if (product.packages.some((p) => p.active && p.purchasable)) return "open";
  if (product.productKey === "christmas_photo") return "coming_soon";
  return "coming_soon";
}
