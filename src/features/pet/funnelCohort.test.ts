import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  buildLandingCohortSequential,
  V1_PHOTO_PATH_STAGES,
  V1_PRIMARY_COHORT_STAGES,
} from "./funnelCohort";
import type { FirstPartyEventRow } from "./funnelCampaignAnalytics";
import { ofPreviousLabel, buildFunnelSteps } from "./funnelDashboard";

const RANGE_FROM = "2026-08-24T00:00:00.000Z";
const RANGE_TO = "2026-08-26T00:00:00.000Z";
const RELIABLE = "2026-08-24T00:00:00.000Z";
const CAMPAIGN_1 = "120253346791240170";
const CAMPAIGN_OTHER = "999999999999999999";

function ev(
  sessionId: string,
  eventName: string,
  createdAt: string,
  extra: Partial<FirstPartyEventRow> = {},
): FirstPartyEventRow {
  return {
    funnelSessionId: sessionId,
    eventName,
    createdAt,
    isTest: false,
    ...extra,
  };
}

describe("V1 landing-cohort sequential conversion", () => {
  it("does not let an unrelated review session inflate Photo→Review", () => {
    const events: FirstPartyEventRow[] = [
      // 3 cohort sessions with photo; 2 of those also review
      ev("s1", "landing_view", "2026-08-24T10:00:00.000Z", { campaignId: CAMPAIGN_1 }),
      ev("s1", "pet_name_submitted", "2026-08-24T10:01:00.000Z", { campaignId: CAMPAIGN_1 }),
      ev("s1", "photo_upload_completed", "2026-08-24T10:02:00.000Z", { campaignId: CAMPAIGN_1 }),
      ev("s1", "order_review_viewed", "2026-08-24T10:03:00.000Z", { campaignId: CAMPAIGN_1 }),

      ev("s2", "landing_view", "2026-08-24T11:00:00.000Z", { campaignId: CAMPAIGN_1 }),
      ev("s2", "pet_name_submitted", "2026-08-24T11:01:00.000Z", { campaignId: CAMPAIGN_1 }),
      ev("s2", "photo_upload_completed", "2026-08-24T11:02:00.000Z", { campaignId: CAMPAIGN_1 }),
      ev("s2", "order_review_viewed", "2026-08-24T11:03:00.000Z", { campaignId: CAMPAIGN_1 }),

      ev("s3", "landing_view", "2026-08-24T12:00:00.000Z", { campaignId: CAMPAIGN_1 }),
      ev("s3", "pet_name_submitted", "2026-08-24T12:01:00.000Z", { campaignId: CAMPAIGN_1 }),
      ev("s3", "photo_upload_completed", "2026-08-24T12:02:00.000Z", { campaignId: CAMPAIGN_1 }),
      // s3 never reviews

      // Unrelated review without photo (and without being in photo cohort)
      ev("s4", "landing_view", "2026-08-24T13:00:00.000Z", { campaignId: CAMPAIGN_1 }),
      ev("s4", "pet_name_submitted", "2026-08-24T13:01:00.000Z", { campaignId: CAMPAIGN_1 }),
      ev("s4", "order_review_viewed", "2026-08-24T13:02:00.000Z", { campaignId: CAMPAIGN_1 }),
    ];

    const result = buildLandingCohortSequential(events, {
      rangeFromIso: RANGE_FROM,
      rangeToIso: RANGE_TO,
      measurementReliableFrom: RELIABLE,
      campaignId: CAMPAIGN_1,
    });

    expect(result.cohortCounts.photo_upload_completed).toBe(3);
    expect(result.cohortCounts.order_review_viewed).toBe(2);
    expect(result.rawCounts.order_review_viewed).toBe(3); // raw still sees s4

    const photoStage = result.primaryStages.find((s) => s.eventName === "photo_upload_completed");
    const reviewStage = result.primaryStages.find((s) => s.eventName === "order_review_viewed");
    expect(photoStage?.sessions).toBe(3);
    expect(reviewStage?.sessions).toBe(2);
    expect(reviewStage?.fromPreviousPct).toBeCloseTo(66.666, 2);

    const steps = buildFunnelSteps(result.cohortCounts);
    expect(steps[3].fromPreviousPct).toBeCloseTo(66.666, 2);
    expect(ofPreviousLabel(steps[3].sessions, steps[2].sessions, "photos")).toBe("66.7% of photos");
    // Must NOT be the old capped 100% from independent 3 photos / 4 reviews style math
    expect(steps[3].fromPreviousPct).not.toBe(100);
  });

  it("excludes a review session with no cohort photo from the Photo→Review numerator", () => {
    const events: FirstPartyEventRow[] = [
      ev("photo-ok", "landing_view", "2026-08-24T10:00:00.000Z"),
      ev("photo-ok", "pet_name_submitted", "2026-08-24T10:01:00.000Z"),
      ev("photo-ok", "photo_upload_completed", "2026-08-24T10:02:00.000Z"),
      ev("photo-ok", "order_review_viewed", "2026-08-24T10:03:00.000Z"),

      ev("review-only", "landing_view", "2026-08-24T11:00:00.000Z"),
      ev("review-only", "pet_name_submitted", "2026-08-24T11:01:00.000Z"),
      ev("review-only", "order_review_viewed", "2026-08-24T11:02:00.000Z"),
    ];

    const result = buildLandingCohortSequential(events, {
      rangeFromIso: RANGE_FROM,
      rangeToIso: RANGE_TO,
      measurementReliableFrom: RELIABLE,
    });

    expect(result.cohortCounts.photo_upload_completed).toBe(1);
    expect(result.cohortCounts.order_review_viewed).toBe(1);
    expect(result.rawCounts.order_review_viewed).toBe(2);
  });

  it("excludes sessions outside the reporting landing cohort", () => {
    const events: FirstPartyEventRow[] = [
      ev("in-range", "landing_view", "2026-08-24T10:00:00.000Z"),
      ev("in-range", "pet_name_submitted", "2026-08-24T10:01:00.000Z"),
      ev("in-range", "photo_upload_completed", "2026-08-24T10:02:00.000Z"),

      // Landing outside range — later in-range events must not invent a cohort session
      ev("out-range", "landing_view", "2026-08-20T10:00:00.000Z"),
      ev("out-range", "pet_name_submitted", "2026-08-24T10:01:00.000Z"),
      ev("out-range", "photo_upload_completed", "2026-08-24T10:02:00.000Z"),
      ev("out-range", "order_review_viewed", "2026-08-24T10:03:00.000Z"),
    ];

    const result = buildLandingCohortSequential(events, {
      rangeFromIso: RANGE_FROM,
      rangeToIso: RANGE_TO,
      measurementReliableFrom: RELIABLE,
    });

    expect(result.landingCohortSize).toBe(1);
    expect(result.cohortCounts.landing_view).toBe(1);
    expect(result.cohortCounts.pet_name_submitted).toBe(1);
    expect(result.cohortCounts.photo_upload_completed).toBe(1);
    expect(result.cohortCounts.order_review_viewed).toBe(0);
  });

  it("excludes pre-reliable landings from the certified cohort", () => {
    const events: FirstPartyEventRow[] = [
      ev("pre", "landing_view", "2026-08-23T10:00:00.000Z"),
      ev("pre", "pet_name_submitted", "2026-08-23T10:01:00.000Z"),
      ev("pre", "photo_upload_completed", "2026-08-23T10:02:00.000Z"),
      ev("pre", "order_review_viewed", "2026-08-23T10:03:00.000Z"),

      ev("post", "landing_view", "2026-08-24T10:00:00.000Z"),
      ev("post", "pet_name_submitted", "2026-08-24T10:01:00.000Z"),
    ];

    const result = buildLandingCohortSequential(events, {
      rangeFromIso: "2026-08-20T00:00:00.000Z",
      rangeToIso: RANGE_TO,
      measurementReliableFrom: RELIABLE,
    });

    expect(result.landingCohortSize).toBe(1);
    expect(result.landingCohortSessionIds).toEqual(["post"]);
    expect(result.cohortCounts.order_review_viewed).toBe(0);
  });

  it("keeps Campaign 1 attribution isolated from another campaign", () => {
    const events: FirstPartyEventRow[] = [
      ev("c1", "landing_view", "2026-08-24T10:00:00.000Z", { campaignId: CAMPAIGN_1 }),
      ev("c1", "pet_name_submitted", "2026-08-24T10:01:00.000Z", { campaignId: CAMPAIGN_1 }),
      ev("c1", "photo_upload_completed", "2026-08-24T10:02:00.000Z", { campaignId: CAMPAIGN_1 }),

      ev("c2", "landing_view", "2026-08-24T11:00:00.000Z", { campaignId: CAMPAIGN_OTHER }),
      ev("c2", "pet_name_submitted", "2026-08-24T11:01:00.000Z", { campaignId: CAMPAIGN_OTHER }),
      ev("c2", "photo_upload_completed", "2026-08-24T11:02:00.000Z", { campaignId: CAMPAIGN_OTHER }),
      ev("c2", "order_review_viewed", "2026-08-24T11:03:00.000Z", { campaignId: CAMPAIGN_OTHER }),
    ];

    const result = buildLandingCohortSequential(events, {
      rangeFromIso: RANGE_FROM,
      rangeToIso: RANGE_TO,
      measurementReliableFrom: RELIABLE,
      campaignId: CAMPAIGN_1,
    });

    expect(result.landingCohortSize).toBe(1);
    expect(result.cohortCounts.photo_upload_completed).toBe(1);
    expect(result.cohortCounts.order_review_viewed).toBe(0);
  });

  it("preserves raw independent event counts separately from cohort counts", () => {
    const events: FirstPartyEventRow[] = [
      ev("a", "landing_view", "2026-08-24T10:00:00.000Z"),
      ev("a", "pet_name_submitted", "2026-08-24T10:01:00.000Z"),
      ev("a", "photo_upload_completed", "2026-08-24T10:02:00.000Z"),

      ev("b", "landing_view", "2026-08-24T11:00:00.000Z"),
      ev("b", "order_review_viewed", "2026-08-24T11:02:00.000Z"),
    ];

    const result = buildLandingCohortSequential(events, {
      rangeFromIso: RANGE_FROM,
      rangeToIso: RANGE_TO,
      measurementReliableFrom: RELIABLE,
    });

    expect(result.rawCounts.landing_view).toBe(2);
    expect(result.rawCounts.order_review_viewed).toBe(1);
    expect(result.cohortCounts.order_review_viewed).toBe(0);
    expect(result.rawCounts.order_review_viewed).not.toBe(result.cohortCounts.order_review_viewed);
  });

  it("excludes test rows from the cohort", () => {
    const events: FirstPartyEventRow[] = [
      ev("real", "landing_view", "2026-08-24T10:00:00.000Z"),
      ev("real", "pet_name_submitted", "2026-08-24T10:01:00.000Z"),
      {
        funnelSessionId: "test",
        eventName: "landing_view",
        createdAt: "2026-08-24T10:00:00.000Z",
        isTest: true,
      },
      {
        funnelSessionId: "test",
        eventName: "pet_name_submitted",
        createdAt: "2026-08-24T10:01:00.000Z",
        isTest: true,
      },
    ];

    const result = buildLandingCohortSequential(events, {
      rangeFromIso: RANGE_FROM,
      rangeToIso: RANGE_TO,
      measurementReliableFrom: RELIABLE,
    });

    expect(result.landingCohortSize).toBe(1);
    expect(result.cohortCounts.pet_name_submitted).toBe(1);
  });

  it("chains Name → photo_step_viewed → started → completed for diagnostics", () => {
    const events: FirstPartyEventRow[] = [
      ev("full", "landing_view", "2026-08-24T10:00:00.000Z"),
      ev("full", "pet_name_submitted", "2026-08-24T10:01:00.000Z"),
      ev("full", "photo_step_viewed", "2026-08-24T10:02:00.000Z"),
      ev("full", "photo_upload_started", "2026-08-24T10:03:00.000Z"),
      ev("full", "photo_upload_completed", "2026-08-24T10:04:00.000Z"),

      ev("view-only", "landing_view", "2026-08-24T11:00:00.000Z"),
      ev("view-only", "pet_name_submitted", "2026-08-24T11:01:00.000Z"),
      ev("view-only", "photo_step_viewed", "2026-08-24T11:02:00.000Z"),

      ev("name-only", "landing_view", "2026-08-24T12:00:00.000Z"),
      ev("name-only", "pet_name_submitted", "2026-08-24T12:01:00.000Z"),
    ];

    const result = buildLandingCohortSequential(events, {
      rangeFromIso: RANGE_FROM,
      rangeToIso: RANGE_TO,
      measurementReliableFrom: RELIABLE,
    });

    expect(V1_PHOTO_PATH_STAGES).toEqual([
      "pet_name_submitted",
      "photo_step_viewed",
      "photo_upload_started",
      "photo_upload_completed",
    ]);
    expect(result.photoPathStages.map((s) => s.sessions)).toEqual([3, 2, 1, 1]);
    expect(result.photoPathStages[1].fromPreviousPct).toBeCloseTo(66.666, 2);
    expect(result.photoPathStages[2].fromPreviousPct).toBe(50);
    expect(result.photoPathStages[3].fromPreviousPct).toBe(100);
  });

  it("wires V1 landing-cohort RPC into the admin analytics hook", () => {
    const hook = readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), "../../hooks/usePetFunnelAnalytics.ts"),
      "utf8",
    );
    expect(hook).toContain('admin_pet_v1_landing_cohort_funnel');
    expect(hook).toContain("cohort_steps");
    expect(hook).toContain("photo_path_steps");
    expect(hook).toContain("rawSteps");
  });
});
