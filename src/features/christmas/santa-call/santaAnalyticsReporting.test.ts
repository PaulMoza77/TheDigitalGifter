import { describe, expect, it, vi } from "vitest";
import {
  aggregateSanta,
  reportingRange,
  isCommercialOrder,
  normalizeSantaPath,
  trafficGroup,
  type Order,
} from "../../../../supabase/functions/_shared/christmas/santaAnalyticsModel";
import { boundedRows } from "../../../../supabase/functions/_shared/christmas/santaAdminReporting";
import {
  validateGaReport,
  ga4Report,
  metaReport,
} from "../../../../supabase/functions/_shared/christmas/santaAnalyticsSources";
import { snapshotForRange } from "../../../../supabase/functions/_shared/christmas/santaAnalyticsSnapshot";

const now = new Date("2026-11-10T05:00:00Z");
const range = reportingRange({ preset: "7" }, now);
const order = (overrides: Partial<Order> = {}): Order => ({
  id: "order-1",
  product_key: "christmas_santa_voice_call",
  payment_status: "pending",
  amount_cents: 5900,
  charged_amount_cents: null,
  currency: "ron",
  stripe_checkout_session_id: "cs_live_1",
  stripe_payment_intent_id: null,
  created_at: "2026-11-09T12:00:00+00:00",
  paid_at: null,
  refunded_at: null,
  metadata: { stripe_mode: "live" },
  ...overrides,
});
const paid = (o: Partial<Order> = {}) =>
  order({
    payment_status: "paid",
    charged_amount_cents: 5900,
    paid_at: "2026-11-09T13:00:00+00:00",
    stripe_payment_intent_id: "pi_1",
    ...o,
  });
const aggregate = (rows: Order[]) =>
  aggregateSanta(rows, [], range, now.toISOString());
const metric = (rows: Order[], id: string) =>
  aggregate(rows).metrics.find((m) => m.id === id)!.value;

