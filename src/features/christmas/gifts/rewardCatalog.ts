/**
 * Christmas Gift Tree — centralized reward catalog + weights.
 *
 * Probability notes (relative weights, not equal random):
 * - common: credits_10 (24), credits_25 (20), santa_discount_15 (18)
 * - medium: free_image (12), christmas_portrait (10), pet_portrait (8)
 * - uncommon: gift_token (5)
 * - rare: credits_50 (2), gift_tree_discount_25 (1)
 *
 * Server must own the same catalog for durable claims (see giftTreeRewards.ts shared mirror).
 * This is a promotional digital reward mechanic — not a sweepstakes or cash prize.
 */

export const GIFT_TREE_SEASON_YEAR = 2026;
export const GIFT_TREE_PRODUCT_KEY = "christmas_gift_tree";
export const GIFT_TREE_STORAGE_KEY = "tdg.christmas.gift_tree.v1";
export const GIFT_TREE_GUEST_KEY = "tdg.christmas.gift_tree.guest.v1";

export const GIFT_TREE_REWARD_TYPES = [
  "credits",
  "image_generation",
  "christmas_portrait",
  "pet_christmas_portrait",
  "discount",
  "gift_token",
] as const;

export type GiftTreeRewardType = (typeof GIFT_TREE_REWARD_TYPES)[number];

export type GiftTreeRewardDef = {
  id: string;
  type: GiftTreeRewardType;
  /** Numeric value: credits amount, percent off, or quantity */
  value: number;
  title: string;
  headline: string;
  description: string;
  weight: number;
  rarity: "common" | "medium" | "uncommon" | "rare";
  /** Existing production route for claim CTA (must exist) */
  claimPath: string;
  /** Entitlement / discount key persisted server-side */
  entitlementKey: string;
  requiresAuthToGrant: boolean;
};

/**
 * Canonical V1 pool. Weights sum to 100 for readable percentages.
 */
export const GIFT_TREE_REWARD_CATALOG: GiftTreeRewardDef[] = [
  {
    id: "credits_10",
    type: "credits",
    value: 10,
    title: "10 Christmas Credits",
    headline: "You won 10 Christmas Credits",
    description: "Use them to create something magical this Christmas.",
    weight: 24,
    rarity: "common",
    claimPath: "/generator?occasion=christmas",
    entitlementKey: "gift_tree_credits_10",
    requiresAuthToGrant: true,
  },
  {
    id: "credits_25",
    type: "credits",
    value: 25,
    title: "25 Christmas Credits",
    headline: "You won 25 Christmas Credits",
    description: "Use them to create something magical this Christmas.",
    weight: 20,
    rarity: "common",
    claimPath: "/generator?occasion=christmas",
    entitlementKey: "gift_tree_credits_25",
    requiresAuthToGrant: true,
  },
  {
    id: "credits_50",
    type: "credits",
    value: 50,
    title: "50 Christmas Credits",
    headline: "You won 50 Christmas Credits",
    description: "A rare Christmas boost — create something spectacular.",
    weight: 2,
    rarity: "rare",
    claimPath: "/generator?occasion=christmas",
    entitlementKey: "gift_tree_credits_50",
    requiresAuthToGrant: true,
  },
  {
    id: "free_image",
    type: "image_generation",
    value: 1,
    title: "1 Free Christmas Image",
    headline: "You won a Free Christmas Image",
    description: "Create a personalized Christmas image with your reward.",
    weight: 12,
    rarity: "medium",
    claimPath: "/christmas/photo-generator",
    entitlementKey: "gift_tree_free_image",
    requiresAuthToGrant: false,
  },
  {
    id: "christmas_portrait",
    type: "christmas_portrait",
    value: 1,
    title: "Free Christmas Portrait",
    headline: "You unlocked a Christmas Portrait",
    description: "Turn a favorite photo into a magical Christmas portrait.",
    weight: 10,
    rarity: "medium",
    claimPath: "/christmas/family",
    entitlementKey: "gift_tree_christmas_portrait",
    requiresAuthToGrant: false,
  },
  {
    id: "pet_portrait",
    type: "pet_christmas_portrait",
    value: 1,
    title: "Free Pet Christmas Portrait",
    headline: "You unlocked a Pet Christmas Portrait",
    description: "Give your pet a festive Christmas portrait.",
    weight: 8,
    rarity: "medium",
    claimPath: "/christmas/pets",
    entitlementKey: "gift_tree_pet_christmas_portrait",
    requiresAuthToGrant: false,
  },
  {
    id: "santa_discount_15",
    type: "discount",
    value: 15,
    title: "15% Off a Personalized Santa Video",
    headline: "You unlocked 15% off Santa Video",
    description: "Save on a personalized Santa video when checkout opens.",
    weight: 18,
    rarity: "common",
    claimPath: "/christmas/santa-video",
    entitlementKey: "gift_tree_santa_discount_15",
    requiresAuthToGrant: false,
  },
  {
    id: "gift_tree_discount_25",
    type: "discount",
    value: 25,
    title: "25% Off Your Christmas Gift Tree",
    headline: "You unlocked 25% off Gift Tree",
    description: "Reserved for the premium Gift Tree product — your discount is saved.",
    weight: 1,
    rarity: "rare",
    claimPath: "/christmas/tree",
    entitlementKey: "gift_tree_premium_discount_25",
    requiresAuthToGrant: false,
  },
  {
    id: "gift_token",
    type: "gift_token",
    value: 1,
    title: "One Extra Christmas Gift",
    headline: "You unlocked an Extra Christmas Gift",
    description: "Open another present under the tree — on us.",
    weight: 5,
    rarity: "uncommon",
    claimPath: "/christmas/gifts",
    entitlementKey: "gift_tree_extra_open",
    requiresAuthToGrant: false,
  },
];

/** Future paid extras — not purchasable until server products are priced. */
export const GIFT_TREE_PAID_OFFERS = [
  {
    packageKey: "open_another",
    label: "Open Another Gift",
    description: "Unlock one more present under the tree.",
    purchasable: false,
    priceCents: 0,
  },
  {
    packageKey: "open_five",
    label: "Open 5 Gifts",
    description: "A bundle of five Christmas gift openings.",
    purchasable: false,
    priceCents: 0,
  },
] as const;

export function findGiftTreeReward(id: string): GiftTreeRewardDef | null {
  return GIFT_TREE_REWARD_CATALOG.find((r) => r.id === id) ?? null;
}

export function totalGiftTreeWeight(
  catalog: GiftTreeRewardDef[] = GIFT_TREE_REWARD_CATALOG,
): number {
  return catalog.reduce((sum, r) => sum + Math.max(0, r.weight), 0);
}

export function giftTreeProbabilityPct(reward: GiftTreeRewardDef): number {
  const total = totalGiftTreeWeight();
  if (total <= 0) return 0;
  return Math.round((reward.weight / total) * 1000) / 10;
}
