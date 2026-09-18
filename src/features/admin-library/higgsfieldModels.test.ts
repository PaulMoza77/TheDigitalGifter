import { describe, expect, it } from "vitest";

import {
  budgetAllows,
  buildImageToVideoPayload,
  parseHiggsfieldEstimate,
} from "./higgsfieldModels";
import { canSubmitPaidGeneration, resumeAction } from "./jobState";
import { findLibraryPhoto, mergeLibraryVideos } from "./libraryMerge";

describe("Higgsfield TDG library payloads", () => {
  it("sends Kling 3.0 Pro documented fields only: 5s, sound off, no silent 720p", () => {
    const result = buildImageToVideoPayload({
      modelKey: "kling-3.0-pro",
      imageUrl: "https://cdn.example/still.jpg",
      prompt: "gentle snowfall",
    });
    expect(result.model.modelId).toBe("kling-video/v3.0/pro/image-to-video");
    expect(result.submitted).toEqual({
      image_url: "https://cdn.example/still.jpg",
      prompt: "gentle snowfall",
      duration: 5,
      sound: "off",
    });
    expect(result.submitted.resolution).toBeUndefined();
    expect(result.requested.resolution).toBe("1080p");
    expect(result.requested.aspectRatio).toBe("9:16");
    expect(result.omitted).toContain("resolution");
  });

  it("sends Seedance 2.0 1080p with generate_audio false and never 720p", () => {
    const result = buildImageToVideoPayload({
      modelKey: "seedance-2.0",
      imageUrl: "https://cdn.example/still.jpg",
      prompt: "fireplace glow",
    });
    expect(result.model.modelId).toBe("bytedance/seedance-2.0/image-to-video");
    expect(result.submitted.resolution).toBe("1080p");
    expect(result.submitted.generate_audio).toBe(false);
    expect(result.submitted.duration).toBe(5);
    expect(JSON.stringify(result.submitted)).not.toContain("720p");
  });

  it("blocks paid submit without a verifiable estimate or when over budget", () => {
    expect(budgetAllows({ budgetUsd: 1, estimatedUsd: null }).ok).toBe(false);
    expect(budgetAllows({ budgetUsd: 0.4, estimatedUsd: 0.5 }).ok).toBe(false);
    expect(budgetAllows({ budgetUsd: 1, estimatedUsd: 0.42 }).ok).toBe(true);
  });

  it("parses estimate endpoint usd and ignores junk", () => {
    expect(parseHiggsfieldEstimate({ usd: "0.42", credits: "6.72" })).toEqual({
      usd: 0.42,
      credits: "6.72",
      source: "higgsfield_estimate",
    });
    expect(parseHiggsfieldEstimate({ hello: true })).toBeNull();
  });

  it("resumes provider jobs without a second paid submit", () => {
    expect(canSubmitPaidGeneration("queued", "req-1")).toBe(false);
    expect(resumeAction("queued", "req-1")).toBe("poll");
    expect(resumeAction("import_failed", "req-1")).toBe("import");
    expect(resumeAction("imported", "req-1")).toBe("none");
    expect(canSubmitPaidGeneration("estimated", null)).toBe(true);
  });

  it("picks existing library photos and prepends generated clips into the same catalog", () => {
    expect(findLibraryPhoto("photo-nyc-ice-girl")?.filename).toBe("nyc_girl_ice_skating.jpg");
    const merged = mergeLibraryVideos([
      {
        id: "hf-test",
        title: "Generated",
        description: "prompt",
        src: "https://signed.example/clip.mp4",
        filename: "clip.mp4",
        category: "christmas_reels",
        kind: "short",
      },
    ]);
    expect(merged[0]?.id).toBe("hf-test");
    expect(merged.some((item) => item.id === "reel-cut3")).toBe(true);
  });
});
