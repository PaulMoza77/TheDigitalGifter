import type { PlanMode } from "./types";

export type LocalDateParts = {
  year: number;
  month: number;
  day: number;
};

export function localDateParts(now: Date, timeZone?: string | null): LocalDateParts {
  const tz = timeZone && timeZone !== "local" ? timeZone : undefined;
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = Object.fromEntries(fmt.formatToParts(now).map((p) => [p.type, p.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
  };
}

export function isoDate(parts: LocalDateParts): string {
  const mo = String(parts.month).padStart(2, "0");
  const d = String(parts.day).padStart(2, "0");
  return `${parts.year}-${mo}-${d}`;
}

export function addDays(parts: LocalDateParts, days: number): LocalDateParts {
  const utc = Date.UTC(parts.year, parts.month - 1, parts.day + days);
  const d = new Date(utc);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

export function diffDays(from: LocalDateParts, to: LocalDateParts): number {
  const a = Date.UTC(from.year, from.month - 1, from.day);
  const b = Date.UTC(to.year, to.month - 1, to.day);
  return Math.round((b - a) / 86_400_000);
}

export function upcomingChristmasYear(now: Date, timeZone?: string | null): number {
  const p = localDateParts(now, timeZone);
  if (p.month === 12 && p.day >= 26) return p.year + 1;
  return p.year;
}

export function christmasDayParts(seasonYear: number): LocalDateParts {
  return { year: seasonYear, month: 12, day: 25 };
}

export function daysUntilChristmas(now: Date, timeZone?: string | null): number {
  const season = upcomingChristmasYear(now, timeZone);
  return diffDays(localDateParts(now, timeZone), christmasDayParts(season));
}

export function resolvePlanMode(daysLeft: number, prepared: string): PlanMode {
  if (daysLeft < 0) return "wrap";
  if (daysLeft <= 7 || prepared === "rescue") return "rescue";
  if (daysLeft <= 21) return "sprint";
  if (daysLeft <= 56) return "standard";
  return "early";
}

export function planModeLabel(mode: PlanMode): string {
  if (mode === "early") return "13-week Christmas plan";
  if (mode === "standard") return "8-week Christmas plan";
  if (mode === "sprint") return "3-week Christmas sprint";
  if (mode === "rescue") return "Christmas Rescue Plan";
  return "Season wrap & next year";
}

export function countdownCopy(daysLeft: number): string {
  if (daysLeft > 1) return `${daysLeft} days until Christmas`;
  if (daysLeft === 1) return "1 day until Christmas";
  if (daysLeft === 0) return "It's Christmas Day";
  if (daysLeft === -1) return "Christmas was yesterday";
  return `Christmas was ${Math.abs(daysLeft)} days ago`;
}
