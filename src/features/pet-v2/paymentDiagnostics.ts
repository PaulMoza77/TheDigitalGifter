/**
 * Safe V2 payment / checkout diagnostic events (no card data).
 */
import { trackPetV2Event } from "./analytics";
import type { PetV2Species } from "./types";

export type V2PaymentDiagInput = {
  species: PetV2Species;
  orderId?: string | null;
  amountCents?: number | null;
  failureCategory?: string | null;
};

export function trackV2PaymentUiVisible(input: V2PaymentDiagInput): void {
  trackPetV2Event({
    eventName: "v2_payment_ui_visible",
    species: input.species,
    amountCents: input.amountCents,
    attemptId: input.orderId || undefined,
  });
}

export function trackV2PaymentAttemptStarted(input: V2PaymentDiagInput): void {
  trackPetV2Event({
    eventName: "v2_payment_attempt_started",
    species: input.species,
    amountCents: input.amountCents,
    attemptId: input.orderId || undefined,
  });
}

export function trackV2PaymentRequiresAction(input: V2PaymentDiagInput): void {
  trackPetV2Event({
    eventName: "v2_payment_requires_action",
    species: input.species,
    amountCents: input.amountCents,
    attemptId: input.orderId || undefined,
    failureCategory: input.failureCategory || "requires_action",
  });
}

export function trackV2PaymentFailed(input: V2PaymentDiagInput): void {
  trackPetV2Event({
    eventName: "v2_payment_failed",
    species: input.species,
    amountCents: input.amountCents,
    attemptId: input.orderId || undefined,
    failureCategory: input.failureCategory || "payment_failed",
  });
}

export function trackV2CheckoutAbandoned(input: V2PaymentDiagInput): void {
  trackPetV2Event({
    eventName: "v2_checkout_abandoned",
    species: input.species,
    amountCents: input.amountCents,
    attemptId: input.orderId || undefined,
  });
}

/** Coarse UA classification for diagnostics (never store raw UA in event name). */
export function classifyCheckoutBrowser(ua = typeof navigator !== "undefined" ? navigator.userAgent : ""): {
  browserFamily: "safari" | "chrome" | "firefox" | "edge" | "samsung" | "other";
  inAppBrowser: "facebook_iab" | "instagram_iab" | "other_iab" | null;
} {
  const u = String(ua || "").toLowerCase();
  const facebook = /fban|fbav|fb_iab|fbios|facebook/.test(u);
  const instagram = /instagram/.test(u);
  let inAppBrowser: "facebook_iab" | "instagram_iab" | "other_iab" | null = null;
  if (facebook) inAppBrowser = "facebook_iab";
  else if (instagram) inAppBrowser = "instagram_iab";
  else if (/; wv\)|webview/.test(u)) inAppBrowser = "other_iab";

  let browserFamily: "safari" | "chrome" | "firefox" | "edge" | "samsung" | "other" = "other";
  if (/edg\//.test(u)) browserFamily = "edge";
  else if (/samsungbrowser/.test(u)) browserFamily = "samsung";
  else if (/firefox|fxios/.test(u)) browserFamily = "firefox";
  else if (/chrome|crios|chromium/.test(u)) browserFamily = "chrome";
  else if (/safari/.test(u) && !/chrome|crios|android/.test(u)) browserFamily = "safari";

  return { browserFamily, inAppBrowser };
}
