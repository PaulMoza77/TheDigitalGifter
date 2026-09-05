import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  GIFT_TREE_PAID_OFFERS,
  GIFT_TREE_REWARD_CATALOG,
  totalGiftTreeWeight,
} from "./rewardCatalog";

describe("gift tree hardening contracts", () => {
  it("keeps paid pack economics authoritative", () => {
    const one = GIFT_TREE_PAID_OFFERS.find((o) => o.packageKey === "open_another");
    const five = GIFT_TREE_PAID_OFFERS.find((o) => o.packageKey === "open_five");
    expect(one?.priceCents).toBe(199);
    expect(one?.opensGranted).toBe(1);
    expect(five?.priceCents).toBe(499);
    expect(five?.opensGranted).toBe(5);
  });

  it("validates catalog weights and unique keys", () => {
    expect(totalGiftTreeWeight()).toBeGreaterThan(0);
    const ids = GIFT_TREE_REWARD_CATALOG.map((r) => r.id);
    const keys = GIFT_TREE_REWARD_CATALOG.map((r) => r.entitlementKey);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(keys).size).toBe(keys.length);
    expect(GIFT_TREE_REWARD_CATALOG.every((r) => r.weight >= 0)).toBe(true);
  });

  it("Origin API never substitutes catalog[0] for unknown entitlements", () => {
    const src = readFileSync(resolve("api/christmas-gift-tree.ts"), "utf8");
    expect(src).toContain("unknown_gift_tree_reward:");
    expect(src).not.toMatch(/GIFT_TREE_REWARD_CATALOG\[0\]/);
    expect(src).toContain("spendIdentity");
    expect(src).toMatch(/guestIdem|guestExisting|Guest free/);
  });

  it("Edge rejects paid opens and does not fall back to first reward", () => {
    const src = readFileSync(
      resolve("supabase/functions/christmas-tree-funnel/index.ts"),
      "utf8",
    );
    expect(src).toContain("paid_opens_require_origin_api");
    expect(src).toMatch(/unknown_reward/);
    expect(src).not.toMatch(/GIFT_TREE_REWARDS\[0\]/);
  });

  it("webhook reconciles gift-tree grants on already_processed", () => {
    const src = readFileSync(resolve("supabase/functions/stripe-webhook/index.ts"), "utf8");
    expect(src).toContain("reconcileChristmasGiftTreeOpens");
    expect(src).toContain("already_processed");
  });

  it("client does not invent rewards or Edge-fallback money actions", () => {
    const page = readFileSync(
      resolve("src/features/christmas/gifts/ChristmasGiftsPage.tsx"),
      "utf8",
    );
    expect(page).not.toMatch(/pickWeightedReward\(/);
    expect(page).toContain("openFailed");

    const apiSrc = readFileSync(
      resolve("src/features/christmas/gifts/giftTreeApi.ts"),
      "utf8",
    );
    expect(apiSrc).toContain("allowEdgeFallback");
    const openFn = apiSrc.slice(apiSrc.indexOf("export async function openGiftTreeOnServer"));
    const nextExport = openFn.indexOf("export async function", 10);
    const openBody = nextExport === -1 ? openFn : openFn.slice(0, nextExport);
    expect(openBody).not.toContain("allowEdgeFallback: true");
  });

  it("hardening migration scopes spend to a single identity", () => {
    const sql = readFileSync(
      resolve("supabase/migrations/20260905180000_christmas_gift_tree_hardening.sql"),
      "utf8",
    );
    expect(sql).toContain("christmas_gift_tree_consume_open");
    expect(sql).toContain("pg_advisory_xact_lock");
    expect(sql.toLowerCase()).not.toContain("drop table");
  });
});
