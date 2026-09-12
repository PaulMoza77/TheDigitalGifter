/**
 * Free-gift claim policy (service layer).
 * Client-testable copy: src/features/christmas/tree/freeGiftClaim.ts
 *
 * Invariants:
 * - CHRISTMAS_FREE_GIFT_ENABLED defaults off
 * - Server owns the catalog outcome (weighted pick); client never chooses the gift
 * - One claim per identity per season (user_id or guest_token_hash)
 * - Guests are non-monetary only; credits stay out unless explicitly allowed + authed
 * - Client `__test_force` cannot open claims without a server bypass env
 */

export type FreeGiftRow = {
  id: string;
  reward_type: string;
  weight?: number;
  active?: boolean;
  title?: string;
  description?: string;
  config?: Record<string, unknown> | null;
};

export function parseFeatureFlag(raw: string | undefined | null): boolean {
  const value = String(raw ?? "false").trim().toLowerCase();
  return value === "true" || value === "1" || value === "on";
}

export function freeGiftIdempotencyKey(opts: {
  seasonYear: number;
  userId?: string | null;
  guestHash?: string | null;
}): string | null {
  if (opts.userId) return `free_gift:${opts.seasonYear}:user:${opts.userId}`;
  if (opts.guestHash) return `free_gift:${opts.seasonYear}:guest:${opts.guestHash}`;
  return null;
}

export function freeGiftClaimAllowed(opts: {
  enabled: boolean;
  clientTestForce?: boolean;
  serverTestBypass?: boolean;
}): boolean {
  if (opts.enabled) return true;
  // Client body flag alone must never open production claims.
  return Boolean(opts.serverTestBypass && opts.clientTestForce);
}

export function filterFreeGiftCandidates(
  pool: readonly FreeGiftRow[],
  opts: {
    isAuthenticated: boolean;
    includeInactive?: boolean;
    creditsAllowed?: boolean;
  },
): FreeGiftRow[] {
  const creditsAllowed = Boolean(opts.creditsAllowed) && opts.isAuthenticated;
  return pool.filter((gift) => {
    if (gift.reward_type === "credits" && !creditsAllowed) return false;
    if (!opts.includeInactive && !gift.active) return false;
    return true;
  });
}

export function entitlementKeyFromGift(gift: FreeGiftRow): string | null {
  if (gift.reward_type !== "cosmetic") return null;
  const key = String(gift.config?.entitlement_key ?? "").trim();
  return key || "snow_globe_ornament";
}

export function weightedPick<T extends { weight?: number }>(
  items: readonly T[],
  random: () => number = Math.random,
): T | null {
  if (items.length === 0) return null;
  const total = items.reduce((sum, item) => sum + (Number(item.weight) || 1), 0);
  let cursor = random() * total;
  for (const item of items) {
    cursor -= Number(item.weight) || 1;
    if (cursor <= 0) return item;
  }
  return items[items.length - 1] ?? null;
}
