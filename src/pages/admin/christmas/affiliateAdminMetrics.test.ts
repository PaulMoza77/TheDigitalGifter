import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  adminPayloadHasPii,
  adminPayloadHasSecrets,
  computeAffiliateFunnelMetrics,
} from "./affiliateAdminMetrics";
import type { ChristmasEventRow } from "./christmasAdminTypes";

function event(partial: Partial<ChristmasEventRow>): ChristmasEventRow {
  return {
    id: partial.id || "1",
    event_name: partial.event_name || "affiliate_product_search",
    funnel_session_id: partial.funnel_session_id || "sess",
    product_key: "christmas_planner_2026",
    package_key: null,
    order_id: null,
    locale: "en",
    pathname: "/account/christmas/gifts",
    device_type: "web",
    amount_cents: null,
    utm_source: null,
    utm_campaign: null,
    is_test: false,
    environment: "prod",
    metadata: partial.metadata || { provider: "ebay", source: "idea", price_bucket: "25_50" },
    created_at: partial.created_at || "2026-09-20T10:00:00.000Z",
  };
}

describe("affiliate admin metrics", () => {
  it("computes CTR and source splits without recipient names", () => {
    const rows = [
      event({ event_name: "affiliate_product_search", id: "a" }),
      event({ event_name: "affiliate_product_search", id: "b", metadata: { provider: "ebay", source: "recipient_search", price_bucket: "50_100" } }),
      event({ event_name: "affiliate_product_results_viewed", id: "c", metadata: { provider: "ebay", marketplace: "EBAY_DE", result_count: 4 } }),
      event({ event_name: "affiliate_product_clicked", id: "d", metadata: { provider: "ebay", source: "idea", affiliate_reference_id: "gc_abc12345" } }),
      event({ event_name: "affiliate_product_added_to_planner", id: "e" }),
      event({ event_name: "affiliate_product_search_failed", id: "f", metadata: { reason: "provider_unavailable" } }),
    ];
    const metrics = computeAffiliateFunnelMetrics(rows);
    expect(metrics.searches).toBe(2);
    expect(metrics.clicks).toBe(1);
    expect(metrics.searchToClickCtr).toBe("50%");
    expect(metrics.clicksBySource.giftIdea).toBe(1);
    expect(metrics.clicksBySource.recipientSearch).toBe(0);
    expect(JSON.stringify(metrics)).not.toMatch(/Andreas/);
    expect(adminPayloadHasPii(metrics)).toBe(false);
    expect(adminPayloadHasSecrets({ ebay: { reason: "DISABLED_FEATURE_FLAG", credentialsPresent: true } })).toBe(false);
    expect(adminPayloadHasSecrets({ token: "Bearer abc.def" })).toBe(true);
  });
});

describe("admin affiliate commerce wiring", () => {
  it("exposes provider health and the revenue seam without secrets", () => {
    const page = readFileSync(resolve(process.cwd(), "src/pages/admin/christmas/AffiliateCommercePage.tsx"), "utf8");
    expect(page).toContain("Provider status");
    expect(page).toContain("Awaiting provider reporting");
    expect(page).not.toContain("EBAY_CLIENT_SECRET");
    expect(page).not.toContain("VITE_EBAY");
    expect(page).not.toContain("display_name");
    const edge = readFileSync(resolve(process.cwd(), "supabase/functions/affiliate-product-search/index.ts"), "utf8");
    expect(edge).toContain("admin_status");
    expect(edge).toContain("assertAdmin");
    expect(edge).toContain("credentialsPresent");
    expect(edge).toContain('action === "lookup"');
  });
});
