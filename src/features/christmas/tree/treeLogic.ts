/** Pure helpers for Tree / Advent — unit-testable without DOM. */

export const TREE_STYLES = ["classic", "snowy", "gold", "cozy", "minimal", "magical"] as const;
export type TreeStyle = (typeof TREE_STYLES)[number];

export const TREE_GIFT_TYPES = ["message", "tdg_reward", "product_link", "cosmetic"] as const;
export type TreeGiftType = (typeof TREE_GIFT_TYPES)[number];

export const TREE_UNLOCK_MODES = ["immediate", "on_date"] as const;
export type TreeUnlockMode = (typeof TREE_UNLOCK_MODES)[number];

export const MAX_TREE_GIFTS = 24;

/** Allowlisted TDG product ornaments — never arbitrary external URLs. */
export const TREE_PRODUCT_LINKS = [
  { key: "christmas_photo", label: "Christmas Portrait", path: "/christmas/photo-generator" },
  { key: "christmas_santa_video", label: "Santa Video", path: "/christmas/santa-video" },
  { key: "christmas_card", label: "Christmas Card", path: "/christmas/cards" },
  { key: "christmas_messages", label: "Message Generator", path: "/christmas/messages" },
  { key: "christmas_wishlist", label: "Wishlist", path: "/christmas/wishlist" },
  { key: "christmas_advent", label: "Advent Calendar", path: "/christmas/advent" },
] as const;

export const TREE_COSMETICS = [
  { key: "gold_star_topper", label: "Gold star topper" },
  { key: "snow_globe_ornament", label: "Snow globe" },
  { key: "candy_cane", label: "Candy cane" },
  { key: "gold_bell", label: "Gold bell" },
  { key: "red_bauble", label: "Red bauble" },
] as const;

const PRODUCT_LINK_KEYS = new Set(TREE_PRODUCT_LINKS.map((p) => p.key));
const COSMETIC_KEYS = new Set(TREE_COSMETICS.map((c) => c.key));

export function isTreeGiftType(value: string): value is TreeGiftType {
  return (TREE_GIFT_TYPES as readonly string[]).includes(value);
}

export function productPathForKey(productKey: unknown): string | null {
  const key = String(productKey || "").trim();
  return TREE_PRODUCT_LINKS.find((p) => p.key === key)?.path ?? null;
}

export function cosmeticLabelForKey(cosmeticKey: unknown): string | null {
  const key = String(cosmeticKey || "").trim();
  return TREE_COSMETICS.find((c) => c.key === key)?.label ?? null;
}

