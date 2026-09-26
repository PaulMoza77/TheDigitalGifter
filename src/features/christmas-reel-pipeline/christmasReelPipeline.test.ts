import { describe, expect, it } from "vitest";
import { analyzeContent, moodHintsFromTags } from "../../../api/_lib/christmas-reel-pipeline/contentAnalysis";
import { selectMusicTrack } from "../../../api/_lib/christmas-reel-pipeline/musicSelection";
import { buildPlatformMetadata } from "../../../api/_lib/christmas-reel-pipeline/metadata";
import { evaluateReadiness, publishReadyFromStatus } from "../../../api/_lib/christmas-reel-pipeline/readinessGate";
import type { AutopilotMusicTrack } from "../../../api/_lib/christmas-reel-pipeline/types";

const tracks: AutopilotMusicTrack[] = [
  {
    id: "t1",
    title: "Silent Night (Lo-Fi)",
    artistSource: "HoliznaCC0",
    mood: "peaceful_instrumental",
    tags: ["christmas", "peaceful", "night"],
    storagePath: null,
    publicSrc: "/assets/music/christmas/silent-night-lofi.mp3",
    filename: "silent-night-lofi.mp3",
    durationSeconds: 135,
    approvedForAutopilot: true,
    commercialUseAllowed: true,
    instagramAllowed: true,
    facebookAllowed: true,
    youtubeAllowed: true,
    lastUsedAt: null,
    licenseType: "CC0 1.0 Universal",
    licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
    sourceUrl: "https://example.com/track",
  },
  {
    id: "t2",
    title: "Joy to the World (Synth Wave)",
    artistSource: "HoliznaCC0",
    mood: "energetic_instrumental",
    tags: ["christmas", "celebration", "fun"],
    storagePath: null,
    publicSrc: "/assets/music/christmas/joy-to-the-world-synthwave.mp3",
    filename: "joy-to-the-world-synthwave.mp3",
    durationSeconds: 160,
    approvedForAutopilot: true,
    commercialUseAllowed: true,
    instagramAllowed: true,
    facebookAllowed: true,
    youtubeAllowed: true,
    lastUsedAt: "2026-09-20T10:00:00.000Z",
    licenseType: "CC0 1.0 Universal",
    licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
    sourceUrl: "https://example.com/track2",
  },
];

describe("christmas reel pipeline", () => {
  it("derives christmas content tags from title and provenance", () => {
    const tags = analyzeContent({
      title: "Christmas Express Train in the Snow",
      provenance: { theme: "train journey" },
    });
    expect(tags).toContain("christmas");
    expect(tags).toContain("train");
    expect(tags).toContain("snow");
  });

  it("selects calm music for snowy night content", () => {
    const tags = analyzeContent({ title: "Snowy Silent Christmas Night" });
    const picked = selectMusicTrack({ tracks, contentTags: tags });
    expect(picked?.id).toBe("t1");
    expect(moodHintsFromTags(tags)).toContain("calm");
  });

  it("builds contextual platform metadata with brand hashtag", () => {
    const metadata = buildPlatformMetadata({
      title: "Cozy Fireplace Christmas Tree",
      contentTags: ["christmas", "cozy", "tree"],
    });
    expect(metadata.instagram?.caption).toContain("🎄");
    expect(metadata.instagram?.hashtags).toContain("#TheDigitalGifter");
    expect(metadata.youtube?.title.length).toBeLessThanOrEqual(100);
  });

  it("blocks READY_TO_PUBLISH when music is not verified", () => {
    const metadata = buildPlatformMetadata({ title: "Test", contentTags: ["christmas"] });
    const result = evaluateReadiness({
      videoProbe: {
        duration: 20,
        width: 1080,
        height: 1920,
        fps: 30,
        hasAudio: false,
        videoCodec: "h264",
        audioCodec: null,
        fileSize: 1000,
        orientation: "portrait",
      },
      musicTrack: { ...tracks[0], approvedForAutopilot: false },
      musicProbe: {
        duration: 120,
        width: 0,
        height: 0,
        fps: 0,
        hasAudio: true,
        videoCodec: null,
        audioCodec: "mp3",
        fileSize: 1000,
        orientation: "square",
      },
      audioRenderOk: true,
      finalProbe: {
        duration: 20,
        width: 1080,
        height: 1920,
        fps: 30,
        hasAudio: true,
        videoCodec: "h264",
        audioCodec: "aac",
        fileSize: 2000,
        orientation: "portrait",
      },
      metadata,
    });
    expect(result.ok).toBe(false);
    expect(result.checks.musicLicenseVerified).toBe(false);
  });

  it("treats legacy catalog assets as publish-ready for autopilot compatibility", () => {
    expect(publishReadyFromStatus("legacy")).toBe(true);
    expect(publishReadyFromStatus("pending_finish")).toBe(false);
    expect(publishReadyFromStatus("ready_to_publish")).toBe(true);
  });
});
