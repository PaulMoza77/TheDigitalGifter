import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { emptyStepCounts } from "./funnelDashboard";
import {
  biggestHybridDrop,
  buildDailyPerformance,
  buildHybridKpis,
  buildHybridStages,
  classifyRangeMode,
  mergeMetaAdRows,
  safeCpaCents,
  safeCpcCents,
  safeRoas,
  safeCtrPct,
} from "./funnelHybrid";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

function readSrc(relative: string) {
  return readFileSync(resolve(root, relative), "utf8");
}

describe("pet hybrid funnel analytics", () => {
  it("does not fabricate conversion rates through unavailable historical stages", () => {
    const stages = buildHybridStages({
      mode: "historical",
      firstPartyCounts: emptyStepCounts(),
      backendCheckouts: 1,
      backendPurchases: 0,
      meta: {
        landingPageViews: 34,
        initiateCheckouts: 1,
        purchases: 0,
        petNameSubmitted: null,
        photoUploadCompleted: null,
        orderReviewViewed: null,
      },
      ga4: {
        landingViews: 0,
        petNameSubmitted: null,
        photoUploadCompleted: null,
        orderReviewViewed: null,
        beginCheckouts: 0,
      },
    });
    expect(stages[0].value).toBe(34);
    expect(stages[0].source).toBe("meta");
    expect(stages[1].value).toBeNull();
    expect(stages[1].source).toBe("historical_unavailable");
    expect(stages[2].value).toBeNull();
    expect(stages[3].value).toBeNull();
    expect(stages[4].value).toBe(1);
    expect(stages[5].value).toBe(0);
    expect(stages[5].source).toBe("stripe_verified");
    // No conversion across unavailable stages
    expect(stages[1].fromPreviousPct).toBeNull();
    expect(stages[2].fromPreviousPct).toBeNull();
    expect(stages[3].fromPreviousPct).toBeNull();
    // Available adjacent stages may still report a drop (checkout → purchase).
    expect(biggestHybridDrop(stages)?.from).toBe("Initiate Checkout");
  });

  it("uses first-party funnel once the entire range is after the tracking boundary", () => {
    expect(
      classifyRangeMode("2026-08-21T12:00:00.000Z", "2026-08-22T00:00:00.000Z", "2026-08-21T10:00:00.000Z"),
    ).toBe("first_party");
    expect(
      classifyRangeMode("2026-08-20T00:00:00.000Z", "2026-08-21T00:00:00.000Z", "2026-08-21T10:00:00.000Z"),
    ).toBe("historical");
    expect(
      classifyRangeMode("2026-08-20T00:00:00.000Z", "2026-08-22T00:00:00.000Z", "2026-08-21T10:00:00.000Z"),
    ).toBe("mixed");

    const counts = emptyStepCounts();
    counts.landing_view = 10;
    counts.pet_name_submitted = 6;
    counts.photo_upload_completed = 4;
    counts.order_review_viewed = 3;
    counts.initiate_checkout = 2;
    counts.purchase = 1;
    const stages = buildHybridStages({
      mode: "first_party",
      firstPartyCounts: counts,
      backendCheckouts: 2,
      backendPurchases: 1,
      meta: {
        landingPageViews: 999,
        initiateCheckouts: 9,
        purchases: 9,
        petNameSubmitted: 9,
        photoUploadCompleted: 9,
        orderReviewViewed: 9,
      },
      ga4: {
        landingViews: 0,
        petNameSubmitted: null,
        photoUploadCompleted: null,
        orderReviewViewed: null,
        beginCheckouts: 0,
      },
    });
    expect(stages.every((s) => s.source === "first_party" || s.source === "stripe_verified")).toBe(true);
    expect(stages[0].value).toBe(10);
    expect(stages[5].value).toBe(1);
  });

  it("prefers Stripe purchase truth over Meta attributed purchases for business totals", () => {
    const stages = buildHybridStages({
      mode: "historical",
      firstPartyCounts: emptyStepCounts(),
      backendCheckouts: 2,
      backendPurchases: 1,
      meta: {
        landingPageViews: 40,
        initiateCheckouts: 3,
        purchases: 7,
        petNameSubmitted: null,
        photoUploadCompleted: null,
        orderReviewViewed: null,
      },
      ga4: {
        landingViews: 0,
        petNameSubmitted: null,
        photoUploadCompleted: null,
        orderReviewViewed: null,
        beginCheckouts: 0,
      },
    });
    const kpis = buildHybridKpis({
      stages,
      spendCents: 10000,
      impressions: 1000,
      linkClicks: 50,
      revenueCents: 2700,
      metaPurchaseValueCents: 18900,
      metaAttributedPurchases: 7,
    });
    expect(kpis.purchases).toBe(1);
    expect(kpis.purchasesSource).toBe("stripe_verified");
    expect(kpis.revenueCents).toBe(2700);
    expect(kpis.metaAttributedPurchases).toBe(7);
    expect(kpis.roas).toBeCloseTo(0.27);
  });

  it("computes Meta spend CPA/ROAS and never emits Infinity for zero spend", () => {
    expect(safeRoas(5000, 0)).toBeNull();
    expect(safeCpaCents(0, 2)).toBe(0);
    expect(safeCpaCents(10000, 0)).toBeNull();
    expect(safeCpcCents(10000, 0)).toBeNull();
    expect(safeCtrPct(10, 0)).toBeNull();
    expect(safeRoas(5000, 2500)).toBeCloseTo(2);
    expect(safeCpaCents(10000, 2)).toBe(5000);

    const ads = mergeMetaAdRows(
      [
        {
          campaign_id: "c1",
          campaign_name: "Pet",
          adset_id: "s1",
          adset_name: "Dog",
          ad_id: "a1",
          ad_name: "Dog Creative A",
          spend_cents: 5000,
          impressions: 1000,
          link_clicks: 40,
          landing_page_views: 30,
          initiate_checkouts: 2,
          purchases: 1,
          purchase_value_cents: 2700,
        },
      ],
      [{ ad_id: "a1", upload: 5 }],
    );
    expect(ads[0].roas).toBeCloseTo(2700 / 5000);
    expect(ads[0].cpaCents).toBe(5000);
    expect(ads[0].firstPartyUploads).toBe(5);
  });

  it("builds daily performance without treating missing spend as zero for ROAS", () => {
    const daily = buildDailyPerformance({
      metaDaily: [{ metric_date: "2026-08-20", spend_cents: 1000, landing_page_views: 10, initiate_checkouts: 1, purchases: 0, purchase_value_cents: 0 }],
      backendDaily: [{ metric_date: "2026-08-20", purchases: 0, revenue_cents: 0 }, { metric_date: "2026-08-21", purchases: 1, revenue_cents: 2700 }],
      checkoutDaily: [{ metric_date: "2026-08-21", checkouts: 1 }],
    });
    expect(daily).toHaveLength(2);
    expect(daily[0].spendCents).toBe(1000);
    expect(daily[1].spendCents).toBeNull();
    expect(daily[1].purchases).toBe(1);
    expect(daily[1].roas).toBeNull();
  });

  it("upserts Meta/GA4 rows idempotently via unique grain + on conflict update", () => {
    const sql = readSrc("supabase/migrations/20260821130000_pet_hybrid_analytics.sql");
    expect(sql).toContain("pet_meta_daily_metrics_grain_uidx");
    expect(sql).toContain("pet_ga4_daily_metrics_grain_uidx");
    expect(sql).toContain("on conflict (metric_date, campaign_id, adset_id, ad_id) do update");
    expect(sql).toContain("on conflict (metric_date, source, medium, campaign, device_category, country) do update");
    expect(sql).toContain("backend_current");
    expect(sql).toContain("charged_amount_cents");
    expect(sql).toContain("pet_checkout_sessions");
  });

  it("keeps Ads/GA4 secrets server-only and admin-protects sync", () => {
    const sync = readSrc("supabase/functions/pet-analytics-sync/index.ts");
    expect(sync).toContain("assertAdmin");
    expect(readSrc("supabase/functions/_shared/pet/metaAds.ts")).toContain("META_ADS_ACCESS_TOKEN");
    expect(sync).not.toMatch(/META_ADS_ACCESS_TOKEN\s*=\s*["'][^"']+["']/);
    expect(readSrc("src/pages/admin/PetFunnelAnalyticsPage.tsx")).not.toMatch(/META_ADS_ACCESS_TOKEN\s*=/);
    expect(readSrc("src/hooks/usePetFunnelAnalytics.ts")).not.toContain("META_ADS_ACCESS_TOKEN");
    expect(readSrc("api/pet-analytics-cron.ts")).toContain("PET_ANALYTICS_CRON_SECRET");
    expect(readSrc("api/pet-analytics-cron.ts")).toContain("401");
    const envExample = readSrc(".env.example");
    expect(envExample).toContain("META_AD_ACCOUNT_ID");
    expect(envExample).toContain("GA4_PROPERTY_ID");
    // Documented names only — no live token values.
    expect(envExample).not.toMatch(/^META_ADS_ACCESS_TOKEN=[A-Za-z0-9]/m);
  });

  it("does not reuse CAPI token for Ads Insights", () => {
    const metaAds = readSrc("supabase/functions/_shared/pet/metaAds.ts");
    expect(metaAds).toContain("META_ADS_ACCESS_TOKEN");
    expect(metaAds).not.toContain("META_CAPI_ACCESS_TOKEN");
    expect(metaAds).toContain("PetNameSubmitted");
    expect(metaAds).toContain("cannot be reliably retrieved");
  });

  it("wires cron + edge function without client-side cron", () => {
    expect(readSrc("vercel.json")).toContain("/api/pet-analytics-cron");
    expect(readSrc("supabase/config.toml")).toContain("pet-analytics-sync");
    expect(readSrc("src/pages/admin/PetFunnelAnalyticsPage.tsx")).toContain("Sync historical data");
    expect(readSrc("src/pages/admin/PetFunnelAnalyticsPage.tsx")).toContain("Meta last synced");
    expect(readSrc("src/pages/admin/PetFunnelAnalyticsPage.tsx")).not.toContain("setInterval");
  });

  it("preserves existing first-party admin RPC wiring", () => {
    expect(readSrc("src/hooks/usePetFunnelAnalytics.ts")).toContain('supabase.rpc("admin_pet_funnel_analytics"');
    expect(readSrc("src/pages/admin/PetFunnelAnalyticsPage.tsx")).toContain("Landing → Purchase");
    expect(readSrc("src/pages/admin/PetFunnelAnalyticsPage.tsx")).toContain("Historical detail unavailable");
  });
});
