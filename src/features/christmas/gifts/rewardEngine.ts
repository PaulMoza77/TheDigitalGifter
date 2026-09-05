import {
  GIFT_TREE_REWARD_CATALOG,
  type GiftTreeRewardDef,
  totalGiftTreeWeight,
} from "./rewardCatalog";
import type { PresentVisual } from "./ChristmasPresent";

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

type Hotspot = Omit<PresentVisual, "id" | "style" | "ribbon">;

/**
 * Hotspots mapped to gifts already in the scene photo/video.
 * Coordinates are % of the source media (not the cropped viewport).
 */
const DESKTOP_HOTSPOTS: Hotspot[] = [
  { leftPct: 37.2, topPct: 74.8, widthPct: 4.4, heightPct: 6.8, depth: 1 },
  { leftPct: 40.0, topPct: 79.2, widthPct: 4.6, heightPct: 5.6, depth: 3 },
  { leftPct: 42.2, topPct: 73.6, widthPct: 5.2, heightPct: 7.4, depth: 0 },
  { leftPct: 45.4, topPct: 72.8, widthPct: 6.2, heightPct: 12.2, depth: 4 },
  { leftPct: 51.0, topPct: 78.6, widthPct: 4.8, heightPct: 6.2, depth: 3 },
  { leftPct: 54.6, topPct: 73.8, widthPct: 5.8, heightPct: 8.2, depth: 1 },
  { leftPct: 59.4, topPct: 78.4, widthPct: 6.2, heightPct: 7.8, depth: 4 },
  { leftPct: 65.0, topPct: 74.6, widthPct: 4.4, heightPct: 7.4, depth: 2 },
];

const MOBILE_HOTSPOTS: Hotspot[] = [
  { leftPct: 5.5, topPct: 70.5, widthPct: 10.5, heightPct: 9.5, depth: 1 },
  { leftPct: 14.0, topPct: 62.0, widthPct: 14.0, heightPct: 16.0, depth: 0 },
  { leftPct: 28.0, topPct: 66.0, widthPct: 19.0, heightPct: 16.5, depth: 3 },
  { leftPct: 48.0, topPct: 72.0, widthPct: 16.5, heightPct: 12.5, depth: 2 },
  { leftPct: 66.0, topPct: 70.5, widthPct: 13.5, heightPct: 11.5, depth: 1 },
  { leftPct: 72.0, topPct: 80.5, widthPct: 11.0, heightPct: 9.0, depth: 4 },
  { leftPct: 79.0, topPct: 66.5, widthPct: 15.0, heightPct: 14.0, depth: 0 },
  { leftPct: 30.5, topPct: 84.5, widthPct: 9.0, heightPct: 6.5, depth: 5 },
];

const STYLES = [
  "red",
  "gold",
  "green",
  "blue",
  "snow",
  "wine",
  "forest",
  "ivory",
] as const;

const RIBBONS = ["classic", "cross", "bow"] as const;

export function presentLayout(
  count = 8,
  variant: "desktop" | "mobile" = "desktop",
): PresentVisual[] {
  const positions = variant === "mobile" ? MOBILE_HOTSPOTS : DESKTOP_HOTSPOTS;
  const n = Math.min(Math.max(count, 4), positions.length);
  return positions.slice(0, n).map((pos, i) => ({
    id: `present_${i + 1}`,
    style: STYLES[i % STYLES.length]!,
    ribbon: RIBBONS[i % RIBBONS.length]!,
    ...pos,
  }));
}
