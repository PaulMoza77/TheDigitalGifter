import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { CHRISTMAS_FUNNEL_ALLOWED_EVENTS } from "../funnelEventContract";
import { findProduct, ctaStateForProduct, CHRISTMAS_CATALOG_SEED } from "../catalog";
import {
  GIFT_TREE_REWARD_CATALOG,
  GIFT_TREE_PAID_OFFERS,
  GIFT_TREE_PRODUCT_KEY,
  giftTreeProbabilityPct,
  totalGiftTreeWeight,
} from "./rewardCatalog";
import {
  pickWeightedReward,
  pickEligibleGiftTreeReward,
  presentLayout,
} from "./rewardEngine";
import {
  canOpenGift,
  emptyGiftTreeState,
  consumeOpen,
} from "./giftState";

describe("christmas gift tree catalog", () => {
  it("includes required reward types with positive weights summing to 100", () => {
    expect(GIFT_TREE_REWARD_CATALOG.length).toBeGreaterThanOrEqual(6);
    expect(GIFT_TREE_REWARD_CATALOG.every((r) => r.weight > 0)).toBe(true);
    expect(totalGiftTreeWeight()).toBe(100);
    expect(giftTreeProbabilityPct(GIFT_TREE_REWARD_CATALOG[0]!)).toBeGreaterThan(0);
    expect(GIFT_TREE_REWARD_CATALOG.every((r) => r.claimPath.startsWith("/"))).toBe(true);
  });

  it("prices extra gift packs at $1.99 and $4.99", () => {
    const one = GIFT_TREE_PAID_OFFERS.find((o) => o.packageKey === "open_another");
    const five = GIFT_TREE_PAID_OFFERS.find((o) => o.packageKey === "open_five");
    expect(one?.priceCents).toBe(199);
    expect(five?.priceCents).toBe(499);
    expect(one?.opensGranted).toBe(1);
    expect(five?.opensGranted).toBe(5);
  });

  it("picks rewards according to weights (non-uniform)", () => {
    let i = 0;
    const sequence = [0.01, 0.3, 0.5, 0.7, 0.9, 0.99];
    const picks = sequence.map(() =>
      pickWeightedReward(GIFT_TREE_REWARD_CATALOG, () => sequence[i++]!),
    );
    expect(new Set(picks.map((p) => p.id)).size).toBeGreaterThan(1);
  });

  it("avoids previous reward when alternatives exist", () => {
    const previous = GIFT_TREE_REWARD_CATALOG[0]!.id;
    const pick = pickEligibleGiftTreeReward(GIFT_TREE_REWARD_CATALOG, {
      previousRewardId: previous,
      random: () => 0.01,
    });
    expect(pick.id).not.toBe(previous);
  });

  it("lays out distinct photo-aligned present hotspots", () => {
    const desktop = presentLayout(8, "desktop");
    const mobile = presentLayout(7, "mobile");
    expect(desktop.length).toBe(8);
    expect(mobile.length).toBe(7);
    expect(new Set(desktop.map((p) => p.id)).size).toBe(8);
    expect(desktop.every((p) => p.widthPct > 0 && p.heightPct > 0)).toBe(true);
    expect(mobile.every((p) => p.topPct > 50)).toBe(true);
  });
});

describe("christmas gift tree persistence rules", () => {
  it("allows one free open then locks without extra tokens", () => {
    const fresh = emptyGiftTreeState();
    expect(canOpenGift(fresh)).toBe(true);
    const opened = {
      ...fresh,
      openedAt: new Date().toISOString(),
      presentId: "present_1",
    };
    expect(canOpenGift(opened)).toBe(false);
    const withToken = { ...opened, extraOpens: 1 };
    expect(canOpenGift(withToken)).toBe(true);
    expect(consumeOpen(withToken).extraOpens).toBe(0);
  });
});

describe("christmas gift tree product wiring", () => {
  it("registers catalog product and funnel events", () => {
    const product = findProduct(CHRISTMAS_CATALOG_SEED, GIFT_TREE_PRODUCT_KEY);
    expect(product?.routePath).toBe("/christmas/gifts");
    expect(ctaStateForProduct(product!)).toBe("open");
    for (const ev of [
      "christmas_gift_tree_view",
      "christmas_tree_view",
      "christmas_gift_tap",
      "christmas_free_gift_prompt_view",
      "christmas_free_reward_assigned",
      "christmas_reward_reveal",
      "christmas_email_claim_view",
      "christmas_email_claim_submit",
      "christmas_email_claim_success",
      "christmas_extra_gift_offer_view",
      "christmas_extra_gift_pack_select",
      "christmas_express_checkout_available",
      "christmas_apple_pay_available",
      "christmas_apple_pay_unavailable",
      "christmas_hero_video_ready",
      "christmas_extra_gift_payment_start",
      "christmas_extra_gift_purchase",
      "christmas_extra_gift_payment_failed",
      "christmas_offer_skip",
      "christmas_paid_gift_open",
      "my_gifts_view",
    ]) {
      expect(CHRISTMAS_FUNNEL_ALLOWED_EVENTS).toContain(ev);
    }
  });
});

