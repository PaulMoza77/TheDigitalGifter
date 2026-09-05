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
    metadata: { foundation: true, live_offer: false, portrait_vertical: true },
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
    name: "Family Christmas",
    description: "Turn your family photo into a magical Christmas portrait.",
    active: true,
    publicDiscoverable: true,
    sortOrder: 20,
    routePath: "/christmas/family",
    localeDefault: "en",
    metadata: { foundation: true, live_offer: false, portrait_vertical: true },
    packages: [
      {
        packageKey: "single",
        packageName: "Single family portrait",
        description: "Draft package — not a live public offer.",
        currency: "usd",
        priceCents: 0,
        compareAtCents: null,
        active: true,
        purchasable: false,
        features: ["1 Christmas family portrait"],
        sortOrder: 10,
        localeDefault: "en",
        metadata: { live_offer: false },
      },
    ],
  },
  {
    productKey: "christmas_couple",
    slug: "couples",
    productType: "photo_generator",
    name: "Couples Christmas",
    description: "A romantic Christmas couple portrait from one shared photo.",
    active: true,
    publicDiscoverable: true,
    sortOrder: 30,
    routePath: "/christmas/couples",
    localeDefault: "en",
    metadata: { foundation: true, live_offer: false, portrait_vertical: true },
    packages: [
      {
        packageKey: "single",
        packageName: "Single couple portrait",
        description: "Draft package — not a live public offer.",
        currency: "usd",
        priceCents: 0,
        compareAtCents: null,
        active: true,
        purchasable: false,
        features: ["1 Christmas couple portrait"],
        sortOrder: 10,
        localeDefault: "en",
        metadata: { live_offer: false },
      },
    ],
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
    name: "Pet Christmas",
    description: "Christmas pet portraits for dogs and cats (not Secret Life packs).",
    active: true,
    publicDiscoverable: true,
    sortOrder: 50,
    routePath: "/christmas/pets",
    localeDefault: "en",
    metadata: {
      foundation: true,
      live_offer: false,
      portrait_vertical: true,
      acquisition_routes: ["/christmas/dogs", "/christmas/cats"],
    },
    packages: [
      {
        packageKey: "single",
        packageName: "Single pet portrait",
        description: "Draft package — not a live public offer.",
        currency: "usd",
        priceCents: 0,
        compareAtCents: null,
        active: true,
        purchasable: false,
        features: ["1 Christmas pet portrait"],
        sortOrder: 10,
        localeDefault: "en",
        metadata: { live_offer: false },
      },
    ],
  },
  {
    productKey: "christmas_santa_video",
    slug: "santa-video",
    productType: "santa_video",
    name: "Personalized Santa Video",
    description: "Santa speaks your child’s name in a private Christmas video.",
    active: true,
    publicDiscoverable: true,
    sortOrder: 60,
    routePath: "/christmas/santa-video",
    localeDefault: "en",
    metadata: {
      foundation: true,
      live_offer: false,
      privacy_required: true,
      santa_video_v1: true,
    },
    packages: [
      {
        packageKey: "basic",
        packageName: "Santa Video — Basic",
        description: "Draft package — not a live public offer.",
        currency: "usd",
        priceCents: 0,
        compareAtCents: null,
        active: true,
        purchasable: false,
        features: ["1 personalized Santa video", "English or Romanian"],
        sortOrder: 10,
        localeDefault: "en",
        metadata: { live_offer: false },
      },
      {
        packageKey: "premium",
        packageName: "Santa Video — Premium",
        description: "Draft package — not a live public offer.",
        currency: "usd",
        priceCents: 0,
        compareAtCents: null,
        active: true,
        purchasable: false,
        features: ["1 personalized Santa video"],
        sortOrder: 20,
        localeDefault: "en",
        metadata: { live_offer: false },
      },
      {
        packageKey: "deluxe",
        packageName: "Santa Video — Deluxe",
        description: "Draft package — not a live public offer.",
        currency: "usd",
        priceCents: 0,
        compareAtCents: null,
        active: true,
        purchasable: false,
        features: ["1 personalized Santa video"],
        sortOrder: 30,
        localeDefault: "en",
        metadata: { live_offer: false },
      },
    ],
  },
  {
    productKey: "christmas_card",
    slug: "cards",
    productType: "card",
    name: "Personalized Christmas Cards",
    description: "Turn your photo and Christmas message into a card worth sending.",
    active: true,
    publicDiscoverable: true,
    sortOrder: 70,
    routePath: "/christmas/cards",
    localeDefault: "en",
    metadata: { cards_v1: true, live_offer: false },
    packages: [],
  },
  {
    productKey: "christmas_gift_tree",
    slug: "gifts",
    productType: "tree",
    name: "Get Your Christmas Gift",
    description: "Pick a present under the tree and reveal a Christmas reward.",
    active: true,
    publicDiscoverable: true,
    sortOrder: 75,
    routePath: "/christmas/gifts",
    localeDefault: "en",
    metadata: { gift_tree_v1: true, live_offer: true },
    packages: [
      {
        packageKey: "open_another",
        packageName: "Get 1 More Chance",
        description: "Unlock one more present under the Christmas gift tree.",
        currency: "usd",
        priceCents: 199,
        compareAtCents: 399,
        active: true,
        purchasable: true,
        features: ["1 extra gift opening", "Reward applied to your account"],
        sortOrder: 10,
        localeDefault: "en",
        metadata: { live_offer: true, opens_granted: 1 },
      },
      {
        packageKey: "open_five",
        packageName: "Get 5 More Chances",
        description: "Bundle of five extra Christmas gift openings.",
        currency: "usd",
        priceCents: 699,
        compareAtCents: 1495,
        active: true,
        purchasable: true,
        features: ["5 extra gift openings", "Best value"],
        sortOrder: 20,
        localeDefault: "en",
        metadata: { live_offer: true, opens_granted: 5 },
      },
    
    ],
  },
  {
    productKey: "christmas_tree",
    slug: "tree",
    productType: "tree",
    name: "Shareable Christmas Tree",
    description: "Decorate a Christmas tree, add gifts, and share securely.",
    active: true,
    publicDiscoverable: true,
    sortOrder: 80,
    routePath: "/christmas/tree",
    localeDefault: "en",
    metadata: { tree_v1: true, live_offer: false },
    packages: [],
  },
  {
    productKey: "christmas_advent",
    slug: "advent",
    productType: "advent",
    name: "Advent Calendar",
    description: "Daily Christmas rewards — starts December 1.",
    active: true,
    publicDiscoverable: true,
    sortOrder: 90,
    routePath: "/christmas/advent",
    localeDefault: "en",
    metadata: { advent_v1: true, starts: "2026-12-01", live_offer: false },
    packages: [],
  },
  {
    productKey: "christmas_wishlist",
    slug: "wishlist",
    productType: "wishlist",
    name: "Christmas Wishlist",
    description: "Make your Christmas list. Share one link.",
    active: true,
    publicDiscoverable: true,
    sortOrder: 100,
    routePath: "/christmas/wishlist",
    localeDefault: "en",
    metadata: { wishlist_v1: true, live_offer: false },
    packages: [],
  },
  {
    productKey: "christmas_gift_finder",
    slug: "gift-finder",
    productType: "gift_finder",
    name: "Christmas Gift Finder",
    description: "Find a Christmas gift they'll actually love.",
    active: true,
    publicDiscoverable: true,
    sortOrder: 110,
    routePath: "/christmas/gift-finder",
    localeDefault: "en",
    metadata: { gift_finder_v1: true, live_offer: false },
    packages: [],
  },
  {
    productKey: "christmas_messages",
    slug: "messages",
    productType: "messages",
    name: "Christmas Message Generator",
    description: "Find the right Christmas words in seconds.",
    active: true,
    publicDiscoverable: true,
    sortOrder: 120,
    routePath: "/christmas/messages",
    localeDefault: "en",
    metadata: { messages_v1: true, live_offer: false },
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
  if (
    product.metadata?.tree_v1 ||
    product.metadata?.gift_tree_v1 ||
    product.metadata?.advent_v1 ||
    product.metadata?.wishlist_v1 ||
    product.metadata?.gift_finder_v1 ||
    product.metadata?.cards_v1 ||
    product.metadata?.messages_v1
  ) {
    return false;
  }
  return Boolean(product.metadata?.coming_soon) || product.packages.every((p) => !p.purchasable);
}

const PORTRAIT_VERTICAL_KEYS = new Set([
  "christmas_photo",
  "christmas_family",
  "christmas_couple",
  "christmas_pet",
  "christmas_santa_video",
]);

const EXPERIENCE_OPEN_KEYS = new Set([
  ...PORTRAIT_VERTICAL_KEYS,
  "christmas_tree",
  "christmas_gift_tree",
  "christmas_advent",
  "christmas_wishlist",
  "christmas_gift_finder",
  "christmas_card",
  "christmas_messages",
]);

export function ctaStateForProduct(product: ChristmasProductDef): "open" | "coming_soon" | "unavailable" {
  if (!product.active || !product.publicDiscoverable) return "unavailable";
  if (product.packages.some((p) => p.active && p.purchasable)) return "open";
  // Navigable experiences; checkout may still be disabled.
  if (
    EXPERIENCE_OPEN_KEYS.has(product.productKey) &&
    !product.metadata?.coming_soon
  ) {
    return "open";
  }
  return "coming_soon";
}
