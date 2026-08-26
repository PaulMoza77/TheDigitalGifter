import { describe, expect, it } from "vitest";
import {
  publishableKeyFingerprint,
  stripeKeyAccountFingerprint,
  stripeKeysShareAccount,
  publishableKeyMatchesSecretMode,
} from "./stripeKeys";

describe("stripeKeys", () => {
  const skLive = "sk_live_AAAAAAAAAAAAAAAA";
  const pkLiveMatch = "pk_live_AAAAAAAAAAAAAAAA";
  const pkLiveOther = "pk_live_BBBBBBBBBBBBBBBB";

  it("extracts matching account fingerprints for paired keys", () => {
    expect(stripeKeyAccountFingerprint(skLive)).toBe("live:AAAAAAAAAAAAAAAA");
    expect(publishableKeyFingerprint(pkLiveMatch)).toBe("live:AAAAAAAAAAAAAAAA");
    expect(stripeKeysShareAccount(pkLiveMatch, skLive)).toBe(true);
  });

  it("rejects publishable keys from a different Stripe account", () => {
    expect(stripeKeysShareAccount(pkLiveOther, skLive)).toBe(false);
  });

  it("uses a 16-character account prefix fingerprint", () => {
    expect(stripeKeyAccountFingerprint(skLive)).toBe("live:AAAAAAAAAAAAAAAA");
  });

  it("rejects live/test mode mismatches", () => {
    expect(publishableKeyMatchesSecretMode("pk_test_AAAAAAAAAAAAAAAA", skLive)).toBe(false);
  });
});
