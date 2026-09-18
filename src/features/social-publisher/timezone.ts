function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function partsInZone(ms: number, timeZone: string) {
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
  const parts = formatter.formatToParts(new Date(ms));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value || "0");
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

/**
 * Convert a wall-clock date+time in an IANA zone to UTC ms.
 * Does not hardcode Europe/Bucharest — callers pass the account timezone.
 */
export function zonedWallTimeToUtcMs(
  date: string,
  time: string,
  timeZone: string,
): number {
  const zone = (timeZone || "").trim() || "UTC";
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  if (![year, month, day, hour, minute].every((n) => Number.isFinite(n))) {
    throw new Error("Invalid date or time");
  }

  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0);
  const asUtcParts = (p: ReturnType<typeof partsInZone>) =>
    Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);

  const desired = Date.UTC(year, month - 1, day, hour, minute, 0);
  let guess = utcGuess;
  for (let i = 0; i < 3; i++) {
    const delta = asUtcParts(partsInZone(guess, zone)) - desired;
    guess -= delta;
  }
  return guess;
}

export function formatZonedDateTime(ms: number, timeZone: string): { date: string; time: string } {
  const p = partsInZone(ms, timeZone || "UTC");
  return {
    date: `${p.year}-${pad2(p.month)}-${pad2(p.day)}`,
    time: `${pad2(p.hour)}:${pad2(p.minute)}`,
  };
}

export function addDaysIso(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const utc = Date.UTC(y, m - 1, d + days);
  const dt = new Date(utc);
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
}

export function resolveDefaultTimezone(input: {
  settingsTimezone?: string | null;
  plannerTimezone?: string | null;
  browserTimezone?: string | null;
}): string {
  const candidates = [input.settingsTimezone, input.plannerTimezone, input.browserTimezone];
  for (const value of candidates) {
    const tz = String(value || "").trim();
    if (!tz) continue;
    try {
      Intl.DateTimeFormat("en-US", { timeZone: tz }).format(new Date());
      return tz;
    } catch {
      continue;
    }
  }
  return "UTC";
}
