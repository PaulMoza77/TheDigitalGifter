import {
  FREE_LIMITS,
  PLANNER_FEATURE_KEYS,
  PLANNER_PACKAGE_FEATURES,
  PLANNER_PRODUCT_KEYS,
  type PlannerAccess,
  type PlannerFeatureKey,
} from "./types";

export function isPlannerProductKey(value: string): boolean {
  return (PLANNER_PRODUCT_KEYS as readonly string[]).includes(value);
}

export function featuresForPackage(
  productKey: string,
  packageKey: string,
): PlannerFeatureKey[] {
  if (productKey === "christmas_planner_food") return [...PLANNER_PACKAGE_FEATURES.food];
  if (productKey === "christmas_planner_recipes") return [...PLANNER_PACKAGE_FEATURES.recipes];
  if (productKey === "christmas_planner_hosting") return [...PLANNER_PACKAGE_FEATURES.hosting];
  if (productKey === "christmas_planner_travel") return [...PLANNER_PACKAGE_FEATURES.travel];
  return [...(PLANNER_PACKAGE_FEATURES[packageKey] || [])];
}

export function mergeFeatures(lists: PlannerFeatureKey[][]): PlannerFeatureKey[] {
  const set = new Set<PlannerFeatureKey>();
  for (const list of lists) {
    for (const key of list) {
      if ((PLANNER_FEATURE_KEYS as readonly string[]).includes(key)) set.add(key);
    }
  }
  return PLANNER_FEATURE_KEYS.filter((k) => set.has(k));
}

export function accessFromGrants(input: {
  grantKeys: string[];
  orders: Array<{ product_key: string; package_key: string; payment_status: string; refunded_at?: string | null }>;
  seasonYear: number;
}): PlannerAccess {
  const fromOrders = input.orders
    .filter((o) => o.payment_status === "paid" && !o.refunded_at && isPlannerProductKey(o.product_key))
    .flatMap((o) => featuresForPackage(o.product_key, o.package_key));
  const fromGrants = input.grantKeys.filter((k): k is PlannerFeatureKey =>
    (PLANNER_FEATURE_KEYS as readonly string[]).includes(k),
  );
  const features = mergeFeatures([fromGrants, fromOrders]);
  const package_keys = [
    ...new Set(
      input.orders
        .filter((o) => o.payment_status === "paid" && !o.refunded_at && isPlannerProductKey(o.product_key))
        .map((o) => o.package_key),
    ),
  ];
  return {
    ok: true,
    season_year: input.seasonYear,
    features,
    package_keys,
    paid: features.length > 0,
  };
}

export function hasFeature(access: PlannerAccess | null | undefined, key: PlannerFeatureKey): boolean {
  return Boolean(access?.features?.includes(key));
}

export function moduleLocked(
  access: PlannerAccess | null | undefined,
  required: PlannerFeatureKey,
): boolean {
  return !hasFeature(access, required);
}

export type LimitCheck = { ok: true } | { ok: false; code: "free_limit"; limit: number };

export function canAddRecipient(access: PlannerAccess | null | undefined, currentCount: number): LimitCheck {
  if (hasFeature(access, "gift_planner")) return { ok: true };
  if (currentCount >= FREE_LIMITS.maxRecipients) {
    return { ok: false, code: "free_limit", limit: FREE_LIMITS.maxRecipients };
  }
  return { ok: true };
}

export function canAddCustomTask(
  access: PlannerAccess | null | undefined,
  customCount: number,
  openCount: number,
): LimitCheck {
  if (hasFeature(access, "planner_core")) return { ok: true };
  if (customCount >= FREE_LIMITS.maxCustomTasks) {
    return { ok: false, code: "free_limit", limit: FREE_LIMITS.maxCustomTasks };
  }
  if (openCount >= FREE_LIMITS.maxOpenTasks) {
    return { ok: false, code: "free_limit", limit: FREE_LIMITS.maxOpenTasks };
  }
  return { ok: true };
}

export function upgradePackageForFeature(feature: PlannerFeatureKey): {
  productKey: string;
  packageKey: string;
} {
  if (feature === "food_planner") return { productKey: "christmas_planner_food", packageKey: "food" };
  if (feature === "recipes" || feature === "premium_content") {
    return { productKey: "christmas_planner_recipes", packageKey: "recipes" };
  }
  if (feature === "hosting") return { productKey: "christmas_planner_hosting", packageKey: "hosting" };
  if (feature === "travel") return { productKey: "christmas_planner_travel", packageKey: "travel" };
  return { productKey: "christmas_planner", packageKey: "core" };
}
