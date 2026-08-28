import { describe, expect, it } from "vitest";
import { draftAfterSpeciesRouteChange } from "./speciesRouteIsolation";
import type { PetV2Draft } from "./types";

function draft(overrides: Partial<PetV2Draft> = {}): PetV2Draft {
  return {
    species: "dog",
    step: "preview",
    photo: { fileName: "chow.jpg", contentType: "image/jpeg", byteSize: 1000 },
    uploadId: "upload-a",
    previewAttemptId: "preview:sess:upload-a",
    photoPreviewDataUrl: "data:image/jpeg;base64,abc",
    generatedPreviewDataUrl: "data:image/jpeg;base64,gen",
    generationMode: "live",
    previewCount: 1,
    lastError: null,
    email: "",
    petName: "",
    subtype: null,
    subtypeDetail: null,
    updatedAt: "",
    ...overrides,
  };
}

describe("V2 species route isolation", () => {
  it("clears photo and preview when switching Dog → Cat tabs", () => {
    const result = draftAfterSpeciesRouteChange(draft({ species: "dog" }), "cat");
    expect(result.clearInMemoryPhoto).toBe(true);
    expect(result.draft.species).toBe("cat");
    expect(result.draft.photo).toBeNull();
    expect(result.draft.uploadId).toBeNull();
    expect(result.draft.photoPreviewDataUrl).toBeNull();
    expect(result.draft.generatedPreviewDataUrl).toBeNull();
    expect(result.draft.previewAttemptId).toBeNull();
    expect(result.draft.step).toBe("landing");
  });

  it("keeps the draft when the route species is unchanged", () => {
    const previous = draft({ species: "dog" });
    const result = draftAfterSpeciesRouteChange(previous, "dog");
    expect(result.clearInMemoryPhoto).toBe(false);
    expect(result.draft.photo?.fileName).toBe("chow.jpg");
    expect(result.draft.generatedPreviewDataUrl).toContain("gen");
  });
});
