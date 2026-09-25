import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  CHRISTMAS_LIBRARY_KINDS,
  LIBRARY_CATEGORIES,
  LIBRARY_VIDEOS,
  appendLibraryQueryParam,
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
      "long_form",
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
      expect(["reel", "short", "photo", "long_form"]).toContain(video.kind);
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
    expect(LIBRARY_VIDEOS[0]?.id).toBe("reel-christmas-express");
    expect(
      searchLibraryVideos("Christmas Overwhelm", "christmas_reels", "reel").some(
        (video) => video.id === "reel-lauren-overwhelm-master",
      ),
    ).toBe(true);
    expect(
      searchLibraryVideos("You can only pick one", "christmas_reels", "reel").some(
        (video) => video.id === "reel-pick-one-i2v",
      ),
    ).toBe(true);
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

  it("preserves long-form signed media query values through Library URL normalization", () => {
    const src =
      "/api/long-form-studio?action=media&kind=video&id=prod-1&exp=1730000000&sig=abc123sigvalue";
    const kept = librarySrcPath(src);
    expect(kept).toBe(src);
    const params = new URLSearchParams(kept.slice(kept.indexOf("?") + 1));
    expect(params.get("action")).toBe("media");
    expect(params.get("kind")).toBe("video");
    expect(params.get("id")).toBe("prod-1");
    expect(params.get("exp")).toBe("1730000000");
    expect(params.get("sig")).toBe("abc123sigvalue");
    const downloaded = appendLibraryQueryParam(src, "download", "1");
    const downParams = new URLSearchParams(downloaded.slice(downloaded.indexOf("?") + 1));
    expect(downParams.get("action")).toBe("media");
    expect(downParams.get("sig")).toBe("abc123sigvalue");
    expect(downParams.get("download")).toBe("1");
    expect(librarySrcPath("/api/clip-factory?action=media&exp=1&sig=2")).toContain("sig=2");
    expect(librarySrcPath("https://example.supabase.co/storage/v1/object/sign/x?token=abc")).toContain("token=abc");
    expect(librarySrcPath("/assets/christmas/final.mp4?v=2")).toBe("/assets/christmas/final.mp4");
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
      searchLibraryVideos("Christmas Magic", "christmas_reels", "reel").some(
        (item) => item.id === "reel-christmas-magic-30s",
      ),
    ).toBe(true);
    expect(
      searchLibraryVideos("You can only pick one", "christmas_reels", "reel").some(
        (item) => item.id === "reel-pick-one-christmas",
      ),
    ).toBe(true);
    expect(LIBRARY_VIDEOS.find((video) => video.id === "reel-pick-one-christmas")?.durationSeconds).toBe(6.93);
    expect(
      searchLibraryVideos("Christmas in New York", "christmas_reels", "reel").some(
        (item) => item.id === "reel-christmas-new-york-30s",
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
      "public/assets/christmas/lauren-overwhelm/final/lauren_overwhelm_master.mp4",
      "public/assets/christmas/lauren-overwhelm/final/lauren_overwhelm_clean.mp4",
      "public/assets/christmas/lauren-overwhelm/final/lauren_overwhelm_visual.mp4",
      "public/assets/christmas/lauren-overwhelm/masters/lauren_01_intro.mp4",
      "public/assets/christmas/lauren-overwhelm/masters/lauren_06_payoff.mp4",
      "public/assets/christmas/lauren-overwhelm/stills/lauren_01_intro_kitchen_worried.jpg",
      "public/assets/christmas/lauren-overwhelm/audio/vo_lauren_overwhelm_full.wav",
      "public/assets/christmas/lauren-overwhelm/voice_manifest.json",
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
      "public/assets/christmas/reels/final/christmas-magic-30s.mp4",
      "public/assets/christmas/reels/final/christmas-new-york-30s.mp4",
      "public/assets/christmas/reels/final/christmas-escape-30s.mp4",
      "public/assets/christmas/reels/final/christmas-dream-home-30s.mp4",
      "public/assets/christmas/reels/final/christmas-childhood-30s.mp4",
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
      "public/assets/christmas/reels/final/you-can-only-pick-one.mp4",
      "public/assets/christmas/reels/posters/reel-pick-one-christmas.jpg",
      "public/assets/christmas/library-stills/pick_one_01_cozy_cabin.jpg",
      "public/assets/christmas/library-stills/pick_one_04_christmas_mansion.jpg",
      "public/assets/christmas/pick-one/masters/pick_one_01_cozy_cabin.mp4",
      "public/assets/christmas/pick-one/masters/pick_one_02_nyc_penthouse.mp4",
      "public/assets/christmas/pick-one/masters/pick_one_03_alpine_chalet.mp4",
      "public/assets/christmas/pick-one/masters/pick_one_04_christmas_mansion.mp4",
      "public/assets/christmas/pick-one/posters/pick_one_01_cozy_cabin.jpg",
      "public/assets/christmas/pick-one/generation_manifest.json",
      "public/assets/christmas/pick-one/final/you-can-only-pick-one-i2v.mp4",
      "public/assets/christmas/pick-one/posters/reel-pick-one-i2v.jpg",
      "public/assets/christmas/library-stills/cartoon_cabin_mashup.jpg",
      "public/assets/christmas/library-stills/family_christmas_boardgame.jpg",
      "public/assets/christmas/library-stills/tom_jerry_christmas_living_room.jpg",
      "public/assets/christmas/library-stills/tom_jerry_storm_sleeping.jpg",
      "public/assets/christmas/library-stills/tom_jerry_storm_bed.jpg",
      "public/assets/christmas/cartoon-cozy-sep22/masters/cozy_02_family_christmas_boardgame.mp4",
      "public/assets/christmas/cartoon-cozy-sep22/masters/cozy_03_tom_jerry_christmas_living_room.mp4",
      "public/assets/christmas/cartoon-cozy-sep22/masters/cozy_04_tom_jerry_storm_sleeping.mp4",
      "public/assets/christmas/cartoon-cozy-sep22/masters/cozy_05_tom_jerry_storm_bed.mp4",
      "public/assets/christmas/cartoon-cozy-sep22/final/cartoon_cozy_emotional_reel_01.mp4",
      "public/assets/christmas/cartoon-cozy-sep22/final/cartoon_cozy_atmosphere_reel_02.mp4",
      "public/assets/christmas/cartoon-cozy-sep22/final/cartoon_cozy_characters_reel_03.mp4",
      "public/assets/christmas/cartoon-cozy-sep22/generation_manifest.json",
      "public/assets/christmas/library-stills/93_days_until_christmas.jpg",
      "public/assets/christmas/countdown-93/masters/countdown_93_days_until_christmas.mp4",
      "public/assets/christmas/countdown-93/posters/countdown_93_days_until_christmas.jpg",
      "public/assets/christmas/countdown-93/generation_manifest.json",
      "source/countdown-93/93_days_until_christmas_1080x1920.png",
      "public/assets/christmas/library-stills/christmas_express_night_moon_viaduct.jpg",
      "public/assets/christmas/library-stills/christmas_express_sunset_viaduct.jpg",
      "public/assets/christmas/library-stills/christmas_express_north_pole_station.jpg",
      "public/assets/christmas/library-stills/christmas_express_aurora_viaduct.jpg",
      "public/assets/christmas/library-stills/christmas_express_santa_gift_train.jpg",
      "public/assets/christmas/christmas-express/masters/cx_01_night_viaduct.mp4",
      "public/assets/christmas/christmas-express/masters/cx_05_santa_gifts.mp4",
      "public/assets/christmas/christmas-express/final/the-christmas-express-30s.mp4",
      "public/assets/christmas/christmas-express/final/all-aboard-for-christmas-30s.mp4",
      "public/assets/christmas/christmas-express/generation_manifest.json",
      "public/assets/christmas/christmas-express/reels_manifest.json",
    ];
    for (const relative of publicFiles) {
      expect(existsSync(resolve(root, relative))).toBe(true);
    }
    const pickOneShorts = LIBRARY_VIDEOS.filter((item) => item.id.startsWith("short-pick-one-"));
    expect(pickOneShorts).toHaveLength(4);
    expect(pickOneShorts.every((item) => item.kind === "short")).toBe(true);
    expect(pickOneShorts.every((item) => item.model === "kling-video/v3.0/pro/image-to-video")).toBe(true);
    expect(pickOneShorts.every((item) => Boolean(item.jobId))).toBe(true);
    expect(pickOneShorts.reduce((sum, item) => sum + (item.costUsd ?? 0), 0)).toBeCloseTo(1.12, 5);
    const pickOneReel = LIBRARY_VIDEOS.find((item) => item.id === "reel-pick-one-i2v");
    expect(pickOneReel?.kind).toBe("reel");
    expect(pickOneReel?.clipsUsed).toHaveLength(4);
    expect(LIBRARY_VIDEOS[0]?.id).toBe("reel-christmas-express");
    const cxShorts = LIBRARY_VIDEOS.filter((item) => item.id.startsWith("short-cx-"));
    expect(cxShorts).toHaveLength(5);
    expect(cxShorts.every((item) => item.kind === "short")).toBe(true);
    expect(cxShorts.every((item) => item.model === "kling-video/v3.0/pro/image-to-video")).toBe(true);
    expect(cxShorts.every((item) => Boolean(item.jobId))).toBe(true);
    expect(cxShorts.reduce((sum, item) => sum + (item.costUsd ?? 0), 0)).toBeCloseTo(1.4, 5);
    expect(LIBRARY_VIDEOS.find((item) => item.id === "reel-christmas-express")?.clipsUsed).toHaveLength(9);
    expect(LIBRARY_VIDEOS.find((item) => item.id === "reel-all-aboard-christmas")?.durationSeconds).toBe(29.97);
    const cozyShorts = LIBRARY_VIDEOS.filter((item) => item.id.startsWith("short-cozy-"));
    expect(cozyShorts).toHaveLength(4);
    expect(cozyShorts.every((item) => item.kind === "short")).toBe(true);
    expect(cozyShorts.every((item) => item.model === "kling-video/v3.0/pro/image-to-video")).toBe(true);
    expect(cozyShorts.every((item) => Boolean(item.sourceImage))).toBe(true);
    expect(LIBRARY_VIDEOS.find((item) => item.id === "reel-cozy-emotional-01")?.clipsUsed).toHaveLength(4);
    expect(LIBRARY_VIDEOS.find((item) => item.id === "reel-cozy-atmosphere-02")?.kind).toBe("reel");
    expect(LIBRARY_VIDEOS.find((item) => item.id === "reel-cozy-characters-03")?.durationSeconds).toBe(12.63);
    const countdown = LIBRARY_VIDEOS.find((item) => item.id === "short-countdown-93-days");
    expect(countdown?.kind).toBe("short");
    expect(countdown?.model).toBe("kling-video/v3.0/pro/image-to-video");
    expect(countdown?.jobId).toBe("b385fff7-954b-4fc0-9e76-259b6740f26b");
    expect(countdown?.costUsd).toBe(0.28);
    expect(countdown?.width).toBe(1080);
    expect(countdown?.height).toBe(1920);
    expect(countdown?.durationSeconds).toBe(5.04);
    expect(countdown?.src).toBe("/assets/christmas/countdown-93/masters/countdown_93_days_until_christmas.mp4");
    expect(searchLibraryVideos("93 days", "christmas_reels", "short").some((item) => item.id === "short-countdown-93-days")).toBe(
      true,
    );
    expect(
      searchLibraryVideos("93 days", "christmas_reels", "photo").some((item) => item.id === "photo-93-days-until-christmas"),
    ).toBe(true);
  });

  it("publishes a single voice-over-corrected Lauren Overwhelm master", () => {
    const masters = LIBRARY_VIDEOS.filter((item) => item.id.startsWith("reel-lauren-overwhelm"));
    expect(masters.map((item) => item.id)).toEqual([
      "reel-lauren-overwhelm-master",
      "reel-lauren-overwhelm-clean",
      "reel-lauren-overwhelm-visual",
    ]);
    const active = LIBRARY_VIDEOS.find((item) => item.id === "reel-lauren-overwhelm-master");
    expect(active?.tags).toContain("voiceover-corrected");
    expect(active?.description.toLowerCase()).toContain("voice-over corrected");
    expect(active?.src).toBe("/assets/christmas/lauren-overwhelm/final/lauren_overwhelm_master.mp4");
    const manifest = JSON.parse(
      readFileSync(resolve(root, "public/assets/christmas/lauren-overwhelm/voice_manifest.json"), "utf8"),
    );
    expect(manifest.status).toBe("VOICE_CORRECTED");
    expect(manifest.video_generation_called).toBe(false);
    expect(manifest.speed).toBeLessThan(1.1);
    expect(manifest.previous_speed).toBe(1.22);
    expect(manifest.wording_shortened).toBe(true);
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
    expect(readSrc("src/features/admin-library/LibraryVideoCard.tsx")).toContain("Start YouTube Live");
    expect(readSrc("src/features/admin-library/LibraryVideoCard.tsx")).toContain("Publish to YouTube");
    expect(readSrc("src/features/admin-library/LibraryVideoCard.tsx")).toContain("appendLibraryQueryParam");
    expect(readSrc("src/features/admin-library/saveLibraryVideo.ts")).toContain("triggerDirectDownload");
    expect(readSrc("src/features/admin-library/saveLibraryVideo.ts")).toContain("openNativeVideoPlayback");
    expect(readSrc("src/layouts/AdminLayout.tsx")).not.toContain("/admin/social-accounts");
    expect(readSrc("src/layouts/AdminLayout.tsx")).not.toContain("/admin/publishing");
    expect(readSrc("src/layouts/AdminLayout.tsx")).not.toContain("/admin/studio");
    expect(readSrc("src/layouts/AdminLayout.tsx")).toContain("/admin/publisher");
    expect(page).toContain('/admin/social-accounts');
    expect(page).toContain('/admin/publishing');
    expect(page).toContain("Social Accounts");
    expect(page).toContain("Publishing");
    expect(readSrc("src/App.tsx")).toContain("path=\"social-accounts\"");
    expect(readSrc("src/App.tsx")).toContain("path=\"publishing\"");
    expect(readSrc("src/App.tsx")).toContain("path=\"publisher\"");
  });
});
