import { readCookieConsent } from "@/lib/cookieConsent";

type SafeParams = Record<string, string | number | boolean | undefined>;

function once(key: string): boolean {
  try {
    if (window.sessionStorage.getItem(key) === "1") return false;
    window.sessionStorage.setItem(key, "1");
    return true;
  } catch {
    return true;
  }
}

/** Consent-aware GA4 helper. Never pass names, email, audio, transcript or access tokens. */
export function trackSantaCallAnalytics(eventName: string, params: SafeParams = {}, onceKey?: string) {
  if (typeof window === "undefined" || readCookieConsent() !== "granted") return;
  if (onceKey && !once(`tdg.ga4.santa.${onceKey}`)) return;
  const gtag = (window as Window & { gtag?: (...args: unknown[]) => void }).gtag;
  if (typeof gtag !== "function") return;
  const safe = Object.fromEntries(
    Object.entries(params).filter(([, value]) =>
      typeof value === "string" || typeof value === "number" || typeof value === "boolean"
    ),
  );
  gtag("event", eventName, { ...safe, product_key: "christmas_santa_voice_call" });
}
