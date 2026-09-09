/**
 * Suite portrait AOV upsells (CHRISTMAS-039).
 * Extra images / extra styles / video for christmas_photo|family|couple|pet.
 * Not Christmas V2 packs (CHRISTMAS-037). Prices live on christmas_packages only.
 */

import {
  CHRISTMAS_CATALOG_SEED,
  findPackage,
  findProduct,
  resolvePurchasableOffer,
  type ChristmasPackageDef,
  type ChristmasProductDef,
} from "./catalog";

export { portraitAovPackageSeeds } from "./catalog";

export const PORTRAIT_AOV_PRODUCT_KEYS = [
  "christmas_photo",
  "christmas_family",
  "christmas_couple",
  "christmas_pet",
] as const;
export type PortraitAovProductKey = (typeof PORTRAIT_AOV_PRODUCT_KEYS)[number];

export const PORTRAIT_AOV_PACKAGE_KEYS = ["extra_images", "extra_styles", "video"] as const;
export type PortraitAovPackageKey = (typeof PORTRAIT_AOV_PACKAGE_KEYS)[number];

/** V2 pack keys — never treat these as suite portrait AOV offers. */
export const CHRISTMAS_V2_PACK_KEYS = ["starter", "magic", "ultimate"] as const;

export type PortraitAovFulfillKind = "extra_images" | "extra_styles" | "video";

export type PortraitAovOfferView = {
  packageKey: PortraitAovPackageKey;
  packageName: string;
  description: string;
  features: string[];
  currency: ChristmasPackageDef["currency"];
  /** Server/catalog amount only. Null when unpublished. */
  amountCents: number | null;
  purchasable: boolean;
  extraCount: number;
  fulfillKind: PortraitAovFulfillKind;
  purchased: boolean;
};

const EXTRA_COUNT: Record<PortraitAovPackageKey, number> = {
  extra_images: 2,
  extra_styles: 2,
  video: 1,
};

export function isPortraitAovProductKey(value: string): value is PortraitAovProductKey {
  return (PORTRAIT_AOV_PRODUCT_KEYS as readonly string[]).includes(value);
}

export function isPortraitAovPackageKey(value: string): value is PortraitAovPackageKey {
  return (PORTRAIT_AOV_PACKAGE_KEYS as readonly string[]).includes(value);
}

export function isChristmasV2PackKey(value: string): boolean {
  return (CHRISTMAS_V2_PACK_KEYS as readonly string[]).includes(value);
}

export function extraCountForUpsell(packageKey: PortraitAovPackageKey): number {
  return EXTRA_COUNT[packageKey];
}

export function fulfillKindForUpsell(packageKey: PortraitAovPackageKey): PortraitAovFulfillKind {
  return packageKey;
}

export function listPortraitAovOffers(input: {
  catalog?: ChristmasProductDef[];
  productKey: string;
  purchasedKeys?: readonly string[];
}): PortraitAovOfferView[] {
  if (!isPortraitAovProductKey(input.productKey)) return [];
  const catalog = input.catalog || CHRISTMAS_CATALOG_SEED;
  const product = findProduct(catalog, input.productKey);
  if (!product) return [];
  const purchased = new Set(input.purchasedKeys || []);

  return PORTRAIT_AOV_PACKAGE_KEYS.map((packageKey) => {
    const pkg = findPackage(product, packageKey);
    const extraCount =
      typeof pkg?.metadata?.extra_count === "number"
        ? Math.max(1, Math.round(pkg.metadata.extra_count))
        : extraCountForUpsell(packageKey);
    const priced = Boolean(pkg?.purchasable && pkg.priceCents > 0);
    return {
      packageKey,
      packageName: pkg?.packageName || packageKey,
      description: pkg?.description || "",
      features: pkg?.features || [],
      currency: pkg?.currency || "usd",
      amountCents: priced ? pkg!.priceCents : null,
      purchasable: priced,
      extraCount,
      fulfillKind: fulfillKindForUpsell(packageKey),
      purchased: purchased.has(packageKey),
    };
  });
}

/**
 * Authoritative upsell offer. Client-supplied amount/currency never win.
 */
export function resolvePortraitAovOffer(input: {
  catalog?: ChristmasProductDef[];
  productKey: string;
  packageKey: string;
  clientAmountCents?: number | null;
  clientCurrency?: string | null;
}) {
  if (!isPortraitAovProductKey(input.productKey)) {
    return { ok: false as const, code: "unknown_product" as const };
  }
  if (!isPortraitAovPackageKey(input.packageKey) || isChristmasV2PackKey(input.packageKey)) {
    return { ok: false as const, code: "unknown_package" as const };
  }
  return resolvePurchasableOffer({
    catalog: input.catalog || CHRISTMAS_CATALOG_SEED,
    productKey: input.productKey,
    packageKey: input.packageKey,
    clientAmountCents: input.clientAmountCents,
    clientCurrency: input.clientCurrency,
  });
}

export function formatServerPrice(amountCents: number, currency: string): string {
  const code = String(currency || "usd").toUpperCase();
  const dollars = (amountCents / 100).toFixed(amountCents % 100 === 0 ? 0 : 2);
  if (code === "USD") return `$${dollars}`;
  return `${dollars} ${code}`;
}
