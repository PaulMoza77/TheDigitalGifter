import { describe, expect, it } from "vitest";
import {
  buildPetAttributionContract,
  deriveCreativeId,
  normalizeFunnelVersion,
} from "./attributionContract";

describe("pet funnel attribution contract", () => {
  it("normalizes funnel versions to lowercase canonical values", () => {
    expect(normalizeFunnelVersion("V2")).toBe("v2");
    expect(normalizeFunnelVersion("v3")).toBe("v3");
    expect(normalizeFunnelVersion("preview")).toBe("unknown");
  });

  it("keeps pet type and funnel version as separate dimensions", () => {
    const contract = buildPetAttributionContract({
      petType: "cat",
      funnelVersion: "v3",
      funnelSessionId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
      clientEventId: "11111111-2222-4333-8333-444444444401",
    });
    expect(contract.pet_type).toBe("cat");
    expect(contract.funnel_version).toBe("v3");
    expect(contract.funnel).toBe("pet");
  });

  it("strips FINAL suffix from creative_id", () => {
    expect(deriveCreativeId({ utmContent: "cat-v3-creative-01-FINAL" })).toBe("cat-v3-creative-01");
  });
});
