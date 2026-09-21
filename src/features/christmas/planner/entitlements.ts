import {
  FREE_LIMITS,
  PLANNER_COMPLETE_FEATURES,
  PLANNER_FEATURE_KEYS,
  PLANNER_PACKAGE_FEATURES,
  PLANNER_PRODUCT_KEYS,
  type PlannerAccess,
  type PlannerFeatureKey,
} from "./types";

/** Funnel user_entitlements keys → V1 app feature flags (mirrors SQL map_planner_entitlement_to_features). */
export const FUNNEL_ENTITLEMENT_TO_FEATURES: Record<string, readonly PlannerFeatureKey[]> = {
  "planner.countdown": ["planner_core"],
  "planner.plan": ["planner_core", "advanced_planning"],
  "planner.tasks": ["planner_core"],
  "planner.gifts": ["gift_planner"],
  "planner.wishlist": ["gift_planner"],
  "planner.budget": ["budget"],
  "planner.shopping": ["budget", "advanced_planning"],
  "planner.meals": ["food_planner"],
  "planner.recipes_collection": ["recipes"],
  "planner.hosting": ["hosting"],
  "planner.travel": ["travel"],
  "planner.rescue_mode": ["rescue_mode"],
  "planner.premium_content": ["premium_content"],
  "planner.club_premium": ["premium_content"],
  "planner.gift_finder_advanced": ["advanced_planning"],
  "planner.activities": ["advanced_planning"],
  "planner.cards_messages": ["advanced_planning"],
  "planner.ai_assistant": ["advanced_planning"],
  "planner.photo_credits_bonus": ["premium_content"],
};

export function featuresFromFunnelEntitlementKeys(keys: string[]): PlannerFeatureKey[] {
  const mapped: PlannerFeatureKey[][] = [];
  for (const key of keys) {
    if ((PLANNER_FEATURE_KEYS as readonly string[]).includes(key)) {
      mapped.push([key as PlannerFeatureKey]);
      continue;
    }
    const feats = FUNNEL_ENTITLEMENT_TO_FEATURES[key];
    if (feats?.length) mapped.push([...feats]);
  }
  return mergeFeatures(mapped);
}

export function isPlannerProductKey(value: string): boolean {
  const key = String(value || "").trim();
  return key === "christmas_planner_2026" || (PLANNER_PRODUCT_KEYS as readonly string[]).includes(key);
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
  orders?: Array<{
    product_key: string;
    package_key: string;
    payment_status: string;
    refunded_at?: string | null;
    season_year?: number;
  }>;
  grants?: Array<{
    feature_key: string;
    status: string;
    season_year: number;
    expires_at?: string | null;
    now?: Date;
  }>;
  seasonYear: number;
}): PlannerAccess {
  const fromActiveGrants = (input.grants || [])
    .filter((g) => {
      if (g.status !== "active") return false;
      if (g.season_year !== input.seasonYear) return false;
      if (g.expires_at && new Date(g.expires_at).getTime() <= (g.now || new Date()).getTime()) {
        return false;
      }
      return true;
    })
    .map((g) => g.feature_key);

  const rawKeys = [...input.grantKeys, ...fromActiveGrants];
  const grantKeys = featuresFromFunnelEntitlementKeys(rawKeys);
  const features = mergeFeatures([grantKeys]);
  const package_keys = [
    ...new Set(
      (input.orders || [])
        .filter(
          (o) =>
            o.payment_status === "paid" &&
            !o.refunded_at &&
            isPlannerProductKey(o.product_key) &&
            (o.season_year == null || o.season_year === input.seasonYear),
        )
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

const COMPLETE_PACKAGE_KEYS = new Set(["founding_pass", "magic", "complete", "all_in"]);

/** Truthful Complete / Founding Pass access — never invents a new product. */
export function hasCompletePlanner(access: PlannerAccess | null | undefined): boolean {
  if (!access) return false;
  if ((access.package_keys || []).some((key) => COMPLETE_PACKAGE_KEYS.has(key))) return true;
  return PLANNER_COMPLETE_FEATURES.every((key) => access.features.includes(key));
}

export function firstNameFromAuthUser(user: {
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
} | null | undefined): string {
  const meta = user?.user_metadata || {};
  const full = String(meta.full_name || meta.name || meta.given_name || "").trim();
  const first = full.split(/\s+/)[0];
  if (first) return first;
  const email = String(user?.email || "").trim();
  const local = email.split("@")[0];
  return local || "";
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

export function upgradePackageForFeature(_feature: PlannerFeatureKey): {
  productKey: string;
  packageKey: string;
} {
  // Launch commerce is Founding Pass only. Locked modules must open that offer,
  // not an essentials hash on the public planner landing.
  return { productKey: "christmas_planner_2026", packageKey: "founding_pass" };
}

export function addonIncludedInPackage(packageKey: string, addonKey: string): boolean {
  const pack = PLANNER_PACKAGE_FEATURES[packageKey] || [];
  const addon = PLANNER_PACKAGE_FEATURES[addonKey] || [];
  return addon.length > 0 && addon.every((f) => pack.includes(f));
}
