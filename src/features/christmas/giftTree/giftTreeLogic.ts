/**
 * Pure Christmas Gift Tree chance-funnel helpers.
 * Server owns reward draws. Client never invents catalog outcomes.
 */

export const GIFT_TREE_PRODUCT_KEY = "christmas_gift_tree";
export const GIFT_TREE_ROUTE = "/christmas/gifts";
export const GIFT_TREE_SEASON_YEAR = 2026;
export const GIFT_TREE_FREE_OPENS_PER_SEASON = 1;
export const GIFT_TREE_BOX_COUNT = 9;
export const GIFT_TREE_GUEST_STORAGE_KEY = "tdg.christmas.gift_tree.guest.v1";

export const GIFT_TREE_REWARD_TYPES = [
  "cosmetic",
  "surprise_message",
  "content_unlock",
  "credits",
] as const;
export type GiftTreeRewardType = (typeof GIFT_TREE_REWARD_TYPES)[number];

export const GIFT_TREE_PACK_KEYS = ["open_1", "open_3", "open_5"] as const;
export type GiftTreePackKey = (typeof GIFT_TREE_PACK_KEYS)[number];

export const GIFT_TREE_PACK_OPENS: Record<GiftTreePackKey, number> = {
  open_1: 1,
  open_3: 3,
  open_5: 5,
};

export type GiftTreeRewardCandidate = {
  id: string;
  reward_key: string;
  reward_type: GiftTreeRewardType;
  title: string;
  description: string;
  weight: number;
  reward_value: number;
  active: boolean;
  paid_only: boolean;
  guest_allowed: boolean;
  config?: Record<string, unknown>;
};

export type GiftTreeAccountSnapshot = {
  freeOpensUsed: number;
  paidOpensRemaining: number;
  paidOpensGranted: number;
};

export type GiftTreeOpenDecision =
  | { ok: true; kind: "free" | "paid" }
  | {
      ok: false;
      code:
        | "identity_required"
        | "opens_disabled"
        | "no_opens"
        | "need_pack"
        | "auth_required_for_credits";
    };

export function isGiftTreePackKey(value: string): value is GiftTreePackKey {
  return (GIFT_TREE_PACK_KEYS as readonly string[]).includes(value);
}

export function opensForPackage(packageKey: string): number | null {
  const key = String(packageKey || "").trim();
  if (!isGiftTreePackKey(key)) return null;
  return GIFT_TREE_PACK_OPENS[key];
}

export function remainingFreeOpens(account: GiftTreeAccountSnapshot): number {
  return Math.max(0, GIFT_TREE_FREE_OPENS_PER_SEASON - account.freeOpensUsed);
}

export function remainingOpens(account: GiftTreeAccountSnapshot): number {
  return remainingFreeOpens(account) + Math.max(0, account.paidOpensRemaining);
}

export function decideOpenKind(input: {
  hasIdentity: boolean;
  opensEnabled: boolean;
  account: GiftTreeAccountSnapshot;
}): GiftTreeOpenDecision {
  if (!input.hasIdentity) return { ok: false, code: "identity_required" };
  if (!input.opensEnabled) {
    if (input.account.paidOpensRemaining > 0) return { ok: true, kind: "paid" };
    return { ok: false, code: "opens_disabled" };
  }
  if (remainingFreeOpens(input.account) > 0) return { ok: true, kind: "free" };
  if (input.account.paidOpensRemaining > 0) return { ok: true, kind: "paid" };
  return { ok: false, code: "need_pack" };
}

export function applyPaidGrant(
  account: GiftTreeAccountSnapshot,
  packageKey: string,
): GiftTreeAccountSnapshot | { ok: false; code: "unknown_pack" } {
  const opens = opensForPackage(packageKey);
  if (opens == null || opens < 1) return { ok: false, code: "unknown_pack" };
  return {
    freeOpensUsed: account.freeOpensUsed,
    paidOpensRemaining: account.paidOpensRemaining + opens,
    paidOpensGranted: account.paidOpensGranted + opens,
  };
}

