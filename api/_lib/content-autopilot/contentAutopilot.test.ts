import { describe, expect, it } from "vitest";
import { dedupeKey, isNearDuplicate, normalizeConceptText } from "./dedupe";
import { classifyConcept } from "./research";
import { buildImagePrompt, buildMotionPrompt } from "./visualStandard";

describe("content autopilot dedupe", () => {
  it("normalizes concept text", () => {
    expect(normalizeConceptText("Choose Your Christmas House!")).toBe("choose your christmas house");
  });

  it("creates stable dedupe keys", () => {
    const a = dedupeKey({ conceptFamily: "cozy_christmas", concept: "Alpine cabin", hook: "Which fireplace?" });
    const b = dedupeKey({ conceptFamily: "cozy_christmas", concept: "Alpine cabin", hook: "Which fireplace?" });
    expect(a).toBe(b);
  });

  it("flags near duplicate hooks", () => {
    expect(isNearDuplicate(["choose your christmas house victorian"], "choose your christmas house victorian")).toBe(true);
    expect(isNearDuplicate(["wolves in snowfall"], "luxury chalet at dusk")).toBe(false);
  });
});

describe("content autopilot selection", () => {
  it("classifies repeat vs test without fake scores", () => {
    expect(
      classifyConcept({
        conceptFamily: "choose_one_to_four",
        concept: "Victorian Christmas house",
        priorFamilyPublications: 3,
        isVariationOfWinner: true,
      }),
    ).toBe("repeat");
    expect(
      classifyConcept({
        conceptFamily: "experimental",
        concept: "Neon ice palace",
        priorFamilyPublications: 0,
        isVariationOfWinner: false,
      }),
    ).toBe("test");
  });
});

describe("visual standard prompts", () => {
  it("adds TDG visual constraints", () => {
    expect(buildImagePrompt("Snowy cabin at dusk")).toContain("9:16");
    expect(buildMotionPrompt("Slow push-in")).toContain("No morphing");
  });
});
