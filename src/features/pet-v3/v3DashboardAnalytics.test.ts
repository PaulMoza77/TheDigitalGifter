import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  buildV3ExtendedFunnelSteps,
  mapV3CountsToExtendedSteps,
  mapV3CountsToPrimarySteps,
  namedEventCounts,
} from "../pet/funnelDatasetConfig";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

function readSrc(relative: string) {
  return readFileSync(resolve(root, relative), "utf8");
}

describe("V3 dashboard analytics contract", () => {
  it("exposes V1, V2, and V3 dataset selectors in the admin page", () => {
    const page = readSrc("src/pages/admin/PetFunnelAnalyticsPage.tsx");
    expect(page).toContain('(["v1", "v2", "v3"] as const)');
    expect(page).not.toContain('"all"');
  });

  it("loads isolated V3 RPCs when the V3 dataset is selected", () => {
    const hook = readSrc("src/hooks/usePetFunnelAnalytics.ts");
    expect(hook).toContain('datasetId === "v3"');
    expect(hook).toContain('admin_pet_v3_funnel_step_counts');
    expect(hook).toContain('admin_pet_v3_dashboard_context');
    expect(hook).toContain("v3ExtendedSteps");
    expect(hook).toContain('datasetId === "v3" ? asNumber(v3Backend.purchases)');
  });

  it("includes checkout_viewed in the V3 SQL step allow-list", () => {
    const migration = readSrc("supabase/migrations/20260826180000_pet_v3_dashboard_analytics.sql");
    expect(migration).toContain("'v3_checkout_viewed'");
    expect(migration).toContain("admin_pet_v3_dashboard_context");
    expect(migration).toContain("coalesce(o.funnel_variant, 'v1') = 'v3'");
  });

  it("maps checkout_viewed as its own stage between unlock and begin checkout", () => {
    const raw = namedEventCounts([
      { event_name: "v3_landing_view", unique_sessions: 100 },
      { event_name: "v3_upload_completed", unique_sessions: 40 },
      { event_name: "v3_preview_viewed", unique_sessions: 30 },
      { event_name: "v3_unlock_clicked", unique_sessions: 12 },
      { event_name: "v3_checkout_viewed", unique_sessions: 10 },
      { event_name: "v3_begin_checkout", unique_sessions: 4 },
      { event_name: "v3_purchase", unique_sessions: 2 },
    ]);
    const extended = mapV3CountsToExtendedSteps(raw);
    expect(extended.checkout_viewed).toBe(10);
    expect(extended.initiate_checkout).toBe(4);
    expect(extended.checkout_viewed).toBeGreaterThan(extended.initiate_checkout);

    const steps = buildV3ExtendedFunnelSteps(extended);
    expect(steps.map((s) => s.eventName)).toEqual([
      "landing_view",
      "pet_name_submitted",
      "photo_upload_completed",
      "order_review_viewed",
      "checkout_viewed",
      "initiate_checkout",
      "purchase",
    ]);
  });

  it("keeps V2 and V3 primary-step maps isolated", () => {
    const v3 = mapV3CountsToPrimarySteps(
      namedEventCounts([
        { event_name: "v3_landing_view", unique_sessions: 5 },
        { event_name: "v3_begin_checkout", unique_sessions: 1 },
        { event_name: "v2_begin_checkout", unique_sessions: 99 },
      ]),
    );
    expect(v3.landing_view).toBe(5);
    expect(v3.initiate_checkout).toBe(1);
    expect(v3.initiate_checkout).not.toBe(99);
  });

  it("does not use V1 backend purchases when V3 dataset is active", () => {
    const hook = readSrc("src/hooks/usePetFunnelAnalytics.ts");
    expect(hook).toContain('datasetId === "v3" ? asNumber(v3Backend.revenue_cents) : asNumber(backend.revenue_cents)');
    expect(hook).toContain('datasetId === "v3" ? [] : ads');
  });

  it("uses V3-only daily rows instead of generic backend daily when V3 is selected", () => {
    const hook = readSrc("src/hooks/usePetFunnelAnalytics.ts");
    expect(hook).toContain('datasetId === "v3"');
    expect(hook).toContain("v3Context?.daily");
    expect(hook).toContain("v3Context?.checkout_daily");
    expect(hook).toContain('datasetId === "v3"\n            ? []');
    const migration = readSrc("supabase/migrations/20260826220000_pet_v3_daily_chart.sql");
    expect(migration).toContain("'daily'");
    expect(migration).toContain("'checkout_daily'");
    expect(migration).toContain("coalesce(o.funnel_variant, 'v1') = 'v3'");
    expect(migration).toContain("v3_begin_checkout");
    expect(migration).not.toContain("v2_begin_checkout");
    expect(migration).not.toContain("initiate_checkout");
  });

  it("proves Dog V2 and V1 rows cannot appear in the V3 daily chart source", () => {
    const migration = readSrc("supabase/migrations/20260826220000_pet_v3_daily_chart.sql");
    expect(migration).toContain("pet_v3_funnel_events");
    expect(migration).not.toContain("pet_funnel_events");
    expect(migration).not.toContain("funnel_variant, 'v1') = 'v2'");
  });

  it("renders checkout viewed in the V3 dashboard UI", () => {
    const page = readSrc("src/pages/admin/PetFunnelAnalyticsPage.tsx");
    expect(page).toContain('v3_checkout_viewed: "checkout viewed"');
    expect(page).toContain('label="Checkout Viewed"');
    expect(page).toContain("report.v3ExtendedSteps");
  });
});
