import { hasAnalyticsConsent, readCookieConsent } from "@/lib/cookieConsent";

const GA_ID = "G-6FVX69WYFG";
const META_PIXEL_ID = "1673980440653322";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
  }
}

function ensureGtag() {
  if (typeof window === "undefined") return false;
  window.dataLayer = window.dataLayer || [];
  if (!window.gtag) {
    window.gtag = function gtag(...args: unknown[]) {
      window.dataLayer?.push(args);
    };
    window.gtag("js", new Date());
  }
  return true;
}

export function applyDefaultDeniedConsent() {
  if (!ensureGtag()) return;
  window.gtag?.("consent", "default", {
    analytics_storage: "denied",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    wait_for_update: 500,
  });
}

export function loadMarketingScripts() {
  if (typeof window === "undefined") return;
  if (!hasAnalyticsConsent(readCookieConsent())) return;

  ensureGtag();
  window.gtag?.("consent", "update", {
    analytics_storage: "granted",
    ad_storage: "granted",
    ad_user_data: "granted",
    ad_personalization: "granted",
  });

  if (!document.querySelector(`script[src*="googletagmanager.com/gtag/js?id=${GA_ID}"]`)) {
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
    document.head.appendChild(script);
  }

  window.gtag?.("config", GA_ID, {
    send_page_view: true,
    anonymize_ip: true,
  });

  if (!window.fbq) {
    const script = document.createElement("script");
    script.async = true;
    script.src = "https://connect.facebook.net/en_US/fbevents.js";
    document.head.appendChild(script);
    window.fbq = function fbq(...args: unknown[]) {
      (window.fbq as { queue?: unknown[] }).queue = (
        window.fbq as { queue?: unknown[] }
      ).queue || [];
      (window.fbq as { queue?: unknown[] }).queue?.push(args);
    };
  }
  window.fbq?.("init", META_PIXEL_ID);
  window.fbq?.("track", "PageView");
}

export function revokeMarketingConsent() {
  if (!ensureGtag()) return;
  window.gtag?.("consent", "update", {
    analytics_storage: "denied",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  });
}

export function initAnalytics() {
  applyDefaultDeniedConsent();
  if (hasAnalyticsConsent(readCookieConsent())) {
    loadMarketingScripts();
  }
}

export function trackPageView(path: string) {
  if (!hasAnalyticsConsent(readCookieConsent())) return;
  if (!ensureGtag()) return;
  window.gtag?.("config", GA_ID, {
    page_path: path,
    page_location: window.location.href,
    page_title: document.title,
  });
}

export function trackEvent(
  eventName: string,
  params?: Record<string, string | number | boolean | null | undefined>,
) {
  if (!hasAnalyticsConsent(readCookieConsent())) return;
  if (!ensureGtag()) return;
  window.gtag?.("event", eventName, {
    ...(params || {}),
    send_to: GA_ID,
  });
}
