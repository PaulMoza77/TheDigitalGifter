import { describe, expect, it } from "vitest";
import { snapClipBoundaries, desiredClipCount } from "./boundaries";
import { buildAssCaptions, escapeAss, formatAssTime } from "./captions";
import { selectDiverseCandidates, sortCandidates } from "./diversity";
import { ffmpegCropExpression, interpolateSubject, planReframe } from "./reframe";
import { classifyMediaUrl } from "./safeUrl";
import { classifyVideoUrl } from "./ingest/classify";
import { extractYoutubeId, normalizeYoutubeUrl, parseIsoDuration } from "./ingest/adapters/youtube";
import { hostnameIsBlocked, isBlockedResolvedAddress, parsePublicHttpUrl } from "./ingest/ssrf";
import { prepareClipFactoryJob } from "./createJob";
import { canTransitionJob, requiresRightsConfirmation, rightsConfirmationError } from "./jobStates";
import { clipTimestampsValid, selectNonOverlappingMoments } from "./moments";
import { overallViralScore, SCORE_WEIGHTS, normalizeDimensions } from "./scoring";
import type { Transcript, ViralCandidate } from "./types";

const transcript: Transcript = {
  language: "en",
  fullText: "Christmas morning did not go as planned. Then everything changed.",
  words: [
    { word: "Christmas", start: 10, end: 10.4 },
    { word: "morning", start: 10.4, end: 10.8 },
    { word: "did", start: 10.8, end: 11.0 },
    { word: "not", start: 11.0, end: 11.2 },
    { word: "go", start: 11.2, end: 11.4 },
    { word: "as", start: 11.4, end: 11.55 },
    { word: "planned.", start: 11.55, end: 12.1 },
    { word: "Then", start: 13.0, end: 13.2 },
    { word: "everything", start: 13.2, end: 13.7 },
    { word: "changed.", start: 13.7, end: 14.4 },
  ],
  segments: [
    { start: 10, end: 12.1, text: "Christmas morning did not go as planned." },
    { start: 13.0, end: 14.4, text: "Then everything changed." },
  ],
};

function cand(partial: Partial<ViralCandidate> & Pick<ViralCandidate, "startTime" | "endTime" | "overallViralScore">): ViralCandidate {
  return {
    duration: partial.endTime - partial.startTime,
    title: "t",
    hook: "h",
    summary: "s",
    reason: "r",
    category: "viral",
    suggestedPlatforms: ["tiktok"],
    suggestedCaption: "c",
    suggestedPostCaption: "p",
    hashtags: ["#tdg"],
    confidence: 0.8,
    scores: { hook: 80, retention: 70, emotion: 60, humor: 40, visual: 50, standalone: 70, shareability: 65 },
    whyItWorks: ["Strong opening"],
    ...partial,
  };
}

describe("clip factory scoring", () => {
  it("computes a weighted overall and ignores a fake model overall", () => {
    const scores = normalizeDimensions({ hook: 100, retention: 0, emotion: 0, humor: 0, visual: 0, standalone: 0, shareability: 0 });
    expect(overallViralScore(scores, "viral")).toBe(Math.round(100 * SCORE_WEIGHTS.viral.hook));
    expect(SCORE_WEIGHTS.funny.humor).toBeGreaterThan(SCORE_WEIGHTS.educational.humor);
  });
});

describe("clip factory boundaries", () => {
  it("snaps mid-sentence cuts onto sentence edges", () => {
    const snapped = snapClipBoundaries(10.9, 13.3, transcript, 60, "auto");
    expect(snapped.start).toBeLessThanOrEqual(10.12);
    expect(snapped.end).toBeGreaterThanOrEqual(14.4);
  });

  it("auto clip count scales with duration", () => {
    expect(desiredClipCount("auto", 30)).toBe(4);
    expect(desiredClipCount(10, 400)).toBe(10);
  });
});

describe("clip factory diversity", () => {
  it("avoids near-duplicate windows", () => {
    const picked = selectDiverseCandidates(
      [
        cand({ startTime: 10, endTime: 25, overallViralScore: 90 }),
        cand({ startTime: 11, endTime: 26, overallViralScore: 89 }),
        cand({ startTime: 40, endTime: 55, overallViralScore: 70 }),
      ],
      2,
    );
    expect(picked).toHaveLength(2);
    expect(picked[1].startTime).toBe(40);
  });

  it("sorts by humor independently of overall", () => {
    const a = cand({ startTime: 0, endTime: 10, overallViralScore: 90, scores: { hook: 90, retention: 90, emotion: 10, humor: 10, visual: 10, standalone: 10, shareability: 10 } });
    const b = cand({ startTime: 20, endTime: 30, overallViralScore: 40, scores: { hook: 10, retention: 10, emotion: 10, humor: 99, visual: 10, standalone: 10, shareability: 10 } });
    expect(sortCandidates([a, b], "funny")[0]).toBe(b);
  });
});

describe("clip factory captions", () => {
  it("builds readable ASS with karaoke word timing and Romanian-safe escapes", () => {
    const ass = buildAssCaptions({
      transcript,
      start: 10,
      end: 14.4,
      style: "karaoke",
      hook: "Crăciunul s-a schimbat.",
      hookEnabled: true,
    });
    expect(ass).toContain("PlayResX: 1080");
    expect(ass).toContain("{\\k");
    expect(ass).toContain("Crăciunul");
    expect(escapeAss("{hi}")).toContain("\\{");
    expect(formatAssTime(65.5)).toBe("0:01:05.50");
  });
});

