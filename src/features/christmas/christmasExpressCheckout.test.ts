import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { christmasCheckoutEnabled } from "./checkout";
import { CHRISTMAS_FUNNEL_ALLOWED_EVENTS } from "./funnelEventContract";
import { CHRISTMAS_V2_EVENTS } from "../christmas-v2/types";
import {
  expressWalletAvailabilityFromMethods,
  PET_EXPRESS_CHECKOUT_OPTIONS,
} from "@/features/pet/expressCheckoutOptions";

function readSrc(relative: string): string {
  return readFileSync(resolve(process.cwd(), relative), "utf8");
}

describe("Christmas Express Checkout wiring", () => {
  it("reuses Pet CustomStripeCheckout ExpressCheckoutElement on paid funnels", () => {
    const shared = readSrc("src/features/pet/components/CustomStripeCheckout.tsx");
    const portrait = readSrc("src/features/christmas/ChristmasPortraitFunnelPage.tsx");
    const santa = readSrc("src/features/christmas/ChristmasSantaVideoPage.tsx");
    const v2 = readSrc("src/features/christmas-v2/screens/CheckoutScreen.tsx");

    expect(shared).toContain("ExpressCheckoutElement");
    expect(shared).toContain("PET_EXPRESS_CHECKOUT_OPTIONS");
    expect(shared).toContain("onWalletAvailability");
    expect(shared).not.toContain("ApplePayButton");
    expect(shared).toContain("Neutral skeleton only");

    expect(portrait).toContain("CustomStripeCheckout");
    expect(portrait).toContain("onWalletAvailability");
    expect(portrait).toContain("trackChristmasWalletAvailability");
    expect(portrait).not.toContain("returnUrl=");

    expect(santa).toContain("CustomStripeCheckout");
    expect(santa).toContain("onWalletAvailability");
    expect(santa).toContain("trackChristmasWalletAvailability");
    expect(santa).not.toContain("returnUrl=");

    expect(v2).toContain("CustomStripeCheckout");
    expect(v2).toContain("onWalletAvailability");
    expect(v2).not.toContain("ExpressCheckoutElement");
    expect(v2).not.toContain("const EXPRESS_OPTIONS");
  });

  it("keeps wallet availability truthful (auto, Stripe-reported only)", () => {
    expect(PET_EXPRESS_CHECKOUT_OPTIONS.paymentMethods.applePay).toBe("auto");
    expect(PET_EXPRESS_CHECKOUT_OPTIONS.paymentMethods.googlePay).toBe("auto");
    expect(expressWalletAvailabilityFromMethods(undefined).any).toBe(false);
    expect(expressWalletAvailabilityFromMethods({ applePay: true }).applePay).toBe(true);
  });

  it("allowlists wallet availability events without enabling production checkout", () => {
    expect(CHRISTMAS_FUNNEL_ALLOWED_EVENTS).toContain("christmas_apple_pay_available");
    expect(CHRISTMAS_FUNNEL_ALLOWED_EVENTS).toContain("christmas_apple_pay_unavailable");
    expect(CHRISTMAS_FUNNEL_ALLOWED_EVENTS).toContain("christmas_express_checkout_available");
    expect(CHRISTMAS_V2_EVENTS).toContain("christmas_v2_apple_pay_available");
    expect(CHRISTMAS_V2_EVENTS).toContain("christmas_v2_apple_pay_unavailable");
    expect(CHRISTMAS_V2_EVENTS).toContain("christmas_v2_express_checkout_available");
    expect(christmasCheckoutEnabled()).toBe(false);
  });

  it("uses Basil Stripe-Version so Custom Checkout / Express can mint a client secret", () => {
    const checkout = readSrc("supabase/functions/christmas-checkout/index.ts");
    expect(checkout).toContain("CHRISTMAS_CHECKOUT_ENABLED");
    expect(checkout).toContain('ui_mode", "custom"');
    expect(checkout).toContain("2025-03-31.basil");
    expect(checkout).toContain('"Stripe-Version"');
  });

  it("does not expose checkout on suite shells", () => {
    const shell = readSrc("src/features/christmas/components/ChristmasFeatureShell.tsx");
    expect(shell).not.toContain("CustomStripeCheckout");
    expect(shell).not.toContain("ExpressCheckoutElement");
  });
});
