/** @vitest-environment jsdom */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  isStripeHostedCheckoutUrl,
  openHostedStripeCheckout,
} from "./openHostedStripeCheckout";

describe("openHostedStripeCheckout", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "open",
      vi.fn(() => ({ focus: vi.fn() })),
    );
    vi.stubGlobal("location", {
      assign: vi.fn(),
      href: "https://thedigitalgifter.com/pet/dog-v2",
      origin: "https://thedigitalgifter.com",
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("accepts only checkout.stripe.com URLs", () => {
    expect(isStripeHostedCheckoutUrl("https://checkout.stripe.com/c/pay/cs_live_x")).toBe(true);
    expect(isStripeHostedCheckoutUrl("https://evil.example/checkout.stripe.com")).toBe(false);
  });

  it("opens a new tab when preferNewTab is allowed", () => {
    const url = "https://checkout.stripe.com/c/pay/cs_live_abc";
    expect(openHostedStripeCheckout(url, { preferNewTab: true })).toBe("new_tab");
    expect(window.open).toHaveBeenCalledWith(url, "_blank", "noopener,noreferrer");
    expect(window.location.assign).not.toHaveBeenCalled();
  });

  it("falls back to same-tab when the popup is blocked", () => {
    vi.stubGlobal("open", vi.fn(() => null));
    const url = "https://checkout.stripe.com/c/pay/cs_live_abc";
    expect(openHostedStripeCheckout(url, { preferNewTab: true })).toBe("same_tab");
    expect(window.location.assign).toHaveBeenCalledWith(url);
  });

  it("uses same-tab when preferNewTab is false", () => {
    const url = "https://checkout.stripe.com/c/pay/cs_live_abc";
    expect(openHostedStripeCheckout(url, { preferNewTab: false })).toBe("same_tab");
    expect(window.open).not.toHaveBeenCalled();
    expect(window.location.assign).toHaveBeenCalledWith(url);
  });
});
