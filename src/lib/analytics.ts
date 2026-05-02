const GA_ID = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined;

declare global {
  interface Window {
    dataLayer: IArguments[];
    gtag?: (...args: unknown[]) => void;
  }
}

let initialized = false;

export function initAnalytics() {
  if (!GA_ID) return;
  if (typeof window === "undefined") return;
  if (initialized) return;

  initialized = true;

  const existingScript = document.querySelector(
    `script[src="https://www.googletagmanager.com/gtag/js?id=${GA_ID}"]`
  );

  if (!existingScript) {
    const script = document.createElement("script");
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
    script.async = true;
    document.head.appendChild(script);
  }

  window.dataLayer = window.dataLayer || [];

  window.gtag = function gtag() {
    window.dataLayer.push(arguments);
  };

  window.gtag("js", new Date());

  window.gtag("config", GA_ID, {
    send_page_view: false,
  });
}

export function trackPageView(path: string) {
  if (!GA_ID) return;
  if (typeof window === "undefined") return;
  if (!window.gtag) return;

  window.gtag("config", GA_ID, {
    page_path: path,
  });
}

export function trackEvent(
  eventName: string,
  params?: Record<string, string | number | boolean | null | undefined>
) {
  if (!GA_ID) return;
  if (typeof window === "undefined") return;
  if (!window.gtag) return;

  window.gtag("event", eventName, params || {});
}