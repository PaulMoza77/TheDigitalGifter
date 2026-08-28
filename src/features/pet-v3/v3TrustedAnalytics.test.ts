import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

function readSrc(relative: string) {
  return readFileSync(resolve(root, relative), "utf8");
}

describe("V3 ingest security — client cannot self-exclude production KPIs", () => {
  const ingest = readSrc("api/pet-v3-funnel-event.ts");
  const migration = readSrc("supabase/migrations/20260828140000_pet_v3_trusted_analytics_hardening.sql");

  it("production ingest API does not read clientTestFlag in handler", () => {
    expect(ingest).toContain("resolveAuthoritativeV3IsTest");
    expect(ingest).not.toMatch(/clientTestFlag\s*=/);
  });

  it("production ingest uses server registry for internal test", () => {
    expect(ingest).toContain("pet_v3_internal_test_session_status");
    expect(migration).toContain("pet_v3_session_is_internal_test");
  });

  it("does not trust VITE_* public token for test authorization", () => {
    expect(readSrc("src/features/pet-v3/v3TestMode.ts")).not.toContain("VITE_PET_V3_ANALYTICS_TEST_TOKEN");
    expect(readSrc("src/features/pet-v3/v3TestMode.ts")).toContain("fetchV3InternalTestStatus");
  });

  it("SQL classification excludes fbp-only paid_meta", () => {
    expect(migration).toContain("fbp alone is NOT sufficient");
    expect(migration).not.toMatch(/coalesce\(btrim\(p_fbp\).*paid_meta/s);
  });

  it("admin RPC required to register internal test sessions", () => {
    expect(migration).toContain("admin_pet_v3_register_internal_test_session");
    expect(migration).toContain("if not public.is_admin()");
  });

  it("client is_test_request is hint-only in analytics payload", () => {
    expect(readSrc("src/features/pet-v3/analytics.ts")).toContain("Hint only");
  });
});

describe("V3 Stripe Checkout Session architecture", () => {
  it("uses Stripe Checkout Session with ui_mode=elements (not standalone PaymentIntent)", () => {
    const checkout = readSrc("src/features/pet-v3/useV3EmbeddedCheckout.ts");
    const funnel = readSrc("supabase/functions/pet-funnel/index.ts");
    expect(checkout).toContain('"elements"');
    expect(funnel).toContain('params.set("ui_mode", "elements")');
    expect(funnel).toContain("checkout/sessions");
    expect(readSrc("supabase/functions/_shared/pet/v3FunnelEvents.ts")).toContain("v3_checkout_session_created");
  });

  it("trusted KPI event is idempotent per order", () => {
    expect(readSrc("supabase/functions/_shared/pet/v3FunnelEvents.ts")).toContain(
      "v3_checkout_session_created:${input.orderId}",
    );
  });
});

describe("V3 price cohort certification", () => {
  it("does not hardcode git commit time as certified cohort", () => {
    expect(readSrc("src/features/pet-v3/v3Measurement.ts")).not.toContain("2026-08-27T21:11:06");
    expect(readSrc("src/features/pet-v3/v3Measurement.ts")).toContain("PET_V3_PRICE_COHORT_CERTIFIED_AT");
    expect(readSrc("supabase/migrations/20260828140000_pet_v3_trusted_analytics_hardening.sql")).toContain(
      "price_cohort_certified_at",
    );
  });
});
