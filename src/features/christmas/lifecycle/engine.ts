/**
 * Christmas commerce lifecycle — pure eligibility + idempotency helpers.
 * Emails are consequences of authoritative order payment/fulfillment states.
 * Secondary loop only — does not cover /send-a-gift or /christmas/gifts.
 */

import type { ChristmasLocale } from "../catalog";
import type {
  ChristmasFulfillmentStatus,
  ChristmasPaymentStatus,
} from "../orderStatus";

export const CHRISTMAS_LIFECYCLE_TEMPLATES = [
  "payment_confirmation",
  "generation_started",
  "generation_ready",
  "generation_failed",
  "abandoned_checkout",
  "cross_sell",
] as const;
export type ChristmasLifecycleTemplate =
  (typeof CHRISTMAS_LIFECYCLE_TEMPLATES)[number];

export type LifecycleCategory = "transactional" | "marketing";

export type LifecycleOrderSnapshot = {
  id: string;
  productKey: string;
  packageKey: string;
  paymentStatus: ChristmasPaymentStatus;
  fulfillmentStatus: ChristmasFulfillmentStatus;
  amountCents: number;
  currency: string;
  email: string | null;
  locale: string | null;
  publicTokenHint: string | null;
  sourceRoute: string | null;
  stripeCheckoutSessionId: string | null;
  createdAt: string;
  paidAt: string | null;
  generationStartedAt: string | null;
  generationFinishedAt: string | null;
  lastError: string | null;
  purchasableTargetKeys?: string[];
};

/** Authoritative commerce state machine (actual DB enums). */
export const CHRISTMAS_COMMERCE_STATE_MACHINE = {
  payment: ["draft", "pending", "paid", "failed", "refunded"] as const,
  fulfillment: [
    "not_started",
    "queued",
    "processing",
    "completed",
    "failed",
  ] as const,
} as const;

export function normalizeLifecycleLocale(
  value: string | null | undefined,
): ChristmasLocale {
  const raw = String(value || "")
    .trim()
    .toLowerCase();
  if (raw === "ro" || raw.startsWith("ro")) return "ro";
  return "en";
}

export function lifecycleEventKey(
  template: ChristmasLifecycleTemplate,
  orderId: string,
  suffix = "",
): string {
  const base = `order:${orderId}:${template}`;
  return suffix ? `${base}:${suffix}` : base;
}

export function templateCategory(
  template: ChristmasLifecycleTemplate,
): LifecycleCategory {
  if (template === "abandoned_checkout" || template === "cross_sell") {
    return "marketing";
  }
  return "transactional";
}

/** Santa video is long-running — worth a "started" email. Portrait packs usually finish quickly. */
export function shouldSendGenerationStarted(productKey: string): boolean {
  return productKey === "christmas_santa_video";
}

export function isTerminalFulfillmentFailure(
  fulfillmentStatus: ChristmasFulfillmentStatus,
  attemptCount: number,
  maxAttempts = 3,
): boolean {
  return fulfillmentStatus === "failed" && attemptCount >= maxAttempts;
}

export function isRetryableGenerationFailure(
  fulfillmentStatus: ChristmasFulfillmentStatus,
  attemptCount: number,
  maxAttempts = 3,
): boolean {
  return fulfillmentStatus === "failed" && attemptCount < maxAttempts;
}

export type AbandonedEligibility = {
  eligible: boolean;
  reason: string;
};

/**
 * Abandoned checkout: pending payment, aged past delay, has email, not paid/refunded.
 * delayMs comes from env/config — never hardwire in callers.
 */
export function evaluateAbandonedCheckout(
  order: LifecycleOrderSnapshot,
  nowMs: number,
  delayMs: number,
): AbandonedEligibility {
  if (!order.email) {
    return { eligible: false, reason: "missing_email" };
  }
  if (order.paymentStatus === "paid") {
    return { eligible: false, reason: "already_paid" };
  }
  if (order.paymentStatus === "refunded") {
    return { eligible: false, reason: "refunded" };
  }
  if (order.paymentStatus === "failed") {
    return { eligible: false, reason: "failed_checkout" };
  }
  if (order.paymentStatus !== "pending" && order.paymentStatus !== "draft") {
    return { eligible: false, reason: "not_pending" };
  }
  const created = Date.parse(order.createdAt);
  if (!Number.isFinite(created)) {
    return { eligible: false, reason: "bad_created_at" };
  }
  if (nowMs - created < delayMs) {
    return { eligible: false, reason: "too_recent" };
  }
  return { eligible: true, reason: "eligible" };
}

