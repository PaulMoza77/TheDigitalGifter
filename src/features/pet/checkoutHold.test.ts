import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  CHECKOUT_HOLD_MS,
  checkoutPreparingHeadline,
  formatHoldCountdown,
  readOrResetCheckoutHold,
} from "./checkoutHold";

function installMemoryStorage() {
  const local = new Map<string, string>();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => local.get(key) ?? null,
        setItem: (key: string, value: string) => {
          local.set(key, value);
        },
        removeItem: (key: string) => {
          local.delete(key);
        },
      },
    },
  });
}

beforeEach(() => {
  installMemoryStorage();
});

afterEach(() => {
  installMemoryStorage();
});

describe("checkout hold", () => {
  it("formats a 30-minute countdown as MM:SS", () => {
    expect(formatHoldCountdown(CHECKOUT_HOLD_MS)).toBe("30:00");
    expect(formatHoldCountdown(90_000)).toBe("01:30");
    expect(formatHoldCountdown(0)).toBe("00:00");
  });

  it("keeps the same deadline across reads, then resets after expiry", () => {
    const first = readOrResetCheckoutHold(1_000);
    expect(first.reset).toBe(true);
    expect(first.expiresAt).toBe(1_000 + CHECKOUT_HOLD_MS);
    const again = readOrResetCheckoutHold(5_000);
    expect(again.reset).toBe(false);
    expect(again.expiresAt).toBe(first.expiresAt);
    const afterExpiry = readOrResetCheckoutHold(first.expiresAt);
    expect(afterExpiry.reset).toBe(true);
    expect(afterExpiry.expiresAt).toBe(first.expiresAt + CHECKOUT_HOLD_MS);
  });

  it("names the pet in the preparing headline", () => {
    expect(checkoutPreparingHeadline("Milo")).toBe("Your “Milo” secret lives are preparing now.");
  });
});
