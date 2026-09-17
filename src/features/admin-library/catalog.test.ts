import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  CHRISTMAS_LIBRARY_KINDS,
  LIBRARY_CATEGORIES,
  LIBRARY_VIDEOS,
  countChristmasKind,
  isLibraryPhoto,
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
    expect(CHRISTMAS_LIBRARY_KINDS.map((item) => item.id)).toEqual(["reel", "short", "photo"]);
    for (const video of LIBRARY_VIDEOS) {
      expect(video.src.startsWith("/")).toBe(true);
      expect(librarySrcPath(video.src).includes("?")).toBe(false);
      expect(["reel", "short", "photo"]).toContain(video.kind);
      if (isLibraryPhoto(video)) {
        expect(/\.(jpe?g|png|webp)$/i.test(video.filename)).toBe(true);
      } else {
        expect(video.filename.endsWith(".mp4")).toBe(true);
      }
    }
    expect(searchLibraryVideos("final", "christmas_reels").some((video) => video.id === "reel-final")).toBe(true);
    expect(
      searchLibraryVideos("Kling 1080p", "christmas_reels").some((video) => video.id === "reel-kling-1080p-final"),
    ).toBe(true);
    expect(
      searchLibraryVideos("Cut 2", "christmas_reels").some((video) => video.id === "reel-kling-1080p-cut2"),
    ).toBe(true);
    expect(LIBRARY_VIDEOS[0]?.id).toBe("reel-kling-1080p-cut2");
    expect(searchLibraryVideos("astronaut", "pet_dog")).toHaveLength(1);
    expect(LIBRARY_VIDEOS.find((video) => video.id === "reel-05")?.durationSeconds).toBe(1.2);
    expect(LIBRARY_VIDEOS.find((video) => video.id === "pet-dog-astronaut")?.poster).toContain("/pet/dog/scenes/");
  });

  it("splits Christmas Reels into Reels, Shorts, and Photos badges", () => {
    expect(countChristmasKind("reel")).toBeGreaterThanOrEqual(5);
    expect(countChristmasKind("short")).toBeGreaterThanOrEqual(12);
    expect(countChristmasKind("photo")).toBeGreaterThanOrEqual(12);
    expect(searchLibraryVideos("", "christmas_reels", "reel").every((item) => item.kind === "reel")).toBe(true);
    expect(searchLibraryVideos("", "christmas_reels", "short").every((item) => item.kind === "short")).toBe(true);
    expect(searchLibraryVideos("", "christmas_reels", "photo").every((item) => item.kind === "photo")).toBe(true);
    expect(searchLibraryVideos("ice", "christmas_reels", "short").some((item) => item.id === "reel-06")).toBe(true);
    expect(searchLibraryVideos("village", "christmas_reels", "short").some((item) => item.id === "reel-07")).toBe(
      true,
    );
    expect(searchLibraryVideos("ice", "christmas_reels", "photo").some((item) => item.id === "photo-wan-ice-rink")).toBe(
      true,
    );
    expect(searchLibraryVideos("cozy cottage", "christmas_reels", "reel").some((item) => item.id === "reel-cozy-final")).toBe(
      true,
    );
  });

  it("keeps Christmas media files on public downloadable paths", () => {
    const publicFiles = [
      "public/assets/christmas/cozy-reel/final_reel.mp4",
      "public/assets/christmas/cozy-reel/clip1.mp4",
      "public/assets/christmas/instagram-reel/source/clip_06.jpg",
      "public/assets/christmas/instagram-reel-kling-1080p/source/cozy_christmas_reading_nook_by_snowy_village.jpg",
    ];
    for (const relative of publicFiles) {
      expect(existsSync(resolve(root, relative))).toBe(true);
    }
  });

  it("is wired into admin nav and the /admin/library route", () => {
    expect(readSrc("src/App.tsx")).toMatch(/path="library"/);
    expect(readSrc("src/App.tsx")).toContain("/dev/library");
    expect(readSrc("src/layouts/AdminLayout.tsx")).toContain("/admin/library");
    const page = readSrc("src/pages/admin/AdminLibraryPage.tsx");
    expect(page).toContain("LibraryVideoCard");
    expect(page).toContain("CHRISTMAS_LIBRARY_KINDS");
    expect(page).not.toContain("download=");
    expect(readSrc("src/features/admin-library/LibraryVideoCard.tsx")).toContain("playsInline");
    expect(readSrc("src/features/admin-library/LibraryVideoCard.tsx")).toContain("Save to Photos");
    expect(readSrc("src/features/admin-library/LibraryVideoCard.tsx")).toContain("isLibraryPhoto");
  });
});
