import { describe, expect, it } from "vitest";

import {
  mapLibraryAssetCategory,
  mapLibraryAssetKind,
  resolveLibraryAssetSrc,
} from "./mapLibraryAsset";

describe("mapLibraryAsset", () => {
  it("keeps known Admin Library categories", () => {
    expect(mapLibraryAssetCategory("christmas_reels")).toBe("christmas_reels");
    expect(mapLibraryAssetCategory("clip_factory")).toBe("clip_factory");
    expect(mapLibraryAssetCategory("volocar_dubai_moments")).toBe("volocar_dubai_moments");
    expect(mapLibraryAssetCategory("flavours_bistro")).toBe("flavours_bistro");
  });

  it("maps VoloCar DB labels onto existing chips", () => {
    expect(mapLibraryAssetCategory("volocar", "volocar-dubai-marina.mp4", "Marina")).toBe(
      "volocar_dubai_moments",
    );
    expect(mapLibraryAssetCategory("volocar", "volocar-monthly.mp4", "Monthly")).toBe(
      "volocar_product_motion",
    );
    expect(mapLibraryAssetCategory("volocar_home", "volocar-home-no-deposit.jpg")).toBe(
      "volocar_product_motion",
    );
  });

  it("normalizes video/image kinds for Christmas filters", () => {
    expect(mapLibraryAssetKind("video", "clip.mp4", 30)).toBe("reel");
    expect(mapLibraryAssetKind("video", "clip.mp4", 5)).toBe("short");
    expect(mapLibraryAssetKind("photo", "still.jpg")).toBe("photo");
    expect(mapLibraryAssetKind("weird", "still.png")).toBe("photo");
    expect(mapLibraryAssetKind("reel")).toBe("reel");
  });

  it("keeps playable src paths instead of forcing Clip Factory signed URLs", () => {
    expect(
      resolveLibraryAssetSrc({
        src: "/api/christmas-reel-pipeline?action=media&id=abc",
        fallbackSignedSrc: "/api/clip-factory?action=media&kind=render&id=abc",
      }),
    ).toContain("christmas-reel-pipeline");
    expect(
      resolveLibraryAssetSrc({
        src: "vps://clip-factory-media/volocar/x.mp4",
        fallbackSignedSrc: "/api/clip-factory?action=media&kind=render&id=abc",
      }),
    ).toContain("clip-factory");
    expect(
      resolveLibraryAssetSrc({
        src: "",
        fallbackSignedSrc: "/api/clip-factory?action=media&kind=render&id=abc",
      }),
    ).toContain("clip-factory");
  });
});
