import { describe, expect, it } from "vitest";
import { CHRISTMAS_FUNNEL_ALLOWED_EVENTS } from "../funnelEventContract";
import { findProduct, ctaStateForProduct, CHRISTMAS_CATALOG_SEED } from "../catalog";
import {
  GIFT_TREE_REWARD_CATALOG,
  giftTreeProbabilityPct,
  totalGiftTreeWeight,
} from "./rewardCatalog";
import { pickWeightedReward, presentLayout } from "./rewardEngine";
import {
  canOpenGift,
  emptyGiftTreeState,
  consumeOpen,
} from "./giftState";

describe("christmas gift tree catalog", () => {
  it("includes all required reward types with positive weights", () => {
    const ids = GIFT_TREE_REWARD_CATALOG.map((r) => r.id);
    expect(ids).toContain("credits_10");
    expect(ids).toContain("credits_25");
    expect(ids).toContain("credits_50");
    expect(ids).toContain("free_image");
    expect(ids).toContain("christmas_portrait");
    expect(ids).toContain("pet_portrait");
    expect(ids).toContain("santa_discount_15");
    expect(ids).toContain("gift_tree_discount_25");
    expect(ids).toContain("gift_token");
    expect(totalGiftTreeWeight()).toBe(100);
    expect(giftTreeProbabilityPct(GIFT_TREE_REWARD_CATALOG[0]!)).toBeGreaterThan(0);
  });

  it("picks rewards according to weights (non-uniform)", () => {
    let i = 0;
    const sequence = [0.01, 0.3, 0.5, 0.7, 0.9, 0.99];
    const picks = sequence.map(() =>
      pickWeightedReward(GIFT_TREE_REWARD_CATALOG, () => sequence[i++]!),
    );
    const unique = new Set(picks.map((p) => p.id));
    expect(unique.size).toBeGreaterThan(1);
  });

  it("lays out distinct photo-aligned present hotspots", () => {
    const desktop = presentLayout(7, "desktop");
    const mobile = presentLayout(6, "mobile");
    expect(desktop.length).toBe(7);
    expect(mobile.length).toBe(6);
    expect(new Set(desktop.map((p) => p.id)).size).toBe(7);
    expect(desktop.every((p) => p.widthPct > 0 && p.heightPct > 0)).toBe(true);
    expect(mobile.every((p) => p.topPct > 50)).toBe(true);
  });
});

describe("christmas gift tree persistence rules", () => {
  it("allows one free open then locks without extra tokens", () => {
    const fresh = emptyGiftTreeState();
    expect(canOpenGift(fresh)).toBe(true);
    const opened = { ...fresh, openedAt: new Date().toISOString(), presentId: "present_1" };
    expect(canOpenGift(opened)).toBe(false);
    const withToken = { ...opened, extraOpens: 1 };
    expect(canOpenGift(withToken)).toBe(true);
    expect(consumeOpen(withToken).extraOpens).toBe(0);
  });
});

describe("christmas gift tree product wiring", () => {
  it("registers catalog product and analytics events", () => {
    const product = findProduct(CHRISTMAS_CATALOG_SEED, "christmas_gift_tree");
    expect(product?.routePath).toBe("/christmas/gifts");
    expect(ctaStateForProduct(product!)).toBe("open");
    for (const ev of [
      "christmas_gift_tree_view",
      "christmas_present_selected",
      "christmas_gift_open_started",
      "christmas_reward_revealed",
      "christmas_reward_claim_started",
      "christmas_reward_claimed",
      "christmas_open_another_gift_viewed",
      "christmas_open_another_gift_clicked",
    ]) {
      expect(CHRISTMAS_FUNNEL_ALLOWED_EVENTS).toContain(ev);
    }
  });
});
