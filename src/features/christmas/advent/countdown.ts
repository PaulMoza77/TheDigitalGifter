/**
 * Advent countdown display helpers.
 * Unlock eligibility remains in treeLogic.adventDayParts (Europe/Bucharest).
 * This only computes remaining time for UI labels.
 */

export type AdventCountdownParts = {
  expired: boolean;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
  targetMs: number;
};

const MS_SECOND = 1000;
const MS_MINUTE = 60 * MS_SECOND;
const MS_HOUR = 60 * MS_MINUTE;
const MS_DAY = 24 * MS_HOUR;

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/** Next Europe/Bucharest midnight after `now` (exclusive of current second). */
export function nextBucharestMidnightMs(now: Date = new Date()): number {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Bucharest",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const partsOf = (ms: number) => {
    const parts = Object.fromEntries(
      fmt.formatToParts(new Date(ms)).map((p) => [p.type, p.value]),
    );
    return {
      year: Number(parts.year),
      month: Number(parts.month),
      day: Number(parts.day),
      hour: Number(parts.hour),
      minute: Number(parts.minute),
      second: Number(parts.second),
    };
  };
  const shown = partsOf(now.getTime());
  // Target: tomorrow 00:00 Bucharest wall clock
  const tomorrow = new Date(Date.UTC(shown.year, shown.month - 1, shown.day + 1, 0, 0, 0));
  // Convert wall date to approx UTC then refine like club countdown
  const y = tomorrow.getUTCFullYear();
  const mo = pad2(tomorrow.getUTCMonth() + 1);
  const d = pad2(tomorrow.getUTCDate());
  const iso = `${y}-${mo}-${d}T00:00:00`;
  let instant = Date.parse(`${iso}Z`);
  const desired = Date.UTC(y, tomorrow.getUTCMonth(), tomorrow.getUTCDate(), 0, 0, 0);
  const asMs = (p: ReturnType<typeof partsOf>) =>
    Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  for (let i = 0; i < 4; i += 1) {
    const delta = desired - asMs(partsOf(instant));
    if (delta === 0) break;
    instant += delta;
  }
  return instant;
}

/** Dec 1 00:00 Europe/Bucharest for the Advent season year. */
export function adventSeasonStartMs(seasonYear: number): number {
  const mo = "12";
  const d = "01";
  const iso = `${seasonYear}-${mo}-${d}T00:00:00`;
  let instant = Date.parse(`${iso}Z`);
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Bucharest",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const partsOf = (ms: number) => {
    const parts = Object.fromEntries(
      fmt.formatToParts(new Date(ms)).map((p) => [p.type, p.value]),
    );
    return {
      year: Number(parts.year),
      month: Number(parts.month),
      day: Number(parts.day),
      hour: Number(parts.hour),
      minute: Number(parts.minute),
      second: Number(parts.second),
    };
  };
  const desired = Date.UTC(seasonYear, 11, 1, 0, 0, 0);
  const asMs = (p: ReturnType<typeof partsOf>) =>
    Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  for (let i = 0; i < 4; i += 1) {
    const delta = desired - asMs(partsOf(instant));
    if (delta === 0) break;
    instant += delta;
  }
  return instant;
}

export function remainingUntil(
  targetMs: number,
  now: Date = new Date(),
): AdventCountdownParts {
  const totalMs = targetMs - now.getTime();
  if (!Number.isFinite(totalMs) || totalMs <= 0) {
    return {
      expired: true,
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      totalMs: 0,
      targetMs,
    };
  }
  return {
    expired: false,
    days: Math.floor(totalMs / MS_DAY),
    hours: Math.floor((totalMs % MS_DAY) / MS_HOUR),
    minutes: Math.floor((totalMs % MS_HOUR) / MS_MINUTE),
    seconds: Math.floor((totalMs % MS_MINUTE) / MS_SECOND),
    totalMs,
    targetMs,
  };
}

export function padCountdownValue(value: number): string {
  if (value >= 100) return String(value);
  return pad2(value);
}
