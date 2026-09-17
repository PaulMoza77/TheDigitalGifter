/**
 * Deno copy of Planner checkout authority.
 * Keep in sync with src/features/christmas/planner/commerce.ts
 */

export const PLANNER_PRODUCT_KEY = "christmas_planner_2026";
export const PLANNER_SEASON_YEAR = 2026;

export const PLANNER_PACKAGE_KEYS = ["essentials", "magic", "all_in"] as const;
export const PLANNER_ADDON_KEYS = [
  "addon_recipes",
  "addon_hosting",
  "addon_activities",
  "addon_gift_ideas",
  "addon_travel",
  "addon_photo_credits",
] as const;

export type PlannerPackageKey = (typeof PLANNER_PACKAGE_KEYS)[number];
export type PlannerAddonKey = (typeof PLANNER_ADDON_KEYS)[number];

export const PACKAGE_ENTITLEMENTS: Record<PlannerPackageKey, string[]> = {
  essentials: [
    "planner.countdown",
    "planner.plan",
    "planner.tasks",
    "planner.gifts",
    "planner.budget",
    "planner.shopping",
    "planner.wishlist",
  ],
  magic: [
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
  ],
  all_in: [
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
  ],
};

export const ADDON_ENTITLEMENTS: Record<PlannerAddonKey, string> = {
  addon_recipes: "planner.recipes_collection",
  addon_hosting: "planner.hosting",
  addon_activities: "planner.activities",
  addon_gift_ideas: "planner.gift_finder_advanced",
  addon_travel: "planner.travel",
  addon_photo_credits: "planner.photo_credits_bonus",
};

export function isPlannerProductKey(value: string): boolean {
  const key = String(value || "").trim();
  return key === PLANNER_PRODUCT_KEY || key === "christmas_planner";
}

export function isPlannerPackageKey(value: string): value is PlannerPackageKey {
  return (PLANNER_PACKAGE_KEYS as readonly string[]).includes(String(value || "").trim());
}

export function isPlannerAddonKey(value: string): value is PlannerAddonKey {
  return (PLANNER_ADDON_KEYS as readonly string[]).includes(String(value || "").trim());
}

export function plannerCheckoutFlagEnabled(): boolean {
  const raw = String(Deno.env.get("CHRISTMAS_PLANNER_CHECKOUT_ENABLED") || "")
    .trim()
    .toLowerCase();
  return raw === "true" || raw === "1" || raw === "on";
}

export type PlannerPkgRow = {
  package_key: string;
  package_name: string;
  description?: string;
  currency: string;
  price_cents: number;
  compare_at_cents?: number | null;
  active: boolean;
  purchasable: boolean;
  features?: unknown;
  sort_order?: number;
  metadata?: Record<string, unknown> | null;
};

export type PlannerProductRow = {
  product_key: string;
  name: string;
  active: boolean;
  metadata?: Record<string, unknown> | null;
};

function addonsIncludedInPackage(packageKey: PlannerPackageKey): PlannerAddonKey[] {
  const owned = new Set(PACKAGE_ENTITLEMENTS[packageKey]);
  return PLANNER_ADDON_KEYS.filter((key) => owned.has(ADDON_ENTITLEMENTS[key]));
}

export function entitlementsForSelection(packageKey: string, addonKeys: string[]): string[] {
  const keys: string[] = [];
  if (isPlannerPackageKey(packageKey)) keys.push(...PACKAGE_ENTITLEMENTS[packageKey]);
  else if (isPlannerAddonKey(packageKey)) keys.push(ADDON_ENTITLEMENTS[packageKey]);
  for (const addon of addonKeys) {
    if (isPlannerAddonKey(addon)) keys.push(ADDON_ENTITLEMENTS[addon]);
  }
  return [...new Set(keys)];
}

export type PlannerResolve =
  | {
      ok: true;
      productKey: string;
      packageKey: string;
      addonKeys: string[];
      skippedAddonKeys: string[];
      sku: string;
      amountCents: number;
      currency: string;
      productName: string;
      packageName: string;
      entitlements: string[];
      tier: string;
      seasonYear: number;
      lineItems: Array<{ packageKey: string; name: string; amountCents: number }>;
    }
  | { ok: false; code: string; message: string };

