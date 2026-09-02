import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { PET_EXPRESS_CHECKOUT_OPTIONS } from "./expressCheckoutOptions";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

function readSrc(relative: string) {
  return readFileSync(resolve(root, relative), "utf8");
}

describe("expressCheckoutOptions", () => {
  it("shows wallets only when Stripe verifies domain + device support", () => {
    expect(PET_EXPRESS_CHECKOUT_OPTIONS.paymentMethods.applePay).toBe("auto");
    expect(PET_EXPRESS_CHECKOUT_OPTIONS.paymentMethods.googlePay).toBe("auto");
    expect(PET_EXPRESS_CHECKOUT_OPTIONS.paymentMethodOrder).toEqual(["applePay", "googlePay"]);
  });

  it("is shared by V2/V3 Elements checkout (no dead decorative Apple Pay button)", () => {
    const v2 = readSrc("src/features/pet-v2/components/V2ElementsCheckout.tsx");
    const v3 = readSrc("src/features/pet-v3/components/V3ElementsCheckout.tsx");
    expect(v2).toContain("PET_EXPRESS_CHECKOUT_OPTIONS");
    expect(v3).toContain("PET_EXPRESS_CHECKOUT_OPTIONS");
    expect(v2).not.toContain("applePayFromStripe");
    expect(v3).not.toContain("applePayFromStripe");
    expect(v2).not.toMatch(/ApplePayButton disabled=\{busy \|\| confirmDisabled\}/);
    expect(v3).not.toMatch(/ApplePayButton disabled=\{busy \|\| confirmDisabled\}/);
  });

  it("documents live Apple Pay domain verification on both public hosts (VPS, not Vercel)", () => {
    const verify = readSrc("scripts/verify-apple-pay-domain.mjs");
    expect(verify).toContain("thedigitalgifter.com");
    expect(verify).toContain("www.thedigitalgifter.com");
    expect(verify).toContain("redirect: \"manual\"");
    expect(verify).not.toContain("set Vercel Production env");
    expect(readSrc(".env.example")).toContain("STRIPE_APPLE_PAY_DOMAIN_ASSOCIATION");
    expect(readSrc(".github/workflows/deploy-vps-static.yml")).toContain("verify-apple-pay-domain");
    expect(readSrc("public/.well-known/apple-developer-merchantid-domain-association").length).toBeGreaterThan(1000);
  });
});
