import { addDaysIso, formatZonedDateTime, zonedWallTimeToUtcMs } from "@/features/social-publisher/timezone";
import { ROLLING_HORIZON_DAYS } from "./types";
import type { PublisherScheduleRule } from "./types";

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

export function isoWeekdayInZone(utcMs: number, timeZone: string): number {
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(new Date(utcMs));
  const map: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  return map[weekday] || 1;
}

export function zonedDateString(utcMs: number, timeZone: string): string {
  return formatZonedDateTime(utcMs, timeZone).date;
}

/** Skip spring-forward gaps. Ambiguous fall-back times resolve to the earlier UTC instant. */
export function wallTimeUtcOrNull(date: string, time: string, timeZone: string): number | null {
  try {
    const ms = zonedWallTimeToUtcMs(date, time, timeZone);
    const roundTrip = formatZonedDateTime(ms, timeZone);
    if (roundTrip.date !== date || roundTrip.time !== time) return null;
    return ms;
  } catch {
    return null;
  }
}

export type PlannedSlot = {
  ruleId: string;
  scheduledAt: string;
  timezone: string;
  uniqueKey: string;
};

export function slotUniqueKey(ruleId: string, scheduledAtIso: string): string {
  return `${ruleId}:${scheduledAtIso}`;
}

export function rollingHorizonEnd(nowMs: number): number {
  return nowMs + ROLLING_HORIZON_DAYS * 24 * 60 * 60 * 1000;
}

export function planSlotsForRule(
  rule: Pick<PublisherScheduleRule, "id" | "timezone" | "weekdays" | "times" | "active" | "deletedAt">,
  nowMs: number,
  horizonDays = ROLLING_HORIZON_DAYS,
): PlannedSlot[] {
  if (!rule.active || rule.deletedAt) return [];
  const zone = rule.timezone || "Europe/Bucharest";
  const startDate = zonedDateString(nowMs, zone);
  const planned: PlannedSlot[] = [];
  const seen = new Set<string>();
  const horizonEnd = nowMs + horizonDays * 24 * 60 * 60 * 1000;

  for (let offset = 0; offset <= horizonDays; offset++) {
    const date = addDaysIso(startDate, offset);
    for (const time of rule.times) {
      const ms = wallTimeUtcOrNull(date, time, zone);
      if (ms == null) continue;
      if (ms < nowMs) continue;
      if (ms >= horizonEnd) continue;
      const weekday = isoWeekdayInZone(ms, zone);
      if (!rule.weekdays.includes(weekday)) continue;
      const scheduledAt = new Date(ms).toISOString();
      const uniqueKey = slotUniqueKey(rule.id, scheduledAt);
      if (seen.has(uniqueKey)) continue;
      seen.add(uniqueKey);
      planned.push({ ruleId: rule.id, scheduledAt, timezone: zone, uniqueKey });
    }
  }

  return planned.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
}

export function isoWeekdayFromYmd(date: string, timeZone: string): number {
  const [year, month, day] = date.split("-").map(Number);
  const noonUtc = Date.UTC(year, month - 1, day, 12, 0, 0);
  return isoWeekdayInZone(noonUtc, timeZone);
}

export function formatCalendarDayKey(scheduledAt: string, timeZone: string): string {
  return formatZonedDateTime(Date.parse(scheduledAt), timeZone).date;
}

export function monthGrid(anchorDate: string): string[] {
  const [year, month] = anchorDate.split("-").map(Number);
  const first = new Date(Date.UTC(year, month - 1, 1));
  const startWeekday = (first.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: string[] = [];
  for (let i = 0; i < startWeekday; i++) {
    const d = new Date(Date.UTC(year, month - 1, 1 - (startWeekday - i)));
    cells.push(`${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(`${year}-${pad2(month)}-${pad2(day)}`);
  }
  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1];
    cells.push(addDaysIso(last, 1));
  }
  return cells;
}