describe("Bucharest reporting boundaries", () => {
  it("uses calendar days and half-open UTC boundaries", () => {
    expect(range).toMatchObject({
      start: "2026-11-04",
      end: "2026-11-10",
      startUtc: "2026-11-03T22:00:00.000Z",
      endUtc: "2026-11-10T22:00:00.000Z",
    });
    expect(reportingRange({ preset: "yesterday" }, now).start).toBe(
      "2026-11-09",
    );
  });
  it.each([
    ["2026-03-29", 23],
    ["2026-10-25", 25],
  ])("handles DST on %s", (day, hours) => {
    const r = reportingRange({ preset: "custom", start: day, end: day }, now);
    expect((Date.parse(r.endUtc) - Date.parse(r.startUtc)) / 3600000).toBe(
      hours,
    );
  });
  it.each([
    { start: "2026-02-30", end: "2026-03-01" },
    { start: "2026-07-01", end: "2026-11-10" },
    { start: "2026-11-11", end: "2026-11-12" },
  ])("rejects invalid, oversized and future ranges", (input) =>
    expect(() => reportingRange({ preset: "custom", ...input }, now)).toThrow(),
  );
});
describe("commercial ledger metrics", () => {
  it("does not count unpaid checkouts as purchases or abandonment", () => {
    expect(metric([order()], "stripe_checkouts")).toBe(1);
    expect(metric([order()], "purchases")).toBe(0);
    expect(metric([order()], "revenue")).toBe(0);
    expect(metric([order()], "abandonment")).toBeNull();
  });
  it("excludes test, synthetic, other-currency and unverified paid orders", () => {
    const rows = [
      paid({ stripe_checkout_session_id: "cs_test_x" }),
      paid({ metadata: { manual_qa: true } }),
      paid({ currency: "usd" }),
      paid({ stripe_checkout_session_id: null }),
      paid({ stripe_payment_intent_id: null }),
    ];
    expect(metric(rows, "purchases")).toBe(0);
    expect(metric(rows, "revenue")).toBe(0);
  });
  it("attributes late payments to paid date without distorting checkout cohort", () => {
    const rows = [
      paid({ created_at: "2026-10-01T12:00:00Z" }),
      order({ id: "order2", stripe_checkout_session_id: "cs_live_2" }),
    ];
    expect(metric(rows, "purchases")).toBe(1);
    expect(metric(rows, "revenue")).toBe(59);
    expect(metric(rows, "conversion")).toBe(0);
  });
  it("separates initial purchases and extensions with exact charged value", () => {
    const rows = [
      paid(),
      paid({
        id: "ext",
        product_key: "christmas_santa_voice_call_extension",
        amount_cents: 4900,
        charged_amount_cents: 4900,
        stripe_checkout_session_id: "cs_live_ext",
      }),
    ];
    expect(metric(rows, "purchases")).toBe(1);
    expect(metric(rows, "extensions")).toBe(1);
    expect(metric(rows, "revenue")).toBe(108);
    expect(metric(rows, "aov")).toBe(54);
    expect(aggregate(rows).daily.reduce((s, d) => s + d.revenue, 0)).toBe(108);
  });
  it("does not invent revenue when charged amount is absent", () =>
    expect(
      metric([paid({ charged_amount_cents: null })], "revenue"),
    ).toBeNull());
  it("retains original gross purchase and identifies refunded orders separately", () => {
    const rows = [
      paid({
        payment_status: "refunded",
        refunded_at: "2026-11-09T14:00:00Z",
        last_refund_at: "2026-11-09T14:00:00Z",
        refunded_amount_cents: 5900,
      }),
    ];
    expect(metric(rows, "purchases")).toBe(1);
    expect(metric(rows, "refunds")).toBe(1);
    expect(metric(rows, "revenue")).toBe(59);
  });
  it("fails closed on duplicated initial checkout IDs", () =>
    expect(() => aggregate([order(), order({ id: "duplicate" })])).toThrow(
      "duplicate_checkout",
    ));
  it("accepts only commercial RON sessions", () =>
    expect(
      isCommercialOrder(order({ metadata: { stripe_mode: "test" } })),
    ).toBe(false));
});
describe("bounded secure sources", () => {
  it("pages beyond 200 and stops when complete", async () => {
    const q = () => ({
      range: (start: number) => ({
        abortSignal: () =>
          Promise.resolve({
            data: start
              ? [{ id: 501 }]
              : Array.from({ length: 500 }, (_, id) => ({ id })),
            error: null,
          }),
      }),
    });
    expect(await boundedRows(q)).toHaveLength(501);
  });
  it("fails on database errors instead of emitting zeros", async () => {
    await expect(
      boundedRows(() => ({
        range: () => ({
          abortSignal: () =>
            Promise.resolve({ error: { message: "sensitive error" } }),
        }),
      })),
    ).rejects.toThrow("report_database_read_failed");
  });
  it("rejects overflow rather than silently truncating", async () => {
    await expect(
      boundedRows(() => ({
        range: () => ({
          abortSignal: () =>
            Promise.resolve({ data: Array(500).fill({}), error: null }),
        }),
      })),
    ).rejects.toThrow("limit_exceeded");
  });
  it("does not fetch providers without credentials", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    expect((await ga4Report(range, () => undefined)).status).toBe(
      "unavailable",
    );
    expect((await metaReport(range, () => undefined)).metrics).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
  it("rejects sampled, truncated or timezone-mismatched GA4 reports", () => {
    expect(() => validateGaReport({ metadata: { timeZone: "UTC" } })).toThrow();
    expect(() =>
      validateGaReport({
        metadata: { timeZone: "Europe/Bucharest", subjectToThresholding: true },
      }),
    ).toThrow();
    expect(() =>
      validateGaReport({
        rows: [],
        rowCount: 1,
        metadata: { timeZone: "Europe/Bucharest" },
      }),
    ).toThrow();
  });
  it("never uses snapshots for a different selected range", () => {
    const raw = JSON.stringify({
      version: 1,
      propertyId: "550164226",
      accountId: "act_1877103439548293",
      campaignId: "120255274308780066",
      timeZone: "Europe/Bucharest",
      start: "2026-11-01",
      end: "2026-11-07",
    });
    expect(snapshotForRange(raw, range)).toEqual({});
  });
  it("normalizes paths without keeping private query params", () => {
    expect(
      normalizeSantaPath(
        "/christmas/santa-call?fbclid=secret&utm_source=facebook",
      ),
    ).toBe("/christmas/santa-call");
    expect(normalizeSantaPath("/santa/call/private-token")).toBeNull();
    expect(trafficGroup("facebook", "paid_social")).toBe(
      "Facebook / Instagram",
    );
    expect(trafficGroup("google", "organic")).toBe("Google organic");
  });
});
