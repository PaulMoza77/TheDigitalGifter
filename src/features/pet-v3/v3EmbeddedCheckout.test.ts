import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { shouldTrackPetBeginCheckout } from "../pet/funnelAnalytics";
import {
  trackV3BeginCheckoutOnInteraction,
  trackV3CheckoutViewed,
} from "./checkoutAnalytics";
import {
  readCachedV3EmbeddedCheckout,
  readOrResetV3CheckoutHold,
  v3BootstrapContact,
  writeCachedV3EmbeddedCheckout,
  V3_CHECKOUT_SESSION_CACHE_KEY,
} from "./v3CheckoutHold";
import { v3PayButtonLabel } from "./v3CheckoutHold";

vi.mock("./analytics", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./analytics")>();
  return {
    ...actual,
    trackPetV3Event: vi.fn(),
  };
});

import { trackPetV3Event } from "./analytics";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const sessionId = "11111111-2222-4333-8333-444444444401";

function readSrc(relative: string) {
  return readFileSync(resolve(root, relative), "utf8");
}

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
      location: { origin: "https://thedigitalgifter.com" },
    },
  });
}

describe("V3 embedded checkout", () => {
  beforeEach(() => {
    installMemoryStorage();
    vi.mocked(trackPetV3Event).mockClear();
  });

  it("does not include the old hosted-checkout Unlock CTA on the offer screen", () => {
    const offer = readSrc("src/features/pet-v3/screens/OfferScreen.tsx");
    expect(offer).toContain("CustomStripeCheckout");
    expect(offer).not.toContain("Opening secure checkout");
    expect(offer).not.toContain("onContinue");
    expect(offer).not.toContain("copy.unlockCta");
  });

  it("bootstraps embedded checkout with uiMode custom without redirect", () => {
    const page = readSrc("src/features/pet-v3/PetV3FunnelPage.tsx");
    const hook = readSrc("src/features/pet-v3/useV3EmbeddedCheckout.ts");
    expect(page).toContain("useV3EmbeddedCheckout");
    expect(page).not.toContain("window.location.assign(result.checkoutUrl)");
    expect(hook).toContain('uiMode: "custom"');
    expect(hook).toContain("bootstrapped.current = true");
  });

  it("uses V3-isolated checkout session cache keys", () => {
    expect(V3_CHECKOUT_SESSION_CACHE_KEY).toContain("petFunnelV3");
    expect(V3_CHECKOUT_SESSION_CACHE_KEY).not.toContain("checkoutSession.v2");
  });

  it("reuses cached session instead of creating duplicates on re-read", () => {
    const now = 1_000_000;
    writeCachedV3EmbeddedCheckout({
      orderId: "order-1",
      publicToken: "token-1",
      sessionId: "cs_test_1",
      clientSecret: "cs_test_secret",
      publishableKey: "pk_test",
      expiresAt: now + 60_000,
    });
    const cached = readCachedV3EmbeddedCheckout(now + 1_000);
    expect(cached?.sessionId).toBe("cs_test_1");
    expect(cached?.clientSecret).toBe("cs_test_secret");
  });

  it("resets hold without touching name/email draft fields", () => {
    const first = readOrResetV3CheckoutHold(1_000);
    const again = readOrResetV3CheckoutHold(5_000);
    expect(again.reset).toBe(false);
    expect(again.expiresAt).toBe(first.expiresAt);
  });

  it("uses bootstrap placeholders that pass createOrder validation", () => {
    const contact = v3BootstrapContact(sessionId);
    expect(contact.petName.length).toBeGreaterThanOrEqual(2);
    expect(contact.email).toContain("@");
    expect(contact.email).toContain("pending+");
  });

  it("formats pay button with cat name when valid", () => {
    expect(v3PayButtonLabel("Luna")("$12")).toBe("Pay $12 & unlock Luna's collection");
    expect(v3PayButtonLabel("")("$12")).toContain("your cat");
  });

  it("fires checkout_viewed without auto-firing begin_checkout on page load", () => {
    trackV3CheckoutViewed();
    expect(trackPetV3Event).toHaveBeenCalledWith(
      expect.objectContaining({ eventName: "v3_checkout_viewed" }),
    );
    expect(trackPetV3Event).not.toHaveBeenCalledWith(
      expect.objectContaining({ eventName: "v3_begin_checkout" }),
    );
  });

  it("fires begin_checkout only after meaningful payment interaction signal", () => {
    const result = {
      status: "open" as const,
      sessionId: "cs_live_embedded",
      clientSecret: "cs_live_embedded_secret_abc",
      orderId: "order-live-1",
      chargedAmountCents: 1200,
      eventId: "eeeeeeee-1111-4222-8333-444444444401",
    };
    expect(shouldTrackPetBeginCheckout(result)).toBe(true);
    expect(
      trackV3BeginCheckoutOnInteraction({
        result,
        fallbackAmountCents: 1200,
      }),
    ).toBe(true);
    expect(trackPetV3Event).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "v3_begin_checkout",
        amountCents: 1200,
        attemptId: "order-live-1",
      }),
    );
  });

  it("does not modify V2 hosted checkout", () => {
    const v2 = readSrc("src/features/pet-v2/PetV2FunnelPage.tsx");
    expect(v2).toContain("window.location.assign(result.checkoutUrl)");
    expect(v2).not.toContain('uiMode: "custom"');
    expect(v2).not.toContain("useV3EmbeddedCheckout");
  });

  it("updates order contact server-side before payment confirmation", () => {
    expect(readSrc("supabase/functions/pet-funnel/index.ts")).toContain('action === "updateOrderContact"');
    expect(readSrc("src/features/pet-v3/useV3EmbeddedCheckout.ts")).toContain("updateOrderContact");
    expect(readSrc("src/features/pet-v3/screens/OfferScreen.tsx")).toContain("onBeforeConfirm");
  });

  it("keeps V1 embedded checkout on PetCheckoutPage unchanged", () => {
    const v1 = readSrc("src/features/pet/PetCheckoutPage.tsx");
    expect(v1).toContain('uiMode: "custom"');
    expect(v1).toContain("CustomStripeCheckout");
  });
});
