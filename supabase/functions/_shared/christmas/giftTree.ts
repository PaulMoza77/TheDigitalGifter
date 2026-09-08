/** Shared Christmas Gift Tree chance-funnel helpers (Deno). */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { asString, sha256Hex } from "./crypto.ts";

export const GIFT_TREE_PRODUCT_KEY = "christmas_gift_tree";
export const GIFT_TREE_SEASON_YEAR = 2026;
export const GIFT_TREE_FREE_OPENS_PER_SEASON = 1;

export const GIFT_TREE_PACK_OPENS: Record<string, number> = {
  open_1: 1,
  open_3: 3,
  open_5: 5,
};

export function giftTreeEnabled(): boolean {
  const raw = asString(Deno.env.get("CHRISTMAS_GIFT_TREE_ENABLED") || "false").toLowerCase();
  return raw === "true" || raw === "1" || raw === "on";
}

export function giftTreeCreditsEnabled(): boolean {
  const raw = asString(Deno.env.get("CHRISTMAS_GIFT_TREE_CREDITS_ENABLED") || "false").toLowerCase();
  return raw === "true" || raw === "1" || raw === "on";
}

export function opensForPackage(packageKey: string): number | null {
  const opens = GIFT_TREE_PACK_OPENS[asString(packageKey)];
  return opens && opens > 0 ? opens : null;
}

export function remainingFreeOpens(freeUsed: number): number {
  return Math.max(0, GIFT_TREE_FREE_OPENS_PER_SEASON - Number(freeUsed || 0));
}

export function weightedPick<T extends { weight?: unknown }>(
  items: T[],
  rng = Math.random,
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

export function filterOpenableRewards(
  rewards: Record<string, unknown>[],
  input: { kind: "free" | "paid"; authenticated: boolean; creditsEnabled: boolean; requireActive: boolean },
): Record<string, unknown>[] {
  return rewards.filter((reward) => {
    if (input.requireActive && !reward.active) return false;
    if (Number(reward.weight) <= 0) return false;
    if (reward.paid_only && input.kind !== "paid") return false;
    if (!reward.guest_allowed && !input.authenticated) return false;
    if (reward.reward_type === "credits") {
      if (!input.creditsEnabled) return false;
      if (!input.authenticated) return false;
    }
    return true;
  });
}

export function publicRewardFromRow(reward: Record<string, unknown>) {
  const config =
    reward.config && typeof reward.config === "object"
      ? (reward.config as Record<string, unknown>)
      : {};
  const type = asString(reward.reward_type);
  const entitlement =
    type === "cosmetic" || type === "content_unlock"
      ? asString(config.entitlement_key) || asString(reward.reward_key)
      : "";
  return {
    reward_key: asString(reward.reward_key),
    reward_type: type,
    title: asString(reward.title),
    description: asString(reward.description),
    entitlement_key: entitlement || null,
    message: type === "surprise_message" ? asString(config.message) || asString(reward.description) : null,
    credits_granted: type === "credits" ? Math.max(0, Number(reward.reward_value) || 0) : 0,
  };
}

export async function hashGuestToken(token: string): Promise<string | null> {
  const raw = asString(token);
  if (raw.length < 32) return null;
  return sha256Hex(raw);
}

export async function ensureGiftTreeAccount(
  service: SupabaseClient,
  input: { userId?: string | null; guestHash?: string | null; seasonYear?: number },
): Promise<Record<string, unknown> | null> {
  const seasonYear = input.seasonYear ?? GIFT_TREE_SEASON_YEAR;
  if (input.userId) {
    const { data: existing } = await service
      .from("christmas_gift_tree_accounts")
      .select("*")
      .eq("user_id", input.userId)
      .eq("season_year", seasonYear)
      .maybeSingle();
    if (existing) return existing;
    const { data, error } = await service
      .from("christmas_gift_tree_accounts")
      .insert({
        user_id: input.userId,
        guest_token_hash: null,
        season_year: seasonYear,
      })
      .select("*")
      .single();
    if (error && error.code !== "23505") throw error;
    if (data) return data;
    const { data: again } = await service
      .from("christmas_gift_tree_accounts")
      .select("*")
      .eq("user_id", input.userId)
      .eq("season_year", seasonYear)
      .maybeSingle();
    return again;
  }
  if (input.guestHash && input.guestHash.length === 64) {
    const { data: existing } = await service
      .from("christmas_gift_tree_accounts")
      .select("*")
      .eq("guest_token_hash", input.guestHash)
      .eq("season_year", seasonYear)
      .maybeSingle();
    if (existing) return existing;
    const { data, error } = await service
      .from("christmas_gift_tree_accounts")
      .insert({
        user_id: null,
        guest_token_hash: input.guestHash,
        season_year: seasonYear,
      })
      .select("*")
      .single();
    if (error && error.code !== "23505") throw error;
    if (data) return data;
    const { data: again } = await service
      .from("christmas_gift_tree_accounts")
      .select("*")
      .eq("guest_token_hash", input.guestHash)
      .eq("season_year", seasonYear)
      .maybeSingle();
    return again;
  }
  return null;
}

export async function grantPaidGiftTreeOpens(input: {
  service: SupabaseClient;
  orderId: string;
  packageKey: string;
  userId?: string | null;
  guestHash?: string | null;
  stripeEventId?: string | null;
}): Promise<{ ok: boolean; already?: boolean; opens_granted?: number; account_id?: string; code?: string }> {
  const opens = opensForPackage(input.packageKey);
  if (!opens) return { ok: false, code: "unknown_pack" };

  const { data: existing } = await input.service
    .from("christmas_gift_tree_grants")
    .select("id, opens_granted, account_id")
    .eq("order_id", input.orderId)
    .maybeSingle();
  if (existing) {
    return {
      ok: true,
      already: true,
      opens_granted: Number(existing.opens_granted),
      account_id: existing.account_id,
    };
  }

  const account = await ensureGiftTreeAccount(input.service, {
    userId: input.userId,
    guestHash: input.guestHash,
  });
  if (!account) return { ok: false, code: "identity_required" };

  const { error: grantErr } = await input.service.from("christmas_gift_tree_grants").insert({
    order_id: input.orderId,
    account_id: account.id,
    user_id: input.userId || null,
    guest_token_hash: input.userId ? null : input.guestHash || null,
    package_key: input.packageKey,
    opens_granted: opens,
    stripe_event_id: input.stripeEventId || null,
    email_status: "pending",
  });
  if (grantErr) {
    if (grantErr.code === "23505") {
      return { ok: true, already: true, opens_granted: opens, account_id: String(account.id) };
    }
    throw grantErr;
  }

  const { data: credited, error: balErr } = await input.service.rpc("credit_christmas_gift_tree_opens", {
    p_account_id: account.id,
    p_opens: opens,
  });
  if (balErr) throw balErr;
  const row = Array.isArray(credited) ? credited[0] : credited;
  if (!row || row.ok !== true) {
    throw new Error("gift_tree_credit_failed");
  }

  await input.service
    .from("christmas_orders")
    .update({ fulfillment_status: "completed" })
    .eq("id", input.orderId)
    .eq("product_key", GIFT_TREE_PRODUCT_KEY);

  return { ok: true, opens_granted: opens, account_id: String(account.id) };
}
