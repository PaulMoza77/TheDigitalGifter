import { describe, expect, it } from "vitest";
import {
  evaluateAbandonedCheckout,
  lifecycleEventKey,
  normalizeLifecycleLocale,
  planCrossSell,
  shouldSendGenerationStarted,
  templateCategory,
  buildResumeUrl,
  isRetryableGenerationFailure,
  isTerminalFulfillmentFailure,
  marketingSendsEnabled,
  lifecycleDryRun,
  type LifecycleOrderSnapshot,
} from "./engine";
import {
  paymentConfirmationCopy,
  generationReadyCopy,
  generationFailedCopy,
} from "./copy";

function baseOrder(
  overrides: Partial<LifecycleOrderSnapshot> = {},
): LifecycleOrderSnapshot {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    productKey: "christmas_photo",
    packageKey: "single",
    paymentStatus: "pending",
    fulfillmentStatus: "not_started",
    amountCents: 0,
    currency: "usd",
    email: "buyer@example.com",
    locale: "en",
    publicTokenHint: "tokensecret",
    sourceRoute: "/christmas/photo-generator",
    stripeCheckoutSessionId: "cs_test",
    createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    paidAt: null,
    generationStartedAt: null,
    generationFinishedAt: null,
    lastError: null,
    ...overrides,
  };
}

describe("christmas lifecycle engine", () => {
  it("normalizes locale and builds idempotent event keys", () => {
    expect(normalizeLifecycleLocale("ro-RO")).toBe("ro");
    expect(normalizeLifecycleLocale(null)).toBe("en");
    expect(lifecycleEventKey("payment_confirmation", "abc")).toBe(
      "order:abc:payment_confirmation",
    );
    expect(templateCategory("abandoned_checkout")).toBe("marketing");
    expect(templateCategory("payment_confirmation")).toBe("transactional");
  });

  it("sends generation_started only for Santa video", () => {
    expect(shouldSendGenerationStarted("christmas_santa_video")).toBe(true);
    expect(shouldSendGenerationStarted("christmas_photo")).toBe(false);
  });

  it("evaluates abandoned checkout eligibility", () => {
    const delay = 45 * 60 * 1000;
    const now = Date.now();
    expect(
      evaluateAbandonedCheckout(baseOrder(), now, delay).eligible,
    ).toBe(true);
    expect(
      evaluateAbandonedCheckout(
        baseOrder({ paymentStatus: "paid" }),
        now,
        delay,
      ).reason,
    ).toBe("already_paid");
    expect(
      evaluateAbandonedCheckout(
        baseOrder({
          createdAt: new Date(now - 60_000).toISOString(),
        }),
        now,
        delay,
      ).reason,
    ).toBe("too_recent");
    expect(
      evaluateAbandonedCheckout(baseOrder({ email: null }), now, delay).reason,
    ).toBe("missing_email");
  });

  it("guards cross-sell against non-purchasable targets", () => {
    expect(planCrossSell("christmas_photo", []).ok).toBe(false);
    expect(
      planCrossSell("christmas_photo", ["christmas_santa_video"]).targetProductKey,
    ).toBe("christmas_santa_video");
  });

  it("classifies retryable vs terminal generation failure", () => {
    expect(isRetryableGenerationFailure("failed", 1)).toBe(true);
    expect(isTerminalFulfillmentFailure("failed", 3)).toBe(true);
    expect(isTerminalFulfillmentFailure("failed", 1)).toBe(false);
  });

  it("defaults marketing off and dry-run on", () => {
    expect(marketingSendsEnabled(undefined)).toBe(false);
    expect(marketingSendsEnabled("true")).toBe(true);
    expect(lifecycleDryRun(undefined)).toBe(true);
    expect(lifecycleDryRun("false")).toBe(false);
  });

  it("builds safe resume URLs without secrets", () => {
    const url = buildResumeUrl({
      siteOrigin: "https://www.thedigitalgifter.com",
      path: "/christmas/photo-generator",
      orderId: "11111111-1111-4111-8111-111111111111",
      locale: "ro",
    });
    expect(url).toContain("resume=1");
    expect(url).toContain("lang=ro");
    expect(url).not.toContain("cs_");
    expect(url).not.toContain("secret");
  });
});

describe("christmas lifecycle copy locale", () => {
  it("renders EN and RO payment + ready emails without cross-locale leakage", () => {
    const enPay = paymentConfirmationCopy("en", {
      productName: "Christmas AI Photo",
      amountCents: 1200,
      currency: "usd",
      orderId: "11111111-1111-4111-8111-111111111111",
      nextStepUrl: "https://example.com/x",
    });
    const roPay = paymentConfirmationCopy("ro", {
      productName: "Portret Crăciun",
      amountCents: 1200,
      currency: "usd",
      orderId: "11111111-1111-4111-8111-111111111111",
      nextStepUrl: "https://example.com/x",
    });
    expect(enPay.subject).toMatch(/confirmed/i);
    expect(roPay.subject).toMatch(/confirmat/i);
    expect(enPay.subject).not.toBe(roPay.subject);

    const enReady = generationReadyCopy(null, {
      productName: "Portrait",
      resultUrl: "https://example.com/r?token=abc",
    });
    const roReady = generationReadyCopy("ro", {
      productName: "Portret",
      resultUrl: "https://example.com/r?token=abc",
    });
    expect(enReady.subject).toMatch(/ready/i);
    expect(roReady.subject).toMatch(/gata/i);

    const fail = generationFailedCopy("en", {
      productName: "Portrait",
      statusUrl: "https://example.com/s",
      terminal: false,
    });
    expect(fail.html.toLowerCase()).not.toContain("stack");
    expect(fail.html.toLowerCase()).not.toContain("replicate");
  });
});
