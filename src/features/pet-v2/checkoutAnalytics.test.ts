import { beforeEach, describe, expect, it, vi } from "vitest";
import { shouldTrackPetBeginCheckout } from "../pet/funnelAnalytics";
import { mapV2CountsToPrimarySteps, namedEventCounts } from "../pet/funnelDatasetConfig";
import { uniqueSessionsForEvent, type FirstPartyEventRow } from "../pet/funnelCampaignAnalytics";
import { v2IdempotencyKey } from "./analytics";
import { trackV2BeginCheckout } from "./checkoutAnalytics";

const sessionId = "11111111-2222-4333-8333-444444444401";

vi.mock("./analytics", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./analytics")>();
  return {
    ...actual,
    trackPetV2Event: vi.fn(),
  };
});

import { trackPetV2Event } from "./analytics";

describe("V2 initiate checkout analytics", () => {
  beforeEach(() => {
    vi.mocked(trackPetV2Event).mockClear();
  });

  it("does not emit v2_begin_checkout before Stripe session creation succeeds", () => {
    expect(
      trackV2BeginCheckout({
        species: "dog",
        result: {
          status: "open",
          sessionId: "cs_test",
          checkoutUrl: "/pet/checkout",
          orderId: "order-1",
          amountCents: 800,
        },
        fallbackAmountCents: 800,
      }),
    ).toBe(false);
    expect(trackPetV2Event).not.toHaveBeenCalled();
  });

  it("emits exactly one v2_begin_checkout after live Stripe session opens", () => {
    const result = {
      status: "open",
      sessionId: "cs_live_abc",
      checkoutUrl: "https://checkout.stripe.com/c/pay/cs_live_abc",
      orderId: "order-live-1",
      chargedAmountCents: 800,
      eventId: "eeeeeeee-1111-4222-8333-444444444401",
    };
    expect(shouldTrackPetBeginCheckout(result)).toBe(true);
    expect(
      trackV2BeginCheckout({
        species: "dog",
        result,
        fallbackAmountCents: 800,
      }),
    ).toBe(true);
    expect(trackPetV2Event).toHaveBeenCalledTimes(1);
    expect(trackPetV2Event).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "v2_begin_checkout",
        species: "dog",
        amountCents: 800,
        attemptId: "order-live-1",
      }),
    );

    const key = v2IdempotencyKey({
      sessionId,
      eventName: "v2_begin_checkout",
      species: "dog",
      attemptId: "order-live-1",
      eventId: result.eventId,
    });
    expect(key).toContain("order-live-1");
  });

  it("maps unlock → begin checkout into dashboard Initiate Checkouts", () => {
    const events: FirstPartyEventRow[] = [
      {
        funnelSessionId: sessionId,
        eventName: "v2_unlock_clicked",
        createdAt: "2026-08-25T20:47:00.000Z",
        campaignId: null,
        adsetId: null,
        adId: null,
        utmCampaign: null,
        species: "dog",
        deviceType: "desktop",
        amountCents: null,
        orderId: null,
        isTest: false,
        pathname: "/pet/dog-v2",
        referrerHost: null,
      },
      {
        funnelSessionId: sessionId,
        eventName: "v2_begin_checkout",
        createdAt: "2026-08-25T20:47:10.000Z",
        campaignId: null,
        adsetId: null,
        adId: null,
        utmCampaign: null,
        species: "dog",
        deviceType: "desktop",
        amountCents: 800,
        orderId: null,
        isTest: false,
        pathname: "/pet/dog-v2",
        referrerHost: null,
      },
    ];
    expect(uniqueSessionsForEvent(events, "v2_unlock_clicked")).toBe(1);
    expect(uniqueSessionsForEvent(events, "v2_begin_checkout")).toBe(1);
    expect(uniqueSessionsForEvent(events, "v2_purchase")).toBe(0);

    const mapped = mapV2CountsToPrimarySteps(
      namedEventCounts([
        { event_name: "v2_unlock_clicked", unique_sessions: 1 },
        { event_name: "v2_begin_checkout", unique_sessions: 1 },
        { event_name: "v2_purchase", unique_sessions: 0 },
      ]),
    );
    expect(mapped.order_review_viewed).toBe(1);
    expect(mapped.initiate_checkout).toBe(1);
    expect(mapped.purchase).toBe(0);
  });
});