export type CrossSellPlan = {
  ok: boolean;
  targetProductKey: string | null;
  reason: string;
};

const CROSS_SELL_MAP: Record<string, string[]> = {
  christmas_photo: ["christmas_santa_video", "christmas_card"],
  christmas_family: ["christmas_santa_video", "christmas_card"],
  christmas_couple: ["christmas_card", "christmas_santa_video"],
  christmas_pet: ["christmas_card"],
  christmas_santa_video: ["christmas_photo", "christmas_card"],
  christmas_card: ["christmas_santa_video", "christmas_photo"],
};

/**
 * Only advertise targets that are explicitly purchasable/live.
 * When commercial gates are off, engine returns no offer.
 */
export function planCrossSell(
  sourceProductKey: string,
  livePurchasableKeys: string[],
): CrossSellPlan {
  const candidates = CROSS_SELL_MAP[sourceProductKey] || [];
  const live = new Set(livePurchasableKeys);
  const target = candidates.find((k) => live.has(k)) || null;
  if (!target) {
    return {
      ok: false,
      targetProductKey: null,
      reason: live.size === 0 ? "no_live_purchasable_targets" : "no_mapped_live_target",
    };
  }
  return { ok: true, targetProductKey: target, reason: "ok" };
}

export function recoveryPathForOrder(order: {
  productKey: string;
  sourceRoute: string | null;
}): string {
  if (order.sourceRoute && order.sourceRoute.startsWith("/christmas/")) {
    return order.sourceRoute.split("?")[0];
  }
  if (order.productKey === "christmas_santa_video") return "/christmas/santa-video";
  if (order.productKey === "christmas_card") return "/christmas/cards";
  if (order.productKey === "christmas_family") return "/christmas/family";
  if (order.productKey === "christmas_couple") return "/christmas/couples";
  if (order.productKey === "christmas_pet") return "/christmas/pets";
  return "/christmas/photo-generator";
}

/** Safe app resume URL — never includes Stripe secrets or client secrets. */
export function buildResumeUrl(input: {
  siteOrigin: string;
  path: string;
  orderId: string;
  locale: ChristmasLocale;
}): string {
  const base = input.siteOrigin.replace(/\/$/, "");
  const path = input.path.startsWith("/") ? input.path : `/${input.path}`;
  const params = new URLSearchParams({
    resume: "1",
    order: input.orderId,
    lang: input.locale,
  });
  return `${base}${path}?${params.toString()}`;
}

export function buildResultUrl(input: {
  siteOrigin: string;
  path: string;
  publicTokenHint: string;
  locale: ChristmasLocale;
}): string {
  const base = input.siteOrigin.replace(/\/$/, "");
  const path = input.path.startsWith("/") ? input.path : `/${input.path}`;
  const params = new URLSearchParams({
    token: input.publicTokenHint,
    lang: input.locale,
  });
  return `${base}${path}?${params.toString()}`;
}

export function normalizeEmail(email: string | null | undefined): string | null {
  const v = String(email || "")
    .trim()
    .toLowerCase();
  return v.includes("@") ? v : null;
}

export function defaultAbandonedDelayMs(envValue?: string | null): number {
  const parsed = Number(envValue);
  if (Number.isFinite(parsed) && parsed >= 5 * 60 * 1000) return parsed;
  return 45 * 60 * 1000; // 45 minutes
}

export function marketingSendsEnabled(envValue?: string | null): boolean {
  return String(envValue || "").trim().toLowerCase() === "true";
}

export function lifecycleDryRun(envValue?: string | null): boolean {
  const v = String(envValue || "").trim().toLowerCase();
  if (v === "false" || v === "0") return false;
  // Safe default: dry-run unless explicitly disabled.
  return v !== "false";
}
