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
  // Arc under the tree — cleaner mobile composition (6–7 gifts).
  const positions = [
    { leftPct: 8, bottomPct: 14, depth: 1, width: 54, height: 46 },
    { leftPct: 24, bottomPct: 6, depth: 3, width: 66, height: 54 },
    { leftPct: 42, bottomPct: 2, depth: 4, width: 74, height: 60 },
    { leftPct: 60, bottomPct: 7, depth: 3, width: 64, height: 52 },
    { leftPct: 76, bottomPct: 15, depth: 1, width: 52, height: 44 },
    { leftPct: 34, bottomPct: 18, depth: 0, width: 48, height: 40 },
    { leftPct: 56, bottomPct: 20, depth: 0, width: 46, height: 38 },
  ];
  return positions.slice(0, Math.min(Math.max(count, 6), 7)).map((pos, i) => ({
    id: `present_${i + 1}`,
    style: styles[i % styles.length]!,
    ribbon: ribbons[i % ribbons.length]!,
    ...pos,
  }));
}
