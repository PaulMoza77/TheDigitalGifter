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
  const positions = [
    { leftPct: 6, bottomPct: 10, depth: 2, width: 58, height: 48 },
    { leftPct: 20, bottomPct: 4, depth: 3, width: 72, height: 56 },
    { leftPct: 34, bottomPct: 12, depth: 1, width: 52, height: 44 },
    { leftPct: 46, bottomPct: 2, depth: 4, width: 80, height: 62 },
    { leftPct: 60, bottomPct: 11, depth: 2, width: 56, height: 50 },
    { leftPct: 72, bottomPct: 5, depth: 3, width: 68, height: 54 },
    { leftPct: 12, bottomPct: 22, depth: 0, width: 46, height: 40 },
    { leftPct: 82, bottomPct: 16, depth: 1, width: 50, height: 42 },
    { leftPct: 54, bottomPct: 22, depth: 0, width: 44, height: 38 },
  ];
  return positions.slice(0, Math.min(Math.max(count, 7), 9)).map((pos, i) => ({
    id: `present_${i + 1}`,
    style: styles[i % styles.length]!,
    ribbon: ribbons[i % ribbons.length]!,
    ...pos,
  }));
}
