import { describe, expect, it } from "vitest";
import { generateDescription, generateTitleOptions, requiredAttributions } from "./copy";
import { filenameImpliesSafety, isRightsComplete, trackBadges } from "./musicRights";
import { buildPlaylist, eligiblePlaylistTracks, formatClock } from "./playlist";
import { validateProductionRights } from "./rightsManifest";
import { ORIGINAL_MUSIC_SEED } from "./seedMusic";
import { checkProductionSimilarity } from "./similarity";
import type { LongFormConfig, MusicTrack } from "./types";
import { prepareYouTubeDraft } from "./youtubePublisher";

function dirtyTrack(over: Partial<MusicTrack> = {}): MusicTrack {
  return {
    id: "dirty",
    title: "Royalty Free Christmas Hits.mp3",
    artistSource: "random channel",
    durationSeconds: 120,
    genre: "christmas",
    mood: "cozy_instrumental",
    source: "other_licensed",
    licenseType: "",
    commercialUseAllowed: null,
    youtubeMonetizationAllowed: "unknown",
    attributionRequired: false,
    attributionText: "",
    compositionRights: "public_domain",
    recordingRights: "unknown",
    rightsComplete: false,
    ...over,
  };
}

describe("long-form studio rights", () => {
  it("never treats royalty-free filenames as cleared", () => {
    expect(filenameImpliesSafety("Royalty Free Christmas Jazz", "no-copyright-mix.mp3")).toBe(true);
    const track = dirtyTrack();
    expect(isRightsComplete(track)).toBe(false);
    expect(trackBadges(track).kind).toBe("review");
    expect(trackBadges(ORIGINAL_MUSIC_SEED[0]!).kind).toBe("demo");
  });

  it("does not treat public-domain composition as a cleared recording", () => {
    const carol = dirtyTrack({
      title: "Public domain carol recording",
      compositionRights: "public_domain",
      recordingRights: "unknown",
      commercialUseAllowed: true,
      youtubeMonetizationAllowed: "yes",
      licenseType: "claimed PD",
    });
    expect(isRightsComplete(carol)).toBe(false);
    const { ok, blockers } = validateProductionRights({
      visuals: [{ id: "v1", title: "Cozy cottage", origin: "tdg_library", commercialUseAllowed: true }],
      tracks: [carol],
    });
    expect(ok).toBe(false);
    expect(blockers.join(" ")).toMatch(/rights data is incomplete/i);
  });

  it("blocks READY_TO_PUBLISH when any asset lacks commercial YouTube rights", () => {
    const { ok, manifest } = validateProductionRights({
      visuals: [{ id: "v1", title: "Scene", origin: "tdg_library", commercialUseAllowed: true }],
      tracks: [dirtyTrack({ commercialUseAllowed: false, youtubeMonetizationAllowed: "no" })],
    });
    expect(ok).toBe(false);
    expect(manifest.publicationStatus).toBe("rights_review_required");
  });

  it("does not treat demo pads as YouTube-cleared Christmas recordings", () => {
    const { ok, manifest } = validateProductionRights({
      visuals: [{ id: "reel-cozy-01", title: "Cozy cottage", origin: "tdg_library", commercialUseAllowed: true }],
      tracks: ORIGINAL_MUSIC_SEED.filter((t) => t.mood === "cozy_instrumental"),
    });
    expect(ok).toBe(false);
    expect(manifest.publicationStatus).toBe("rights_review_required");
    expect(ORIGINAL_MUSIC_SEED.every((t) => t.demo && t.youtubeMonetizationAllowed === "unknown")).toBe(true);
  });
});

