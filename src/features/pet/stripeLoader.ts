import type { Stripe, StripeConstructor } from "@stripe/stripe-js";
import { publishableKeyFingerprint } from "./stripeKeys";

export const STRIPE_JS_RELEASE_TRAIN = "dahlia";

const stripeInstances = new Map<string, Promise<Stripe | null>>();
let stripeConstructorPromise: Promise<StripeConstructor | null> | null = null;

function windowStripe(): (StripeConstructor & { version?: string }) | undefined {
  return (window as Window & { Stripe?: StripeConstructor & { version?: string } }).Stripe;
}

function removeLegacyStripeScripts(): void {
  for (const node of document.querySelectorAll('script[src*="js.stripe.com"]')) {
    const src = (node as HTMLScriptElement).src || "";
    if (/js\.stripe\.com\/v3\/?(\?|$)/.test(src)) {
      node.parentNode?.removeChild(node);
    }
  }
}

async function loadDahliaStripeConstructor(): Promise<StripeConstructor | null> {
  if (typeof window === "undefined") return null;

  const existing = windowStripe();
  if (existing?.version === STRIPE_JS_RELEASE_TRAIN) {
    return existing;
  }

  if (typeof document === "undefined") return null;

  removeLegacyStripeScripts();
  delete (window as Window & { Stripe?: StripeConstructor }).Stripe;
  stripeConstructorPromise = null;

  stripeConstructorPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://js.stripe.com/${STRIPE_JS_RELEASE_TRAIN}/stripe.js`;
    script.async = true;
    script.onload = () => resolve(windowStripe() ?? null);
    script.onerror = () => reject(new Error("stripe_script_load_failed"));
    (document.head || document.body)?.appendChild(script);
  });

  return stripeConstructorPromise;
}

export function getStripePromise(publishableKey: string): Promise<Stripe | null> {
  const key = String(publishableKey || "").trim();
  if (!key.startsWith("pk_")) {
    return Promise.reject(new Error("missing_publishable_key"));
  }

  const cached = stripeInstances.get(key);
  if (cached) return cached;

  const created = loadDahliaStripeConstructor().then((ctor) => (ctor ? ctor(key) : null));
  stripeInstances.set(key, created);
  return created;
}

export function stripeInstanceKeyFingerprint(publishableKey: string): string | null {
  return publishableKeyFingerprint(publishableKey);
}

/** Test-only helper. */
export function resetStripeLoaderCacheForTests(): void {
  stripeInstances.clear();
  stripeConstructorPromise = null;
}
