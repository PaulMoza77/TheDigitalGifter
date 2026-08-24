export const CHECKOUT_HOLD_MS = 30 * 60 * 1000;
export const CHECKOUT_HOLD_STORAGE_KEY = "tdg.pet.checkoutHold.v1";
export const CHECKOUT_SESSION_CACHE_KEY = "tdg.pet.checkoutSession.v1";

export type CheckoutHold = {
  expiresAt: number;
};

export type CachedEmbeddedCheckout = {
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

export function formatHoldCountdown(remainingMs: number): string {
  const total = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function readCheckoutHold(nowMs = Date.now()): CheckoutHold | null {
  const raw = storage()?.getItem(CHECKOUT_HOLD_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as CheckoutHold;
    if (!Number.isFinite(parsed.expiresAt) || parsed.expiresAt <= nowMs) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeCheckoutHold(hold: CheckoutHold) {
  storage()?.setItem(CHECKOUT_HOLD_STORAGE_KEY, JSON.stringify(hold));
}

export function readOrResetCheckoutHold(nowMs = Date.now()): { expiresAt: number; reset: boolean } {
  const existing = readCheckoutHold(nowMs);
  if (existing) return { expiresAt: existing.expiresAt, reset: false };
  const expiresAt = nowMs + CHECKOUT_HOLD_MS;
  writeCheckoutHold({ expiresAt });
  storage()?.removeItem(CHECKOUT_SESSION_CACHE_KEY);
  return { expiresAt, reset: true };
}

export function readCachedEmbeddedCheckout(nowMs = Date.now()): CachedEmbeddedCheckout | null {
  const raw = storage()?.getItem(CHECKOUT_SESSION_CACHE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as CachedEmbeddedCheckout;
    if (!parsed.sessionId || !Number.isFinite(parsed.expiresAt) || parsed.expiresAt <= nowMs) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeCachedEmbeddedCheckout(value: CachedEmbeddedCheckout) {
  storage()?.setItem(CHECKOUT_SESSION_CACHE_KEY, JSON.stringify(value));
}

export function checkoutPreparingHeadline(petName: string): string {
  const name = petName.trim() || "your pet";
  return `Your “${name}” secret lives are preparing now.`;
}

export function remainingHoldMs(expiresAt: number, nowMs = Date.now()): number {
  return Math.max(0, expiresAt - nowMs);
}
