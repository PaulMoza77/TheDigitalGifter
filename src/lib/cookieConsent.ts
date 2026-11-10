export const COOKIE_CONSENT_KEY = "tdg.cookie-consent.v1";
export const COOKIE_CONSENT_CHANGED_EVENT = "tdg-cookie-consent-changed";
export const COOKIE_SETTINGS_EVENT = "tdg-cookie-settings";

export type CookieConsentValue = "granted" | "denied";

export function readCookieConsent(): CookieConsentValue | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(COOKIE_CONSENT_KEY);
    if (value === "granted" || value === "denied") return value;
    return null;
  } catch {
    return null;
  }
}

export function applyCookieConsent(value: CookieConsentValue) {
  const setter = (window as Window & { __tdgSetCookieConsent?: (next: CookieConsentValue) => void })
    .__tdgSetCookieConsent;
  if (typeof setter === "function") {
    setter(value);
    window.dispatchEvent(new Event(COOKIE_CONSENT_CHANGED_EVENT));
    return;
  }
  try {
    window.localStorage.setItem(COOKIE_CONSENT_KEY, value);
  } catch {
    /* private mode */
  }
  window.dispatchEvent(new Event(COOKIE_CONSENT_CHANGED_EVENT));
}

export function openCookieSettings() {
  window.dispatchEvent(new Event(COOKIE_SETTINGS_EVENT));
}
