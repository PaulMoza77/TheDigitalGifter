/** Shared Christmas Tree / Advent helpers (Deno). */

export const TREE_STYLES = ["classic", "snowy", "gold", "cozy", "minimal", "magical"] as const;
export const BOX_STYLES = ["red", "gold", "green", "blue", "snow"] as const;
export const GIFT_TYPES = ["message", "tdg_reward", "product_link", "cosmetic"] as const;

export type TreeStyle = (typeof TREE_STYLES)[number];

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
    gifts: gifts.map((g) => ({
      id: g.id,
      sort_order: g.sort_order,
      gift_type: g.gift_type,
      box_style: g.box_style,
      display_name: g.display_name,
      unlock_mode: g.unlock_mode,
      unlock_at: g.unlock_at,
      opened: Boolean(g.opened_at),
      // message only after open check by caller
      message: g.opened_at ? g.message : null,
    })),
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
