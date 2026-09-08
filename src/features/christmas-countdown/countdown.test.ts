import { describe, expect, it } from "vitest";
import { christmasSignupCsv } from "./csv";
import { coalescePublicConfig, CHRISTMAS_COUNTDOWN_DEFAULTS, publicConfigFromUnknown } from "./defaults";
import { ga4EndDate, ga4StartDate, rangeForChristmasPreset } from "./dateRange";
import {
  buildCountdownFunnel,
  conversionRate,
  formatPct,
  mapGa4DimensionMetricRow,
  mergeDailyPoints,
  signupMethodCounts,
  stepConversionPct,
  yyyymmddToIso,
} from "./metrics";
import { kpisFromSignupAndEventRows } from "../../../supabase/functions/_shared/christmas/firstParty";
import { captureChristmasCountdownAttribution, CHRISTMAS_COUNTDOWN_ATTRIBUTION_KEY } from "./utm";

describe("christmas countdown conversion math", () => {
  it("returns null when unique users is zero", () => {
    expect(conversionRate(12, 0)).toBeNull();
    expect(conversionRate(0, 0)).toBeNull();
    expect(formatPct(conversionRate(12, 0))).toBe("—");
  });

  it("returns null conversion when signup data is missing instead of 0%", () => {
    expect(conversionRate(null, 14)).toBeNull();
    expect(conversionRate(undefined, 14)).toBeNull();
    expect(formatPct(conversionRate(null, 14))).toBe("—");
    expect(conversionRate(0, 14)).toBe(0);
    expect(formatPct(conversionRate(0, 14))).toBe("0.0%");
  });

  it("computes signups / unique users * 100", () => {
    expect(conversionRate(132, 1240)).toBeCloseTo(10.645, 3);
    expect(formatPct(conversionRate(132, 1240))).toBe("10.6%");
  });

  it("computes sequential funnel percentages", () => {
    expect(stepConversionPct(184, 1240)).toBeCloseTo((184 / 1240) * 100, 6);
    expect(stepConversionPct(132, 184)).toBeCloseTo((132 / 184) * 100, 6);
    expect(stepConversionPct(41, 132)).toBeCloseTo((41 / 132) * 100, 6);
    expect(stepConversionPct(10, 0)).toBeNull();
  });

  it("builds visitor → joined → returned funnel from real counts only", () => {
    const steps = buildCountdownFunnel({
      visitors: 1240,
      joinStarted: 184,
      joined: 132,
      returned: 41,
    });
    expect(steps[0]?.count).toBe(1240);
    expect(steps[1]?.fromPreviousPct).toBeCloseTo((184 / 1240) * 100, 6);
    expect(steps[2]?.fromPreviousPct).toBeCloseTo((132 / 184) * 100, 6);
    expect(steps[3]?.fromPreviousPct).toBeCloseTo((41 / 132) * 100, 6);
  });

  it("keeps funnel join steps unknown when first-party data failed to load", () => {
    const steps = buildCountdownFunnel({
      visitors: 14,
      joinStarted: null,
      joined: null,
      returned: null,
    });
    expect(steps[0]?.count).toBe(14);
    expect(steps[1]?.count).toBeNull();
    expect(steps[2]?.count).toBeNull();
    expect(steps[3]?.count).toBeNull();
    expect(steps[1]?.fromPreviousPct).toBeNull();
    expect(formatPct(steps[2]?.fromPreviousPct ?? null)).toBe("—");
  });

  it("keeps funnel join steps when GA4 visitors are missing", () => {
    const steps = buildCountdownFunnel({
      visitors: null,
      joinStarted: 4,
      joined: 2,
      returned: 0,
    });
    expect(steps[0]?.count).toBeNull();
    expect(steps[1]?.fromPreviousPct).toBeNull();
    expect(steps[2]?.fromPreviousPct).toBe(50);
  });
});

describe("christmas countdown date filtering", () => {
  const now = new Date("2026-09-08T15:00:00.000Z");

  it("resolves today / 7d / 30d / all time", () => {
    expect(rangeForChristmasPreset("today", now)).toEqual({ preset: "today", from: "2026-09-08", to: "2026-09-08" });
    expect(rangeForChristmasPreset("7d", now)).toEqual({ preset: "7d", from: "2026-09-02", to: "2026-09-08" });
    expect(rangeForChristmasPreset("30d", now)).toEqual({ preset: "30d", from: "2026-08-10", to: "2026-09-08" });
    expect(rangeForChristmasPreset("all", now).from).toBe("2024-01-01");
    expect(rangeForChristmasPreset("all", now).to).toBe("2026-09-08");
  });

  it("supports a custom range and swaps inverted bounds", () => {
    const range = rangeForChristmasPreset("custom", now, { from: "2026-09-10", to: "2026-09-01" });
    expect(range).toEqual({ preset: "custom", from: "2026-09-01", to: "2026-09-10" });
    expect(ga4StartDate(range)).toBe("2026-09-01");
    expect(ga4EndDate(range)).toBe("2026-09-10");
  });
});

