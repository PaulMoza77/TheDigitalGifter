import { describe, expect, it } from "vitest";
import {
  buildV4SequentialCohort,
  buildV4SequentialSteps,
  enforceMonotonicSequential,
  rankV4DropOffPoints,
  mapV2EventToV4,
} from "./sequentialFunnel";
import { v4IdempotencyKey, resetV4ScrollOnceForTests, trackV4ScrollDepth } from "./analytics";
import { isV4MetaCampaignId, isV4AcquisitionCohort, v4RedirectTarget, petV4LandingPath } from "./campaign";
import { PET_V4_META_CAMPAIGN_ID } from "./types";
import { parseV4AnalyticsPayload } from "./v4Dashboard";

describe("pet-v4 campaign isolation", () => {
  it("maps the New Sales Campaign id", () => {
    expect(isV4MetaCampaignId(PET_V4_META_CAMPAIGN_ID)).toBe(true);
    expect(isV4MetaCampaignId("120253346791240170")).toBe(false);
    expect(petV4LandingPath("dog")).toBe("/pet/dog-v4");
  });

  it("treats dedicated V4 paths as acquisition cohort", () => {
    expect(isV4AcquisitionCohort("", "/pet/dog-v4")).toBe(true);
    expect(isV4AcquisitionCohort("", "/pet/dog-v2")).toBe(false);
  });

  it("soft-redirects V2 URLs when campaign_id is V4", () => {
    const target = v4RedirectTarget("/pet/dog-v2", `?campaign_id=${PET_V4_META_CAMPAIGN_ID}&utm_source=fb`);
    expect(target).toBe(`/pet/dog-v4?campaign_id=${PET_V4_META_CAMPAIGN_ID}&utm_source=fb`);
  });
});

describe("pet-v4 sequential funnel", () => {
  it("never allows a later stage to exceed an earlier stage", () => {
    const clamped = enforceMonotonicSequential({
      landing: 100,
      upload_started: 80,
      upload_completed: 90, // impossible raw
      generation_completed: 70,
      teaser_viewed: 60,
      offer_viewed: 80, // impossible raw
      checkout_clicked: 40,
      checkout_session_created: 30,
      purchase: 20,
    });
    expect(clamped.upload_completed).toBeLessThanOrEqual(clamped.upload_started);
    expect(clamped.offer_viewed).toBeLessThanOrEqual(clamped.teaser_viewed);
    const steps = buildV4SequentialSteps(clamped);
    for (let i = 1; i < steps.length; i++) {
      expect(steps[i].users).toBeLessThanOrEqual(steps[i - 1].users);
    }
  });

  it("builds cohort-chained counts from session sets", () => {
    const sessionsByEvent = {
      v4_landing_view: new Set(["a", "b", "c", "d"]),
      v4_upload_started: new Set(["a", "b", "c", "x"]), // x not in landing
      v4_upload_completed: new Set(["a", "b"]),
      v4_generation_completed: new Set(["a", "b"]),
      v4_teaser_viewed: new Set(["a"]),
      v4_offer_viewed: new Set(["a"]),
      v4_checkout_clicked: new Set(["a"]),
      v4_checkout_session_created: new Set(["a"]),
      v4_purchase: new Set(["a"]),
    };
    const cohort = buildV4SequentialCohort(sessionsByEvent);
    expect(cohort.landing).toBe(4);
    expect(cohort.upload_started).toBe(3); // a,b,c
    expect(cohort.upload_completed).toBe(2);
    expect(cohort.teaser_viewed).toBe(1);
    expect(cohort.purchase).toBe(1);
  });

  it("ranks drop-off points by measured loss", () => {
    const steps = buildV4SequentialSteps({
      landing: 100,
      upload_started: 40,
      upload_completed: 40,
      generation_completed: 40,
      teaser_viewed: 40,
      offer_viewed: 20,
      checkout_clicked: 20,
      checkout_session_created: 20,
      purchase: 10,
    });
    const ranked = rankV4DropOffPoints(steps);
    expect(ranked[0].from).toBe("landing");
    expect(ranked[0].to).toBe("upload_started");
    expect(ranked[0].dropOffPct).toBe(60);
  });
});

describe("pet-v4 event mapping + idempotency", () => {
  it("maps V2 teaser events into V4 equivalents", () => {
    expect(mapV2EventToV4("v2_landing_view")).toBe("v4_landing_view");
    expect(mapV2EventToV4("v2_teaser_generation_completed")).toBe("v4_generation_completed");
    expect(mapV2EventToV4("v2_begin_checkout")).toBe("v4_checkout_clicked");
  });

  it("dedupes session-once and scroll depth keys", () => {
    const landing = v4IdempotencyKey({
      sessionId: "11111111-1111-4111-8111-111111111111",
      eventName: "v4_landing_view",
      species: "dog",
    });
    const landing2 = v4IdempotencyKey({
      sessionId: "11111111-1111-4111-8111-111111111111",
      eventName: "v4_landing_view",
      species: "dog",
    });
    expect(landing).toBe(landing2);

    const scroll = v4IdempotencyKey({
      sessionId: "11111111-1111-4111-8111-111111111111",
      eventName: "v4_scroll_depth",
      metaKey: "p50",
    });
    expect(scroll).toContain("v4_scroll_depth:p50");
  });

  it("scroll tracker is idempotent per bucket in-session", () => {
    resetV4ScrollOnceForTests();
    // Should not throw without window fetch
    trackV4ScrollDepth("p25", 25);
    trackV4ScrollDepth("p25", 26);
  });
});

describe("pet-v4 dashboard parser", () => {
  it("builds economics and monotonic steps from RPC payload", () => {
    const report = parseV4AnalyticsPayload({
      sequential: {
        landing: 10,
        upload_started: 8,
        upload_completed: 9,
        generation_completed: 6,
        teaser_viewed: 5,
        offer_viewed: 4,
        checkout_clicked: 3,
        checkout_session_created: 2,
        purchase: 1,
      },
      first_party: {
        landing_sessions: 10,
        unique_visitors: 9,
        upload_completes: 8,
        checkout_cta_clicks: 3,
        purchases: 1,
        revenue_cents: 299,
      },
      meta: {
        spend_cents: 1000,
        impressions: 10000,
        link_clicks: 100,
        landing_page_views: 80,
      },
    });
    expect(report.sequentialSteps[2].users).toBeLessThanOrEqual(report.sequentialSteps[1].users);
    expect(report.economics.cpa).toBe(1000);
    expect(report.campaignId).toBe(PET_V4_META_CAMPAIGN_ID);
  });
});
