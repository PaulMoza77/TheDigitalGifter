import { describe, expect, it, vi } from "vitest";
import { getStripePromise, resetStripeLoaderCacheForTests, STRIPE_JS_RELEASE_TRAIN } from "./stripeLoader";

describe("stripeLoader", () => {
  it("caches Stripe instances by publishable key when dahlia is already loaded", async () => {
    resetStripeLoaderCacheForTests();
    const ctor = vi.fn((key: string) => ({ key, version: STRIPE_JS_RELEASE_TRAIN }));
    vi.stubGlobal("window", {
      Stripe: Object.assign(ctor, { version: STRIPE_JS_RELEASE_TRAIN }),
    });
    vi.stubGlobal("document", undefined);

    const first = getStripePromise("pk_live_abc");
    const second = getStripePromise("pk_live_abc");
    const third = getStripePromise("pk_live_def");
    expect(first).toBe(second);
    expect(first).not.toBe(third);
    await third;
    expect(ctor).toHaveBeenCalledTimes(2);
    vi.unstubAllGlobals();
  });
});
