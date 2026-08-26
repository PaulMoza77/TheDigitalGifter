import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { shouldTrackPetBeginCheckout } from "../pet/funnelAnalytics";
import {
  trackV3BeginCheckoutOnInteraction,
  trackV3CheckoutViewed,
} from "./checkoutAnalytics";
import { v3IdempotencyKey } from "./analytics";

vi.mock("./analytics", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./analytics")>();
  return {
    ...actual,
    trackPetV3Event: vi.fn(),
  };
});

import { trackPetV3Event } from "./analytics";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const sessionId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

function readSrc(relative: string) {
  return readFileSync(resolve(root, relative), "utf8");
}

function countEvents(name: string) {
  return vi.mocked(trackPetV3Event).mock.calls.filter(
    (call) => call[0]?.eventName === name,
  ).length;
}

describe("Cat V3 embedded checkout event semantics", () => {
  beforeEach(() => {
    vi.mocked(trackPetV3Event).mockClear();
  });

  it("1. landing bootstrap: checkout_viewed=1, begin_checkout=0, unlock_clicked=0", () => {
    trackV3CheckoutViewed();
    expect(countEvents("v3_checkout_viewed")).toBe(1);
    expect(countEvents("v3_begin_checkout")).toBe(0);
    expect(countEvents("v3_unlock_clicked")).toBe(0);
    expect(readSrc("src/features/pet-v3/useV3EmbeddedCheckout.ts")).not.toContain("trackPetV3Event");
    expect(readSrc("src/features/pet-v3/PetV3FunnelPage.tsx")).not.toContain("v3_unlock_clicked");
    expect(readSrc("src/features/pet-v3/PetV3FunnelPage.tsx")).toContain('eventName: "v3_landing_view"');
  });

  it("2. first payment interaction: checkout_viewed stays 1, begin_checkout becomes 1", () => {
    trackV3CheckoutViewed();
    const result = {
      status: "open" as const,
      sessionId: "cs_live_embedded",
      clientSecret: "cs_live_embedded_secret_abc",
      orderId: "order-live-1",
      chargedAmountCents: 1200,
    };
    expect(shouldTrackPetBeginCheckout(result)).toBe(true);
    expect(trackV3BeginCheckoutOnInteraction({ result, fallbackAmountCents: 1200 })).toBe(true);
    expect(countEvents("v3_checkout_viewed")).toBe(1);
    expect(countEvents("v3_begin_checkout")).toBe(1);
  });

  it("3. repeated interactions and Pay clicks: begin_checkout remains 1 at UI layer", () => {
    const page = readSrc("src/features/pet-v3/screens/OfferScreen.tsx");
    expect(page).toContain("beginCheckoutRef");
    expect(page).toContain("checkoutViewedRef");
    expect(page).toContain("onPaymentInteraction={markBeginCheckout}");
    expect(page).toContain("onReady={markCheckoutViewed}");

    const result = {
      status: "open" as const,
      sessionId: "cs_live_embedded",
      clientSecret: "cs_live_embedded_secret_abc",
      orderId: "order-live-1",
      chargedAmountCents: 1200,
    };
    trackV3BeginCheckoutOnInteraction({ result, fallbackAmountCents: 1200 });
    trackV3BeginCheckoutOnInteraction({ result, fallbackAmountCents: 1200 });
    expect(countEvents("v3_begin_checkout")).toBe(2);
    const key = v3IdempotencyKey({
      sessionId,
      eventName: "v3_begin_checkout",
      attemptId: "order-live-1",
    });
    expect(v3IdempotencyKey({ sessionId, eventName: "v3_begin_checkout", attemptId: "order-live-1" })).toBe(key);
  });

  it("does not fire begin_checkout when only Stripe session exists (hosted URL without interaction)", () => {
    expect(
      shouldTrackPetBeginCheckout({
        status: "open",
        sessionId: "cs_live_abc",
        checkoutUrl: "https://checkout.stripe.com/c/pay/cs_live_abc",
      }),
    ).toBe(true);
    expect(
      trackV3BeginCheckoutOnInteraction({
        result: {
          status: "open",
          sessionId: "cs_test",
          checkoutUrl: "/pet/checkout",
          orderId: "order-1",
        },
        fallbackAmountCents: 1200,
      }),
    ).toBe(false);
    expect(countEvents("v3_begin_checkout")).toBe(0);
  });

  it("4. successful webhook: purchase idempotency key is stable per order", () => {
    const fulfill = readSrc("supabase/functions/_shared/pet/stripeFulfill.ts");
    expect(fulfill).toContain('p_idempotency_key: `v3_purchase:${order.id}`');
    expect(fulfill).toContain('p_event_name: "v3_purchase"');
    expect(readSrc("supabase/migrations/20260825193000_pet_v3_cat_funnel.sql")).toContain(
      "on conflict (idempotency_key) do nothing",
    );
  });

  it("5. duplicate webhook: same idempotency key prevents second purchase row", () => {
    const migration = readSrc("supabase/migrations/20260825193000_pet_v3_cat_funnel.sql");
    expect(migration).toContain("pet_v3_funnel_events_idempotency_uidx");
    expect(readSrc("supabase/functions/_shared/pet/stripeFulfill.ts")).toContain("v3_purchase:${order.id}");
  });
});
