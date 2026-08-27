import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { v3FiltersActive, v3RpcFilterArgs } from "./v3AnalyticsFilters";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

function readSrc(relative: string) {
  return readFileSync(resolve(root, relative), "utf8");
}

describe("V3 dashboard attribution filters", () => {
  it("maps UI filters to parameterized RPC args with null defaults", () => {
    expect(v3RpcFilterArgs({})).toEqual({
      p_funnel_version: "v3",
      p_campaign_id: null,
      p_adset_id: null,
      p_ad_id: null,
      p_creative_id: null,
      p_utm_source: null,
      p_utm_medium: null,
    });
    expect(
      v3RpcFilterArgs({
        campaignId: "120000000001",
        adsetId: "220000000001",
        creativeId: "cat-v3-creative-01",
        utmSource: "meta",
        utmMedium: "paid_social",
      }),
    ).toEqual({
      p_funnel_version: "v3",
      p_campaign_id: "120000000001",
      p_adset_id: "220000000001",
      p_ad_id: null,
      p_creative_id: "cat-v3-creative-01",
      p_utm_source: "meta",
      p_utm_medium: "paid_social",
    });
  });

  it("detects when attribution filters are active", () => {
    expect(v3FiltersActive({})).toBe(false);
    expect(v3FiltersActive({ utmSource: "meta" })).toBe(true);
  });

  it("uses parameterized SQL with AND-combined filters in migration", () => {
    const sql = readSrc("supabase/migrations/20260826200000_pet_v3_checkout_event_and_filters.sql");
    expect(sql).toContain("p_campaign_id text default null");
    expect(sql).toContain("and (campaign_filter is null or e.campaign_id = campaign_filter)");
    expect(sql).toContain("count(distinct funnel_session_id)");
    expect(sql).not.toMatch(/execute\s+format/i);
    expect(sql).not.toMatch(/'\s*\|\|\s*p_campaign_id/i);
  });

  it("wires empty default attribution filters through the analytics hook RPC calls", () => {
    const hook = readSrc("src/hooks/usePetFunnelAnalytics.ts");
    expect(hook).toContain("v3RpcFilterArgs(v3Filters)");
    expect(hook).toContain("EMPTY_V3_ANALYTICS_FILTERS");
    expect(hook).toContain('admin_pet_v3_funnel_step_counts"');
    expect(hook).toContain('admin_pet_v3_dashboard_context"');
    const page = readSrc("src/pages/admin/PetFunnelAnalyticsPage.tsx");
    expect(page).not.toContain("V3 attribution filters");
    expect(page).not.toContain("setV3Filters");
  });
});
