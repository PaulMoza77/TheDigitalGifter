const GA_ID = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

let initialized = false;

export function initAnalytics() {
  if (!GA_ID) return;
  if (typeof window === "undefined") return;
  if (initialized) return;

  initialized = true;

  window.dataLayer = window.dataLayer || [];

  window.gtag = function gtag(...args: unknown[]) {
    window.dataLayer?.push(args);
  };

  const existingScript = document.querySelector(
    `script[src="https://www.googletagmanager.com/gtag/js?id=${GA_ID}"]`
  );

  if (!existingScript) {
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
    document.head.appendChild(script);
  }

  window.gtag("js", new Date());

  window.gtag("config", GA_ID, {
    send_page_view: false,
  });
}

export function trackPageView(path: string) {
  if (!GA_ID) return;
  if (typeof window === "undefined") return;

  if (!window.gtag) {
    initAnalytics();
  }

  window.gtag?.("event", "page_view", {
    page_title: document.title,
    page_location: window.location.href,
    page_path: path,
  });
}

export function trackEvent(
  eventName: string,
  params?: Record<string, string | number | boolean | null | undefined>
) {
  if (!GA_ID) return;
  if (typeof window === "undefined") return;

  if (!window.gtag) {
    initAnalytics();
  }

  window.gtag?.("event", eventName, params || {});
}