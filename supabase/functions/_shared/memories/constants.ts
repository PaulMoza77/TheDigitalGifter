export const MEMORIES_SOURCE_BUCKET = "memories-source-photos";
export const MEMORIES_PRODUCT_FAMILY = "memories";
export const MEMORIES_PRODUCT_TYPE = "memories_subscription";
export const MEMORIES_FUNNEL_VARIANT = "memories_v1";
export const MEMORIES_SIGNED_UPLOAD_SECONDS = 60 * 15;
export const MEMORIES_PHOTO_MAX_BYTES = 15 * 1024 * 1024;

export type MemoriesPlanKey = "starter" | "plus" | "legacy";
export type MemoriesCommercialMode = "waitlist" | "test" | "paid_early_access";

/** Proposed membership specs for early-access waitlist. Not live generation entitlements. */
export const MEMORIES_PLANS = {
  starter: {
    key: "starter" as const,
    sku: "memories-starter-monthly",
    name: "Memories Starter",
    amountCents: 900,
    priceDisplay: "$9/month",
    badge: null as string | null,
    tagline: "Bring a few special moments to life.",
    monthlyAnimations: 5,
    features: [
      "5 photo animations per month",
      "Short animated memories",
      "Personal memory gallery",
      "Download your creations",
      "Standard processing",
    ],
  },
  plus: {
    key: "plus" as const,
    sku: "memories-plus-monthly",
    name: "Memories Plus",
    amountCents: 1900,
    priceDisplay: "$19/month",
    badge: "Best Value",
    tagline: "Turn your favorite memories into beautiful stories.",
    monthlyAnimations: 20,
    features: [
      "20 photo animations per month",
      "Everything in Starter",
      "Longer memory clips",
      "Photo enhancement",
      "Personalized memory stories",
      "Priority processing",
    ],
  },
  legacy: {
    key: "legacy" as const,
    sku: "memories-legacy-monthly",
    name: "Memories Legacy",
    amountCents: 4900,
    priceDisplay: "$49/month",
    badge: null as string | null,
    tagline: "Build a lasting collection for generations.",
    monthlyAnimations: 60,
    features: [
      "60 photo animations per month",
      "Everything in Plus",
      "Premium memory films",
      "Family memory collections",
      "Advanced storytelling experiences",
      "Highest processing priority",
    ],
  },
} as const;

export function siteOrigin(): string {
  return (
    String(Deno.env.get("PUBLIC_SITE_URL") || Deno.env.get("SITE_URL") || "").trim() ||
    "https://www.thedigitalgifter.com"
  );
}

export function memoriesEnabled(): boolean {
  const raw = String(Deno.env.get("MEMORIES_ENABLED") ?? "true").trim().toLowerCase();
  return raw !== "false" && raw !== "0" && raw !== "off";
}

export function memoriesCommercialMode(): MemoriesCommercialMode {
  const raw = String(Deno.env.get("MEMORIES_COMMERCIAL_MODE") || "waitlist")
    .trim()
    .toLowerCase();
  if (raw === "test" || raw === "paid_early_access") return raw;
  return "waitlist";
}

export function stripePriceIdForPlan(plan: MemoriesPlanKey): string {
  const map: Record<MemoriesPlanKey, string> = {
    starter: String(Deno.env.get("MEMORIES_STRIPE_PRICE_STARTER") || "").trim(),
    plus: String(Deno.env.get("MEMORIES_STRIPE_PRICE_PLUS") || "").trim(),
    legacy: String(Deno.env.get("MEMORIES_STRIPE_PRICE_LEGACY") || "").trim(),
  };
  return map[plan];
}

export function isMemoriesPlanKey(value: unknown): value is MemoriesPlanKey {
  return value === "starter" || value === "plus" || value === "legacy";
}

export function chargingAllowed(mode: MemoriesCommercialMode): boolean {
  return mode === "test" || mode === "paid_early_access";
}
