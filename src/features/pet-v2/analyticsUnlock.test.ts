import { describe, expect, it } from "vitest";
import { uniqueSessionsForEvent, type FirstPartyEventRow } from "../pet/funnelCampaignAnalytics";
import { FUNNEL_DATASETS, mapV2CountsToPrimarySteps, namedEventCounts } from "../pet/funnelDatasetConfig";
import { v2IdempotencyKey } from "./analytics";

const session = "11111111-1111-4111-8111-111111111111";

describe("V2 unlock click instrumentation", () => {
  it("uses a unique idempotency key per click so ingestion is not deduped away", () => {
    const a = v2IdempotencyKey({
      sessionId: session,
      eventName: "v2_unlock_clicked",
      species: "dog",
      eventId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
    });
    const b = v2IdempotencyKey({
      sessionId: session,
      eventName: "v2_unlock_clicked",
      species: "dog",
      eventId: "ffffffff-1111-4222-8333-444444444402",
    });
    expect(a).not.toBe(b);
  });

  it("counts v2_unlock_clicked in V2 KPI unlock step", () => {
    const events: FirstPartyEventRow[] = [
      {
        funnelSessionId: session,
        eventName: "v2_landing_view",
        createdAt: "2026-08-25T20:47:00.000Z",
        campaignId: FUNNEL_DATASETS.v2.campaignId,
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
        funnelSessionId: session,
        eventName: "v2_unlock_clicked",
        createdAt: "2026-08-25T20:47:05.000Z",
        campaignId: FUNNEL_DATASETS.v2.campaignId,
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
    ];
    expect(uniqueSessionsForEvent(events, "v2_unlock_clicked")).toBe(1);
    const counts = namedEventCounts([
      { event_name: "v2_unlock_clicked", unique_sessions: uniqueSessionsForEvent(events, "v2_unlock_clicked") },
    ]);
    const mapped = mapV2CountsToPrimarySteps({ v2_unlock_clicked: counts.v2_unlock_clicked });
    expect(mapped.order_review_viewed).toBe(1);
  });
});
