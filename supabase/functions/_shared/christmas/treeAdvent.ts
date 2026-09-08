/** Shared Christmas Tree / Advent helpers (Deno). */

export const TREE_STYLES = ["classic", "snowy", "gold", "cozy", "minimal", "magical"] as const;
export const BOX_STYLES = ["red", "gold", "green", "blue", "snow"] as const;
export const GIFT_TYPES = ["message", "tdg_reward", "product_link", "cosmetic"] as const;
export const MAX_TREE_GIFTS = 24;

export type TreeStyle = (typeof TREE_STYLES)[number];

const PRODUCT_LINK_KEYS = new Set([
  "christmas_photo",
  "christmas_santa_video",
  "christmas_card",
  "christmas_messages",
  "christmas_wishlist",
  "christmas_advent",
]);
const COSMETIC_KEYS = new Set([
  "gold_star_topper",
  "snow_globe_ornament",
  "candy_cane",
  "gold_bell",
  "red_bauble",
]);
const PRODUCT_PATHS: Record<string, string> = {
  christmas_photo: "/christmas/photo-generator",
  christmas_santa_video: "/christmas/santa-video",
  christmas_card: "/christmas/cards",
  christmas_messages: "/christmas/messages",
  christmas_wishlist: "/christmas/wishlist",
  christmas_advent: "/christmas/advent",
};

export function parseUnlockAt(value: unknown): string | null {
  const raw = asString(value);
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const d = new Date(`${raw}T00:00:00+02:00`);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function isGiftUnlocked(
  gift: { unlock_mode?: unknown; unlock_at?: unknown },
  nowMs = Date.now(),
): boolean {
  if (asString(gift.unlock_mode) !== "on_date") return true;
  const raw = asString(gift.unlock_at);
  if (!raw) return false;
  const t = new Date(raw).getTime();
  if (Number.isNaN(t)) return false;
  return t <= nowMs;
}

export function productPathForKey(productKey: unknown): string | null {
  const key = asString(productKey);
  return PRODUCT_PATHS[key] || null;
}

export function projectSharedGift(gift: Record<string, unknown>, nowMs = Date.now()) {
  const unlocked = isGiftUnlocked(gift, nowMs);
  const opened = Boolean(gift.opened_at);
  const reveal = unlocked && opened;
  const giftType = asString(gift.gift_type) || "message";
  const linked = reveal ? asString(gift.linked_product_key) || null : null;
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
    message: reveal && giftType === "message" ? asString(gift.message) : null,
    linked_product_key: giftType === "message" || giftType === "cosmetic" ? null : linked,
    product_path:
      reveal && (giftType === "product_link" || giftType === "tdg_reward")
        ? productPathForKey(gift.linked_product_key)
        : null,
    cosmetic_key: reveal && giftType === "cosmetic" ? linked : null,
  };
}

export function normalizeTreeGiftInput(body: Record<string, unknown>):
  | {
      ok: true;
      gift: {
        gift_type: string;
        box_style: string;
        display_name: string;
        message: string;
        unlock_mode: "immediate" | "on_date";
        unlock_at: string | null;
        linked_product_key: string | null;
      };
    }
  | { ok: false; error: string } {
  const giftType = asString(body.gift_type) || "message";
  if (!(GIFT_TYPES as readonly string[]).includes(giftType)) {
    return { ok: false, error: "invalid_gift_type" };
  }
  const box = asString(body.box_style) || "red";
  if (!(BOX_STYLES as readonly string[]).includes(box)) {
    return { ok: false, error: "invalid_box" };
  }
  const displayName = sanitizeText(body.display_name, 80);
  const message = sanitizeText(body.message, 800);
  const unlockMode = asString(body.unlock_mode) === "on_date" ? "on_date" : "immediate";
  let unlockAt: string | null = null;
  if (unlockMode === "on_date") {
    unlockAt = parseUnlockAt(body.unlock_at);
    if (!unlockAt) return { ok: false, error: "invalid_unlock_at" };
  }
  let linked: string | null = null;
  if (giftType === "product_link" || giftType === "tdg_reward") {
    const key = asString(body.linked_product_key);
    if (!PRODUCT_LINK_KEYS.has(key)) return { ok: false, error: "invalid_product_link" };
    linked = key;
  } else if (giftType === "cosmetic") {
    const key = asString(body.linked_product_key) || asString(body.cosmetic_key);
    if (!COSMETIC_KEYS.has(key)) return { ok: false, error: "invalid_cosmetic" };
    linked = key;
  }
  return {
    ok: true,
    gift: {
      gift_type: giftType,
      box_style: box,
      display_name: displayName,
      message: giftType === "message" ? message : sanitizeText(message, 200),
      unlock_mode: unlockMode,
      unlock_at: unlockAt,
      linked_product_key: linked,
    },
  };
}

export function asString(value: unknown): string {
  return String(value ?? "").trim();
}

export function isTreeStyle(value: string): value is TreeStyle {
  return (TREE_STYLES as readonly string[]).includes(value);
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function generateOpaqueToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function generateShareId(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  // base64url without padding
  let s = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return s;
}

export function sanitizeText(value: unknown, max: number): string {
  return asString(value).slice(0, max);
}

export function publicTreeView(tree: Record<string, unknown>, gifts: Record<string, unknown>[]) {
  return {
    share_id: tree.share_id,
    title: tree.title,
    message: tree.message,
    from_name: tree.from_name,
    tree_style: tree.tree_style,
    decoration_config: tree.decoration_config,
    locale: tree.locale,
    gifts: gifts.map((g) => projectSharedGift(g)),
  };
}

/** Canonical Advent day in Europe/Bucharest (documented timezone policy). */
export function adventDayParts(now = new Date(), seasonYear = 2026): {
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

export function adventEnabled(): boolean {
  const raw = asString(Deno.env.get("CHRISTMAS_ADVENT_ENABLED") || "false").toLowerCase();
  return raw === "true" || raw === "1" || raw === "on";
}

export function freeGiftEnabled(): boolean {
  const raw = asString(Deno.env.get("CHRISTMAS_FREE_GIFT_ENABLED") || "false").toLowerCase();
  return raw === "true" || raw === "1" || raw === "on";
}

export function adventCreditsEnabled(): boolean {
  const raw = asString(Deno.env.get("CHRISTMAS_ADVENT_CREDITS_ENABLED") || "false").toLowerCase();
  return raw === "true" || raw === "1" || raw === "on";
}
