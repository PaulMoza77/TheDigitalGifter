/**
 * Christmas lifecycle — pure domain logic (no I/O).
 * Emails are consequences of authoritative order state transitions.
 */

import type { ChristmasLocale } from "../catalog";
import { normalizeChristmasLocale } from "../i18n/resolveLocale";

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

export const LIFECYCLE_TEMPLATE_CATEGORY: Record<
  ChristmasLifecycleTemplate,
  LifecycleCategory
> = {
  payment_confirmation: "transactional",
  generation_started: "transactional",
  generation_ready: "transactional",
  generation_failed: "transactional",
  abandoned_checkout: "marketing",
  cross_sell: "marketing",
};

/** Actual christmas_orders state machine (from migration constraints). */
export const CHRISTMAS_ORDER_STATE_MACHINE = {
  payment: ["draft", "pending", "paid", "failed", "refunded"] as const,
  fulfillment: [
    "not_started",
    "queued",
    "processing",
    "completed",
    "failed",
  ] as const,
};

export type ChristmasOrderLifecycleView = {
  id: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  productKey: string;
  packageKey: string;
  amountCents: number;
  currency: string;
  locale: string | null;
  email: string | null;
  createdAt: string;
  paidAt: string | null;
  checkoutStartedAt?: string | null;
  publicTokenHint?: string | null;
  sourceRoute?: string | null;
  purchasableTarget?: boolean;
};

export function resolvePersistedOrderLocale(
  locale: string | null | undefined,
): ChristmasLocale {
  return normalizeChristmasLocale(locale || "en");
}

export function lifecycleEventKey(
  template: ChristmasLifecycleTemplate,
  orderId: string,
  suffix?: string,
): string {
  const base = `order:${orderId}:${template}`;
  return suffix ? `${base}:${suffix}` : base;
}

/** Near-instant photo: skip started email. Long Santa video: send once when queued. */
export function shouldSendGenerationStarted(productKey: string): boolean {
  return productKey === "christmas_santa_video";
}

export function abandonedCheckoutEligibility(input: {
  order: ChristmasOrderLifecycleView;
  nowMs: number;
  delayMs: number;
}): { eligible: boolean; reason: string } {
  const { order, nowMs, delayMs } = input;
  if (order.paymentStatus === "paid") {
    return { eligible: false, reason: "already_paid" };
  }
  if (order.paymentStatus === "refunded") {
    return { eligible: false, reason: "refunded" };
  }
  if (order.paymentStatus === "failed") {
    return { eligible: false, reason: "failed" };
  }
  if (order.paymentStatus !== "pending" && order.paymentStatus !== "draft") {
    return { eligible: false, reason: "not_checkout_pending" };
  }
  if (!order.email) {
    return { eligible: false, reason: "no_email" };
  }
  const started = Date.parse(
    order.checkoutStartedAt || order.createdAt || "",
  );
  if (!Number.isFinite(started)) {
    return { eligible: false, reason: "invalid_created_at" };
  }
  if (nowMs - started < delayMs) {
    return { eligible: false, reason: "too_recent" };
  }
  return { eligible: true, reason: "eligible" };
}

/** Default abandoned delay: 45 minutes (configurable via env in runners). */
export const DEFAULT_ABANDONED_CHECKOUT_DELAY_MS = 45 * 60 * 1000;

/**
 * Cross-sell targets — only when target is live/purchasable.
 * live_send_enabled must still be false until commercial gates open.
 */
export const CHRISTMAS_CROSS_SELL_MAP: Record<string, string[]> = {
  christmas_photo: ["christmas_santa_video", "christmas_card"],
  christmas_family: ["christmas_santa_video", "christmas_card"],
  christmas_couple: ["christmas_card", "christmas_santa_video"],
  christmas_pet: ["christmas_card"],
  christmas_santa_video: ["christmas_photo", "christmas_card"],
  christmas_card: ["christmas_photo"],
};

