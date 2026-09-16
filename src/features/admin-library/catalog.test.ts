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
    expect(searchLibraryVideos("astronaut", "pet_dog")).toHaveLength(1);
  });

  it("is wired into admin nav and the /admin/library route", () => {
    expect(readSrc("src/App.tsx")).toMatch(/path="library"/);
    expect(readSrc("src/layouts/AdminLayout.tsx")).toContain("/admin/library");
    expect(readSrc("src/pages/admin/AdminLibraryPage.tsx")).toContain("download=");
  });
});
