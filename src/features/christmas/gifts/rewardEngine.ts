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
  // Arc at the photoreal tree base — lower + more centered under the trunk.
  const positions = [
    { leftPct: 18, bottomPct: 6, depth: 1, width: 52, height: 44 },
    { leftPct: 30, bottomPct: 2, depth: 3, width: 64, height: 52 },
    { leftPct: 44, bottomPct: 0, depth: 4, width: 72, height: 58 },
    { leftPct: 56, bottomPct: 3, depth: 3, width: 62, height: 50 },
    { leftPct: 68, bottomPct: 7, depth: 1, width: 50, height: 42 },
    { leftPct: 36, bottomPct: 12, depth: 0, width: 46, height: 38 },
    { leftPct: 54, bottomPct: 13, depth: 0, width: 44, height: 36 },
  ];
  return positions.slice(0, Math.min(Math.max(count, 6), 7)).map((pos, i) => ({
    id: `present_${i + 1}`,
    style: styles[i % styles.length]!,
    ribbon: ribbons[i % ribbons.length]!,
    ...pos,
  }));
}
