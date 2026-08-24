import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { firstPartyConversionPct } from "./funnelEventContract";
import {
  V1_EVENT_NAMES,
  V1_FUNNEL_STAGES,
  V2_EVENT_NAMES,
  V2_FUNNEL_STAGES,
  attributedSessionIds,
  buildCampaignCostMetrics,
  buildCompareRows,
  buildV2Kpis,
  buildVariantFunnel,
  compareUsesSharedFirstActionRow,
  filterEventsForCampaign,
  filterEventsForDataset,
  filterMetaRowsByCampaignId,
  filterUnattributedEvents,
  firstActionForVariant,
  funnelVariantNotice,
  measurementReliability,
  resolveCampaignIdFromAttribution,
  resolveSessionCampaignId,
  uniqueSessionsForEvent,
  unattributedShare,
  type CampaignAnalyticsConfig,
  type FirstPartyEventRow,
} from "./funnelCampaignAnalytics";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
function readSrc(relative: string) {
  return readFileSync(resolve(root, relative), "utf8");
}

const CAMPAIGN_A = "120253346791240170";
const CAMPAIGN_B = "120299999999999999";

const configs: CampaignAnalyticsConfig[] = [
  {
    campaignId: CAMPAIGN_A,
    displayName: "TDG DOG - V1",
    funnelVariant: "v1",
    utmCampaignAliases: ["tdg-dog-v1"],
    measurementReliableFrom: "2026-08-24T00:00:00.000Z",
  },
  {
    campaignId: CAMPAIGN_B,
    displayName: "TDG DOG - V2 FREE PREVIEW",
    funnelVariant: "v2_preview",
    utmCampaignAliases: ["tdg-dog-v2"],
    measurementReliableFrom: "2026-08-24T12:00:00.000Z",
  },
];

function event(
  session: string,
  name: string,
  extras: Partial<FirstPartyEventRow> & { createdAt?: string } = {},
): FirstPartyEventRow {
  return {
    funnelSessionId: session,
    eventName: name,
    createdAt: extras.createdAt || "2026-08-24T15:00:00.000Z",
    campaignId: extras.campaignId ?? null,
    adsetId: extras.adsetId ?? null,
    adId: extras.adId ?? null,
    utmCampaign: extras.utmCampaign ?? null,
    species: extras.species ?? "dog",
    deviceType: extras.deviceType ?? "mobile",
    amountCents: extras.amountCents ?? null,
    orderId: extras.orderId ?? null,
    isTest: extras.isTest ?? false,
    pathname: extras.pathname ?? "/pet/dog",
    referrerHost: extras.referrerHost ?? "facebook.com",
  };
}

const mixedEvents: FirstPartyEventRow[] = [
  event("sess-a-1", "landing_view", { campaignId: CAMPAIGN_A, adsetId: "set-a", adId: "ad-a1" }),
  event("sess-a-1", "pet_name_submitted", { campaignId: CAMPAIGN_A, adsetId: "set-a", adId: "ad-a1" }),
  event("sess-a-1", "photo_upload_completed", { campaignId: CAMPAIGN_A, adsetId: "set-a", adId: "ad-a1" }),
  event("sess-a-1", "order_review_viewed", { campaignId: CAMPAIGN_A, adsetId: "set-a", adId: "ad-a1" }),
  event("sess-a-1", "initiate_checkout", { campaignId: CAMPAIGN_A, adsetId: "set-a", adId: "ad-a1" }),
  event("sess-a-1", "purchase", { campaignId: CAMPAIGN_A, adsetId: "set-a", adId: "ad-a1", amountCents: 2700 }),
  event("sess-a-2", "landing_view", { campaignId: CAMPAIGN_A, adsetId: "set-a", adId: "ad-a2" }),
  event("sess-a-2", "pet_name_submitted", { campaignId: CAMPAIGN_A, adsetId: "set-a", adId: "ad-a2" }),
  event("sess-b-1", "v2_landing_view", { campaignId: CAMPAIGN_B, adsetId: "set-b", adId: "ad-b1", pathname: "/pet/dog-v2" }),
  event("sess-b-1", "v2_upload_started", { campaignId: CAMPAIGN_B, adsetId: "set-b", adId: "ad-b1" }),
  event("sess-b-1", "v2_upload_completed", { campaignId: CAMPAIGN_B, adsetId: "set-b", adId: "ad-b1" }),
  event("sess-b-1", "v2_preview_generation_started", { campaignId: CAMPAIGN_B, adsetId: "set-b", adId: "ad-b1" }),
  event("sess-b-1", "v2_preview_generation_completed", { campaignId: CAMPAIGN_B, adsetId: "set-b", adId: "ad-b1" }),
  event("sess-b-1", "v2_preview_viewed", { campaignId: CAMPAIGN_B, adsetId: "set-b", adId: "ad-b1" }),
  event("sess-b-1", "v2_unlock_clicked", { campaignId: CAMPAIGN_B, adsetId: "set-b", adId: "ad-b1" }),
  event("sess-b-1", "v2_begin_checkout", { campaignId: CAMPAIGN_B, adsetId: "set-b", adId: "ad-b1" }),
  event("sess-b-1", "v2_purchase", { campaignId: CAMPAIGN_B, adsetId: "set-b", adId: "ad-b1", amountCents: 2700 }),
  event("sess-b-2", "v2_landing_view", { campaignId: CAMPAIGN_B, adsetId: "set-b", adId: "ad-b2" }),
  event("sess-u-1", "landing_view", { campaignId: null, utmCampaign: null, pathname: "/pet/dog", referrerHost: "facebook.com" }),
  event("sess-u-1", "pet_name_submitted", { campaignId: null }),
  event("sess-test", "landing_view", { campaignId: CAMPAIGN_A, isTest: true }),
  event("sess-test", "purchase", { campaignId: CAMPAIGN_A, isTest: true, amountCents: 2700 }),
];

