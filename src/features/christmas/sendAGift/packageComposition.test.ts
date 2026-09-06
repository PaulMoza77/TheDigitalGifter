import { describe, expect, it } from "vitest";
import {
  SEND_A_GIFT_FUNNEL,
  SEND_A_GIFT_PACKAGE_KEYS,
  SEND_A_GIFT_PACKAGES,
  SEND_A_GIFT_PRODUCT_KEY,
  assertServerOwnedCheckoutInput,
  isSendAGiftPackageKey,
  resolveSendAGiftPackage,
} from "./packageComposition";

describe("Send-a-Gift package composition", () => {
  it("exposes exactly 3 server-owned packages", () => {
    expect(SEND_A_GIFT_PACKAGE_KEYS).toHaveLength(3);
    expect(Object.keys(SEND_A_GIFT_PACKAGES)).toHaveLength(3);
  });

  it("keeps production purchasable false and price at zero until founder pricing", () => {
    for (const key of SEND_A_GIFT_PACKAGE_KEYS) {
      const pkg = SEND_A_GIFT_PACKAGES[key];
      expect(pkg.purchasable).toBe(false);
      expect(pkg.priceCents).toBe(0);
      expect(pkg.entitlements.length).toBeGreaterThan(0);
    }
  });

  it("rejects client price and entitlement overrides", () => {
    expect(
      assertServerOwnedCheckoutInput({
        productKey: SEND_A_GIFT_PRODUCT_KEY,
        packageKey: "starter",
        clientAmountCents: 999,
      }),
    ).toEqual({ ok: false, reason: "client_price_override_rejected" });

    expect(
      assertServerOwnedCheckoutInput({
        productKey: SEND_A_GIFT_PRODUCT_KEY,
        packageKey: "starter",
        clientEntitlements: [{ serviceKey: "christmas_photo", quantity: 99 }],
      }),
    ).toEqual({ ok: false, reason: "client_entitlement_override_rejected" });
  });

  it("rejects checkout while not purchasable (pre-activation)", () => {
    expect(
      assertServerOwnedCheckoutInput({
        productKey: SEND_A_GIFT_PRODUCT_KEY,
        packageKey: "classic",
      }),
    ).toEqual({ ok: false, reason: "not_purchasable" });
  });

  it("validates package keys only", () => {
    expect(isSendAGiftPackageKey("premium")).toBe(true);
    expect(isSendAGiftPackageKey("classic")).toBe(true);
    expect(isSendAGiftPackageKey("deluxe")).toBe(false);
    expect(resolveSendAGiftPackage("classic")?.packageName).toBe("Christmas Gift");
    expect(SEND_A_GIFT_FUNNEL).toBe("christmas_send_a_gift");
  });
});
