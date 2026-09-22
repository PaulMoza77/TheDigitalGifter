/**
 * Christmas Planner commerce - server-authoritative packages and add-ons.
 * Seed numbers exist for tests / Admin bootstrap. Runtime checkout must
 * resolve from DB rows mapped into this shape and must ignore client amounts.
 */

import {
  findPackage,
  findProduct,
  type ChristmasPackageDef,
  type ChristmasProductDef,
} from "../catalog";
import { christmasCheckoutEnabled } from "../checkout";
import {
  FOUNDING_PASS_CURRENCY,
  FOUNDING_PASS_PACKAGE_KEY,
  FOUNDING_PASS_PRICE_CENTS,
} from "./types";

export const PLANNER_PRODUCT_FAMILY = "christmas_planner" as const;
export const PLANNER_PRODUCT_KEY = "christmas_planner_2026" as const;
export const PLANNER_SEASON_YEAR = 2026;
export const PLANNER_ROUTE = "/christmas/planner";
export const PLANNER_WELCOME_ROUTE = "/christmas/planner/welcome";
export const PLANNER_ACCOUNT_ROUTE = "/account/christmas";
export const PLANNER_ACCOUNT_WELCOME_ROUTE = "/account/christmas/welcome";

export const PLANNER_PACKAGE_KEYS = ["founding_pass", "essentials", "magic", "all_in"] as const;
export type PlannerPackageKey = (typeof PLANNER_PACKAGE_KEYS)[number];

export const PLANNER_ADDON_KEYS = [
  "addon_recipes",
  "addon_hosting",
  "addon_activities",
  "addon_gift_ideas",
  "addon_travel",
  "addon_photo_credits",
] as const;
export type PlannerAddonKey = (typeof PLANNER_ADDON_KEYS)[number];

export const PLANNER_ENTITLEMENT_KEYS = [
  "planner.countdown",
  "planner.plan",
  "planner.tasks",
  "planner.gifts",
  "planner.budget",
  "planner.shopping",
  "planner.wishlist",
  "planner.meals",
  "planner.hosting",
  "planner.cards_messages",
  "planner.activities",
  "planner.travel",
  "planner.gift_finder_advanced",
  "planner.rescue_mode",
  "planner.recipes_collection",
  "planner.premium_content",
  "planner.photo_credits_bonus",
  "planner.ai_assistant",
  "planner.club_premium",
] as const;
export type PlannerEntitlementKey = (typeof PLANNER_ENTITLEMENT_KEYS)[number];

const ESSENTIALS_ENTITLEMENTS: PlannerEntitlementKey[] = [
  "planner.countdown",
  "planner.plan",
  "planner.tasks",
  "planner.gifts",
  "planner.budget",
  "planner.shopping",
  "planner.wishlist",
];

const MAGIC_ENTITLEMENTS: PlannerEntitlementKey[] = [
  ...ESSENTIALS_ENTITLEMENTS,
  "planner.meals",
  "planner.hosting",
  "planner.cards_messages",
  "planner.activities",
  "planner.travel",
  "planner.gift_finder_advanced",
  "planner.rescue_mode",
];

const ALL_IN_ENTITLEMENTS: PlannerEntitlementKey[] = [
  ...MAGIC_ENTITLEMENTS,
  "planner.recipes_collection",
  "planner.premium_content",
  "planner.photo_credits_bonus",
  "planner.ai_assistant",
  "planner.club_premium",
];

export const PACKAGE_ENTITLEMENTS: Record<PlannerPackageKey, PlannerEntitlementKey[]> = {
  founding_pass: ALL_IN_ENTITLEMENTS,
  essentials: ESSENTIALS_ENTITLEMENTS,
  magic: MAGIC_ENTITLEMENTS,
  all_in: ALL_IN_ENTITLEMENTS,
};

export const ADDON_ENTITLEMENTS: Record<PlannerAddonKey, PlannerEntitlementKey> = {
  addon_recipes: "planner.recipes_collection",
  addon_hosting: "planner.hosting",
  addon_activities: "planner.activities",
  addon_gift_ideas: "planner.gift_finder_advanced",
  addon_travel: "planner.travel",
  addon_photo_credits: "planner.photo_credits_bonus",
};

