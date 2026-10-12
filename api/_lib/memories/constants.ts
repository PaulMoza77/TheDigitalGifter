export const MEMORIES_SOURCE_BUCKET = "memories-source-photos";
export const MEMORIES_PRODUCT_FAMILY = "memories";
export const MEMORIES_PRODUCT_TYPE = "memories_subscription";
export const MEMORIES_FUNNEL_VARIANT = "memories_v1";
export const MEMORIES_SIGNED_UPLOAD_SECONDS = 60 * 15;
export const MEMORIES_PHOTO_MAX_BYTES = 15 * 1024 * 1024;

export type MemoriesPlanKey = "starter" | "plus" | "legacy";
export type MemoriesCommercialMode = "waitlist" | "test" | "paid_early_access";

export const MEMORIES_PLANS = {
  starter: {
    key: "starter" as const,
    sku: "memories-starter-monthly",
    name: "Memories Starter",
    amountCents: 900,
    priceDisplay: "$9/month",
    badge: null as string | null,
    features: [
      "Limited monthly photo animations (when available)",
      "Personal memory library",
      "Basic preservation features",
    ],
    provisionalNote: "Entitlements are provisional until product launch.",
  },
  plus: {
    key: "plus" as const,
    sku: "memories-plus-monthly",
    name: "Memories Plus",
    amountCents: 1900,
    priceDisplay: "$19/month",
    badge: "Most Popular",
    features: [
      "More monthly animations (when available)",
      "Advanced memory experiences",
      "Expanded library",
    ],
    provisionalNote: "Entitlements are provisional until product launch.",
  },
  legacy: {
    key: "legacy" as const,
    sku: "memories-legacy-monthly",
    name: "Memories Legacy",
    amountCents: 4900,
    priceDisplay: "$49/month",
    badge: null as string | null,
    features: [
      "Premium memory experiences (when available)",
      "Advanced voice and storytelling features, subject to rights and feasibility",
      "Future interactive features",
    ],
    provisionalNote: "Entitlements are provisional until product launch.",
  },
} as const;

export function siteOrigin(): string {
  return (
    String(process.env.PUBLIC_SITE_URL || process.env.SITE_URL || process.env.VITE_APP_URL || "")
      .trim() || "https://www.thedigitalgifter.com"
  );
}

export function memoriesEnabled(): boolean {
  const raw = String(process.env.MEMORIES_ENABLED ?? "true").trim().toLowerCase();
  return raw !== "false" && raw !== "0" && raw !== "off";
}

export function memoriesCommercialMode(): MemoriesCommercialMode {
  const raw = String(process.env.MEMORIES_COMMERCIAL_MODE || "waitlist")
    .trim()
    .toLowerCase();
  if (raw === "test" || raw === "paid_early_access") return raw;
  return "waitlist";
}

export function stripePriceIdForPlan(plan: MemoriesPlanKey): string {
  const map: Record<MemoriesPlanKey, string> = {
    starter: String(process.env.MEMORIES_STRIPE_PRICE_STARTER || "").trim(),
    plus: String(process.env.MEMORIES_STRIPE_PRICE_PLUS || "").trim(),
    legacy: String(process.env.MEMORIES_STRIPE_PRICE_LEGACY || "").trim(),
  };
  return map[plan];
}

export function isMemoriesPlanKey(value: unknown): value is MemoriesPlanKey {
  return value === "starter" || value === "plus" || value === "legacy";
}

export function chargingAllowed(mode: MemoriesCommercialMode): boolean {
  return mode === "test" || mode === "paid_early_access";
}
