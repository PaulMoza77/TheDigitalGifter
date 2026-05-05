const GA_ID = "G-6FVX69WYFG";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

let initialized = false;

function loadGoogleTagScript() {
  if (typeof document === "undefined") return;

  const existingScript = document.querySelector<HTMLScriptElement>(
    `script[src="https://www.googletagmanager.com/gtag/js?id=${GA_ID}"]`
  );

  if (existingScript) return;

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(script);
}

export function initAnalytics() {
  if (typeof window === "undefined") return;
  if (initialized) return;

  initialized = true;

  window.dataLayer = window.dataLayer || [];

  window.gtag = function gtag(...args: unknown[]) {
    window.dataLayer?.push(args);
  };

  loadGoogleTagScript();

  window.gtag("js", new Date());

  window.gtag("config", GA_ID, {
    page_path: window.location.pathname + window.location.search,
    page_location: window.location.href,
    page_title: document.title,
  });
}

export function trackPageView(path: string) {
  if (typeof window === "undefined") return;

  if (!window.gtag) {
    initAnalytics();
  }

  window.gtag?.("config", GA_ID, {
    page_path: path,
    page_location: window.location.href,
    page_title: document.title,
  });
}

export function trackEvent(
  eventName: string,
  params?: Record<string, string | number | boolean | null | undefined>
) {
  if (typeof window === "undefined") return;

  if (!window.gtag) {
    initAnalytics();
  }

  window.gtag?.("event", eventName, {
    ...(params || {}),
    send_to: GA_ID,
  });
}