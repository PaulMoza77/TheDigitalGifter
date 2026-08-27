/** V3-isolated Elements checkout session cache (separate from V1 keys). */

import {
  isValidEmbeddedClientSecret,
  publishableKeyMatchesClientSecret,
} from "../pet/funnelGuards";

export const V3_CHECKOUT_HOLD_STORAGE_KEY = "tdg.petFunnelV3.checkoutHold.v1";
/** Versioned Elements cache — never reuse Custom Checkout (v1) secrets. */
export const V3_CHECKOUT_SESSION_CACHE_KEY = "tdg.petFunnelV3.checkoutSession.v2";
/** Legacy Custom Checkout cache key — read only for order recovery, never for Elements secrets. */
export const V3_CHECKOUT_SESSION_CACHE_KEY_LEGACY = "tdg.petFunnelV3.checkoutSession.v1";
export const V3_CHECKOUT_HOLD_MS = 30 * 60 * 1000;
export const V3_CHECKOUT_CACHE_VERSION = 2;
export const V3_CHECKOUT_MODE_ELEMENTS = "elements" as const;

export type V3CheckoutHold = {
  expiresAt: number;
};

export type V3CachedEmbeddedCheckout = {
  orderId: string;
  publicToken: string;
  sessionId: string;
  clientSecret?: string | null;
  publishableKey?: string | null;
  checkoutUrl?: string | null;
  expiresAt: number;
  eventId?: string;
  purchaseEventId?: string;
  amountCents?: number;
  chargedAmountCents?: number;
  status?: "open" | "payment_processing" | "comped";
  checkoutMode?: "elements" | "custom" | "hosted";
  cacheVersion?: number;
};

function storage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function readV3CheckoutHold(nowMs = Date.now()): V3CheckoutHold | null {
  const raw = storage()?.getItem(V3_CHECKOUT_HOLD_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as V3CheckoutHold;
    if (!Number.isFinite(parsed.expiresAt) || parsed.expiresAt <= nowMs) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeV3CheckoutHold(hold: V3CheckoutHold) {
  storage()?.setItem(V3_CHECKOUT_HOLD_STORAGE_KEY, JSON.stringify(hold));
}

export function readOrResetV3CheckoutHold(nowMs = Date.now()): { expiresAt: number; reset: boolean } {
  const existing = readV3CheckoutHold(nowMs);
  if (existing) return { expiresAt: existing.expiresAt, reset: false };
  const expiresAt = nowMs + V3_CHECKOUT_HOLD_MS;
  writeV3CheckoutHold({ expiresAt });
  storage()?.removeItem(V3_CHECKOUT_SESSION_CACHE_KEY);
  storage()?.removeItem(V3_CHECKOUT_SESSION_CACHE_KEY_LEGACY);
  return { expiresAt, reset: true };
}

export function readCachedV3EmbeddedCheckout(nowMs = Date.now()): V3CachedEmbeddedCheckout | null {
  const raw = storage()?.getItem(V3_CHECKOUT_SESSION_CACHE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as V3CachedEmbeddedCheckout;
    if (!parsed.sessionId || !Number.isFinite(parsed.expiresAt) || parsed.expiresAt <= nowMs) {
      return null;
    }
    if (!isValidCachedV3EmbeddedCheckout(parsed)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Order identity for refresh recovery when the cached client secret is stale/invalid.
 * Also recovers order id/token from legacy Custom Checkout cache (v1) without reusing its secret.
 * Never stores raw photo bytes.
 */
export function readRecoverableV3CheckoutOrder(nowMs = Date.now()): {
  orderId: string;
  publicToken: string;
  sessionId?: string;
  expiresAt: number;
} | null {
  const store = storage();
  if (!store) return null;
  for (const key of [V3_CHECKOUT_SESSION_CACHE_KEY, V3_CHECKOUT_SESSION_CACHE_KEY_LEGACY]) {
    const raw = store.getItem(key);
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw) as V3CachedEmbeddedCheckout;
      const orderId = String(parsed.orderId || "").trim();
      const publicToken = String(parsed.publicToken || "").trim();
      if (!orderId || !publicToken) continue;
      if (!Number.isFinite(parsed.expiresAt) || parsed.expiresAt <= nowMs) continue;
      return {
        orderId,
        publicToken,
        sessionId: String(parsed.sessionId || "").trim() || undefined,
        expiresAt: parsed.expiresAt,
      };
    } catch {
      /* try next key */
    }
  }
  return null;
}

/** Reject Custom/legacy caches and bare cs_* session ids. */
export function isValidCachedV3EmbeddedCheckout(
  cached: Pick<
    V3CachedEmbeddedCheckout,
    "clientSecret" | "sessionId" | "publishableKey" | "checkoutMode" | "cacheVersion"
  >,
): boolean {
  if (cached.cacheVersion !== V3_CHECKOUT_CACHE_VERSION) return false;
  if (cached.checkoutMode !== V3_CHECKOUT_MODE_ELEMENTS) return false;
  const publishableKey = String(cached.publishableKey || "").trim();
  if (!publishableKey.startsWith("pk_")) return false;
  if (!isValidEmbeddedClientSecret(cached.clientSecret, cached.sessionId)) return false;
  return publishableKeyMatchesClientSecret(publishableKey, cached.clientSecret);
}

export function writeCachedV3EmbeddedCheckout(value: V3CachedEmbeddedCheckout) {
  const payload: V3CachedEmbeddedCheckout = {
    ...value,
    checkoutMode: V3_CHECKOUT_MODE_ELEMENTS,
    cacheVersion: V3_CHECKOUT_CACHE_VERSION,
  };
  storage()?.setItem(V3_CHECKOUT_SESSION_CACHE_KEY, JSON.stringify(payload));
  // Drop legacy Custom secrets so they cannot be reused as Elements.
  storage()?.removeItem(V3_CHECKOUT_SESSION_CACHE_KEY_LEGACY);
}

export function clearCachedV3EmbeddedCheckout() {
  storage()?.removeItem(V3_CHECKOUT_SESSION_CACHE_KEY);
  storage()?.removeItem(V3_CHECKOUT_SESSION_CACHE_KEY_LEGACY);
}

/** Session-scoped placeholder contact that passes createOrder validation before the customer types. */
export function v3BootstrapContact(funnelSessionId: string): { email: string; petName: string } {
  const token = funnelSessionId.replace(/[^a-z0-9]/gi, "").slice(0, 12) || "pending";
  return {
    email: `pending+${token}@checkout.thedigitalgifter.com`,
    petName: "Cat",
  };
}

export function v3PayButtonLabel(petName: string) {
  return (_payLabel: string) => {
    const name = petName.trim();
    return name.length >= 2 ? `Pay $12 & unlock ${name}'s collection` : "Pay $12 & unlock your cat's collection";
  };
}
