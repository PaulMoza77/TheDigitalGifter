/**
 * Countdown to Christmas morning in the visitor's local timezone.
 * Campaign year is the single switch for next season.
 */

export const CHRISTMAS_COUNTDOWN_YEAR = 2026;

export type ChristmasCountdownParts = {
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

export function getChristmasTargetMs(
  year: number = CHRISTMAS_COUNTDOWN_YEAR,
  now: Date = new Date(),
): number {
  void now;
  return new Date(year, 11, 25, 0, 0, 0, 0).getTime();
}

export function remainingUntilChristmas(
  now: Date = new Date(),
  year: number = CHRISTMAS_COUNTDOWN_YEAR,
): ChristmasCountdownParts {
  const targetMs = getChristmasTargetMs(year, now);
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