/** Add-ons already covered by a package - never auto-charge. */
export function addonsIncludedInPackage(packageKey: PlannerPackageKey): PlannerAddonKey[] {
  const owned = new Set(PACKAGE_ENTITLEMENTS[packageKey]);
  return PLANNER_ADDON_KEYS.filter((key) => owned.has(ADDON_ENTITLEMENTS[key]));
}

export function isPlannerProductKey(value: string): boolean {
  const key = String(value || "").trim();
  return key === PLANNER_PRODUCT_KEY || key === PLANNER_PRODUCT_FAMILY || key === "christmas_planner";
}

export function isPlannerPackageKey(value: string): value is PlannerPackageKey {
  return (PLANNER_PACKAGE_KEYS as readonly string[]).includes(String(value || "").trim());
}

export function isPlannerAddonKey(value: string): value is PlannerAddonKey {
  return (PLANNER_ADDON_KEYS as readonly string[]).includes(String(value || "").trim());
}

export function plannerCheckoutFlagEnabled(): boolean {
  const raw = String(
    (typeof process !== "undefined" && process.env?.CHRISTMAS_PLANNER_CHECKOUT_ENABLED) || "",
  )
    .trim()
    .toLowerCase();
  return raw === "true" || raw === "1" || raw === "on";
}

export function plannerCheckoutLive(product: ChristmasProductDef | null | undefined): boolean {
  if (plannerCheckoutFlagEnabled()) return true;
  return christmasCheckoutEnabled() && product?.metadata?.checkout_live === true;
}

/** Authenticated Planner unlock return path. Rejects open redirects. */
export function isSafePlannerReturnPath(path: string): boolean {
  const raw = String(path || "").trim();
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("://") || raw.includes("\\") || raw.includes("@")) {
    return false;
  }
  const pathname = raw.split("?")[0].split("#")[0];
  if (pathname === PLANNER_ACCOUNT_ROUTE || pathname.startsWith(`${PLANNER_ACCOUNT_ROUTE}/`)) return true;
  if (pathname === PLANNER_ROUTE || pathname.startsWith(`${PLANNER_ROUTE}/`)) return true;
  return false;
}

export function plannerCheckoutReturnPath(path: string | null | undefined): string {
  const raw = String(path || "").trim().split("#")[0];
  const pathname = raw.split("?")[0];
  if (pathname === PLANNER_ACCOUNT_WELCOME_ROUTE) return PLANNER_ACCOUNT_WELCOME_ROUTE;
  if (isSafePlannerReturnPath(pathname) && pathname.startsWith(PLANNER_ACCOUNT_ROUTE)) return pathname;
  if (pathname === PLANNER_WELCOME_ROUTE || pathname.startsWith(`${PLANNER_WELCOME_ROUTE}/`)) return PLANNER_WELCOME_ROUTE;
  return PLANNER_ACCOUNT_WELCOME_ROUTE;
}

export type PlannerCheckoutPlan =
  | {
      ok: true;
      productKey: string;
      packageKey: string;
      addonKeys: PlannerAddonKey[];
      skippedAddonKeys: PlannerAddonKey[];
      sku: string;
      amountCents: number;
      currency: ChristmasPackageDef["currency"];
      productName: string;
      packageName: string;
      entitlements: PlannerEntitlementKey[];
      tier: PlannerPackageKey | "addon";
      seasonYear: number;
    }
  | { ok: false; code: string; message: string };

function uniqueEntitlements(keys: PlannerEntitlementKey[]): PlannerEntitlementKey[] {
  return [...new Set(keys)];
}

export function entitlementsForSelection(input: {
  packageKey: string;
  addonKeys?: string[] | null;
}): PlannerEntitlementKey[] {
  const keys: PlannerEntitlementKey[] = [];
  if (isPlannerPackageKey(input.packageKey)) {
    keys.push(...PACKAGE_ENTITLEMENTS[input.packageKey]);
  } else if (isPlannerAddonKey(input.packageKey)) {
    keys.push(ADDON_ENTITLEMENTS[input.packageKey]);
  }
  for (const addon of input.addonKeys || []) {
    if (isPlannerAddonKey(addon)) keys.push(ADDON_ENTITLEMENTS[addon]);
  }
  return uniqueEntitlements(keys);
}

