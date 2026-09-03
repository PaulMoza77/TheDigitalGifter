/** Pure helpers for Tree / Advent — unit-testable without DOM. */

export const TREE_STYLES = ["classic", "snowy", "gold", "cozy", "minimal", "magical"] as const;
export type TreeStyle = (typeof TREE_STYLES)[number];

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