export function resolvePlannerCheckoutFromRows(input: {
  product: PlannerProductRow;
  packages: PlannerPkgRow[];
  packageKey: string;
  addonKeys?: string[] | null;
  clientAmountCents?: number | null;
  clientCurrency?: string | null;
  christmasCheckoutEnabled: boolean;
}): PlannerResolve {
  void input.clientAmountCents;
  void input.clientCurrency;
  if (!input.christmasCheckoutEnabled) {
    return { ok: false, code: "checkout_disabled", message: "Christmas checkout is not enabled." };
  }
  const meta = input.product.metadata || {};
  const live = meta.checkout_live === true || plannerCheckoutFlagEnabled();
  if (!live) {
    return { ok: false, code: "checkout_disabled", message: "Christmas Planner checkout is not enabled." };
  }
  if (!input.product.active) {
    return { ok: false, code: "inactive_product", message: "Christmas Planner is not available." };
  }
  const packageKey = String(input.packageKey || "").trim();
  const pkg = input.packages.find((row) => row.package_key === packageKey);
  if (!pkg) return { ok: false, code: "unknown_package", message: "Unsupported Planner package." };
  if (!pkg.active) return { ok: false, code: "inactive_package", message: "This Planner package is inactive." };
  if (!pkg.purchasable) return { ok: false, code: "not_purchasable", message: "This Planner package is not purchasable." };
  if (!pkg.price_cents || pkg.price_cents <= 0) {
    return { ok: false, code: "invalid_price", message: "Configured package price is not valid." };
  }

  const requested = [...new Set((input.addonKeys || []).map((k) => String(k || "").trim()).filter(Boolean))];
  for (const addon of requested) {
    if (!isPlannerAddonKey(addon)) {
      return { ok: false, code: "unknown_package", message: "Unsupported Planner add-on." };
    }
  }
  const included = isPlannerPackageKey(packageKey)
    ? new Set(addonsIncludedInPackage(packageKey))
    : new Set<PlannerAddonKey>();
  const charged: string[] = [];
  const skipped: string[] = [];
  const lineItems = [{ packageKey, name: pkg.package_name, amountCents: pkg.price_cents }];
  let extra = 0;
  for (const addon of requested) {
    if (included.has(addon as PlannerAddonKey) || addon === packageKey) {
      skipped.push(addon);
      continue;
    }
    const addonPkg = input.packages.find((row) => row.package_key === addon);
    if (!addonPkg) return { ok: false, code: "unknown_package", message: "Unsupported Planner add-on." };
    if (!addonPkg.active || !addonPkg.purchasable) {
      return { ok: false, code: "not_purchasable", message: "This Planner add-on is not purchasable." };
    }
    if (!addonPkg.price_cents || addonPkg.price_cents <= 0) {
      return { ok: false, code: "invalid_price", message: "Configured add-on price is not valid." };
    }
    if (String(addonPkg.currency).toLowerCase() !== String(pkg.currency).toLowerCase()) {
      return { ok: false, code: "currency_mismatch", message: "Add-on currency does not match package." };
    }
    charged.push(addon);
    extra += addonPkg.price_cents;
    lineItems.push({ packageKey: addon, name: addonPkg.package_name, amountCents: addonPkg.price_cents });
  }

  return {
    ok: true,
    productKey: input.product.product_key,
    packageKey,
    addonKeys: charged,
    skippedAddonKeys: skipped,
    sku: `xmas_${input.product.product_key}_${packageKey}`,
    amountCents: pkg.price_cents + extra,
    currency: String(pkg.currency || "usd").toLowerCase(),
    productName: input.product.name,
    packageName: pkg.package_name,
    entitlements: entitlementsForSelection(packageKey, charged),
    tier: isPlannerPackageKey(packageKey) ? packageKey : "addon",
    seasonYear: Number(meta.season_year) || PLANNER_SEASON_YEAR,
    lineItems,
  };
}