describe("clip factory ingest urls", () => {
  it("blocks SSRF and allows direct https media", () => {
    expect(classifyMediaUrl("http://127.0.0.1/secret.mp4").ok).toBe(false);
    expect(classifyMediaUrl("https://cdn.example.com/talk.mp4").ok).toBe(true);
  });

  it("classifies YouTube instead of rejecting the hostname", () => {
    const classified = classifyVideoUrl("https://youtube.com/watch?v=dQw4w9wgGcI");
    expect(classified.ok).toBe(true);
    if (classified.ok) {
      expect(classified.provider).toBe("youtube");
      expect(classified.normalizedUrl).toBe("https://www.youtube.com/watch?v=dQw4w9wgGcI");
      expect(classified.canImport).toBe(false);
    }
    expect(extractYoutubeId("https://youtu.be/dQw4w9wgGcI")).toBe("dQw4w9wgGcI");
    expect(normalizeYoutubeUrl("dQw4w9wgGcI")).toContain("watch?v=");
    expect(parseIsoDuration("PT1H2M3S")).toBe(3723);
  });

  it("blocks localhost, private ranges, and credentials", () => {
    expect(parsePublicHttpUrl("http://localhost/video.mp4").ok).toBe(false);
    expect(parsePublicHttpUrl("http://192.168.1.8/video.mp4").ok).toBe(false);
    expect(parsePublicHttpUrl("http://10.0.0.4/video.mp4").ok).toBe(false);
    expect(parsePublicHttpUrl("ftp://cdn.example.com/video.mp4").ok).toBe(false);
    expect(parsePublicHttpUrl("https://user:pass@cdn.example.com/video.mp4").ok).toBe(false);
    expect(hostnameIsBlocked("169.254.169.254")).toBe(true);
    expect(isBlockedResolvedAddress("172.16.0.4")).toBe(true);
    expect(isBlockedResolvedAddress("8.8.8.8")).toBe(false);
  });
});

describe("clip factory job creation", () => {
  it("requires rights confirmation for URL sources", () => {
    expect(requiresRightsConfirmation("youtube")).toBe(true);
    expect(rightsConfirmationError(false)).toMatch(/permission/i);
    const denied = prepareClipFactoryJob({
      source_kind: "direct_media_url",
      url: "https://cdn.example.com/talk.mp4",
      rights_confirmed: false,
    });
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.code).toBe("rights_required");
    const allowed = prepareClipFactoryJob({
      source_kind: "direct_media_url",
      url: "https://cdn.example.com/talk.mp4",
      rights_confirmed: true,
    });
    expect(allowed.ok).toBe(true);
  });

  it("does not require rights for uploads or library items", () => {
    expect(
      prepareClipFactoryJob({ source_kind: "upload", object_path: "uploads/a.mp4", file_name: "a.mp4" }).ok,
    ).toBe(true);
    expect(prepareClipFactoryJob({ source_kind: "library", library_asset_id: "reel-north-pole-santa" }).ok).toBe(true);
  });

  it("returns a specific fallback for YouTube without authorized import", () => {
    const result = prepareClipFactoryJob({
      url: "https://www.youtube.com/watch?v=dQw4w9wgGcI",
      rights_confirmed: true,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("import_unavailable");
      expect(result.message).toMatch(/Upload the original video file/i);
      expect(result.message).not.toMatch(/This source cannot be imported automatically/i);
    }
  });

  it("rejects invalid URLs and allows legal job transitions", () => {
    expect(prepareClipFactoryJob({ url: "not-a-url", rights_confirmed: true }).ok).toBe(false);
    expect(canTransitionJob("queued", "importing")).toBe(true);
    expect(canTransitionJob("transcribing", "analyzing")).toBe(true);
    expect(canTransitionJob("completed", "queued")).toBe(false);
    expect(canTransitionJob("failed", "queued")).toBe(true);
  });
});

describe("clip factory timestamps", () => {
  it("keeps selected moments non-overlapping and inside the source", () => {
    const picked = selectNonOverlappingMoments(
      [
        cand({ startTime: 10, endTime: 25, overallViralScore: 90 }),
        cand({ startTime: 18, endTime: 32, overallViralScore: 88 }),
        cand({ startTime: 40, endTime: 55, overallViralScore: 70 }),
      ],
      3,
    );
    expect(picked).toHaveLength(2);
    expect(picked[0].startTime).toBe(10);
    expect(picked[1].startTime).toBe(40);
    expect(clipTimestampsValid(10, 25, 60)).toBe(true);
    expect(clipTimestampsValid(10, 8, 60)).toBe(false);
  });
});

describe("clip factory reframe", () => {
  it("tracks off-center subjects instead of forcing center crop", () => {
    const plan = planReframe({
      width: 1920,
      height: 1080,
      keyframes: [
        { t: 0, subjectX: 0.82, subjectY: 0.4, hasFace: true, confidence: 0.9 },
        { t: 4, subjectX: 0.8, subjectY: 0.42, hasFace: true, confidence: 0.88 },
      ],
    });
    expect(plan.mode).toBe("track");
    const mid = interpolateSubject(plan.keyframes, 2);
    expect(mid.x).toBeGreaterThan(0.7);
    expect(ffmpegCropExpression(plan, 0, 1920, 1080)).toContain("crop=");
  });
});
