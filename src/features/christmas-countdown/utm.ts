import {
  captureFunnelAttribution,
  getFunnelAttribution,
  getFunnelFirstTouchContext,
  sanitizeAttributionValue,
} from "@/features/pet/funnelAttribution";

export const CHRISTMAS_COUNTDOWN_ATTRIBUTION_KEY = "tdg.christmas.countdown.attribution.v1";

export type ChristmasCountdownAttribution = {
  source: string | null;
  medium: string | null;
  campaign: string | null;
  content: string | null;
  term: string | null;
  referrer: string | null;
  landingPage: string | null;
};

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readStoredCountdownAttribution(): ChristmasCountdownAttribution | null {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(CHRISTMAS_COUNTDOWN_ATTRIBUTION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      source: sanitizeAttributionValue(parsed.source),
      medium: sanitizeAttributionValue(parsed.medium),
      campaign: sanitizeAttributionValue(parsed.campaign),
      content: sanitizeAttributionValue(parsed.content),
      term: sanitizeAttributionValue(parsed.term),
      referrer: sanitizeAttributionValue(parsed.referrer),
      landingPage: typeof parsed.landingPage === "string" ? parsed.landingPage.slice(0, 120) : null,
    };
  } catch {
    return null;
  }
}

export function persistCountdownAttribution(value: ChristmasCountdownAttribution) {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(CHRISTMAS_COUNTDOWN_ATTRIBUTION_KEY, JSON.stringify(value));
  } catch {
    /* private mode */
  }
}

/** First-touch UTM + referrer for the Christmas hub. Does not overwrite a stored first touch. */
export function captureChristmasCountdownAttribution(search?: string): ChristmasCountdownAttribution {
  captureFunnelAttribution(search);
  const existing = readStoredCountdownAttribution();
  if (existing && (existing.source || existing.medium || existing.campaign || existing.referrer)) {
    return existing;
  }
  const utm = getFunnelAttribution();
  const firstTouch = getFunnelFirstTouchContext();
  const landingPage =
    typeof window !== "undefined"
      ? `${window.location.pathname}${window.location.search}`.slice(0, 120)
      : "/christmas";
  const next: ChristmasCountdownAttribution = {
    source: utm.utm_source ?? null,
    medium: utm.utm_medium ?? null,
    campaign: utm.utm_campaign ?? null,
    content: utm.utm_content ?? null,
    term: utm.utm_term ?? null,
    referrer: firstTouch.referrerHost ?? null,
    landingPage,
  };
  persistCountdownAttribution(next);
  return next;
}

export function attributionForSignup(): ChristmasCountdownAttribution {
  return readStoredCountdownAttribution() || captureChristmasCountdownAttribution();
}