/**
 * Authoritative planner offer. Client amount/currency never win.
 * Add-ons already included in the selected package are skipped (not charged).
 */
export function resolvePlannerCheckout(input: {
  catalog: ChristmasProductDef[];
  productKey?: string | null;
  packageKey: string;
  addonKeys?: string[] | null;
  clientAmountCents?: number | null;
  clientCurrency?: string | null;
  requireCheckoutEnabled?: boolean;
}): PlannerCheckoutPlan {
  void input.clientAmountCents;
  void input.clientCurrency;

  const product =
    findProduct(input.catalog, input.productKey || PLANNER_PRODUCT_KEY) ||
    findProduct(input.catalog, PLANNER_PRODUCT_KEY);
  if (!product || !isPlannerProductKey(product.productKey)) {
    return { ok: false, code: "unknown_product", message: "Unknown Christmas Planner product." };
  }
  if (!product.active) {
    return { ok: false, code: "inactive_product", message: "Christmas Planner is not available." };
  }
  if (input.requireCheckoutEnabled !== false && !plannerCheckoutLive(product)) {
    return {
      ok: false,
      code: "checkout_disabled",
      message: "Christmas Planner checkout is not enabled.",
    };
  }

  const packageKey = String(input.packageKey || "").trim();
  const pkg = findPackage(product, packageKey);
  if (!pkg) {
    return { ok: false, code: "unknown_package", message: "Unsupported Planner package." };
  }
  if (!pkg.active) {
    return { ok: false, code: "inactive_package", message: "This Planner package is inactive." };
  }
  if (!pkg.purchasable) {
    return { ok: false, code: "not_purchasable", message: "This Planner package is not purchasable." };
  }
  if (pkg.priceCents <= 0) {
    return { ok: false, code: "invalid_price", message: "Configured package price is not valid." };
  }
  if (packageKey === FOUNDING_PASS_PACKAGE_KEY) {
    if (pkg.priceCents !== FOUNDING_PASS_PRICE_CENTS || String(pkg.currency).toLowerCase() !== FOUNDING_PASS_CURRENCY) {
      return {
        ok: false,
        code: "invalid_price",
        message: "Founding Pass price is not the authoritative $17 USD offer.",
      };
    }
  }

  const requestedAddons = [...new Set((input.addonKeys || []).map((k) => String(k || "").trim()).filter(Boolean))];
  for (const addon of requestedAddons) {
    if (!isPlannerAddonKey(addon)) {
      return { ok: false, code: "unknown_package", message: "Unsupported Planner add-on." };
    }
  }

  const included = isPlannerPackageKey(packageKey) ? new Set(addonsIncludedInPackage(packageKey)) : new Set<PlannerAddonKey>();
  const chargedAddons: PlannerAddonKey[] = [];
  const skippedAddonKeys: PlannerAddonKey[] = [];
  let addonTotal = 0;

  for (const addon of requestedAddons) {
    if (!isPlannerAddonKey(addon)) continue;
    if (included.has(addon) || addon === packageKey) {
      skippedAddonKeys.push(addon);
      continue;
    }
    const addonPkg = findPackage(product, addon);
    if (!addonPkg) return { ok: false, code: "unknown_package", message: "Unsupported Planner add-on." };
    if (!addonPkg.active || !addonPkg.purchasable) {
      return { ok: false, code: "not_purchasable", message: "This Planner add-on is not purchasable." };
    }
    if (addonPkg.priceCents <= 0) {
      return { ok: false, code: "invalid_price", message: "Configured add-on price is not valid." };
    }
    if (addonPkg.currency !== pkg.currency) {
      return { ok: false, code: "currency_mismatch", message: "Add-on currency does not match package." };
    }
    chargedAddons.push(addon);
    addonTotal += addonPkg.priceCents;
  }

  const entitlements = entitlementsForSelection({ packageKey, addonKeys: chargedAddons });
  const amountCents = pkg.priceCents + addonTotal;
  const tier: PlannerPackageKey | "addon" = isPlannerPackageKey(packageKey) ? packageKey : "addon";

  return {
    ok: true,
    productKey: product.productKey,
    packageKey,
    addonKeys: chargedAddons,
    skippedAddonKeys,
    sku: `xmas_${product.productKey}_${packageKey}`,
    amountCents,
    currency: pkg.currency,
    productName: product.name,
    packageName: pkg.packageName,
    entitlements,
    tier,
    seasonYear: Number(product.metadata?.season_year) || PLANNER_SEASON_YEAR,
  };
}

