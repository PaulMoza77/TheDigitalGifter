import { describe, expect, it } from "vitest";
import {
  REQUIRED_FUNNEL_IDS,
  TDG_FUNNEL_REGISTRY,
  assertRequiredFunnelsPresent,
  isAllowedHealthState,
} from "./funnelRegistry";

describe("TDG funnel registry", () => {
  it("includes required funnel ids including christmas_send_a_gift", () => {
    const check = assertRequiredFunnelsPresent();
    expect(check.ok).toBe(true);
    expect(check.missing).toEqual([]);
    expect(REQUIRED_FUNNEL_IDS).toContain("christmas_send_a_gift");
  });

  it("only uses allowed health states", () => {
    for (const f of TDG_FUNNEL_REGISTRY) {
      expect(isAllowedHealthState(f.ga4)).toBe(true);
      expect(isAllowedHealthState(f.metaPixel)).toBe(true);
      expect(isAllowedHealthState(f.metaCapi)).toBe(true);
      expect(isAllowedHealthState(f.purchaseDedupe)).toBe(true);
    }
  });
});
