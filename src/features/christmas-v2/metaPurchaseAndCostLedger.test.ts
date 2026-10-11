import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

function readSrc(relative: string) {
  return readFileSync(resolve(root, relative), "utf8");
}

describe("Christmas V2 Meta Purchase + cost ledger contracts", () => {
  const migration = readSrc(
    "supabase/migrations/20261011180000_christmas_v2_meta_purchase_and_cost_ledger.sql",
  );
  const edgeMeta = readSrc("supabase/functions/_shared/christmas/metaCapi.ts");
  const nodeMeta = readSrc("api/_lib/christmas/metaCapi.ts");
  const edgeFulfill = readSrc("supabase/functions/_shared/christmas/stripeFulfill.ts");
  const edgeFunnel = readSrc("supabase/functions/christmas-funnel/index.ts");
  const nodeFunnel = readSrc("api/christmas-funnel.ts");
  const edgeCost = readSrc("supabase/functions/_shared/christmas/costLedger.ts");
  const nodeCost = readSrc("api/_lib/christmas/costLedger.ts");
  const orderPage = readSrc("src/features/christmas-v2/ChristmasV2FunnelPage.tsx");
  const pixel = readSrc("src/lib/metaPixel.ts");

  it("uses stable christmas_purchase_${orderId} event_id for Pixel/CAPI dedupe", () => {
    expect(edgeMeta).toContain("christmas_purchase_${orderId}");
    expect(nodeMeta).toContain("christmas_purchase_${orderId}");
    expect(edgeFunnel).toContain("christmas_purchase_");
    expect(nodeFunnel).toContain("christmas_purchase_");
    expect(orderPage).toContain("trackMetaPurchaseOnce");
    expect(orderPage).toContain("metaEventId");
    expect(orderPage).toContain('currency: (data.order.currency || "EUR").toUpperCase()');
  });

  it("fires Meta Purchase only after paid fulfill via claim/finalize RPCs", () => {
    expect(migration).toContain("christmas_v2_claim_meta_purchase_delivery");
    expect(migration).toContain("christmas_v2_finalize_meta_purchase_delivery");
    expect(migration).toContain("not_paid");
    expect(migration).toContain("already_sent");
    expect(migration).toContain("in_flight");
    expect(migration).toContain("permanently_failed");
    expect(edgeFulfill).toContain("emitChristmasV2MetaPurchase");
    expect(edgeFunnel).toContain("emitChristmasV2MetaPurchase");
    expect(nodeFunnel).toContain("emitChristmasV2MetaPurchase");
  });

  it("gates live CAPI transmission and never blocks payment on Meta outage", () => {
    expect(edgeMeta).toContain("christmasMetaCapiTransmissionAllowed");
    expect(edgeMeta).toContain("CHRISTMAS_META_CAPI_LIVE");
    expect(edgeMeta).toContain("META_TEST_EVENT_CODE");
    expect(edgeMeta).toContain("live_gated");
    expect(edgeMeta).toMatch(/Never throws|never fail|catch/);
    expect(edgeFulfill).toContain("waitUntil");
    expect(nodeFunnel).toContain("waitUntil");
    expect(edgeMeta).not.toMatch(/META_CAPI_ACCESS_TOKEN["']?\s*[:=]\s*["'][^"']+["']/);
    expect(nodeMeta).not.toMatch(/META_CAPI_ACCESS_TOKEN["']?\s*[:=]\s*["'][^"']+["']/);
  });

  it("preserves fbc/fbp on order and reuses pet sanitizers", () => {
    expect(migration).toContain("meta_fbc");
    expect(migration).toContain("meta_fbp");
    expect(edgeMeta).toContain("persistChristmasMetaClickIds");
    expect(edgeFunnel).toContain("persistChristmasMetaClickIds");
    expect(nodeFunnel).toContain("persistChristmasMetaClickIds");
    expect(readSrc("src/features/christmas-v2/useChristmasEmbeddedCheckout.ts")).toContain(
      "getMetaCapiClickIds",
    );
    expect(edgeMeta).toContain('from "../pet/meta.ts"');
  });

  it("records cost estimates separately from actual billed amounts", () => {
    expect(migration).toContain("estimated_cost_usd");
    expect(migration).toContain("actual_cost_usd");
    expect(migration).toContain("estimate_catalog_not_provider_invoice");
    expect(migration).toContain("null, -- actual unknown");
    expect(migration).toContain("on conflict (provider, prediction_id)");
    expect(edgeCost).toContain("christmas_v2_ai_cost_ledger_record_attempt");
    expect(nodeCost).toContain("christmas_v2_ai_cost_ledger_record_attempt");
    expect(readSrc("api/christmas-generate.ts")).toContain("recordChristmasV2ImageCost");
    expect(readSrc("api/christmas-generate-video.ts")).toContain("recordChristmasV2VideoCost");
    expect(readSrc("supabase/functions/christmas-generate/index.ts")).toContain(
      "recordChristmasV2ImageCost",
    );
  });

  it("marks ROAS/CPA unavailable and keeps EUR package amounts in economics views", () => {
    expect(migration).toContain("ad_spend_unavailable");
    expect(migration).toContain("christmas_v2_order_economics");
    expect(migration).toContain("christmas_v2_package_economics");
    expect(migration).toContain("purchase_kind");
    expect(migration).toContain("ai_cogs_estimated_usd");
    expect(pixel).toContain("currency?: string");
    expect(pixel).toContain("sku?: string");
  });

  it("restricts meta delivery + cost RPCs away from anon/authenticated customers", () => {
    expect(migration).toContain("revoke all on function public.christmas_v2_claim_meta_purchase_delivery");
    expect(migration).toContain("to service_role");
    expect(migration).toContain("revoke all on table public.christmas_v2_meta_deliveries from anon");
    expect(migration).toContain(
      "revoke all on function public.christmas_v2_ai_cost_ledger_record_attempt",
    );
  });
});
