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

export type AdventDoorState =
  | "claimed"
  | "available"
  | "openable"
  | "future"
  | "preseason"
  | "ended";

/**
 * Door interaction states.
 * During Dec 1–24, past unclaimed doors remain openable (catch-up),
 * today's door is `available`, and future doors stay locked.
 */
export function adventDoorState(opts: {
  day: number;
  eligibleDay: number | null;
  claimed: boolean;
  beforeSeason: boolean;
  afterSeason: boolean;
}): AdventDoorState {
  if (opts.claimed) return "claimed";
  if (opts.beforeSeason) return "preseason";
  if (opts.afterSeason) return "ended";
  if (opts.eligibleDay == null) return "future";
  if (opts.day === opts.eligibleDay) return "available";
  if (opts.day < opts.eligibleDay) return "openable";
  return "future";
}

/** True when the door may still be claimed (today or catch-up). */
export function canClaimAdventDoor(state: AdventDoorState): boolean {
  return state === "available" || state === "openable";
}

/**
 * Milliseconds until Dec 1 00:00 in Europe/Bucharest for the season year.
 * Uses a binary search over UTC instants so DST / offset stays correct.
 */
export function msUntilAdventStart(now: Date, seasonYear: number): number {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Bucharest",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const asParts = (ms: number) => {
    const map = Object.fromEntries(formatter.formatToParts(new Date(ms)).map((p) => [p.type, p.value]));
    return {
      y: Number(map.year),
      m: Number(map.month),
      d: Number(map.day),
      h: Number(map.hour),
      min: Number(map.minute),
      s: Number(map.second),
    };
  };
  const targetKey = seasonYear * 1e8 + 12 * 1e6 + 1 * 1e4; // Dec 1 00:00
  const keyOf = (p: ReturnType<typeof asParts>) =>
    p.y * 1e8 + p.m * 1e6 + p.d * 1e4 + p.h * 100 + p.min + p.s / 100;

  // Rough UTC window around Dec 1 Bucharest.
  let lo = Date.UTC(seasonYear, 10, 30, 0, 0, 0);
  let hi = Date.UTC(seasonYear, 11, 2, 12, 0, 0);
  while (hi - lo > 1000) {
    const mid = Math.floor((lo + hi) / 2);
    if (keyOf(asParts(mid)) < targetKey) lo = mid;
    else hi = mid;
  }
  return Math.max(0, hi - now.getTime());
}

export function adventCountdownParts(ms: number): {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
} {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  return { days, hours, minutes, seconds };
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
