import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { FUNNEL_HEALTH_STATES, isFunnelHealthState } from "./funnelHealth";
import {
  FUNNEL_REGISTRY,
  REQUIRED_FUNNEL_IDS,
  isRequiredFunnelId,
  requiredFunnels,
} from "./funnelRegistry";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

function readSrc(relative: string) {
  return readFileSync(resolve(root, relative), "utf8");
}

describe("funnelRegistry", () => {
  it("lists every required pet and Christmas funnel", () => {
    expect([...REQUIRED_FUNNEL_IDS]).toEqual([
      "pet_v1",
      "pet_v2",
      "pet_v3",
      "christmas_v2",
      "christmas_photo",
      "christmas_family",
      "christmas_couple",
      "christmas_kids",
      "christmas_pet",
      "christmas_santa_video",
      "christmas_card",
      "christmas_tree",
      "christmas_advent",
      "christmas_wishlist",
      "christmas_gift_finder",
      "christmas_messages",
    ]);
    const rows = requiredFunnels();
    expect(rows).toHaveLength(REQUIRED_FUNNEL_IDS.length);
    for (const id of REQUIRED_FUNNEL_IDS) {
      expect(isRequiredFunnelId(id)).toBe(true);
      expect(FUNNEL_REGISTRY[id].id).toBe(id);
    }
    expect(rows.some((row) => row.family === "pet")).toBe(true);
    expect(rows.some((row) => row.family === "christmas")).toBe(true);
    expect(FUNNEL_REGISTRY.christmas_kids.enabled).toBe(false);
    expect(FUNNEL_REGISTRY.pet_v1.channels.meta).toBe(true);
    expect(FUNNEL_REGISTRY.christmas_photo.channels.meta).toBe(false);
    expect(FUNNEL_REGISTRY.christmas_photo.channels.ga4).toBe(false);
  });

  it("does not register send-a-gift on main", () => {
    expect(isRequiredFunnelId("send_a_gift")).toBe(false);
    expect(readSrc("src/features/funnel-analytics/funnelRegistry.ts")).toContain(
      "Send-a-gift is a later primary addition",
    );
  });

  it("wires /admin/funnel-analytics behind AdminRoute", () => {
    const app = readSrc("src/App.tsx");
    expect(app).toContain("funnel-analytics");
    expect(app).toMatch(/<AdminRoute>[\s\S]*funnel-analytics/);
    expect(readSrc("src/layouts/AdminLayout.tsx")).toContain("/admin/funnel-analytics");
    expect(readSrc("src/pages/admin/FunnelAnalyticsPage.tsx")).toContain("Funnel Analytics");
  });

  it("keeps Supabase behind the service layer and forbids mock runtime data", () => {
    const page = readSrc("src/pages/admin/FunnelAnalyticsPage.tsx");
    const hook = readSrc("src/hooks/useFunnelAnalyticsRegistry.ts");
    const service = readSrc("src/features/funnel-analytics/funnelAnalyticsService.ts");
    expect(page).not.toContain("from \"@/lib/supabase\"");
    expect(page).not.toContain("from '@/lib/supabase'");
    expect(hook).toContain("loadFunnelAnalyticsRegistry");
    expect(hook).not.toContain("from \"@/lib/supabase\"");
    expect(service).toContain('from("pet_funnel_events")');
    expect(service).toContain('from("christmas_funnel_events")');
    expect(service).toContain('from("pet_meta_daily_metrics")');
    expect(service).toContain('from("pet_ga4_daily_metrics")');
    expect(service).toContain('from("pet_analytics_sync_runs")');
    expect(service).not.toMatch(/mock[A-Z]|MOCK_|fakeRows|placeholderRows/);
  });

  it("allows only healthy|degraded|unverified|disabled", () => {
    expect([...FUNNEL_HEALTH_STATES]).toEqual(["healthy", "degraded", "unverified", "disabled"]);
    expect(isFunnelHealthState("healthy")).toBe(true);
    expect(isFunnelHealthState("ok")).toBe(false);
    expect(isFunnelHealthState("warning")).toBe(false);
  });
});
