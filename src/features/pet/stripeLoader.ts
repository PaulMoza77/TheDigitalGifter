import type { Stripe, StripeConstructor } from "@stripe/stripe-js";
import { publishableKeyFingerprint } from "./stripeKeys";

export const STRIPE_JS_RELEASE_TRAIN = "dahlia";

const stripeInstances = new Map<string, Promise<Stripe | null>>();
let constructorLoad: Promise<StripeConstructor | null> | null = null;

function windowStripe(): (StripeConstructor & { version?: string | number }) | undefined {
  return (window as Window & { Stripe?: StripeConstructor & { version?: string | number } }).Stripe;
}

function isDahliaStripe(version: unknown): boolean {
  return version === STRIPE_JS_RELEASE_TRAIN;
}

function removeNonDahliaStripeScripts(): void {
  if (typeof document === "undefined") return;
  for (const node of document.querySelectorAll('script[src*="js.stripe.com"]')) {
    const src = (node as HTMLScriptElement).src || "";
    if (!src.includes(`/js.stripe.com/${STRIPE_JS_RELEASE_TRAIN}/`)) {
      node.parentNode?.removeChild(node);
    }
  }
}

function resetWindowStripe(): void {
  removeNonDahliaStripeScripts();
  delete (window as Window & { Stripe?: StripeConstructor }).Stripe;
  constructorLoad = null;
}

async function loadDahliaStripeConstructor(force = false): Promise<StripeConstructor | null> {
  if (typeof window === "undefined") return null;

  const existing = windowStripe();
  if (!force && existing && isDahliaStripe(existing.version)) {
    return existing;
  }

  if (typeof document === "undefined") return null;

  if (force) {
    resetWindowStripe();
    stripeInstances.clear();
  } else if (existing && !isDahliaStripe(existing.version)) {
    resetWindowStripe();
  }

  if (!constructorLoad) {
    constructorLoad = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = `https://js.stripe.com/${STRIPE_JS_RELEASE_TRAIN}/stripe.js`;
      script.async = true;
      script.onload = () => resolve(windowStripe() ?? null);
      script.onerror = () => {
        constructorLoad = null;
        reject(new Error("stripe_script_load_failed"));
      };
      (document.head || document.body)?.appendChild(script);
    });
  }

  return constructorLoad;
}

/** Warm dahlia Stripe.js as early as possible on funnel entry. */
export function preloadDahliaStripe(): void {
  if (typeof window === "undefined") return;
  void loadDahliaStripeConstructor().catch(() => {
    /* checkout path will retry */
  });
}

export function getStripePromise(publishableKey: string, forceReload = false): Promise<Stripe | null> {
  const key = String(publishableKey || "").trim();
  if (!key.startsWith("pk_")) {
    return Promise.reject(new Error("missing_publishable_key"));
  }

  if (forceReload) {
    stripeInstances.delete(key);
  }

  const cached = stripeInstances.get(key);
  if (cached && !forceReload) return cached;

  const created = loadDahliaStripeConstructor(forceReload).then((ctor) => (ctor ? ctor(key) : null));
  stripeInstances.set(key, created);
  return created;
}

export function stripeInstanceKeyFingerprint(publishableKey: string): string | null {
  return publishableKeyFingerprint(publishableKey);
}

/** Test-only helper. */
export function resetStripeLoaderCacheForTests(): void {
  stripeInstances.clear();
  constructorLoad = null;
}

export async function reloadStripeForCheckout(publishableKey: string): Promise<Stripe | null> {
  resetWindowStripe();
  return getStripePromise(publishableKey, true);
}
