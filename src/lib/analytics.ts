const GA_ID = "G-6FVX69WYFG";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
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

export function initAnalytics() {
  if (!ensureGtag()) return;

  window.gtag?.("config", GA_ID, {
    send_page_view: true,
    page_path: window.location.pathname + window.location.search,
    page_location: window.location.href,
    page_title: document.title,
    debug_mode: true,
  });
}

export function trackPageView(path: string) {
  if (!ensureGtag()) return;

  window.gtag?.("config", GA_ID, {
    page_path: path,
    page_location: window.location.href,
    page_title: document.title,
    debug_mode: true,
  });
}

export function trackEvent(
  eventName: string,
  params?: Record<string, string | number | boolean | null | undefined>
) {
  if (!ensureGtag()) return;

  window.gtag?.("event", eventName, {
    ...(params || {}),
    send_to: GA_ID,
    debug_mode: true,
  });
}