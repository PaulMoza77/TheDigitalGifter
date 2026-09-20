export const OCCASION_KEYS = [
  "christmas", "thanksgiving", "birthday", "easter", "valentines",
  "anniversary", "dinner_party", "other",
] as const;
export type OccasionKey = (typeof OCCASION_KEYS)[number];

export type OccasionContext = {
  key: OccasionKey;
  year?: number | null;
  startsOn?: string | null;
  endsOn?: string | null;
  locale?: string | null;
  countryCode?: string | null;
};

export const CHRISTMAS_2026: OccasionContext = {
  key: "christmas", year: 2026, startsOn: "2026-12-24", endsOn: "2026-12-26",
};

/** Domain seam for new modules. Existing christmas_* tables remain compatible during launch. */
export function occasionScope(input?: Partial<OccasionContext> | null): OccasionContext {
  return { ...CHRISTMAS_2026, ...(input || {}), key: input?.key || "christmas" };
}
