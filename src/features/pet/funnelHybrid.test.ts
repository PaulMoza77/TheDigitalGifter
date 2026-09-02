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
  classifyPetCheckoutForAnalytics,
  classifyPetOrderForAnalytics,
  classifyRangeMode,
  mergeMetaAdRows,
  safeCpaCents,
  safeCpcCents,
  safeRoas,
  safeCtrPct,
} from "./funnelHybrid";
import { mapMetaInsightRowForTests } from "./metaInsightMap";
import {
  actionValue,
  preferredActionValue,
  tallyMetaActionAliases,
} from "../../../supabase/functions/_shared/pet/metaActionValue";
import {
  BUILTIN_PET_META_CAMPAIGN_IDS,
  filterPetMetaInsightRows,
  isExcludedNonPetCampaignName,
  mergePetMetaCampaignAllowlist,
  parsePetMetaCampaignIds,
} from "../../../supabase/functions/_shared/pet/metaCampaignAllowlist";

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
    expect(stages[0].value).toBe(0);
    expect(stages[0].source).toBe("first_party");
    expect(stages[1].value).toBe(0);
    expect(stages[1].source).toBe("first_party");
    expect(stages[2].value).toBe(0);
    expect(stages[3].value).toBe(0);
    expect(stages[4].value).toBe(1);
    expect(stages[4].source).toBe("backend_truth");
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
    expect(stages.slice(0, 4).every((s) => s.source === "first_party")).toBe(true);
    expect(stages[4].source).toBe("backend_truth");
    expect(stages[4].value).toBe(2);
    expect(stages[5].source).toBe("stripe_verified");
    expect(stages[0].value).toBe(10);
    expect(stages[5].value).toBe(1);

    const kpis = buildHybridKpis({
      stages,
      spendCents: 5000,
      impressions: 1000,
      linkClicks: 40,
      revenueCents: 2700,
      metaLpv: 999,
      metaPurchaseValueCents: 0,
      metaAttributedPurchases: 0,
    });
    expect(kpis.metaLpv).toBe(999);
    expect(kpis.firstPartyLandings).toBe(10);
    expect(kpis.names).toBe(6);
    expect(kpis.landingToPurchase).toBeCloseTo(10);
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
    expect(kpis.freeDiscountOrders).toBe(0);
  });

  it("keeps 100% promo comps and Stripe test orders out of paid purchase KPIs", () => {
    expect(
      classifyPetOrderForAnalytics({
        stripeCheckoutSessionId: "promo:VTM99:order-1",
        chargedAmountCents: 0,
        amountCents: 5900,
        discountPercent: 100,
        stripePaymentStatus: "no_payment_required",
      }),
    ).toBe("free");
    expect(
      classifyPetOrderForAnalytics({
        stripeCheckoutSessionId: "cs_test_123",
        chargedAmountCents: 2700,
        amountCents: 2700,
        discountPercent: 0,
        stripePaymentStatus: "paid",
      }),
    ).toBe("test");
    expect(
      classifyPetOrderForAnalytics({
        stripeCheckoutSessionId: "cs_live_123",
        stripePaymentIntentId: "pi_live_123",
        chargedAmountCents: 2700,
        amountCents: 2700,
        discountPercent: 0,
        stripePaymentStatus: "paid",
      }),
    ).toBe("paid");

    const stages = buildHybridStages({
      mode: "first_party",
      firstPartyCounts: emptyStepCounts(),
      backendCheckouts: 6,
      backendPurchases: 0,
      meta: {
        landingPageViews: 10,
        initiateCheckouts: 6,
        purchases: 6,
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
      spendCents: 4623,
      impressions: 1000,
      linkClicks: 40,
      revenueCents: 0,
      metaPurchaseValueCents: 0,
      metaAttributedPurchases: 0,
      freeDiscountOrders: 6,
    });
    expect(kpis.purchases).toBe(0);
    expect(kpis.revenueCents).toBe(0);
    expect(kpis.cpaCents).toBeNull();
    expect(kpis.roas).toBe(0);
    expect(kpis.freeDiscountOrders).toBe(6);
  });

  it("counts only production customer Stripe Checkout initiations", () => {
    expect(
      classifyPetCheckoutForAnalytics({
        stripeSessionId: "cs_live_abc",
        emailNormalized: "buyer@gmail.com",
        isAdminEmail: false,
      }),
    ).toBe("customer");
    expect(
      classifyPetCheckoutForAnalytics({
        stripeSessionId: "cs_live_abandoned",
        emailNormalized: "buyer@gmail.com",
        isAdminEmail: false,
        stripePaymentStatus: null,
      }),
    ).toBe("customer");
    expect(
      classifyPetCheckoutForAnalytics({
        stripeSessionId: "cs_test_abc",
        emailNormalized: "buyer@gmail.com",
      }),
    ).toBe("test");
    expect(
      classifyPetCheckoutForAnalytics({
        stripeSessionId: "cs_live_abc",
        emailNormalized: "verify@example.com",
      }),
    ).toBe("test");
    expect(
      classifyPetCheckoutForAnalytics({
        stripeSessionId: "promo:VTM99:order-1",
        emailNormalized: "friend@icloud.com",
        discountPercent: 100,
        stripePaymentStatus: "no_payment_required",
      }),
    ).toBe("promo");
    expect(
      classifyPetCheckoutForAnalytics({
        stripeSessionId: "cs_live_abc",
        emailNormalized: "owner@gmail.com",
        isAdminEmail: true,
      }),
    ).toBe("internal");

    const stages = buildHybridStages({
      mode: "historical",
      firstPartyCounts: emptyStepCounts(),
      backendCheckouts: 0,
      backendPurchases: 0,
      meta: {
        landingPageViews: 42,
        initiateCheckouts: 10,
        purchases: 6,
        petNameSubmitted: null,
        photoUploadCompleted: null,
        orderReviewViewed: null,
      },
      ga4: {
        landingViews: 0,
        petNameSubmitted: null,
        photoUploadCompleted: null,
        orderReviewViewed: null,
        beginCheckouts: 8,
      },
    });
    const kpis = buildHybridKpis({
      stages,
      spendCents: 4623,
      impressions: 1000,
      linkClicks: 40,
      revenueCents: 0,
      metaPurchaseValueCents: 0,
      metaAttributedPurchases: 0,
    });
    expect(stages[4].value).toBe(0);
    expect(stages[4].source).toBe("backend_truth");
    expect(kpis.checkouts).toBe(0);
    expect(kpis.costPerCheckoutCents).toBeNull();
  });

  it("allowlists only explicit pet Meta campaign IDs and drops Minutes Guides spend", () => {
    expect(BUILTIN_PET_META_CAMPAIGN_IDS).toEqual([
      "120253346791240170",
      "120253465585030170",
      "120253518796930170",
    ]);
    expect(parsePetMetaCampaignIds("120253346791240170, 120299999999999999")).toEqual([
      "120253346791240170",
      "120299999999999999",
    ]);
    expect(mergePetMetaCampaignAllowlist(["120253346791240170"], ["120253181963650170"])).toEqual([
      "120253346791240170",
      "120253181963650170",
    ]);
    expect(isExcludedNonPetCampaignName("2nd try")).toBe(true);
    expect(isExcludedNonPetCampaignName("Smart Deal Budget 1st campaign")).toBe(true);
    expect(isExcludedNonPetCampaignName("TDG - Dog campaign")).toBe(false);
    expect(
      filterPetMetaInsightRows(
        [
          { campaign_id: "120253346791240170", campaign_name: "TDG - Dog campaign", spend_cents: 2610 },
          { campaign_id: "120253181963650170", campaign_name: "2nd try", spend_cents: 2013 },
        ],
        ["120253346791240170", "120253181963650170"],
      ),
    ).toEqual([{ campaign_id: "120253346791240170", campaign_name: "TDG - Dog campaign", spend_cents: 2610 }]);
    expect(filterPetMetaInsightRows([{ campaign_id: "120253181963650170", campaign_name: "2nd try" }], [])).toEqual([]);
    expect(safeCpcCents(2610, 30)).toBe(87);
    expect(safeCtrPct(30, 1582)).toBeCloseTo((30 / 1582) * 100);
  });

  it("does not double-count Meta omni action aliases against Ads Manager columns", () => {
    const actions = [
      { action_type: "landing_page_view", value: "20" },
      { action_type: "omni_landing_page_view", value: "20" },
      { action_type: "initiate_checkout", value: "3" },
      { action_type: "omni_initiated_checkout", value: "3" },
      { action_type: "purchase", value: "1" },
      { action_type: "omni_purchase", value: "1" },
    ];
    expect(actionValue(actions, ["landing_page_view", "omni_landing_page_view"])).toBe(40);
    expect(preferredActionValue(actions, ["landing_page_view", "omni_landing_page_view"])).toBe(20);
    expect(preferredActionValue(actions, ["initiate_checkout", "omni_initiated_checkout"])).toBe(3);
    expect(preferredActionValue(actions, ["purchase", "omni_purchase"])).toBe(1);
    expect(preferredActionValue([{ action_type: "omni_landing_page_view", value: "20" }], ["landing_page_view", "omni_landing_page_view"])).toBe(20);

    const mapped = mapMetaInsightRowForTests({
      date_start: "2026-08-22",
      campaign_id: "120253346791240170",
      ad_id: "1",
      spend: "26.44",
      actions,
    });
    expect(mapped.landing_page_views).toBe(20);
    expect(mapped.initiate_checkouts).toBe(3);
    expect(mapped.purchases).toBe(1);

    expect(
      tallyMetaActionAliases([{ actions }]),
    ).toEqual({
      landing_page_view: 20,
      omni_landing_page_view: 20,
      initiate_checkout: 3,
      omni_initiated_checkout: 3,
      purchase: 1,
      omni_purchase: 1,
    });
    expect(readSrc("supabase/functions/_shared/pet/metaAds.ts")).toContain("preferredActionValue");
    expect(readSrc("supabase/functions/_shared/pet/metaAds.ts")).not.toContain(
      'actionValue(actions, ["landing_page_view", "omni_landing_page_view"])',
    );
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
    const paidSql = readSrc("supabase/migrations/20260822140000_pet_analytics_paid_vs_comp.sql");
    expect(paidSql).toContain("pet_order_analytics_class");
    expect(paidSql).toContain("free_orders");
    expect(paidSql).toContain("analytics_class = 'paid'");
    expect(paidSql).toContain("analytics_class = 'test'");
    const checkoutSql = readSrc("supabase/migrations/20260822150000_pet_analytics_customer_checkouts.sql");
    expect(checkoutSql).toContain("pet_checkout_analytics_class");
    expect(checkoutSql).toContain("analytics_class = 'customer'");
    expect(checkoutSql).toContain("promo_checkouts");
    const allowSql = readSrc("supabase/migrations/20260822160000_pet_meta_campaign_allowlist.sql");
    expect(allowSql).toContain("pet_meta_campaign_allowlist");
    const geoSql = readSrc("supabase/migrations/20260902171000_pet_funnel_exclude_internal_geos.sql");
    expect(geoSql).toContain("pet_funnel_country_is_internal");
    expect(geoSql).toContain("and not public.pet_funnel_country_is_internal(g.country)");
    expect(geoSql).toContain("'romania', 'italy'");
    expect(allowSql).toContain("120253346791240170");
    expect(allowSql).toContain("purge_unallowlisted_pet_meta_metrics");
    expect(allowSql).toContain("a.campaign_id = m.campaign_id");
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
    expect(envExample).toContain("PET_META_CAMPAIGN_IDS");
    expect(envExample).toContain("GA4_PROPERTY_ID");
    const ga4 = readSrc("supabase/functions/_shared/pet/ga4Data.ts");
    expect(ga4).not.toMatch(/name:\s*"sessions"[\s\S]{0,120}name:\s*"sessions"/);
    // Documented names only — no live token values.
    expect(envExample).not.toMatch(/^META_ADS_ACCESS_TOKEN=[A-Za-z0-9]/m);
  });

  it("does not reuse CAPI token for Ads Insights", () => {
    const metaAds = readSrc("supabase/functions/_shared/pet/metaAds.ts");
    expect(metaAds).toContain("META_ADS_ACCESS_TOKEN");
    expect(metaAds).not.toContain("META_CAPI_ACCESS_TOKEN");
    expect(metaAds).toContain("PetNameSubmitted");
    expect(metaAds).toContain("cannot be reliably retrieved");
    expect(metaAds).toContain('field: "campaign.id"');
    expect(metaAds).toContain("refusing to sync the entire ad account");
    expect(metaAds).not.toContain("/pet|secret.?life|dog|cat/i");
    expect(readSrc("supabase/functions/pet-analytics-sync/index.ts")).toContain("purge_unallowlisted_pet_meta_metrics");
  });

  it("wires cron + edge function without client-side cron", () => {
    expect(readSrc("api/pet-analytics-cron.ts")).toContain("pet-analytics-sync");
    expect(readSrc("supabase/config.toml")).toContain("pet-analytics-sync");
    expect(readSrc("src/pages/admin/PetFunnelAnalyticsPage.tsx")).toContain("Sync historical data");
    expect(readSrc("src/pages/admin/PetFunnelAnalyticsPage.tsx")).toContain("Meta last synced");
    expect(readSrc("src/pages/admin/PetFunnelAnalyticsPage.tsx")).not.toContain("setInterval");
  });

  it("preserves existing first-party admin RPC wiring", () => {
    expect(readSrc("src/hooks/usePetFunnelAnalytics.ts")).toContain('supabase.rpc("admin_pet_funnel_analytics"');
    expect(readSrc("src/hooks/usePetFunnelAnalytics.ts")).not.toContain("backendPurchases || firstPartyKpis.purchases");
    expect(readSrc("src/hooks/usePetFunnelAnalytics.ts")).not.toContain("backendCheckouts || firstPartyKpis.checkouts");
    expect(readSrc("src/pages/admin/PetFunnelAnalyticsPage.tsx")).toContain("Landing → Purchase");
    expect(readSrc("src/pages/admin/PetFunnelAnalyticsPage.tsx")).toContain("Free / 100% Discount Orders");
    expect(readSrc("src/pages/admin/PetFunnelAnalyticsPage.tsx")).toContain("Production customer Stripe Checkout");
    expect(readSrc("src/pages/admin/PetFunnelAnalyticsPage.tsx")).toContain("Historical detail unavailable");
    expect(readSrc("src/pages/admin/PetFunnelAnalyticsPage.tsx")).toContain("grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4 xl:grid-cols-5");
  });
});
