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
      "clip_factory",
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
    expect(LIBRARY_VIDEOS[0]?.id).toBe("reel-np-journey-01");
    expect(
      searchLibraryVideos("North Pole Santa", "christmas_reels", "reel").some((video) => video.id === "reel-north-pole-santa"),
    ).toBe(true);
    expect(
      searchLibraryVideos("Global Christmas journey", "christmas_reels", "reel").some(
        (video) => video.id === "reel-global-christmas-journey",
      ),
    ).toBe(true);
    expect(
      searchLibraryVideos("Luxury Christmas palace", "christmas_reels", "reel").some((video) => video.id === "reel-luxury-palace"),
    ).toBe(true);
    expect(searchLibraryVideos("Polar Express arrival", "christmas_reels", "reel").some((video) => video.id === "reel-sep19-01")).toBe(
      true,
    );
    expect(searchLibraryVideos("ice skating", "christmas_reels", "photo").some((item) => item.id === "photo-nyc-ice-girl")).toBe(
      true,
    );
    expect(searchLibraryVideos("kids sledding", "christmas_reels", "photo").some((item) => item.id === "photo-village-kids-sled")).toBe(
      true,
    );
    expect(searchLibraryVideos("astronaut", "pet_dog")).toHaveLength(1);
    expect(LIBRARY_VIDEOS.find((video) => video.id === "reel-05")?.durationSeconds).toBe(1.2);
    expect(LIBRARY_VIDEOS.find((video) => video.id === "pet-dog-astronaut")?.poster).toContain("/pet/dog/scenes/");
  });

  it("splits Christmas Reels into Reels, Shorts, and Photos badges", () => {
    expect(countChristmasKind("reel")).toBeGreaterThanOrEqual(6);
    expect(countChristmasKind("short")).toBeGreaterThanOrEqual(15);
    expect(countChristmasKind("photo")).toBeGreaterThanOrEqual(27);
    expect(searchLibraryVideos("", "christmas_reels", "reel").every((item) => item.kind === "reel")).toBe(true);
    expect(searchLibraryVideos("", "christmas_reels", "short").every((item) => item.kind === "short")).toBe(true);
    expect(searchLibraryVideos("", "christmas_reels", "photo").every((item) => item.kind === "photo")).toBe(true);
    expect(searchLibraryVideos("ice", "christmas_reels", "short").some((item) => item.id === "short-ice-nyc")).toBe(true);
    expect(searchLibraryVideos("village", "christmas_reels", "short").some((item) => item.id === "short-kids-sled")).toBe(
      true,
    );
    expect(searchLibraryVideos("ice", "christmas_reels", "photo").some((item) => item.id === "photo-nyc-ice-girl")).toBe(
      true,
    );
    expect(
      searchLibraryVideos("kids", "christmas_reels", "photo").some((item) => item.id === "photo-village-kids-sled"),
    ).toBe(true);
    expect(searchLibraryVideos("cut3", "christmas_reels", "reel").some((item) => item.id === "reel-cut3")).toBe(true);
    expect(
      searchLibraryVideos("Christmas Movie Nostalgia", "christmas_reels", "reel").some(
        (item) => item.id === "reel-christmas-movie-nostalgia-01",
      ),
    ).toBe(true);
    expect(
      searchLibraryVideos("The Journey", "christmas_reels", "reel").some(
        (item) => item.id === "reel-np-journey-01",
      ),
    ).toBe(true);
    expect(
      searchLibraryVideos("ready-to-post", "christmas_reels", "reel").length,
    ).toBeGreaterThanOrEqual(8);
    expect(
      searchLibraryVideos("recognizable-scene", "christmas_reels", "photo").some(
        (item) => item.id === "photo-home-alone-house",
      ),
    ).toBe(true);
  });

  it("keeps Christmas media files on public downloadable paths", () => {
    const publicFiles = [
      "public/assets/christmas/cozy-reel/final_reel.mp4",
      "public/assets/christmas/cozy-reel/clip1.mp4",
      "public/assets/christmas/instagram-reel/source/clip_06.jpg",
      "public/assets/christmas/instagram-reel-kling-1080p/source/cozy_christmas_reading_nook_by_snowy_village.jpg",
      "public/assets/christmas/library-stills/nyc_girl_ice_skating.jpg",
      "public/assets/christmas/library-stills/village_kids_sledding.jpg",
      "public/assets/christmas/library-stills/vintage_family_snowman.jpg",
      "public/assets/christmas/instagram-reel-cut3/clip_ice_nyc.mp4",
      "public/assets/christmas/instagram-reel-cut3/clip_kids_sled.mp4",
      "public/assets/christmas/instagram-reel-cut3/final_christmas_reel_cut3.mp4",
      "public/assets/christmas/reels/masters/christmas_master_01.mp4",
      "public/assets/christmas/reels/masters/christmas_master_02.mp4",
      "public/assets/christmas/reels/masters/christmas_master_03.mp4",
      "public/assets/christmas/reels/masters/christmas_master_04.mp4",
      "public/assets/christmas/reels/masters/christmas_master_05.mp4",
      "public/assets/christmas/reels/final/christmas_reel_cinematic_01.mp4",
      "public/assets/christmas/reels/final/christmas_reel_social_hook_02.mp4",
      "public/assets/christmas/reels/final/christmas_reel_nostalgic_03.mp4",
      "public/assets/christmas/reels/masters/christmas_master_06.mp4",
      "public/assets/christmas/reels/masters/christmas_master_10.mp4",
      "public/assets/christmas/reels/final/reel-01.mp4",
      "public/assets/christmas/reels/final/reel-05.mp4",
      "public/assets/christmas/library-stills/01_village_balcony_girl.jpg",
      "public/assets/christmas/library-stills/polar_express_alpine_viaduct.jpg",
      "public/assets/christmas/library-stills/home_alone_style_christmas_house.jpg",
      "public/assets/christmas/library-stills/grinch_whoville_rooftop.jpg",
      "public/assets/christmas/np-journey/masters/npj_01_train_window.mp4",
      "public/assets/christmas/np-journey/masters/npj_11_plaza.mp4",
      "public/assets/christmas/np-journey/final/the_journey_north_pole_reel_01.mp4",
      "public/assets/christmas/np-journey/final/follow_santa_reel_02.mp4",
      "public/assets/christmas/np-journey/final/one_magical_christmas_night_reel_03.mp4",
      "public/assets/christmas/np-journey/final/viral_train_north_pole_short_04.mp4",
      "public/assets/christmas/np-journey/final/viral_most_magical_night_short_05.mp4",
      "public/assets/christmas/np-journey/posters/reel-np-journey-01.jpg",
      "public/assets/christmas/library-stills/np_journey_viaduct_aurora_wide.jpg",
      "public/assets/christmas/cinematic-sep20/masters/cinematic_08_grinch.mp4",
      "public/assets/christmas/cinematic-sep20/final/christmas_movie_nostalgia_reel_01.mp4",
      "public/assets/christmas/cinematic-sep20/final/christmas_magic_reel_02.mp4",
      "public/assets/christmas/cinematic-sep20/final/the_perfect_christmas_reel_03.mp4",
      "public/assets/christmas/cinematic-sep20/posters/reel-nostalgia-01.jpg",
      "public/assets/christmas/north-pole-santa/final/north_pole_santa_reel.mp4",
      "public/assets/christmas/north-pole-santa/masters/santa_01_workshop.mp4",
      "public/assets/christmas/north-pole-santa/masters/santa_04_sweep.mp4",
      "public/assets/christmas/north-pole-santa/source/01_workshop_wrapping_1080x1920.jpg",
      "public/assets/christmas/luxury-palace/final/luxury_christmas_palace_reel.mp4",
      "public/assets/christmas/luxury-palace/masters/palace_01_establish.mp4",
      "public/assets/christmas/luxury-palace/masters/palace_05_hero.mp4",
      "public/assets/christmas/luxury-palace/source/05_hero_balcony_palace_1080x1920.jpg",
      "public/assets/christmas/global-reel/final/global_christmas_journey_reel.mp4",
      "public/assets/christmas/global-reel/masters/global_01_lapland.mp4",
      "public/assets/christmas/global-reel/masters/global_05_white_house.mp4",
      "public/assets/christmas/global-reel/source/05_white_house_1080x1920.jpg",
    ];
    for (const relative of publicFiles) {
      expect(existsSync(resolve(root, relative))).toBe(true);
    }
  });

  it("is wired into admin nav and the /admin/library route", () => {
    expect(readSrc("src/App.tsx")).toMatch(/path="library"/);
    expect(readSrc("src/App.tsx")).toContain("/dev/library");
    expect(readSrc("src/layouts/AdminLayout.tsx")).toContain("/admin/library");
    expect(readSrc("src/layouts/AdminLayout.tsx")).toContain("/admin/clip-factory");
    expect(readSrc("src/App.tsx")).toContain("path=\"clip-factory\"");
    const page = readSrc("src/pages/admin/AdminLibraryPage.tsx");
    expect(page).toContain("LibraryVideoCard");
    expect(page).toContain("CHRISTMAS_LIBRARY_KINDS");
    expect(page).toContain("onShare");
    expect(page).toContain("Schedule batch");
    expect(page).not.toContain("download=");
    expect(page).not.toMatch(/Higgsfield|Budget USD|Assemble Reel from selected shorts/);
    expect(readSrc("src/features/admin-library/LibraryVideoCard.tsx")).toContain("playsInline");
    expect(readSrc("src/features/admin-library/LibraryVideoCard.tsx")).toContain("Save to Photos");
    expect(readSrc("src/features/admin-library/LibraryVideoCard.tsx")).toContain("isLibraryPhoto");
    expect(readSrc("src/features/admin-library/LibraryVideoCard.tsx")).toContain("Share / Schedule");
    expect(readSrc("src/layouts/AdminLayout.tsx")).toContain("/admin/social-accounts");
    expect(readSrc("src/layouts/AdminLayout.tsx")).toContain("/admin/publishing");
    expect(readSrc("src/App.tsx")).toContain("path=\"social-accounts\"");
    expect(readSrc("src/App.tsx")).toContain("path=\"publishing\"");
  });
});
