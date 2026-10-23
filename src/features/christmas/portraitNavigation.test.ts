import { describe, expect, it } from "vitest";
import { emptyPortraitDraft } from "./portraitTypes";
import { previousPortraitStep, reachablePortraitStep } from "./portraitNavigation";

describe("portrait step permalinks and recovery", () => {
  const uploaded = { ...emptyPortraitDraft(), sourcePath: "private/upload.jpg", styleKey: "snow", blurredPreviewUrl: "data:image/jpeg;base64,preview" };
  it("opens the landing at the bare URL even with an old offer in session", () => {
    expect(reachablePortraitStep(null, { ...uploaded, step: "offer" }, false)).toBe("intro");
  });
  it("restores valid steps and falls back for a permalink without its private session", () => {
    expect(reachablePortraitStep("offer", uploaded, false)).toBe("offer");
    expect(reachablePortraitStep("offer", emptyPortraitDraft(), false)).toBe("upload");
    expect(reachablePortraitStep("preview", { ...uploaded, styleKey: null }, false)).toBe("style");
    expect(reachablePortraitStep("checkout", uploaded, false)).toBe("offer");
    expect(reachablePortraitStep("checkout", uploaded, true)).toBe("checkout");
  });
  it("offers a way back from an unavailable checkout without losing the upload", () => {
    expect(previousPortraitStep({ ...uploaded, step: "offer" }, true)).toBe("preview");
    expect(previousPortraitStep({ ...uploaded, step: "preview" }, true)).toBe("style");
    expect(previousPortraitStep({ ...uploaded, step: "style" }, true)).toBe("photo");
    expect(previousPortraitStep({ ...uploaded, step: "style" }, false)).toBe("upload");
  });
  it("rejects unknown steps and order screens without an order token", () => {
    expect(reachablePortraitStep("invalid", uploaded, false)).toBe("intro");
    expect(reachablePortraitStep("result", uploaded, false)).toBe("intro");
  });
});