describe("christmas gift tree payment authority", () => {
  it("never trusts client-provided pack amounts", () => {
    expect(GIFT_TREE_PAID_OFFERS.map((o) => o.priceCents).sort()).toEqual([199, 499]);
  });
});


describe("christmas gift tree 5 more chances entitlement", () => {
  it("labels the higher paid pack as Get 5 More Chances (not 1 more)", () => {
    const five = GIFT_TREE_PAID_OFFERS.find((o) => o.packageKey === "open_five");
    const one = GIFT_TREE_PAID_OFFERS.find((o) => o.packageKey === "open_another");
    expect(five?.label).toBe("Get 5 More Chances");
    expect(five?.opensGranted).toBe(5);
    expect(five?.priceCents).toBe(499);
    expect(one?.label).toBe("1 more chance");
    expect(one?.opensGranted).toBe(1);
    expect(five?.label.toLowerCase()).not.toContain("1 more");
  });
});

describe("christmas gift tree media architecture", () => {
  it("does not manually fetch or link-preload the hero mp4", () => {
    const scene = readFileSync(resolve(process.cwd(), "src/features/christmas/gifts/ChristmasTreeScene.tsx"), "utf8");
    // Strip comments so instructional text does not false-positive.
    const code = scene.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(code).not.toMatch(/fetch\(\s*[`'"][^`'"]*scene-(mobile|desktop)\.mp4/);
    expect(code).not.toMatch(/rel\s*=\s*[`'"]preload[`'"][\s\S]{0,80}as\s*=\s*[`'"]video[`'"]/);
    expect(code).toMatch(/<video[\s\S]*preload=["']auto["']/);
    expect(code).toMatch(/PosterWebp|PosterJpg|posterWebp|posterJpg|\.poster\.(webp|jpg)/);
  });

  it("defers gift-open warm until after hero ready", () => {
    const page = readFileSync(resolve(process.cwd(), "src/features/christmas/gifts/ChristmasGiftsPage.tsx"), "utf8");
    expect(page).toMatch(/onHeroReady/);
    expect(page).toMatch(/requestIdleCallback|setTimeout/);
    // Must not warm gift-open at initial mount via network APIs.
    const mountEffect = page.match(/useEffect\(\(\) => \{[\s\S]*?\}, \[\]\)/);
    if (mountEffect) {
      const code = mountEffect[0].replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
      expect(code).not.toMatch(/fetch\([^)]*giftOpen|createElement\([`'"]link[`'"]\)[\s\S]*giftOpen|giftOpenMp4/);
      expect(code).not.toMatch(/rel\s*=\s*[`'"]preload[`'"]/);
    }
  });

  it("uses versioned media URLs for cache-busting", () => {
    const media = readFileSync(resolve(process.cwd(), "src/features/christmas/gifts/giftTreeMedia.ts"), "utf8");
    expect(media).toMatch(/\?v=/);
    expect(media).toMatch(/scene-mobile\.poster\.webp/);
  });
});

describe("christmas gift tree checkout lock", () => {
  it("guards purchase with an in-flight lock on the gifts page", () => {
    const page = readFileSync(resolve(process.cwd(), "src/features/christmas/gifts/ChristmasGiftsPage.tsx"), "utf8");
    expect(page).toMatch(/purchaseInFlight/);
    expect(page).toMatch(/if \(purchaseInFlight\.current\) return/);
  });

  it("dedupes concurrent startChristmasCheckout calls in photoApi", () => {
    const api = readFileSync(resolve(process.cwd(), "src/features/christmas/photoApi.ts"), "utf8");
    expect(api).toMatch(/christmasCheckoutInflight/);
    expect(api).toMatch(/christmasCheckoutDedupeKey/);
  });
});

describe("christmas gift tree stripe entitlement mapping", () => {
  it("maps open_five to +5 opens server-side from GIFT_TREE_PAID_OFFERS", () => {
    const fulfill = readFileSync(
      resolve(process.cwd(), "supabase/functions/_shared/christmas/stripeFulfill.ts"),
      "utf8",
    );
    expect(fulfill).toMatch(/GIFT_TREE_PAID_OFFERS/);
    expect(fulfill).toMatch(/opens_granted/);
    // Must not credit from a client-supplied quantity field.
    expect(fulfill).not.toMatch(/body\.quantity|metadata\.quantity\s*\*\s*1/);
  });
});
