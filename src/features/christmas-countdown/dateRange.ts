export type ChristmasDatePreset = "today" | "7d" | "30d" | "all" | "custom";

export type ChristmasDateRange = {
  from: string;
  to: string;
  preset: ChristmasDatePreset;
};

const ALL_TIME_FROM = "2024-01-01";

function utcYmd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function utcDayStart(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function isValidYmd(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00.000Z`));
}

export function rangeForChristmasPreset(
  preset: ChristmasDatePreset,
  now = new Date(),
  custom?: { from: string; to: string },
): ChristmasDateRange {
  const today = utcYmd(utcDayStart(now));
  if (preset === "today") return { preset, from: today, to: today };
  if (preset === "all") return { preset, from: ALL_TIME_FROM, to: today };
  if (preset === "custom" && custom && isValidYmd(custom.from) && isValidYmd(custom.to)) {
    const from = custom.from <= custom.to ? custom.from : custom.to;
    const to = custom.from <= custom.to ? custom.to : custom.from;
    return { preset, from, to };
  }
  const days = preset === "30d" ? 30 : 7;
  const from = new Date(utcDayStart(now).getTime() - (days - 1) * 86400000);
  return { preset: preset === "30d" ? "30d" : "7d", from: utcYmd(from), to: today };
}

export function rangeToIsoBounds(range: ChristmasDateRange): { fromIso: string; toIso: string } {
  return {
    fromIso: `${range.from}T00:00:00.000Z`,
    toIso: `${range.to}T23:59:59.999Z`,
  };
}

export function ga4StartDate(range: ChristmasDateRange): string {
  return range.from;
}

export function ga4EndDate(range: ChristmasDateRange): string {
  return range.to;
}
