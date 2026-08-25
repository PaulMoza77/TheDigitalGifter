import { describe, expect, it } from "vitest";
import {
  attributionFallbackLabel,
  biggestFunnelDrop,
  buildFunnelSteps,
  buildKpis,
  emptyStepCounts,
  formatPct,
  funnelWarnings,
  isMetaSource,
  ofPreviousLabel,
  percent,
  percentChange,
  rangeForPreset,
  ratio,
} from "./funnelDashboard";

describe("pet funnel dashboard math", () => {
  it("counts unique sessions in the main funnel, not raw repeats", () => {
    const counts = emptyStepCounts();
    counts.landing_view = 1;
    counts.pet_name_submitted = 1;
    const steps = buildFunnelSteps(counts);
    expect(steps[0].sessions).toBe(1);
    expect(steps[1].sessions).toBe(1);
  });

  it("calculates conversion from previous and from LPV", () => {
    const steps = buildFunnelSteps({
      landing_view: 100,
      pet_name_submitted: 44,
      photo_upload_completed: 28,
      order_review_viewed: 21,
      initiate_checkout: 12,
      purchase: 4,
    });
    expect(steps[1].fromLandingPct).toBeCloseTo(44);
    expect(steps[1].fromPreviousPct).toBeCloseTo(44);
    expect(steps[2].fromPreviousPct).toBeCloseTo(63.636, 2);
    expect(steps[5].fromLandingPct).toBeCloseTo(4);
    expect(biggestFunnelDrop(steps)?.from).toBe("First-party Landing Sessions");
    expect(biggestFunnelDrop(steps)?.to).toBe("Pet Name Submitted");
  });

  it("keeps a defensive 100% safety cap only when fed independent (non-cohort) totals", () => {
    // Safety guard for mismatched independent counts — production V1 rates use landing-cohort chaining instead.
    const steps = buildFunnelSteps({
      landing_view: 19,
      pet_name_submitted: 7,
      photo_upload_completed: 3,
      order_review_viewed: 4,
      initiate_checkout: 0,
      purchase: 0,
    });
    expect(steps[2].sessions).toBe(3);
    expect(steps[3].sessions).toBe(4);
    expect(steps[3].fromPreviousPct).toBe(100);
    expect(ofPreviousLabel(4, 3, "photos")).toBe("100.0% of photos");
    expect(percent(4, 3)).toBeCloseTo(133.333, 2);
  });

  it("does not emit NaN or Infinity for zero denominators", () => {
    expect(percent(4, 0)).toBeNull();
    expect(ratio(100, 0)).toBeNull();
    expect(percentChange(4, 0)).toBeNull();
    expect(formatPct(null)).toBe("—");
    const kpis = buildKpis(emptyStepCounts(), 0, 0);
    expect(kpis.landingToPurchase).toBeNull();
    expect(kpis.checkoutToPurchase).toBeNull();
    expect(kpis.averageOrderValueCents).toBeNull();
  });

  it("does not label unattributed traffic as Meta", () => {
    expect(isMetaSource({})).toBe(false);
    expect(attributionFallbackLabel({}).label).toBe("Direct / Organic / Unknown");
    expect(attributionFallbackLabel({}).sourceGroup).toBe("unattributed");
    expect(attributionFallbackLabel({ utmSource: "google" }).sourceGroup).toBe("other");
    expect(attributionFallbackLabel({ utmSource: "facebook", utmCampaign: "Secret Lives" }).sourceGroup).toBe("meta");
    expect(attributionFallbackLabel({ campaignId: "120" }).sourceGroup).toBe("meta");
  });

  it("uses last 7 days by default and compares an equivalent previous window", () => {
    const now = new Date("2026-08-21T12:00:00.000Z");
    const range = rangeForPreset("7d", now);
    expect(range.to.toISOString()).toBe("2026-08-22T00:00:00.000Z");
    expect(range.from.toISOString()).toBe("2026-08-15T00:00:00.000Z");
    expect(range.previousTo.toISOString()).toBe(range.from.toISOString());
    expect(range.to.getTime() - range.from.getTime()).toBe(range.previousTo.getTime() - range.previousFrom.getTime());
  });

  it("emits deterministic warnings only", () => {
    const steps = buildFunnelSteps({
      landing_view: 50,
      pet_name_submitted: 10,
      photo_upload_completed: 8,
      order_review_viewed: 6,
      initiate_checkout: 5,
      purchase: 0,
    });
    const warnings = funnelWarnings({ steps, firstEventAt: null });
    expect(warnings.some((w) => /first-party|Historical|historical/i.test(w))).toBe(true);
    expect(warnings).toContain("High landing → name drop-off");
    expect(warnings).toContain("Checkout started but no purchases");
  });
});
