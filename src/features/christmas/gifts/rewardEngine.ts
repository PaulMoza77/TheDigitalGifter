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
 * Invisible borders mapped to gifts already in the scene photo/video.
 * Coordinates are % of the source media (not the cropped viewport).
 */
/** Slightly generous hit boxes so desktop clicks reliably catch photo gifts. */
const DESKTOP_HOTSPOTS: Hotspot[] = [
  { leftPct: 36.6, topPct: 73.8, widthPct: 5.4, heightPct: 10.0, depth: 1 },
  { leftPct: 40.2, topPct: 72.2, widthPct: 6.6, heightPct: 12.0, depth: 2 },
  { leftPct: 44.8, topPct: 72.8, widthPct: 6.8, heightPct: 12.6, depth: 3 },
  { leftPct: 49.6, topPct: 77.6, widthPct: 6.2, heightPct: 8.4, depth: 4 },
  { leftPct: 53.8, topPct: 74.4, widthPct: 7.0, heightPct: 11.6, depth: 3 },
  { leftPct: 59.0, topPct: 72.2, widthPct: 7.4, heightPct: 11.0, depth: 1 },
  { leftPct: 59.8, topPct: 78.8, widthPct: 4.8, heightPct: 7.6, depth: 5 },
  { leftPct: 65.0, topPct: 74.0, widthPct: 6.4, heightPct: 10.4, depth: 2 },
  { leftPct: 68.0, topPct: 76.8, widthPct: 5.6, heightPct: 8.8, depth: 4 },
];

const MOBILE_HOTSPOTS: Hotspot[] = [
  { leftPct: 5.0, topPct: 70.0, widthPct: 11.0, heightPct: 10.0, depth: 1 },
  { leftPct: 13.5, topPct: 61.5, widthPct: 14.5, heightPct: 16.5, depth: 0 },
  { leftPct: 27.5, topPct: 65.5, widthPct: 19.5, heightPct: 17.0, depth: 3 },
  { leftPct: 47.5, topPct: 71.5, widthPct: 17.0, heightPct: 13.0, depth: 2 },
  { leftPct: 65.5, topPct: 70.0, widthPct: 14.0, heightPct: 12.0, depth: 1 },
  { leftPct: 71.5, topPct: 80.0, widthPct: 11.5, heightPct: 9.5, depth: 4 },
  { leftPct: 78.5, topPct: 66.0, widthPct: 15.5, heightPct: 14.5, depth: 0 },
  { leftPct: 30.0, topPct: 84.0, widthPct: 9.5, heightPct: 7.0, depth: 5 },
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
