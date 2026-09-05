import { describe, expect, it } from "vitest";
import {
  shouldShowGiftTreeCheckoutStarting,
  shouldShowGiftTreePaymentSheet,
} from "./giftTreeCheckoutUi";

describe("gift tree checkout UI", () => {
  it("always shows the payment sheet when a client secret exists", () => {
    expect(
      shouldShowGiftTreePaymentSheet({
        checkout: { clientSecret: "cs_test_secret" },
      }),
    ).toBe(true);
  });

  it("does not require revealStep gating (regression: sheet was hidden on checkout step)", () => {
    // Historical bug: `checkout && revealStep !== "checkout"` hid payment after pack select.
    expect(
      shouldShowGiftTreePaymentSheet({
        checkout: { clientSecret: "cs_live_x" },
      }),
    ).toBe(true);
  });

  it("shows starting overlay only while purchasing without a session", () => {
    expect(shouldShowGiftTreeCheckoutStarting({ purchasing: true, checkout: null })).toBe(true);
    expect(
      shouldShowGiftTreeCheckoutStarting({
        purchasing: true,
        checkout: { clientSecret: "cs_x" },
      }),
    ).toBe(false);
  });
});
