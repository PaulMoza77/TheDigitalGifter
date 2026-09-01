import { describe, expect, it, vi } from "vitest";
import { logExpressCheckoutReady, resolveExpressCheckoutClick } from "./expressCheckoutConfirm";

describe("resolveExpressCheckoutClick", () => {
  it("marks interaction then resolve() so Apple Pay can open", () => {
    const resolve = vi.fn();
    const onInteraction = vi.fn();
    resolveExpressCheckoutClick({ resolve } as never, onInteraction);
    expect(onInteraction).toHaveBeenCalledTimes(1);
    expect(resolve).toHaveBeenCalledTimes(1);
    expect(onInteraction.mock.invocationCallOrder[0]).toBeLessThan(resolve.mock.invocationCallOrder[0]);
  });
});

describe("logExpressCheckoutReady", () => {
  it("logs wallet availability without secrets", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    logExpressCheckoutReady({
      elementType: "expressCheckout",
      availablePaymentMethods: {
        applePay: false,
        googlePay: false,
        link: true,
        amazonPay: false,
        paypal: false,
        klarna: false,
      },
    });
    expect(info).toHaveBeenCalledWith("[express-checkout-ready]", {
      applePay: false,
      googlePay: false,
      link: true,
    });
    info.mockRestore();
  });
});
