export const ADVENT_ASSETS = {
  /** Cinematic room without baked-in UI (calendar/title live in the app). */
  room: "/assets/christmas/christmas_finale_room.webp",
  roomFallback: "/assets/christmas/christmas_hero_room.webp",
  og: "/assets/christmas/christmas_finale_room.webp",
} as const;

export const ADVENT_FONT_HREF =
  "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500&family=Source+Sans+3:wght@400;500;600;700&display=swap";

/** Deterministic door face variants — shared set, slightly different each door. */
export const ADVENT_DOOR_VARIANTS = [
  "velvet",
  "tartan",
  "wood",
  "velvet-wreath",
  "tartan-bow",
  "wood-star",
  "velvet-snow",
  "tartan-wreath",
  "wood-bow",
  "velvet-star",
  "tartan-tree",
  "wood-wreath",
  "velvet-bow",
  "tartan-star",
  "wood-snow",
  "velvet-tree",
  "tartan-snow",
  "wood-tree",
  "velvet-wreath",
  "tartan-bow",
  "wood-star",
  "velvet-snow",
  "tartan-tree",
  "wood-wreath",
] as const;

export type AdventDoorVariant = (typeof ADVENT_DOOR_VARIANTS)[number];

export function doorVariantForDay(day: number): AdventDoorVariant {
  const idx = Math.max(1, Math.min(24, day)) - 1;
  return ADVENT_DOOR_VARIANTS[idx]!;
}
