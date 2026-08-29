/** V2-isolated Elements checkout session cache (separate from V1/V3 keys). */

import {
  isValidEmbeddedClientSecret,
  publishableKeyMatchesClientSecret,
} from "../pet/funnelGuards";
import type { PetV2Species } from "./types";

export const V2_CHECKOUT_HOLD_STORAGE_KEY = "tdg.petFunnelV2.checkoutHold.v1";
export const V2_CHECKOUT_SESSION_CACHE_KEY = "tdg.petFunnelV2.checkoutSession.v1";
export const V2_CHECKOUT_HOLD_MS = 30 * 60 * 1000;
export const V2_CHECKOUT_CACHE_VERSION = 1;
export const V2_CHECKOUT_MODE_ELEMENTS = "elements" as const;

export type V2CheckoutHold = {
  expiresAt: number;
};

export type V2CachedEmbeddedCheckout = {
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
  funnelSessionId?: string;
  species?: PetV2Species;
};

function storage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function readV2CheckoutHold(nowMs = Date.now()): V2CheckoutHold | null {
  const raw = storage()?.getItem(V2_CHECKOUT_HOLD_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as V2CheckoutHold;
    if (!Number.isFinite(parsed.expiresAt) || parsed.expiresAt <= nowMs) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeV2CheckoutHold(hold: V2CheckoutHold) {
  storage()?.setItem(V2_CHECKOUT_HOLD_STORAGE_KEY, JSON.stringify(hold));
}

export function readOrResetV2CheckoutHold(nowMs = Date.now()): { expiresAt: number; reset: boolean } {
  const existing = readV2CheckoutHold(nowMs);
  if (existing) return { expiresAt: existing.expiresAt, reset: false };
  const expiresAt = nowMs + V2_CHECKOUT_HOLD_MS;
  writeV2CheckoutHold({ expiresAt });
  storage()?.removeItem(V2_CHECKOUT_SESSION_CACHE_KEY);
  return { expiresAt, reset: true };
}

export function readCachedV2EmbeddedCheckout(nowMs = Date.now()): V2CachedEmbeddedCheckout | null {
  const raw = storage()?.getItem(V2_CHECKOUT_SESSION_CACHE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as V2CachedEmbeddedCheckout;
    if (!parsed.sessionId || !Number.isFinite(parsed.expiresAt) || parsed.expiresAt <= nowMs) {
      return null;
    }
    if (!isValidCachedV2EmbeddedCheckout(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function readRecoverableV2CheckoutOrder(nowMs = Date.now()): {
  orderId: string;
  publicToken: string;
  sessionId?: string;
  expiresAt: number;
  species?: PetV2Species;
  funnelSessionId?: string;
} | null {
  const raw = storage()?.getItem(V2_CHECKOUT_SESSION_CACHE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as V2CachedEmbeddedCheckout;
    const orderId = String(parsed.orderId || "").trim();
    const publicToken = String(parsed.publicToken || "").trim();
    if (!orderId || !publicToken) return null;
    if (!Number.isFinite(parsed.expiresAt) || parsed.expiresAt <= nowMs) return null;
    return {
      orderId,
      publicToken,
      sessionId: String(parsed.sessionId || "").trim() || undefined,
      expiresAt: parsed.expiresAt,
      species: parsed.species,
      funnelSessionId: parsed.funnelSessionId,
    };
  } catch {
    return null;
  }
}

export function isValidCachedV2EmbeddedCheckout(
  cached: Pick<
    V2CachedEmbeddedCheckout,
    "clientSecret" | "sessionId" | "publishableKey" | "checkoutMode" | "cacheVersion"
  >,
): boolean {
  if (cached.cacheVersion !== V2_CHECKOUT_CACHE_VERSION) return false;
  if (cached.checkoutMode !== V2_CHECKOUT_MODE_ELEMENTS) return false;
  const publishableKey = String(cached.publishableKey || "").trim();
  if (!publishableKey.startsWith("pk_")) return false;
  if (!isValidEmbeddedClientSecret(cached.clientSecret, cached.sessionId)) return false;
  return publishableKeyMatchesClientSecret(publishableKey, cached.clientSecret);
}

export function writeCachedV2EmbeddedCheckout(value: V2CachedEmbeddedCheckout) {
  const payload: V2CachedEmbeddedCheckout = {
    ...value,
    checkoutMode: V2_CHECKOUT_MODE_ELEMENTS,
    cacheVersion: V2_CHECKOUT_CACHE_VERSION,
  };
  storage()?.setItem(V2_CHECKOUT_SESSION_CACHE_KEY, JSON.stringify(payload));
}

export function clearCachedV2EmbeddedCheckout() {
  storage()?.removeItem(V2_CHECKOUT_SESSION_CACHE_KEY);
}

/** Session-scoped placeholder contact — Stripe collects the real email at pay time. */
export function v2BootstrapContact(
  funnelSessionId: string,
  species: PetV2Species = "dog",
): { email: string; petName: string } {
  const token = funnelSessionId.replace(/[^a-z0-9]/gi, "").slice(0, 12) || "pending";
  const petName = species === "cat" ? "Cat" : species === "other" ? "Pet" : "Dog";
  return {
    email: `pending+${token}@checkout.thedigitalgifter.com`,
    petName,
  };
}

export function v2PayButtonLabel(payLabel: string) {
  return `Reveal My Dog’s Secret Life — ${payLabel}`;
}
