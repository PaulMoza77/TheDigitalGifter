/** Shared Christmas Gift Tree reward catalog (Deno Edge). Keep in sync with src/features/christmas/gifts/rewardCatalog.ts */

export type GiftTreeReward = {
  id: string;
  type:
    | "credits"
    | "image_generation"
    | "christmas_portrait"
    | "pet_christmas_portrait"
    | "discount"
    | "gift_token";
  value: number;
  title: string;
  description: string;
  weight: number;
  claim_path: string;
  entitlement_key: string;
  requires_auth_for_credits: boolean;
};

export const GIFT_TREE_SEASON_YEAR = 2026;

export const GIFT_TREE_REWARDS: GiftTreeReward[] = [
  {
    id: "credits_10",
    type: "credits",
    value: 10,
    title: "10 Christmas Credits",
    description: "Use them to create something magical this Christmas.",
    weight: 24,
    claim_path: "/generator?occasion=christmas",
    entitlement_key: "gift_tree_credits_10",
    requires_auth_for_credits: true,
  },
  {
    id: "credits_25",
    type: "credits",
    value: 25,
    title: "25 Christmas Credits",
    description: "Use them to create something magical this Christmas.",
    weight: 20,
    claim_path: "/generator?occasion=christmas",
    entitlement_key: "gift_tree_credits_25",
    requires_auth_for_credits: true,
  },
  {
    id: "credits_50",
    type: "credits",
    value: 50,
    title: "50 Christmas Credits",
    description: "A rare Christmas boost — create something spectacular.",
    weight: 2,
    claim_path: "/generator?occasion=christmas",
    entitlement_key: "gift_tree_credits_50",
    requires_auth_for_credits: true,
  },
  {
    id: "free_image",
    type: "image_generation",
    value: 1,
    title: "1 Free Christmas Image",
    description: "Create a personalized Christmas image with your reward.",
    weight: 12,
    claim_path: "/christmas/photo-generator",
    entitlement_key: "gift_tree_free_image",
    requires_auth_for_credits: false,
  },
  {
    id: "christmas_portrait",
    type: "christmas_portrait",
    value: 1,
    title: "Free Christmas Portrait",
    description: "Turn a favorite photo into a magical Christmas portrait.",
    weight: 10,
    claim_path: "/christmas/family",
    entitlement_key: "gift_tree_christmas_portrait",
    requires_auth_for_credits: false,
  },
  {
    id: "pet_portrait",
    type: "pet_christmas_portrait",
    value: 1,
    title: "Free Pet Christmas Portrait",
    description: "Give your pet a festive Christmas portrait.",
    weight: 8,
    claim_path: "/christmas/pets",
    entitlement_key: "gift_tree_pet_christmas_portrait",
    requires_auth_for_credits: false,
  },
  {
    id: "santa_discount_15",
    type: "discount",
    value: 15,
    title: "15% Off a Personalized Santa Video",
    description: "Save on a personalized Santa video when checkout opens.",
    weight: 18,
    claim_path: "/christmas/santa-video",
    entitlement_key: "gift_tree_santa_discount_15",
    requires_auth_for_credits: false,
  },
  {
    id: "gift_tree_discount_25",
    type: "discount",
    value: 25,
    title: "25% Off Your Christmas Gift Tree",
    description: "Reserved for the premium Gift Tree product — your discount is saved.",
    weight: 1,
    claim_path: "/christmas/tree",
    entitlement_key: "gift_tree_premium_discount_25",
    requires_auth_for_credits: false,
  },
  {
    id: "gift_token",
    type: "gift_token",
    value: 1,
    title: "One Extra Christmas Gift",
    description: "Open another present under the tree — on us.",
    weight: 5,
    claim_path: "/christmas/gifts",
    entitlement_key: "gift_tree_extra_open",
    requires_auth_for_credits: false,
  },
];

export function giftTreeEnabled(): boolean {
  const raw = String(Deno.env.get("CHRISTMAS_GIFT_TREE_ENABLED") || "true").toLowerCase();
  return raw === "true" || raw === "1" || raw === "on";
}

export function giftTreeCreditsEnabled(): boolean {
  const raw = String(Deno.env.get("CHRISTMAS_GIFT_TREE_CREDITS_ENABLED") || "true").toLowerCase();
  return raw === "true" || raw === "1" || raw === "on";
}

export function findGiftTreeReward(id: string): GiftTreeReward | null {
  return GIFT_TREE_REWARDS.find((r) => r.id === id) ?? null;
}

export function pickGiftTreeReward(random = Math.random): GiftTreeReward {
  const total = GIFT_TREE_REWARDS.reduce((s, r) => s + Math.max(0, r.weight), 0);
  let cursor = random() * total;
  for (const reward of GIFT_TREE_REWARDS) {
    cursor -= reward.weight;
    if (cursor <= 0) return reward;
  }
  return GIFT_TREE_REWARDS[GIFT_TREE_REWARDS.length - 1]!;
}

export function giftTreeClaimIdempotency(input: {
  seasonYear: number;
  userId?: string | null;
  guestHash?: string | null;
  openSlot?: number;
}): string {
  const base = input.userId
    ? `gift_tree:${input.seasonYear}:user:${input.userId}`
    : `gift_tree:${input.seasonYear}:guest:${input.guestHash}`;
  const slot =
    typeof input.openSlot === "number" && Number.isFinite(input.openSlot)
      ? Math.max(0, Math.floor(input.openSlot))
      : 0;
  if (slot > 0) return `${base}:open:${slot}`;
  const day = new Date().toISOString().slice(0, 10);
  return `${base}:day:${day}`;
}

export function publicGiftTreeReward(reward: GiftTreeReward) {
  return {
    id: reward.id,
    type: reward.type,
    value: reward.value,
    title: reward.title,
    description: reward.description,
    entitlement_key: reward.entitlement_key,
    claim_path: reward.claim_path,
  };
}


/** Paid packs — keep in sync with rewardCatalog.ts + funnel migration. */
export const GIFT_TREE_PAID_OFFERS = [
  {
    package_key: "open_another",
    label: "1 more chance",
    price_cents: 199,
    opens_granted: 1,
  },
  {
    package_key: "open_five",
    label: "Get 5 More Chances",
    price_cents: 499,
    opens_granted: 5,
  },
] as const;
