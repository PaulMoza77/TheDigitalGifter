import { describe, expect, it } from "vitest";
import {
  MEMORIES_PLANS,
  chargingAllowed,
  isMemoriesPlanKey,
  memoriesCommercialMode,
} from "./constants";

describe("Memories commercial gates", () => {
  it("recognizes plan keys", () => {
    expect(isMemoriesPlanKey("starter")).toBe(true);
    expect(isMemoriesPlanKey("plus")).toBe(true);
    expect(isMemoriesPlanKey("legacy")).toBe(true);
    expect(isMemoriesPlanKey("magic")).toBe(false);
  });

  it("only charges in test or paid_early_access", () => {
    expect(chargingAllowed("waitlist")).toBe(false);
    expect(chargingAllowed("test")).toBe(true);
    expect(chargingAllowed("paid_early_access")).toBe(true);
  });

  it("defaults to waitlist when env unset", () => {
    const prev = process.env.MEMORIES_COMMERCIAL_MODE;
    delete process.env.MEMORIES_COMMERCIAL_MODE;
    expect(memoriesCommercialMode()).toBe("waitlist");
    if (prev === undefined) delete process.env.MEMORIES_COMMERCIAL_MODE;
    else process.env.MEMORIES_COMMERCIAL_MODE = prev;
  });

  it("keeps provisional monthly amounts centralized", () => {
    expect(MEMORIES_PLANS.starter.amountCents + MEMORIES_PLANS.plus.amountCents).toBe(2800);
  });
});
