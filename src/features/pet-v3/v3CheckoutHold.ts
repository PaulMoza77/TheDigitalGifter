/** V3-isolated embedded checkout session cache (separate from V1 keys). */

export const V3_CHECKOUT_HOLD_STORAGE_KEY = "tdg.petFunnelV3.checkoutHold.v1";
export const V3_CHECKOUT_SESSION_CACHE_KEY = "tdg.petFunnelV3.checkoutSession.v1";
export const V3_CHECKOUT_HOLD_MS = 30 * 60 * 1000;

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
      storage()?.removeItem(V3_CHECKOUT_SESSION_CACHE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/** Reject bare cs_* session ids and other invalid values stored as clientSecret. */
export function isValidCachedV3EmbeddedCheckout(
  cached: Pick<V3CachedEmbeddedCheckout, "clientSecret" | "sessionId" | "publishableKey">,
): boolean {
  const publishableKey = String(cached.publishableKey || "").trim();
  if (!publishableKey.startsWith("pk_")) return false;
  return isValidEmbeddedClientSecret(cached.clientSecret, cached.sessionId);
}

export function isValidEmbeddedClientSecret(
  clientSecret: string | null | undefined,
  sessionId?: string | null,
): boolean {
  const secret = String(clientSecret || "").trim();
  if (!secret) return false;
  if (!/^cs_(live|test)_/.test(secret)) return false;
  if (!secret.includes("_secret_")) return false;
  const sid = String(sessionId || "").trim();
  if (sid && secret === sid) return false;
  return true;
}

export function writeCachedV3EmbeddedCheckout(value: V3CachedEmbeddedCheckout) {
  storage()?.setItem(V3_CHECKOUT_SESSION_CACHE_KEY, JSON.stringify(value));
}

export function clearCachedV3EmbeddedCheckout() {
  storage()?.removeItem(V3_CHECKOUT_SESSION_CACHE_KEY);
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
