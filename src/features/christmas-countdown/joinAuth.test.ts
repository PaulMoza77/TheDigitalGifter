import { describe, expect, it } from "vitest";
import {
  CHRISTMAS_JOIN_OPTIN_KEY,
  CHRISTMAS_JOIN_PENDING_KEY,
  christmasAuthCallbackUrl,
  clearChristmasJoinOptIn,
  peekChristmasJoinOptIn,
  rememberChristmasJoinPending,
  takeChristmasJoinPending,
} from "./joinAuth";

function fakeWindow(hostname = "www.thedigitalgifter.com") {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      sessionStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => store.set(key, value),
        removeItem: (key: string) => store.delete(key),
      },
      location: { hostname, origin: `https://${hostname}` },
    },
  });
  return store;
}

describe("christmas google join pending", () => {
  it("remembers Google pending and marketing opt-in across the OAuth round trip", () => {
    const store = fakeWindow();
    rememberChristmasJoinPending(true);
    expect(store.get(CHRISTMAS_JOIN_PENDING_KEY)).toBe("google");
    expect(peekChristmasJoinOptIn()).toBe(true);
    expect(takeChristmasJoinPending()).toBe(true);
    expect(takeChristmasJoinPending()).toBe(false);
    expect(peekChristmasJoinOptIn()).toBe(true);
    clearChristmasJoinOptIn();
    expect(store.get(CHRISTMAS_JOIN_OPTIN_KEY)).toBeUndefined();
  });

  it("sends apex-domain Google OAuth back to www /auth/callback", () => {
    fakeWindow("thedigitalgifter.com");
    expect(christmasAuthCallbackUrl()).toBe("https://www.thedigitalgifter.com/auth/callback");
  });
});
