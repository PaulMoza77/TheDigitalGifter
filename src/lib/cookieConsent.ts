export const COOKIE_CONSENT_KEY = "tdg_cookie_consent";

export type CookieConsentValue = "accepted" | "rejected";

export type CookieConsentState = {
  value: CookieConsentValue;
  updatedAt: string;
};

export function readCookieConsent(): CookieConsentState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CookieConsentState;
    if (parsed?.value === "accepted" || parsed?.value === "rejected") {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function writeCookieConsent(value: CookieConsentValue): CookieConsentState {
  const next: CookieConsentState = {
    value,
    updatedAt: new Date().toISOString(),
  };
  localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(next));
  return next;
}

export function hasAnalyticsConsent(state: CookieConsentState | null): boolean {
  return state?.value === "accepted";
}