export function crossSellTargets(input: {
  productKey: string;
  liveProductKeys: Set<string>;
}): string[] {
  const candidates = CHRISTMAS_CROSS_SELL_MAP[input.productKey] || [];
  return candidates.filter((key) => input.liveProductKeys.has(key));
}

export type LifecycleEmailCopy = {
  subject: string;
  htmlBody: string;
  textBody: string;
};

function esc(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function lifecycleEmailCopy(
  template: ChristmasLifecycleTemplate,
  locale: ChristmasLocale,
  vars: {
    productName: string;
    amountLabel?: string;
    orderRef?: string;
    resultUrl?: string;
    resumeUrl?: string;
    crossSellName?: string;
    crossSellUrl?: string;
    unsubscribeUrl?: string;
  },
): LifecycleEmailCopy {
  const ro = locale === "ro";
  const product = vars.productName;
  const amount = vars.amountLabel || "";
  const ref = vars.orderRef || "";

  switch (template) {
    case "payment_confirmation": {
      const subject = ro
        ? `Plata confirmată — ${product}`
        : `Payment confirmed — ${product}`;
      const body = ro
        ? `<p>Plata ta pentru <strong>${esc(product)}</strong>${amount ? ` (${esc(amount)})` : ""} a fost confirmată.</p><p>Pregătim generarea. Îți vom trimite un email când rezultatul este gata.</p><p>Referință comandă: ${esc(ref)}</p><p>— The Digital Gifter</p>`
        : `<p>Your payment for <strong>${esc(product)}</strong>${amount ? ` (${esc(amount)})` : ""} is confirmed.</p><p>We're preparing generation. We'll email you when your result is ready.</p><p>Order reference: ${esc(ref)}</p><p>— The Digital Gifter</p>`;
      return { subject, htmlBody: body, textBody: body.replace(/<[^>]+>/g, "") };
    }
    case "generation_started": {
      const subject = ro
        ? `Generăm ${product}…`
        : `Creating your ${product}…`;
      const body = ro
        ? `<p>Am început generarea pentru <strong>${esc(product)}</strong>. Pentru video, poate dura câteva minute.</p><p>— The Digital Gifter</p>`
        : `<p>We've started creating your <strong>${esc(product)}</strong>. Video can take a few minutes.</p><p>— The Digital Gifter</p>`;
      return { subject, htmlBody: body, textBody: body.replace(/<[^>]+>/g, "") };
    }
    case "generation_ready": {
      const subject = ro
        ? `${product} este gata`
        : `Your ${product} is ready`;
      const link = vars.resultUrl || "#";
      const body = ro
        ? `<p><strong>${esc(product)}</strong> este gata.</p><p><a href="${esc(link)}">Deschide rezultatul</a></p><p>— The Digital Gifter</p>`
        : `<p>Your <strong>${esc(product)}</strong> is ready.</p><p><a href="${esc(link)}">Open your result</a></p><p>— The Digital Gifter</p>`;
      return { subject, htmlBody: body, textBody: body.replace(/<[^>]+>/g, "") };
    }
    case "generation_failed": {
      const subject = ro
        ? `Nu am putut finaliza ${product}`
        : `We couldn't finish your ${product}`;
      const body = ro
        ? `<p>Nu am putut finaliza <strong>${esc(product)}</strong> după mai multe încercări. Echipa noastră a fost notificată. Dacă ai plătit, nu vei fi taxat din nou pentru reîncercare.</p><p>Referință: ${esc(ref)}</p><p>— The Digital Gifter</p>`
        : `<p>We couldn't finish your <strong>${esc(product)}</strong> after several attempts. Our team has been notified. If you paid, you won't be charged again for a retry.</p><p>Reference: ${esc(ref)}</p><p>— The Digital Gifter</p>`;
      return { subject, htmlBody: body, textBody: body.replace(/<[^>]+>/g, "") };
    }
    case "abandoned_checkout": {
      const subject = ro
        ? `Mai vrei să finalizezi ${product}?`
        : `Still want to finish your ${product}?`;
      const link = vars.resumeUrl || "#";
      const unsub = vars.unsubscribeUrl || "/unsubscribe";
      const body = ro
        ? `<p>Ai început checkout-ul pentru <strong>${esc(product)}</strong>, dar plata nu s-a finalizat.</p><p><a href="${esc(link)}">Reia acolo unde ai rămas</a></p><p>Dacă ai plătit deja, ignoră acest mesaj.</p><p style="font-size:12px;opacity:.8"><a href="${esc(unsub)}">Dezabonare</a></p><p>— The Digital Gifter</p>`
        : `<p>You started checkout for <strong>${esc(product)}</strong>, but payment wasn't completed.</p><p><a href="${esc(link)}">Resume where you left off</a></p><p>If you already paid, please ignore this message.</p><p style="font-size:12px;opacity:.8"><a href="${esc(unsub)}">Unsubscribe</a></p><p>— The Digital Gifter</p>`;
      return { subject, htmlBody: body, textBody: body.replace(/<[^>]+>/g, "") };
    }
    case "cross_sell": {
      const name = vars.crossSellName || "Christmas";
      const link = vars.crossSellUrl || "#";
      const unsub = vars.unsubscribeUrl || "/unsubscribe";
      const subject = ro
        ? `Poate îți place și: ${name}`
        : `You might also like: ${name}`;
      const body = ro
        ? `<p>Mulțumim pentru comandă! Descoperă și <strong>${esc(name)}</strong>.</p><p><a href="${esc(link)}">Vezi produsul</a></p><p style="font-size:12px;opacity:.8"><a href="${esc(unsub)}">Dezabonare</a></p><p>— The Digital Gifter</p>`
        : `<p>Thanks for your order! You might also like <strong>${esc(name)}</strong>.</p><p><a href="${esc(link)}">See the product</a></p><p style="font-size:12px;opacity:.8"><a href="${esc(unsub)}">Unsubscribe</a></p><p>— The Digital Gifter</p>`;
      return { subject, htmlBody: body, textBody: body.replace(/<[^>]+>/g, "") };
    }
    default: {
      const _exhaustive: never = template;
      void _exhaustive;
      return {
        subject: "The Digital Gifter",
        htmlBody: "<p>The Digital Gifter</p>",
        textBody: "The Digital Gifter",
      };
    }
  }
}

export function marketingSendAllowed(input: {
  marketingEnabled: boolean;
  marketingConsent: boolean | null;
}): { ok: boolean; reason: string } {
  if (!input.marketingEnabled) {
    return { ok: false, reason: "marketing_live_disabled" };
  }
  if (input.marketingConsent === false) {
    return { ok: false, reason: "marketing_suppressed" };
  }
  return { ok: true, reason: "allowed" };
}

/** Public product landing paths for cross-sell CTAs (no secrets). */
export function productLandingPath(productKey: string): string {
  switch (productKey) {
    case "christmas_santa_video":
      return "/christmas/santa-video";
    case "christmas_card":
      return "/christmas/cards";
    case "christmas_family":
      return "/christmas/family";
    case "christmas_couple":
      return "/christmas/couples";
    case "christmas_pet":
      return "/christmas/pets";
    case "christmas_photo":
    default:
      return "/christmas/photo-generator";
  }
}

/** Opaque resume path — never includes Stripe secrets. */
export function abandonedResumePath(order: ChristmasOrderLifecycleView): string {
  const route = order.sourceRoute || productLandingPath(order.productKey);
  const base = route.startsWith("/") ? route : `/${route}`;
  return `${base}?resume=1&order=${encodeURIComponent(order.id)}`;
}

export function resultAccessPath(order: ChristmasOrderLifecycleView): string {
  const route = order.sourceRoute || productLandingPath(order.productKey);
  const base = route.startsWith("/") ? route : `/${route}`;
  const token = order.publicTokenHint;
  if (token) return `${base}?token=${encodeURIComponent(token)}`;
  return `${base}?order=${encodeURIComponent(order.id)}`;
}