describe("playlist builder", () => {
  it("fills duration from demo pads when no cleared tracks exist", () => {
    const tracks = [...ORIGINAL_MUSIC_SEED, dirtyTrack({ id: "skip", mood: "cozy_instrumental", durationSeconds: 180 })];
    expect(eligiblePlaylistTracks(tracks, "cozy_instrumental")).toHaveLength(0);
    expect(eligiblePlaylistTracks(tracks, "cozy_instrumental", { includeDemo: true }).length).toBeGreaterThan(0);
    const built = buildPlaylist({
      tracks,
      mood: "cozy_instrumental",
      targetSeconds: 3600,
      shuffle: true,
      seed: 42,
    });
    expect(built.usedDemo).toBe(true);
    expect(built.entries.length).toBeGreaterThan(10);
    expect(built.entries[built.entries.length - 1]?.endSeconds).toBeGreaterThanOrEqual(3599);
    expect(formatClock(3600)).toBe("1h 0m");
  });
});

describe("similarity guard", () => {
  it("flags duration-only clones of the same scene and playlist", () => {
    const base: LongFormConfig = {
      sceneIds: ["reel-cozy-01"],
      sceneSequence: ["reel-cozy-01"],
      musicTrackIds: ["tdg-orig-cozy-hearth"],
      playlistOrder: ["tdg-orig-cozy-hearth"],
      visualTreatment: "cozy-hearth-v1",
      stylePreset: "cozy",
      durationSeconds: 3600,
      title: "Cozy Christmas Fireplace",
      thumbnailConceptId: "wide-none",
    };
    const clone3h: LongFormConfig = { ...base, durationSeconds: 10800 };
    const report = checkProductionSimilarity(clone3h, [{ id: "p1", title: base.title, config: base }]);
    expect(report.tooSimilar).toBe(true);
    expect(report.reasons.some((r) => r.includes("same scene"))).toBe(true);
  });

  it("allows a materially different scene and mood", () => {
    const a: LongFormConfig = {
      sceneIds: ["reel-cozy-01"],
      sceneSequence: ["reel-cozy-01"],
      musicTrackIds: ["tdg-orig-cozy-hearth"],
      playlistOrder: ["tdg-orig-cozy-hearth"],
      visualTreatment: "cozy-hearth-v1",
      stylePreset: "cozy",
      durationSeconds: 3600,
      title: "Cozy Christmas Fireplace",
    };
    const b: LongFormConfig = {
      sceneIds: ["reel-nyc-01"],
      sceneSequence: ["reel-nyc-01", "reel-nyc-02"],
      musicTrackIds: ["tdg-orig-jazz-ember"],
      playlistOrder: ["tdg-orig-jazz-ember"],
      visualTreatment: "nyc-jazz-v2",
      stylePreset: "luxury",
      durationSeconds: 3600,
      title: "Christmas Jazz in New York",
    };
    const report = checkProductionSimilarity(b, [{ id: "p1", title: a.title, config: a }]);
    expect(report.tooSimilar).toBe(false);
  });
});

describe("youtube copy", () => {
  it("builds titles and only stored attribution text", () => {
    const titles = generateTitleOptions({
      sceneTitle: "Cozy cottage · fireplace + snow",
      style: "cozy",
      moodLabel: "Christmas Jazz",
    });
    expect(titles).toHaveLength(3);
    expect(titles[0]).toMatch(/Cozy Christmas Fireplace/);
    const withAttr: MusicTrack = {
      ...ORIGINAL_MUSIC_SEED[0]!,
      attributionRequired: true,
      attributionText: "Hearth Glow · The Digital Gifter",
    };
    const missingAttr: MusicTrack = {
      ...ORIGINAL_MUSIC_SEED[1]!,
      attributionRequired: true,
      attributionText: "",
    };
    expect(requiredAttributions([withAttr, missingAttr])).toEqual(["Hearth Glow · The Digital Gifter"]);
    const description = generateDescription({
      sceneTitle: "Cozy cottage",
      style: "cozy",
      mood: "cozy_instrumental",
      durationSeconds: 3600,
      tracks: [withAttr],
    });
    expect(description).toContain("Hearth Glow · The Digital Gifter");
    expect(description).toContain("The Digital Gifter");
    expect(description).not.toContain("unknown artist");
    const draft = prepareYouTubeDraft({
      productionId: "p1",
      chosenTitle: titles[0]!,
      description,
    });
    expect(draft.privacyStatus).toBe("private");
  });
});
