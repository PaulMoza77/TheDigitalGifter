export const CHRISTMAS_COUNTDOWN_CAMPAIGN_YEAR = 2026;

/** Default public countdown target: Christmas Day 2026 00:00 UTC. */
export const CHRISTMAS_COUNTDOWN_DEFAULT_TARGET_ISO = "2026-12-25T00:00:00.000Z";

export const CHRISTMAS_COUNTDOWN_DEFAULTS = {
  campaignYear: CHRISTMAS_COUNTDOWN_CAMPAIGN_YEAR,
  countdownTargetAt: CHRISTMAS_COUNTDOWN_DEFAULT_TARGET_ISO,
  pageActive: true,
  signupActive: true,
  headline: "Create Magical Christmas Cards with AI",
  supportingCopy:
    "Transform your holiday memories into stunning, personalized Christmas cards in seconds. No design skills needed — just upload, customize, and let our AI work its magic.",
  ctaText: "Start Creating",
  successMessage: "You're on the list. We'll be in touch before Christmas.",
  reachedMessage: "Christmas is here. Create something worth sending.",
} as const;

export type ChristmasCountdownPublicConfig = {
  campaignYear: number;
  countdownTargetAt: string;
  pageActive: boolean;
  signupActive: boolean;
  headline: string;
  supportingCopy: string;
  ctaText: string;
  successMessage: string;
  reachedMessage: string;
};

export const CHRISTMAS_COUNTDOWN_PATH = "/christmas";

export const CHRISTMAS_COUNTDOWN_JOIN_EVENTS = [
  "christmas_page_view",
  "christmas_join_started",
  "christmas_join_completed",
  "christmas_google_auth_started",
  "christmas_google_auth_completed",
  "christmas_return_visit",
] as const;

export type ChristmasCountdownJoinEvent = (typeof CHRISTMAS_COUNTDOWN_JOIN_EVENTS)[number];

export function isNonEmptyText(value: unknown, fallback: string, max = 500): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim().slice(0, max);
  return trimmed || fallback;
}

export function asBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === 1 || value === "1") return true;
  if (value === "false" || value === 0 || value === "0") return false;
  return fallback;
}

export function coalescePublicConfig(raw: unknown): ChristmasCountdownPublicConfig {
  const row = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const year = Number(row.campaign_year ?? row.campaignYear);
  const target =
    typeof row.countdown_target_at === "string"
      ? row.countdown_target_at
      : typeof row.countdownTargetAt === "string"
        ? row.countdownTargetAt
        : "";
  const parsedTarget = Date.parse(target);
  return {
    campaignYear: Number.isFinite(year) && year >= 2024 && year <= 2100 ? Math.round(year) : CHRISTMAS_COUNTDOWN_DEFAULTS.campaignYear,
    countdownTargetAt: Number.isFinite(parsedTarget)
      ? new Date(parsedTarget).toISOString()
      : CHRISTMAS_COUNTDOWN_DEFAULTS.countdownTargetAt,
    pageActive: asBoolean(row.page_active ?? row.pageActive, CHRISTMAS_COUNTDOWN_DEFAULTS.pageActive),
    signupActive: asBoolean(row.signup_active ?? row.signupActive, CHRISTMAS_COUNTDOWN_DEFAULTS.signupActive),
    headline: isNonEmptyText(row.headline, CHRISTMAS_COUNTDOWN_DEFAULTS.headline, 180),
    supportingCopy: isNonEmptyText(row.supporting_copy ?? row.supportingCopy, CHRISTMAS_COUNTDOWN_DEFAULTS.supportingCopy, 600),
    ctaText: isNonEmptyText(row.cta_text ?? row.ctaText, CHRISTMAS_COUNTDOWN_DEFAULTS.ctaText, 80),
    successMessage: isNonEmptyText(row.success_message ?? row.successMessage, CHRISTMAS_COUNTDOWN_DEFAULTS.successMessage, 240),
    reachedMessage: isNonEmptyText(row.reached_message ?? row.reachedMessage, CHRISTMAS_COUNTDOWN_DEFAULTS.reachedMessage, 240),
  };
}

export function publicConfigFromUnknown(raw: unknown): ChristmasCountdownPublicConfig {
  try {
    return coalescePublicConfig(raw);
  } catch {
    return { ...CHRISTMAS_COUNTDOWN_DEFAULTS };
  }
}
