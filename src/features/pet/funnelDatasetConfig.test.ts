import { describe, expect, it } from "vitest";
import {
  FUNNEL_DATASETS,
  UNCONFIGURED_CAMPAIGN_ID,
  isDatasetConfigured,
  mapV2CountsToPrimarySteps,
  namedEventCounts,
  rpcCampaignIdForDataset,
} from "./funnelDatasetConfig";

describe("funnelDatasetConfig", () => {
  it("keeps V1 and V2 campaign IDs in one config object", () => {
    expect(FUNNEL_DATASETS.v1.campaignId).toBe("120253346791240170");
    expect(FUNNEL_DATASETS.v1.funnelVariant).toBe("v1");
    expect(FUNNEL_DATASETS.v1.eventSource).toBe("pet_funnel_events");
    expect(FUNNEL_DATASETS.v2.campaignId).toBe("");
    expect(FUNNEL_DATASETS.v2.funnelVariant).toBe("v2_preview");
    expect(FUNNEL_DATASETS.v2.eventSource).toBe("pet_v2_funnel_events");
    expect(isDatasetConfigured("v1")).toBe(true);
    expect(isDatasetConfigured("v2")).toBe(false);
    expect(rpcCampaignIdForDataset("v2")).toBe(UNCONFIGURED_CAMPAIGN_ID);
  });

  it("maps V2 events into the original six funnel cards without mixing V1 names", () => {
    const counts = mapV2CountsToPrimarySteps(
      namedEventCounts([
        { event_name: "v2_landing_view", unique_sessions: 40 },
        { event_name: "v2_upload_completed", unique_sessions: 22 },
        { event_name: "v2_preview_viewed", unique_sessions: 18 },
        { event_name: "v2_unlock_clicked", unique_sessions: 9 },
        { event_name: "v2_begin_checkout", unique_sessions: 4 },
        { event_name: "v2_purchase", unique_sessions: 2 },
        { event_name: "pet_name_submitted", unique_sessions: 99 },
      ]),
    );
    expect(counts.landing_view).toBe(40);
    expect(counts.pet_name_submitted).toBe(22);
    expect(counts.photo_upload_completed).toBe(18);
    expect(counts.order_review_viewed).toBe(9);
    expect(counts.initiate_checkout).toBe(4);
    expect(counts.purchase).toBe(2);
  });
});
