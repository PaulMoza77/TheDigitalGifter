import { describe, expect, it } from "vitest";
import {
  FUNNEL_DATASETS,
  isDatasetConfigured,
  mapV2CountsToPrimarySteps,
  mapV3CountsToPrimarySteps,
  namedEventCounts,
  rpcCampaignIdForDataset,
} from "./funnelDatasetConfig";

describe("funnelDatasetConfig", () => {
  it("keeps V1 and V2 campaign IDs in one config object", () => {
    expect(FUNNEL_DATASETS.v1.campaignId).toBe("120253346791240170");
    expect(FUNNEL_DATASETS.v1.funnelVariant).toBe("v1");
    expect(FUNNEL_DATASETS.v1.eventSource).toBe("pet_funnel_events");
    expect(FUNNEL_DATASETS.v2.campaignId).toBe("120253465585030170");
    expect(FUNNEL_DATASETS.v2.funnelVariant).toBe("v2_preview");
    expect(FUNNEL_DATASETS.v2.eventSource).toBe("pet_v2_funnel_events");
    expect(isDatasetConfigured("v1")).toBe(true);
    expect(isDatasetConfigured("v2")).toBe(true);
    expect(rpcCampaignIdForDataset("v2")).toBe("120253465585030170");
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
    expect(FUNNEL_DATASETS.v2.kpiLabels.step2).toBe("Photo Uploads");
    expect(FUNNEL_DATASETS.v2.kpiLabels.step3).toBe("Preview Viewed");
    expect(FUNNEL_DATASETS.v2.kpiLabels.step4).toBe("Unlock Clicks");
    expect(FUNNEL_DATASETS.v2.kpiLabels.landingHelper).not.toContain("pet_name_submitted");
  });

  it("keeps V3 cat dataset isolated with no Meta campaign until configured", () => {
    expect(FUNNEL_DATASETS.v3.campaignId).toBe("");
    expect(FUNNEL_DATASETS.v3.funnelVariant).toBe("v3_cat_preview");
    expect(FUNNEL_DATASETS.v3.eventSource).toBe("pet_v3_funnel_events");
    expect(isDatasetConfigured("v3")).toBe(false);
    expect(rpcCampaignIdForDataset("v3")).toBe("__not_configured__");

    const counts = mapV3CountsToPrimarySteps(
      namedEventCounts([
        { event_name: "v3_landing_view", unique_sessions: 10 },
        { event_name: "v3_upload_completed", unique_sessions: 6 },
        { event_name: "v3_preview_viewed", unique_sessions: 5 },
        { event_name: "v3_unlock_clicked", unique_sessions: 2 },
        { event_name: "v3_begin_checkout", unique_sessions: 1 },
        { event_name: "v3_purchase", unique_sessions: 1 },
      ]),
    );
    expect(counts.landing_view).toBe(10);
    expect(counts.pet_name_submitted).toBe(6);
    expect(counts.photo_upload_completed).toBe(5);
    expect(counts.order_review_viewed).toBe(2);
    expect(counts.initiate_checkout).toBe(1);
    expect(counts.purchase).toBe(1);
  });
});
