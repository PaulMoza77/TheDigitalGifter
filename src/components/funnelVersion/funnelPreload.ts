/**
 * Christmas funnel images.
 * Width choice must stay in sync with the boot script in index.html:
 * phones use the 480w WebP, everything wider uses 960w.
 */

export const CHRISTMAS_FUNNEL_HERO = ["christmas-before", "christmas-after"] as const;

export const CHRISTMAS_FUNNEL_REST = [
  "christmas-ex2-before",
  "christmas-ex2-after",
  "christmas-ex3-before",
  "christmas-ex3-after",
] as const;

export const CHRISTMAS_FUNNEL_VARIANTS = [
  ...CHRISTMAS_FUNNEL_HERO,
  ...CHRISTMAS_FUNNEL_REST,
] as const;

export function isChristmasFunnelVariant(variant: string) {
  return (CHRISTMAS_FUNNEL_VARIANTS as readonly string[]).includes(variant);
}

export function christmasFunnelWidth(): 480 | 960 {
  if (typeof window === "undefined") return 960;
  return window.matchMedia("(max-width: 767px)").matches ? 480 : 960;
}

export function christmasFunnelImageUrl(variant: string) {
  return `/assets/funnel/${variant}-${christmasFunnelWidth()}.webp`;
}

function preloadImage(href: string, priority: "high" | "low" | "auto") {
  if (typeof document === "undefined") return;
  if (document.querySelector(`link[data-funnel-preload="${href}"]`)) return;
  const link = document.createElement("link");
  link.rel = "preload";
  link.as = "image";
  link.type = "image/webp";
  link.href = href;
  link.setAttribute("fetchpriority", priority);
  link.setAttribute("data-funnel-preload", href);
  document.head.appendChild(link);
}

/** Preload the hero pair, then fetch the rest of the Christmas gallery into cache. */
export function warmChristmasFunnelImages() {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const width = String(christmasFunnelWidth());
  if (document.documentElement.dataset.funnelWarm === width) return;
  document.documentElement.dataset.funnelWarm = width;

  CHRISTMAS_FUNNEL_HERO.forEach((variant, index) => {
    preloadImage(christmasFunnelImageUrl(variant), index === 0 ? "high" : "auto");
  });

  CHRISTMAS_FUNNEL_REST.forEach((variant) => {
    const href = christmasFunnelImageUrl(variant);
    void fetch(href, { priority: "low", credentials: "same-origin" } as RequestInit).catch(
      () => undefined,
    );
  });
}

const FUNNEL_ROUTE_LOADERS = [
  () => import("@/components/funnelVersion/FunnelUploadPhoto"),
  () => import("@/components/funnelVersion/FunnelStyleSelect"),
  () => import("@/components/funnelVersion/FunnelPreview"),
  () => import("@/components/funnelVersion/FunnelEmailCapture"),
  () => import("@/components/funnelVersion/FunnelPayment"),
  () => import("@/components/funnelVersion/ResultPage"),
];

/** Pull the next funnel screens into the module cache so each step opens immediately. */
export function prefetchChristmasFunnelRoutes() {
  if (typeof window === "undefined") return;
  const run = () => {
    for (const load of FUNNEL_ROUTE_LOADERS) void load();
  };
  const idle = window.requestIdleCallback;
  if (typeof idle === "function") idle(run, { timeout: 1200 });
  else window.setTimeout(run, 300);
}