function isPublicPlannerOffer(pkg: ChristmasPackageDef): boolean {
  if (pkg.metadata?.publicOffer === false) return false;
  if (pkg.metadata?.kind === "addon") return false;
  return true;
}

export function plannerPublicCatalog(product: ChristmasProductDef) {
  const launchPackages = product.packages.filter(
    (pkg) => pkg.active && isPlannerPackageKey(pkg.packageKey) && pkg.packageKey === "founding_pass",
  );
  const packages = (launchPackages.length ? launchPackages : product.packages)
    .filter((pkg) => pkg.active && isPlannerPackageKey(pkg.packageKey) && isPublicPlannerOffer(pkg))
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((pkg) => ({
      packageKey: pkg.packageKey,
      packageName: pkg.packageName,
      description: pkg.description,
      currency: pkg.currency,
      priceCents: pkg.priceCents,
      compareAtCents: pkg.compareAtCents,
      purchasable: pkg.purchasable,
      features: pkg.features,
      badge: pkg.metadata?.badge ? String(pkg.metadata.badge) : null,
      highlight: Boolean(pkg.metadata?.highlight),
      entitlements: isPlannerPackageKey(pkg.packageKey) ? PACKAGE_ENTITLEMENTS[pkg.packageKey] : [],
      includedAddons: isPlannerPackageKey(pkg.packageKey) ? addonsIncludedInPackage(pkg.packageKey) : [],
    }));

  const addons = (launchPackages.length ? [] : product.packages)
    .filter((pkg) => pkg.active && isPlannerAddonKey(pkg.packageKey))
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((pkg) => ({
      packageKey: pkg.packageKey,
      packageName: pkg.packageName,
      description: pkg.description,
      currency: pkg.currency,
      priceCents: pkg.priceCents,
      purchasable: pkg.purchasable,
      entitlement: isPlannerAddonKey(pkg.packageKey) ? ADDON_ENTITLEMENTS[pkg.packageKey] : null,
    }));

  return {
    productKey: product.productKey,
    name: product.name,
    description: product.description,
    checkoutLive: plannerCheckoutLive(product),
    seasonYear: Number(product.metadata?.season_year) || PLANNER_SEASON_YEAR,
    packages,
    addons,
  };
}

export function mapPlannerRowsToProduct(input: {
  product: Record<string, unknown>;
  packages: Array<Record<string, unknown>>;
}): ChristmasProductDef {
  const meta = (input.product.metadata || {}) as Record<string, unknown>;
  return {
    productKey: String(input.product.product_key || PLANNER_PRODUCT_KEY),
    slug: String(input.product.slug || "planner"),
    productType: "planner",
    name: String(input.product.name || "Christmas Planner"),
    description: String(input.product.description || ""),
    active: input.product.active !== false,
    publicDiscoverable: input.product.public_discoverable !== false,
    sortOrder: Number(input.product.sort_order) || 8,
    routePath: String(input.product.route_path || PLANNER_ROUTE),
    localeDefault: "en",
    metadata: meta,
    packages: input.packages.map((pkg) => ({
      packageKey: String(pkg.package_key || ""),
      packageName: String(pkg.package_name || ""),
      description: String(pkg.description || ""),
      currency: (String(pkg.currency || "usd").toLowerCase() as ChristmasPackageDef["currency"]) || "usd",
      priceCents: Number(pkg.price_cents) || 0,
      compareAtCents: pkg.compare_at_cents == null ? null : Number(pkg.compare_at_cents),
      active: pkg.active !== false,
      purchasable: pkg.purchasable === true,
      features: Array.isArray(pkg.features) ? pkg.features.map((f) => String(f)) : [],
      sortOrder: Number(pkg.sort_order) || 100,
      localeDefault: "en",
      metadata: (pkg.metadata || {}) as Record<string, unknown>,
    })),
  };
}
