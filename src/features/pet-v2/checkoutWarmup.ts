/**
 * Warm the slow external dependencies for Dog V2 Elements checkout *before*
 * the offer screen needs them. Saves multi-second cold starts on mobile.
 */
import { getPublicSupabaseConfig } from "@/lib/env";
import { fetchV2ProviderStatus } from "./providerStatus";

const STRIPE_JS_CANDIDATES = [
  "https://js.stripe.com/clover/stripe.js",
  "https://js.stripe.com/v3/",
] as const;

let warmed = false;
let stripeScriptPromise: Promise<void> | null = null;

function ensurePreconnect(href: string, crossOrigin = false) {
  if (typeof document === "undefined") return;
  const existing = document.querySelector(`link[rel="preconnect"][href="${href}"]`);
  if (existing) return;
  const link = document.createElement("link");
  link.rel = "preconnect";
  link.href = href;
  if (crossOrigin) link.crossOrigin = "anonymous";
  document.head.appendChild(link);
}

function prefetchStripeScript(): Promise<void> {
  if (typeof document === "undefined") return Promise.resolve();
  if (stripeScriptPromise) return stripeScriptPromise;

  ensurePreconnect("https://js.stripe.com");
  ensurePreconnect("https://api.stripe.com");
  ensurePreconnect("https://merchant-ui-api.stripe.com");

  stripeScriptPromise = new Promise((resolve) => {
    let remaining = STRIPE_JS_CANDIDATES.length;
    const done = () => {
      remaining -= 1;
      if (remaining <= 0) resolve();
    };
    for (const href of STRIPE_JS_CANDIDATES) {
      // Prefer <link rel="preload"> so we don't execute Stripe twice before loadStripe.
      const existing = document.querySelector(`link[rel="preload"][href="${href}"]`);
      if (existing) {
        done();
        continue;
      }
      const link = document.createElement("link");
      link.rel = "preload";
      link.as = "script";
      link.href = href;
      link.onload = () => done();
      link.onerror = () => done();
      document.head.appendChild(link);
    }
    // Don't block checkout forever if preload hangs.
    window.setTimeout(() => resolve(), 4_000);
  });
  return stripeScriptPromise;
}

/** Fire-and-forget warm of pet-funnel edge isolate (getPublicOffer is cheap). */
function warmPetFunnelEdge(): void {
  try {
    const { url, anon } = getPublicSupabaseConfig();
    void fetch(`${url.replace(/\/$/, "")}/functions/v1/pet-funnel`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anon,
        Authorization: `Bearer ${anon}`,
      },
      body: JSON.stringify({ action: "getPublicOffer" }),
      signal: AbortSignal.timeout(8_000),
    }).catch(() => {
      /* checkout path will retry */
    });
  } catch {
    /* env may be missing in unit tests */
  }
}

/** Call once on V2 landing / photo — safe to invoke repeatedly. */
export function warmV2CheckoutDependencies(): void {
  if (typeof window === "undefined") return;
  if (warmed) {
    void prefetchStripeScript();
    return;
  }
  warmed = true;
  void prefetchStripeScript();
  void fetchV2ProviderStatus().catch(() => {
    /* checkout path will retry */
  });
  warmPetFunnelEdge();
}

/** Test helper. */
export function resetV2CheckoutWarmupForTests(): void {
  warmed = false;
  stripeScriptPromise = null;
}