export function consumeOpen(
  account: GiftTreeAccountSnapshot,
  kind: "free" | "paid",
): GiftTreeAccountSnapshot | { ok: false; code: "no_opens" } {
  if (kind === "free") {
    if (remainingFreeOpens(account) <= 0) return { ok: false, code: "no_opens" };
    return { ...account, freeOpensUsed: account.freeOpensUsed + 1 };
  }
  if (account.paidOpensRemaining <= 0) return { ok: false, code: "no_opens" };
  return { ...account, paidOpensRemaining: account.paidOpensRemaining - 1 };
}

export function filterOpenableRewards(input: {
  rewards: GiftTreeRewardCandidate[];
  kind: "free" | "paid";
  authenticated: boolean;
  creditsEnabled: boolean;
  requireActive?: boolean;
}): GiftTreeRewardCandidate[] {
  return input.rewards.filter((reward) => {
    if (input.requireActive !== false && !reward.active) return false;
    if (reward.weight <= 0) return false;
    if (reward.paid_only && input.kind !== "paid") return false;
    if (!reward.guest_allowed && !input.authenticated) return false;
    if (reward.reward_type === "credits") {
      if (!input.creditsEnabled) return false;
      if (!input.authenticated) return false;
    }
    return true;
  });
}

export function weightedPickReward<T extends { weight: number }>(
  items: T[],
  rng: () => number = Math.random,
): T | null {
  if (items.length === 0) return null;
  const total = items.reduce((sum, item) => sum + Math.max(0, Number(item.weight) || 0), 0);
  if (total <= 0) return null;
  let cursor = rng() * total;
  for (const item of items) {
    cursor -= Math.max(0, Number(item.weight) || 0);
    if (cursor <= 0) return item;
  }
  return items[items.length - 1] ?? null;
}

export function publicRewardView(reward: GiftTreeRewardCandidate): {
  reward_key: string;
  reward_type: GiftTreeRewardType;
  title: string;
  description: string;
  entitlement_key: string | null;
  message: string | null;
  credits_granted: number;
} {
  const config = reward.config && typeof reward.config === "object" ? reward.config : {};
  const entitlement =
    reward.reward_type === "cosmetic" || reward.reward_type === "content_unlock"
      ? String(config.entitlement_key || reward.reward_key)
      : null;
  return {
    reward_key: reward.reward_key,
    reward_type: reward.reward_type,
    title: reward.title,
    description: reward.description,
    entitlement_key: entitlement,
    message: reward.reward_type === "surprise_message" ? String(config.message || reward.description) : null,
    credits_granted: reward.reward_type === "credits" ? Math.max(0, reward.reward_value) : 0,
  };
}

export function freeOpenIdempotencyKey(input: {
  seasonYear: number;
  userId?: string | null;
  guestHash?: string | null;
}): string | null {
  if (input.userId) return `gift_tree_free:${input.seasonYear}:user:${input.userId}`;
  if (input.guestHash && input.guestHash.length === 64) {
    return `gift_tree_free:${input.seasonYear}:guest:${input.guestHash}`;
  }
  return null;
}

export function grantIdempotencyKey(orderId: string): string {
  return `gift_tree_grant:${orderId}`;
}

export function sanitizeGiftTreeAnalytics(meta: Record<string, unknown>): Record<string, unknown> {
  const blocked = new Set([
    "message",
    "title",
    "guest_token",
    "owner_token",
    "reward_title",
    "email",
  ]);
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(meta)) {
    if (blocked.has(key)) continue;
    if (typeof value === "string" && value.length > 80) continue;
    out[key] = value;
  }
  return out;
}

export function giftTreeBoxSlots(count = GIFT_TREE_BOX_COUNT): number[] {
  return Array.from({ length: count }, (_, i) => i);
}

export function denyOpenCopy(code: string): string {
  switch (code) {
    case "opens_disabled":
      return "Gift Tree opens unlock when the season is live.";
    case "need_pack":
      return "Your free open is used. Buy a pack to open more gifts.";
    case "no_opens":
      return "No opens remaining.";
    case "identity_required":
      return "We could not start a private Gift Tree session.";
    case "auth_required_for_credits":
      return "Sign in to receive credit rewards.";
    default:
      return "This gift cannot be opened right now.";
  }
}
