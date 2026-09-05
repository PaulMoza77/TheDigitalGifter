import { describe, expect, it } from "vitest";
import {
  abandonedCheckoutEligibility,
  abandonedResumePath,
  crossSellTargets,
  DEFAULT_ABANDONED_CHECKOUT_DELAY_MS,
  lifecycleEmailCopy,
  lifecycleEventKey,
  marketingSendAllowed,
  productLandingPath,
  resolvePersistedOrderLocale,
  shouldSendGenerationStarted,
  type ChristmasOrderLifecycleView,
} from "./lifecycleCore";

function order(
  overrides: Partial<ChristmasOrderLifecycleView> = {},
): ChristmasOrderLifecycleView {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    paymentStatus: "pending",
    fulfillmentStatus: "not_started",
    productKey: "christmas_photo",
    packageKey: "single",
    amountCents: 0,
    currency: "usd",
    locale: "en",
    email: "user@example.com",
    createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    paidAt: null,
    sourceRoute: "/christmas/photo-generator",
    publicTokenHint: "abc",
    ...overrides,
  };
}

describe("christmas lifecycle core", () => {
  it("resolves persisted locale with EN fallback", () => {
    expect(resolvePersistedOrderLocale("ro")).toBe("ro");
    expect(resolvePersistedOrderLocale(null)).toBe("en");
    expect(resolvePersistedOrderLocale("xx")).toBe("en");
  });

  it("builds unique event keys", () => {
    expect(lifecycleEventKey("payment_confirmation", "oid")).toBe(
      "order:oid:payment_confirmation",
    );
    expect(lifecycleEventKey("cross_sell", "oid", "christmas_card")).toBe(
      "order:oid:cross_sell:christmas_card",
    );
  });

  it("sends generation_started only for Santa video", () => {
    expect(shouldSendGenerationStarted("christmas_santa_video")).toBe(true);
    expect(shouldSendGenerationStarted("christmas_photo")).toBe(false);
  });

  it("EN/RO transactional copy without cross-locale leakage", () => {
    const en = lifecycleEmailCopy("payment_confirmation", "en", {
      productName: "Christmas Portrait",
      amountLabel: "$0.00",
      orderRef: "oid",
    });
    const ro = lifecycleEmailCopy("payment_confirmation", "ro", {
      productName: "Portret de Crăciun",
      amountLabel: "0,00 USD",
      orderRef: "oid",
    });
    expect(en.subject).toMatch(/Payment confirmed/i);
    expect(ro.subject).toMatch(/Plata confirmată/i);
    expect(en.subject).not.toBe(ro.subject);
  });

  it("abandoned checkout eligibility respects pay/cancel/window", () => {
    const now = Date.now();
    const delay = DEFAULT_ABANDONED_CHECKOUT_DELAY_MS;
    expect(
      abandonedCheckoutEligibility({
        order: order({
          createdAt: new Date(now - delay - 1000).toISOString(),
        }),
        nowMs: now,
        delayMs: delay,
      }).eligible,
    ).toBe(true);
    expect(
      abandonedCheckoutEligibility({
        order: order({ paymentStatus: "paid" }),
        nowMs: now,
        delayMs: delay,
      }).reason,
    ).toBe("already_paid");
    expect(
      abandonedCheckoutEligibility({
        order: order({
          createdAt: new Date(now - 60_000).toISOString(),
        }),
        nowMs: now,
        delayMs: delay,
      }).reason,
    ).toBe("too_recent");
    expect(
      abandonedCheckoutEligibility({
        order: order({ paymentStatus: "failed" }),
        nowMs: now,
        delayMs: delay,
      }).eligible,
    ).toBe(false);
  });

  it("resume URL never embeds Stripe secrets", () => {
    const path = abandonedResumePath(order());
    expect(path).toContain("resume=1");
    expect(path).toContain("order=");
    expect(path).not.toMatch(/cs_live|client_secret|sk_/i);
  });

  it("product landing paths are public routes without secrets", () => {
    expect(productLandingPath("christmas_santa_video")).toBe(
      "/christmas/santa-video",
    );
    expect(productLandingPath("christmas_card")).toBe("/christmas/cards");
    expect(abandonedResumePath(order({ sourceRoute: null }))).toContain(
      "photo-generator",
    );
    expect(productLandingPath("unknown")).not.toMatch(/secret|sk_/i);
  });

  it("cross-sell never offers disabled products", () => {
    const live = new Set(["christmas_card"]);
    expect(
      crossSellTargets({
        productKey: "christmas_photo",
        liveProductKeys: live,
      }),
    ).toEqual(["christmas_card"]);
    expect(
      crossSellTargets({
        productKey: "christmas_photo",
        liveProductKeys: new Set(),
      }),
    ).toEqual([]);
  });

  it("marketing suppression blocks abandoned/cross-sell", () => {
    expect(
      marketingSendAllowed({
        marketingEnabled: false,
        marketingConsent: true,
      }).ok,
    ).toBe(false);
    expect(
      marketingSendAllowed({
        marketingEnabled: true,
        marketingConsent: false,
      }).reason,
    ).toBe("marketing_suppressed");
    expect(
      marketingSendAllowed({
        marketingEnabled: true,
        marketingConsent: true,
      }).ok,
    ).toBe(true);
  });

  it("marketing copy includes unsubscribe seam", () => {
    const copy = lifecycleEmailCopy("abandoned_checkout", "en", {
      productName: "Portrait",
      resumeUrl: "https://example.com/r",
      unsubscribeUrl: "https://example.com/unsubscribe",
    });
    expect(copy.htmlBody).toMatch(/unsubscribe/i);
  });
});
