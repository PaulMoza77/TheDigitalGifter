import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  GIFT_TREE_PAID_OFFERS,
  GIFT_TREE_REWARD_CATALOG,
} from "./rewardCatalog";
import {
  applyPercentOff,
  pickDiscountEntitlement,
  pickFreeEntitlement,
} from "./giftTreeRedemption";

function extractEdgeRewards(source: string) {
  return [...source.matchAll(
    /id:\s*"([^"]+)"[\s\S]*?type:\s*"([^"]+)"[\s\S]*?value:\s*(\d+)[\s\S]*?weight:\s*(\d+)[\s\S]*?claim_path:\s*"([^"]+)"[\s\S]*?entitlement_key:\s*"([^"]+)"/g,
  )].map((m) => ({
    id: m[1],
    type: m[2],
    value: Number(m[3]),
    weight: Number(m[4]),
    claim_path: m[5],
    entitlement_key: m[6],
  }));
}

describe("gift tree catalog contract (Node ↔ Edge)", () => {
  const edgePath = resolve(
    process.cwd(),
    "supabase/functions/_shared/christmas/giftTreeRewards.ts",
  );
  const edgeSource = readFileSync(edgePath, "utf8");
  const edgeRewards = extractEdgeRewards(edgeSource);

  it("has identical reward ids, entitlement keys, types, values, weights, claim paths", () => {
    expect(edgeRewards.map((r) => r.id).sort()).toEqual(
      [...GIFT_TREE_REWARD_CATALOG.map((r) => r.id)].sort(),
    );
    for (const node of GIFT_TREE_REWARD_CATALOG) {
      const edge = edgeRewards.find((r) => r.id === node.id);
      expect(edge, node.id).toBeTruthy();
      expect(edge!.entitlement_key).toBe(node.entitlementKey);
      expect(edge!.type).toBe(node.type);
      expect(edge!.value).toBe(node.value);
      expect(edge!.weight).toBe(node.weight);
      expect(edge!.claim_path).toBe(node.claimPath);
    }
  });

  it("keeps paid pack keys/prices/opens identical to migration intent", () => {
    expect(GIFT_TREE_PAID_OFFERS).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ packageKey: "open_another", priceCents: 199, opensGranted: 1 }),
        expect.objectContaining({ packageKey: "open_five", priceCents: 499, opensGranted: 5 }),
      ]),
    );
    expect(edgeSource).toContain('package_key: "open_another"');
    expect(edgeSource).toContain("price_cents: 199");
    expect(edgeSource).toContain('package_key: "open_five"');
    expect(edgeSource).toContain("price_cents: 499");
  });
});

describe("gift tree redemption helpers", () => {
  it("applies percent-off safely", () => {
    expect(applyPercentOff(1999, 15)).toBe(1699);
    expect(applyPercentOff(499, 25)).toBe(374);
    expect(applyPercentOff(100, 100)).toBe(0);
  });

  it("picks free portrait entitlement for family product", () => {
    const free = pickFreeEntitlement(
      [
        {
          id: "a",
          entitlement_key: "gift_tree_christmas_portrait",
          redeemed_at: null,
          status: "available",
        },
      ],
      "christmas_family",
    );
    expect(free?.id).toBe("a");
  });

  it("picks santa discount", () => {
    const discount = pickDiscountEntitlement(
      [
        {
          id: "d",
          entitlement_key: "gift_tree_santa_discount_15",
          redeemed_at: null,
          status: "available",
        },
      ],
      "christmas_santa_video",
    );
    expect(discount?.percent_off).toBe(15);
  });
});
