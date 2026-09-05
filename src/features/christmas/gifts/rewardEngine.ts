import {
  GIFT_TREE_REWARD_CATALOG,
  type GiftTreeRewardDef,
  totalGiftTreeWeight,
} from "./rewardCatalog";

/**
 * Weighted reward selection. Prefer server outcome when available;
 * client uses the same catalog for offline UX / tests only.
 */
export function pickWeightedReward(
  catalog: GiftTreeRewardDef[] = GIFT_TREE_REWARD_CATALOG,
  random: () => number = Math.random,
): GiftTreeRewardDef {
  const active = catalog.filter((r) => r.weight > 0);
  const total = totalGiftTreeWeight(active);
  if (active.length === 0 || total <= 0) {
    throw new Error("empty_reward_catalog");
  }
  let cursor = random() * total;
  for (const reward of active) {
    cursor -= reward.weight;
    if (cursor <= 0) return reward;
  }
  return active[active.length - 1]!;
}

export function presentLayout(count = 8): Array<{
  id: string;
  style: "red" | "gold" | "green" | "blue" | "snow" | "wine" | "forest" | "ivory";
  width: number;
  height: number;
  leftPct: number;
  bottomPct: number;
  depth: number;
  ribbon: "classic" | "cross" | "bow";
}> {
  const styles = [
    "red",
    "gold",
    "green",
    "blue",
    "snow",
    "wine",
    "forest",
    "ivory",
  ] as const;
  const ribbons = ["classic", "cross", "bow"] as const;
  // Spaced arc under the tree — no overlapping boxes (leftPct = left edge).
  const positions = [
    { leftPct: 6, bottomPct: 10, depth: 1, width: 54, height: 46 },
    { leftPct: 28, bottomPct: 2, depth: 3, width: 58, height: 50 },
    { leftPct: 50, bottomPct: 2, depth: 3, width: 58, height: 50 },
    { leftPct: 72, bottomPct: 10, depth: 1, width: 54, height: 46 },
    { leftPct: 17, bottomPct: 18, depth: 0, width: 48, height: 40 },
    { leftPct: 61, bottomPct: 18, depth: 0, width: 48, height: 40 },
  ];
  const n = Math.min(Math.max(count, 4), 6);
  return positions.slice(0, n).map((pos, i) => ({
    id: `present_${i + 1}`,
    style: styles[i % styles.length]!,
    ribbon: ribbons[i % ribbons.length]!,
    ...pos,
  }));
}
