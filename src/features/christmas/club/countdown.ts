import {
  CHRISTMAS_CLUB_CONFIG,
  type ChristmasClubConfig,
} from "./config";

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

/**
 * Resolve Christmas 00:00 in a named IANA timezone without Temporal.
 * Interprets the configured wall-clock as that zone, then returns UTC ms.
 */
export function zonedWallTimeMs(
  config: Pick<
    ChristmasClubConfig,
    "campaignYear" | "month" | "day" | "hour" | "minute" | "second"
  >,
  timeZone: string,
): number {
  const y = config.campaignYear;
  const mo = pad2(config.month);
  const d = pad2(config.day);
  const h = pad2(config.hour);
  const mi = pad2(config.minute);
  const s = pad2(config.second);
  const iso = `${y}-${mo}-${d}T${h}:${mi}:${s}`;

  const utcGuess = Date.parse(`${iso}Z`);
  if (!Number.isFinite(utcGuess)) {
    return Date.UTC(y, config.month - 1, config.day, config.hour, config.minute, config.second);
  }

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  const partsOf = (ms: number) => {
    const parts = formatter.formatToParts(new Date(ms));
    const get = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((p) => p.type === type)?.value || "0";
    return {
      year: Number(get("year")),
      month: Number(get("month")),
      day: Number(get("day")),
      hour: Number(get("hour")),
      minute: Number(get("minute")),
      second: Number(get("second")),
    };
  };

  const asMs = (p: ReturnType<typeof partsOf>) =>
    Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);

  const desired = Date.UTC(
    y,
    config.month - 1,
    config.day,
    config.hour,
    config.minute,
    config.second,
  );

  let instant = utcGuess;
  for (let i = 0; i < 4; i += 1) {
    const shown = partsOf(instant);
    const delta = desired - asMs(shown);
    if (delta === 0) break;
    instant += delta;
  }
  return instant;
}

export function getChristmasTargetMs(
  config: ChristmasClubConfig = CHRISTMAS_CLUB_CONFIG,
  now: Date = new Date(),
): number {
  if (config.timeZone === "local") {
    return new Date(
      config.campaignYear,
      config.month - 1,
      config.day,
      config.hour,
      config.minute,
      config.second,
      0,
    ).getTime();
  }
  void now;
  return zonedWallTimeMs(config, config.timeZone);
}

export function remainingUntilChristmas(
  now: Date = new Date(),
  config: ChristmasClubConfig = CHRISTMAS_CLUB_CONFIG,
): ChristmasCountdownParts {
  const targetMs = getChristmasTargetMs(config, now);
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

  const days = Math.floor(totalMs / MS_DAY);
  const hours = Math.floor((totalMs % MS_DAY) / MS_HOUR);
  const minutes = Math.floor((totalMs % MS_HOUR) / MS_MINUTE);
  const seconds = Math.floor((totalMs % MS_MINUTE) / MS_SECOND);

  return {
    expired: false,
    days,
    hours,
    minutes,
    seconds,
    totalMs,
    targetMs,
  };
}

export function padCountdownValue(value: number): string {
  if (value >= 100) return String(value);
  return pad2(value);
}