describe("GA4 response mapping", () => {
  it("maps dimension/metric rows and yyyymmdd dates", () => {
    expect(yyyymmddToIso("20260908")).toBe("2026-09-08");
    const mapped = mapGa4DimensionMetricRow({
      dimensionValues: [{ value: "20260908" }, { value: "google" }],
      metricValues: [{ value: "12" }, { value: "4" }],
    });
    expect(mapped.dimensions).toEqual(["20260908", "google"]);
    expect(mapped.metrics).toEqual([12, 4]);
  });

  it("merges daily traffic points", () => {
    const merged = mergeDailyPoints([
      { date: "2026-09-07", views: 10, users: 4 },
      { date: "2026-09-07", views: 3, users: 1 },
      { date: "bad", views: 9, users: 9 },
    ]);
    expect(merged).toEqual([{ date: "2026-09-07", views: 13, users: 5 }]);
  });
});

describe("signup method counts and CSV", () => {
  it("counts first-party KPIs from signup and event rows", () => {
    const kpis = kpisFromSignupAndEventRows(
      [
        { signup_method: "email", created_at: "2026-09-08T00:00:00.000Z", last_seen_at: "2026-09-08T00:00:00.000Z" },
        { signup_method: "google", created_at: "2026-09-08T00:00:00.000Z", last_seen_at: "2026-09-09T00:00:00.000Z" },
      ],
      [
        { event_name: "christmas_page_view", funnel_session_id: "s1", pathname: "/christmas" },
        { event_name: "christmas_join_started", funnel_session_id: "s1", pathname: "/christmas" },
        { event_name: "christmas_join_completed", funnel_session_id: "s1", pathname: "/christmas" },
      ],
    );
    expect(kpis.signups_total).toBe(2);
    expect(kpis.signups_email).toBe(1);
    expect(kpis.signups_google).toBe(1);
    expect(kpis.signups_returning).toBe(1);
    expect(kpis.join_started_sessions).toBe(1);
    expect(kpis.join_completed_sessions).toBe(1);
  });

  it("counts email vs google", () => {
    expect(
      signupMethodCounts([{ signup_method: "email" }, { signup_method: "google" }, { signup_method: "google" }]),
    ).toEqual({ email: 1, google: 2, total: 3 });
  });

  it("exports filtered signup columns without internal ids", () => {
    const csv = christmasSignupCsv([
      {
        email: "ada@example.com",
        signup_method: "email",
        created_at: "2026-09-08T00:00:00.000Z",
        source: "meta",
        medium: "paid_social",
        campaign: "xmas",
        referrer: "facebook.com",
        user_id: null,
        last_seen_at: "2026-09-08T00:00:00.000Z",
      },
    ]);
    expect(csv.split("\n")[0]).toBe("email,signup_method,joined_at,source,medium,campaign,referrer,user_status,returning");
    expect(csv).toContain("ada@example.com");
    expect(csv).toContain("email-only");
    expect(csv).not.toContain("user_id");
    expect(csv).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}/i);
  });
});

describe("settings fallback", () => {
  it("returns hardcoded defaults when config fetch is empty or invalid", () => {
    expect(publicConfigFromUnknown(null).headline).toBe(CHRISTMAS_COUNTDOWN_DEFAULTS.headline);
    expect(publicConfigFromUnknown({}).ctaText).toBe("Start Creating");
    expect(coalescePublicConfig({ headline: "   ", page_active: false }).pageActive).toBe(false);
    expect(coalescePublicConfig({ headline: "   " }).headline).toBe(CHRISTMAS_COUNTDOWN_DEFAULTS.headline);
  });
});

describe("UTM first-touch persistence", () => {
  it("keeps the original acquisition source on revisit", () => {
    const session = new Map<string, string>();
    const local = new Map<string, string>();
    const storage = (map: Map<string, string>) => ({
      getItem: (key: string) => map.get(key) ?? null,
      setItem: (key: string, value: string) => {
        map.set(key, value);
      },
      removeItem: (key: string) => {
        map.delete(key);
      },
    });
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        sessionStorage: storage(session),
        localStorage: storage(local),
        location: {
          search: "?utm_source=meta&utm_medium=paid_social&utm_campaign=xmas",
          pathname: "/christmas",
          hostname: "www.thedigitalgifter.com",
        },
      },
    });
    const first = captureChristmasCountdownAttribution("?utm_source=meta&utm_medium=paid_social&utm_campaign=xmas");
    expect(first.source).toBe("meta");
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        sessionStorage: storage(session),
        localStorage: storage(local),
        location: { search: "?utm_source=google", pathname: "/christmas", hostname: "www.thedigitalgifter.com" },
      },
    });
    const second = captureChristmasCountdownAttribution("?utm_source=google");
    expect(second.source).toBe("meta");
    expect(local.get(CHRISTMAS_COUNTDOWN_ATTRIBUTION_KEY)).toContain("meta");
  });
});