/** Parse unlock_at. Date-only values use Europe/Bucharest midnight. */
export function parseUnlockAt(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const d = new Date(`${raw}T00:00:00+02:00`);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function isGiftUnlocked(
  gift: { unlock_mode?: string | null; unlock_at?: string | null },
  nowMs = Date.now(),
): boolean {
  if (gift.unlock_mode !== "on_date") return true;
  if (!gift.unlock_at) return false;
  const t = new Date(gift.unlock_at).getTime();
  if (Number.isNaN(t)) return false;
  return t <= nowMs;
}

export type SharedGiftProjection = {
  id: unknown;
  sort_order: unknown;
  gift_type: unknown;
  box_style: unknown;
  display_name: unknown;
  unlock_mode: unknown;
  unlock_at: unknown;
  can_open: boolean;
  opened: boolean;
  message: string | null;
  linked_product_key: string | null;
  product_path: string | null;
  cosmetic_key: string | null;
};

/** Share-page gift view: never reveal payload until server unlock + open. */
export function projectSharedGift(
  gift: Record<string, unknown>,
  nowMs = Date.now(),
): SharedGiftProjection {
  const unlocked = isGiftUnlocked(
    {
      unlock_mode: gift.unlock_mode as string | undefined,
      unlock_at: gift.unlock_at as string | null | undefined,
    },
    nowMs,
  );
  const opened = Boolean(gift.opened_at);
  const reveal = unlocked && opened;
  const giftType = String(gift.gift_type || "message");
  const linked = reveal ? String(gift.linked_product_key || "") || null : null;
  return {
    id: gift.id,
    sort_order: gift.sort_order,
    gift_type: gift.gift_type,
    box_style: gift.box_style,
    display_name: gift.display_name,
    unlock_mode: gift.unlock_mode,
    unlock_at: gift.unlock_at,
    can_open: unlocked,
    opened,
    message: reveal && giftType === "message" ? String(gift.message || "") : null,
    linked_product_key: giftType === "message" || giftType === "cosmetic" ? null : linked,
    product_path:
      reveal && (giftType === "product_link" || giftType === "tdg_reward")
        ? productPathForKey(gift.linked_product_key)
        : null,
    cosmetic_key: reveal && giftType === "cosmetic" ? linked : null,
  };
}

export type NormalizedTreeGift =
  | {
      ok: true;
      gift: {
        gift_type: TreeGiftType;
        box_style: string;
        display_name: string;
        message: string;
        unlock_mode: TreeUnlockMode;
        unlock_at: string | null;
        linked_product_key: string | null;
      };
    }
  | { ok: false; error: string };

export function normalizeTreeGiftInput(body: Record<string, unknown>): NormalizedTreeGift {
  const giftType = String(body.gift_type || "message").trim();
  if (!isTreeGiftType(giftType)) return { ok: false, error: "invalid_gift_type" };
  const box = String(body.box_style || "red").trim();
  const displayName = String(body.display_name || "").trim().slice(0, 80);
  const message = String(body.message || "").trim().slice(0, 800);
  const unlockMode = String(body.unlock_mode || "immediate").trim() === "on_date" ? "on_date" : "immediate";
  let unlockAt: string | null = null;
  if (unlockMode === "on_date") {
    unlockAt = parseUnlockAt(body.unlock_at);
    if (!unlockAt) return { ok: false, error: "invalid_unlock_at" };
  }
  let linked: string | null = null;
  if (giftType === "product_link" || giftType === "tdg_reward") {
    const key = String(body.linked_product_key || "").trim();
    if (!PRODUCT_LINK_KEYS.has(key)) return { ok: false, error: "invalid_product_link" };
    linked = key;
  } else if (giftType === "cosmetic") {
    const key = String(body.linked_product_key || body.cosmetic_key || "").trim();
    if (!COSMETIC_KEYS.has(key)) return { ok: false, error: "invalid_cosmetic" };
    linked = key;
  }
  return {
    ok: true,
    gift: {
      gift_type: giftType,
      box_style: box,
      display_name: displayName,
      message: giftType === "message" ? message : message.slice(0, 200),
      unlock_mode: unlockMode,
      unlock_at: unlockAt,
      linked_product_key: linked,
    },
  };
}

export function isValidTreeStyle(value: string): value is TreeStyle {
  return (TREE_STYLES as readonly string[]).includes(value);
}

export function giftCountBucket(count: number): string {
  if (count <= 0) return "0";
  if (count === 1) return "1";
  if (count <= 3) return "2-3";
  if (count <= 6) return "4-6";
  return "7+";
}

/** Canonical Advent calendar day in Europe/Bucharest (documented policy). */
export function adventDayParts(
  now: Date,
  seasonYear = 2026,
): {
  year: number;
  month: number;
  day: number;
  seasonYear: number;
  eligibleDay: number | null;
  beforeSeason: boolean;
  afterSeason: boolean;
} {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Bucharest",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = Object.fromEntries(fmt.formatToParts(now).map((p) => [p.type, p.value]));
  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);
  const beforeSeason = year < seasonYear || (year === seasonYear && month < 12);
  const afterSeason = year > seasonYear || (year === seasonYear && month === 12 && day > 24);
  let eligibleDay: number | null = null;
  if (year === seasonYear && month === 12 && day >= 1 && day <= 24) eligibleDay = day;
  return { year, month, day, seasonYear, eligibleDay, beforeSeason, afterSeason };
}

export function adventDoorState(opts: {
  day: number;
  eligibleDay: number | null;
  claimed: boolean;
  beforeSeason: boolean;
  afterSeason: boolean;
}): "claimed" | "available" | "future" | "missed" | "preseason" {
  if (opts.claimed) return "claimed";
  if (opts.beforeSeason) return "preseason";
  if (opts.afterSeason) return "missed";
  if (opts.eligibleDay == null) return "future";
  if (opts.day === opts.eligibleDay) return "available";
  if (opts.day < opts.eligibleDay) return "missed";
  return "future";
}

/** Analytics metadata must never include private message/name content. */
export function sanitizeTreeAnalyticsMeta(meta: Record<string, unknown>): Record<string, unknown> {
  const blocked = new Set([
    "message",
    "title",
    "from_name",
    "display_name",
    "owner_token",
    "gift_message",
    "recipient",
    "cosmetic_key",
    "linked_product_key",
    "product_path",
  ]);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta)) {
    if (blocked.has(k)) continue;
    if (typeof v === "string" && v.length > 80) continue;
    out[k] = v;
  }
  return out;
}

export function reorderIds(ids: string[], fromIndex: number, toIndex: number): string[] {
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= ids.length ||
    toIndex >= ids.length ||
    fromIndex === toIndex
  ) {
    return [...ids];
  }
  const next = [...ids];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}
