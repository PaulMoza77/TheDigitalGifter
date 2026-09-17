import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  LIBRARY_CATEGORIES,
  LIBRARY_VIDEOS,
  librarySrcPath,
  searchLibraryVideos,
} from "./catalog";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

function readSrc(relative: string) {
  return readFileSync(resolve(root, relative), "utf8");
}

describe("admin video library", () => {
  it("lists unique videos in known categories with downloadable public paths", () => {
    const ids = LIBRARY_VIDEOS.map((video) => video.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(LIBRARY_CATEGORIES.map((item) => item.id)).toEqual([
      "christmas_reels",
      "christmas_marketing",
      "pet_dog",
      "pet_cat",
      "pet_other",
    ]);
    for (const video of LIBRARY_VIDEOS) {
      expect(video.src.startsWith("/")).toBe(true);
      expect(librarySrcPath(video.src).includes("?")).toBe(false);
      expect(video.filename.endsWith(".mp4")).toBe(true);
    }
    expect(searchLibraryVideos("final", "christmas_reels").some((video) => video.id === "reel-final")).toBe(true);
    expect(
      searchLibraryVideos("Kling 1080p", "christmas_reels").some((video) => video.id === "reel-kling-1080p-final"),
    ).toBe(true);
    expect(searchLibraryVideos("astronaut", "pet_dog")).toHaveLength(1);
    expect(LIBRARY_VIDEOS.find((video) => video.id === "reel-05")?.durationSeconds).toBe(1.2);
    expect(LIBRARY_VIDEOS.find((video) => video.id === "pet-dog-astronaut")?.poster).toContain("/pet/dog/scenes/");
  });

  it("is wired into admin nav and the /admin/library route", () => {
    expect(readSrc("src/App.tsx")).toMatch(/path="library"/);
    expect(readSrc("src/layouts/AdminLayout.tsx")).toContain("/admin/library");
    const page = readSrc("src/pages/admin/AdminLibraryPage.tsx");
    expect(page).toContain("LibraryVideoCard");
    expect(page).not.toContain("download=");
    expect(readSrc("src/features/admin-library/LibraryVideoCard.tsx")).toContain("playsInline");
    expect(readSrc("src/features/admin-library/LibraryVideoCard.tsx")).toContain("Save to Photos");
    expect(readSrc("src/features/admin-library/LibraryVideoCard.tsx")).toContain("openLibraryVideoInNewTab");
    expect(readSrc("src/features/admin-library/saveLibraryVideo.ts")).toContain("cache: \"no-store\"");
  });
});