describe("pet campaign-scoped funnel analytics", () => {
  it("selecting Campaign A excludes Campaign B data", () => {
    const a = filterEventsForCampaign(mixedEvents, configs, CAMPAIGN_A);
    expect(a.every((row) => row.campaignId === CAMPAIGN_A || row.isTest)).toBe(true);
    expect(a.some((row) => row.campaignId === CAMPAIGN_B)).toBe(false);
    expect(uniqueSessionsForEvent(a, "landing_view")).toBe(2);
    expect(uniqueSessionsForEvent(a, "v2_landing_view")).toBe(0);
    expect(uniqueSessionsForEvent(a, "purchase")).toBe(1);
  });

  it("selecting Campaign B excludes Campaign A data", () => {
    const b = filterEventsForCampaign(mixedEvents, configs, CAMPAIGN_B);
    expect(b.some((row) => row.campaignId === CAMPAIGN_A)).toBe(false);
    expect(uniqueSessionsForEvent(b, "v2_landing_view")).toBe(2);
    expect(uniqueSessionsForEvent(b, "landing_view")).toBe(0);
    expect(uniqueSessionsForEvent(b, "v2_purchase")).toBe(1);
    expect(uniqueSessionsForEvent(b, "purchase")).toBe(0);
  });

  it("Meta filter uses campaign ID", () => {
    const rows = [
      { campaign_id: CAMPAIGN_A, spend_cents: 5000, landing_page_views: 40 },
      { campaign_id: CAMPAIGN_B, spend_cents: 9000, landing_page_views: 12 },
    ];
    expect(filterMetaRowsByCampaignId(rows, CAMPAIGN_A)).toEqual([rows[0]]);
    expect(filterMetaRowsByCampaignId(rows, CAMPAIGN_B)).toEqual([rows[1]]);
    const isolatedSql = readSrc("supabase/migrations/20260824230000_pet_dataset_isolated_analytics.sql");
    expect(isolatedSql).toContain("p_campaign_id");
    expect(isolatedSql).toMatch(/m\.campaign_id = p_campaign_id/);
    expect(isolatedSql).toContain("funnel_variant");
    expect(isolatedSql).toContain("pet_v2_funnel_events");
  });

  it("first-party 6-card funnel is dataset/table scoped, not campaign_id scoped", () => {
    expect(resolveCampaignIdFromAttribution({ campaignId: CAMPAIGN_A }, configs)).toBe(CAMPAIGN_A);
    expect(resolveCampaignIdFromAttribution({ campaignId: CAMPAIGN_B }, configs)).toBe(CAMPAIGN_B);
    const aSessions = attributedSessionIds(mixedEvents, configs, CAMPAIGN_A);
    const bSessions = attributedSessionIds(mixedEvents, configs, CAMPAIGN_B);
    expect([...aSessions].some((id) => bSessions.has(id))).toBe(false);
    const v1 = filterEventsForDataset(mixedEvents, "v1");
    const v2 = filterEventsForDataset(mixedEvents, "v2_preview");
    expect(uniqueSessionsForEvent(v1, "landing_view")).toBe(3);
    expect(uniqueSessionsForEvent(v1, "v2_landing_view")).toBe(0);
    expect(uniqueSessionsForEvent(v2, "v2_landing_view")).toBe(2);
    expect(uniqueSessionsForEvent(v2, "landing_view")).toBe(0);
    const sql = readSrc("supabase/migrations/20260824230000_pet_dataset_isolated_analytics.sql");
    expect(sql).toContain("= 'v2_preview'");
    expect(sql).not.toMatch(/current_v1 as \([\s\S]{0,600}resolved_campaign_id = campaign_filter/);
  });

  it("does not assign unattributed sessions to a paid campaign", () => {
    const unknown = event("sess-guess", "landing_view", {
      campaignId: null,
      utmCampaign: null,
      pathname: "/pet/dog",
      species: "dog",
      referrerHost: "facebook.com",
    });
    expect(resolveSessionCampaignId([unknown], configs)).toBeNull();
    expect(
      resolveCampaignIdFromAttribution(
        { campaignId: null, utmCampaign: "something-shared" },
        [
          { ...configs[0], utmCampaignAliases: ["shared"] },
          { ...configs[1], utmCampaignAliases: ["shared"] },
        ],
      ),
    ).toBeNull();
    const unattributed = filterUnattributedEvents(mixedEvents, configs);
    expect(unattributed.some((row) => row.funnelSessionId === "sess-u-1")).toBe(true);
    expect(unattributed.some((row) => row.campaignId === CAMPAIGN_A)).toBe(false);
    expect(unattributed.some((row) => row.campaignId === CAMPAIGN_B)).toBe(false);
    expect(filterEventsForCampaign([unknown], configs, CAMPAIGN_A)).toEqual([]);
    expect(unattributedShare(1, 5)).toBe(20);
  });

  it("falls back to a unique configured utm_campaign only", () => {
    const viaUtm = event("sess-utm", "landing_view", { campaignId: null, utmCampaign: "tdg-dog-v2" });
    expect(resolveSessionCampaignId([viaUtm], configs)).toBe(CAMPAIGN_B);
    expect(resolveCampaignIdFromAttribution({ utmCampaign: "tdg-dog-v1" }, configs)).toBe(CAMPAIGN_A);
  });

  it("uses the V1 event schema for a V1 campaign", () => {
    const stages = buildVariantFunnel("v1", filterEventsForCampaign(mixedEvents, configs, CAMPAIGN_A));
    expect(stages.map((s) => s.eventName)).toEqual(V1_FUNNEL_STAGES.map((s) => s.eventName));
    expect(stages.every((s) => V1_EVENT_NAMES.has(s.eventName))).toBe(true);
    expect(stages.some((s) => V2_EVENT_NAMES.has(s.eventName))).toBe(false);
    expect(stages[0].sessions).toBe(2);
    expect(stages[1].sessions).toBe(2);
    expect(stages[5].sessions).toBe(1);
    expect(firstActionForVariant("v1")?.eventName).toBe("pet_name_submitted");
  });

  it("uses the V2 event schema for a V2 campaign", () => {
    const stages = buildVariantFunnel("v2_preview", filterEventsForCampaign(mixedEvents, configs, CAMPAIGN_B));
    expect(stages.map((s) => s.eventName)).toEqual(V2_FUNNEL_STAGES.map((s) => s.eventName));
    expect(stages.every((s) => V2_EVENT_NAMES.has(s.eventName))).toBe(true);
    expect(stages.some((s) => V1_EVENT_NAMES.has(s.eventName))).toBe(false);
    const kpis = buildV2Kpis(filterEventsForCampaign(mixedEvents, configs, CAMPAIGN_B));
    expect(kpis.uploadRate).toBe(50);
    expect(kpis.landingToPreviewViewed).toBe(50);
    expect(firstActionForVariant("v2_preview")?.eventName).toBe("v2_upload_completed");
  });

  it("does not mix incompatible funnel stages in compare mode", () => {
    const rows = buildCompareRows([
      {
        campaignId: CAMPAIGN_A,
        displayName: "TDG DOG - V1",
        funnelVariant: "v1",
        spendCents: 5000,
        impressions: 1000,
        reach: 800,
        linkClicks: 40,
        metaLpv: 42,
        fpLanding: 37,
        firstAction: 12,
        firstActionLabel: "Name Submitted",
        firstActionEvent: "pet_name_submitted",
        orderReview: 8,
        checkout: 4,
        purchase: 2,
        revenueCents: 5400,
        measurementReliableFrom: configs[0].measurementReliableFrom,
      },
      {
        campaignId: CAMPAIGN_B,
        displayName: "TDG DOG - V2 FREE PREVIEW",
        funnelVariant: "v2_preview",
        spendCents: 3000,
        impressions: 900,
        reach: 700,
        linkClicks: 30,
        metaLpv: 20,
        fpLanding: 18,
        firstAction: 10,
        firstActionLabel: "Upload Completed",
        firstActionEvent: "v2_upload_completed",
        previewViewed: 7,
        unlockClicked: 5,
        checkout: 3,
        purchase: 1,
        revenueCents: 2700,
        measurementReliableFrom: configs[1].measurementReliableFrom,
      },
    ]);
    expect(compareUsesSharedFirstActionRow(rows)).toBe(false);
    const firstAction = rows.find((row) => row.key === "first_action");
    expect(firstAction?.values[0].display).toContain("Name Submitted");
    expect(firstAction?.values[1].display).toContain("Upload Completed");
    expect(rows.some((row) => row.label.includes("Order Review") && row.incompatible)).toBe(true);
    expect(rows.some((row) => row.label.includes("Preview Viewed") && row.incompatible)).toBe(true);
    expect(rows.some((row) => row.key === "landing_checkout")).toBe(true);
    expect(rows.some((row) => row.key === "landing_purchase")).toBe(true);
  });

  it("never uses Meta LPV as a first-party conversion denominator", () => {
    const stages = buildVariantFunnel("v1", filterEventsForCampaign(mixedEvents, configs, CAMPAIGN_A));
    expect(stages[1].fromLandingPct).toBe(100);
    expect(firstPartyConversionPct(12, 37, 999)).toBeCloseTo((12 / 37) * 100);
    const page = readSrc("src/pages/admin/PetFunnelAnalyticsPage.tsx");
    expect(page).not.toMatch(/ofPreviousLabel\([^)]*kpis\.lpv/);
    expect(page).not.toMatch(/percent\([^)]*metaLpv/);
  });

  it("keeps ad-set filtering inside the selected campaign", () => {
    const aSetB = [
      ...mixedEvents,
      event("sess-leak", "landing_view", { campaignId: CAMPAIGN_B, adsetId: "set-a", adId: "ad-leak" }),
    ];
    const filtered = filterEventsForCampaign(aSetB, configs, CAMPAIGN_A, "set-a");
    expect(filtered.every((row) => row.campaignId === CAMPAIGN_A)).toBe(true);
    expect(filtered.some((row) => row.funnelSessionId === "sess-leak")).toBe(false);
    expect(uniqueSessionsForEvent(filtered, "landing_view")).toBe(2);
  });

  it("excludes test traffic", () => {
    const a = filterEventsForCampaign(mixedEvents, configs, CAMPAIGN_A);
    expect(a.some((row) => row.isTest)).toBe(false);
    expect(a.some((row) => row.funnelSessionId === "sess-test")).toBe(false);
    const sql = readSrc("supabase/migrations/20260824200000_pet_campaign_analytics.sql");
    expect(sql).toContain("coalesce(is_test, false) = false");
  });

  it("labels pre-reliable history instead of mixing it in silently", () => {
    const warning = measurementReliability({
      rangeFromIso: "2026-08-20T00:00:00.000Z",
      rangeToIso: "2026-08-25T00:00:00.000Z",
      measurementReliableFrom: "2026-08-24T00:00:00.000Z",
    });
    expect(warning.crosses).toBe(true);
    expect(warning.label).toContain("2026-08-24T00:00:00.000Z");
    expect(
      measurementReliability({
        rangeFromIso: "2026-08-24T00:00:00.000Z",
        rangeToIso: "2026-08-25T00:00:00.000Z",
        measurementReliableFrom: "2026-08-24T00:00:00.000Z",
      }).crosses,
    ).toBe(false);
  });

  it("does not invent a funnel when the variant is unmapped", () => {
    expect(funnelVariantNotice(null)).toBe("Funnel variant not configured");
    expect(funnelVariantNotice("v2_preview")).toBeNull();
    expect(firstActionForVariant(null)).toBeNull();
  });

  it("keeps the original analytics page and only adds a compact V1/V2 switch", () => {
    const page = readSrc("src/pages/admin/PetFunnelAnalyticsPage.tsx");
    expect(page).not.toContain("Overall business");
    expect(page).not.toContain("Campaign summary");
    expect(page).not.toContain("Unattributed");
    expect(page).not.toContain("Compare campaigns");
    expect(page).toContain("FUNNEL_DATASETS");
    expect(page).toContain("Campaign 2 not configured yet");
    expect(page).toContain("Meta acquisition");
    expect(page).toContain("First-party funnel");
    expect(page).toContain("inline-flex max-w-full flex-wrap rounded-xl border border-slate-700");
  });

  it("computes campaign-matched cost metrics and coverage warnings", () => {
    const healthy = buildCampaignCostMetrics({
      spendCents: 3700,
      fpLanding: 37,
      firstAction: 12,
      checkout: 4,
      purchase: 2,
      revenueCents: 5400,
      metaLpv: 42,
    });
    expect(healthy.costPerFpLandingCents).toBe(100);
    expect(healthy.costPerFirstActionCents).toBe(308);
    expect(healthy.cpaCents).toBe(1850);
    expect(healthy.attributionCoverageWarning).toBe(false);
    const unhealthy = buildCampaignCostMetrics({
      spendCents: 5000,
      fpLanding: 0,
      firstAction: 0,
      checkout: 0,
      purchase: 0,
      revenueCents: 0,
      metaLpv: 42,
    });
    expect(unhealthy.attributionCoverageWarning).toBe(true);
  });
});
