import { describe, expect, it } from "vitest";
import {
  assessMediaQuality,
  candidateTextGrounded,
  durationMatchesExpected,
  isKnownInvalidMediaHash,
  KNOWN_INVALID_MEDIA_HASHES,
} from "./mediaQuality";

describe("clip factory media quality", () => {
  it("rejects the poisoned 12.6s YouTube cache and duration mismatches", () => {
    expect(isKnownInvalidMediaHash(KNOWN_INVALID_MEDIA_HASHES[0])).toBe(true);
    const poison = assessMediaQuality({
      durationSeconds: 12.6,
      width: 1280,
      height: 720,
      fileSizeBytes: 174007,
      hasVideo: true,
      hasAudio: true,
      mediaHash: KNOWN_INVALID_MEDIA_HASHES[0],
      expectedDurationSeconds: 600,
    });
    expect(poison.ok).toBe(false);
    if (!poison.ok) expect(poison.code).toBe("synthetic_or_empty");

    const tiny = assessMediaQuality({
      durationSeconds: 12.6,
      width: 1280,
      height: 720,
      fileSizeBytes: 174007,
      hasVideo: true,
    });
    expect(tiny.ok).toBe(false);
    if (!tiny.ok) expect(tiny.code).toBe("synthetic_or_empty");

    expect(durationMatchesExpected(12.6, 480)).toBe(false);
    expect(durationMatchesExpected(480, 480)).toBe(true);
    expect(durationMatchesExpected(12.6, null)).toBe(true);
  });

  it("rejects uniform JPEG samples and ungrounded dog-dancing copy", () => {
    const uniform = assessMediaQuality({
      durationSeconds: 30,
      width: 1280,
      height: 720,
      fileSizeBytes: 2_000_000,
      jpegSampleBytes: [3200, 3100, 3300, 3000],
    });
    expect(uniform.ok).toBe(false);
    if (!uniform.ok) expect(uniform.code).toBe("uniform_frames");

    expect(
      candidateTextGrounded({
        start: 6.96,
        end: 12.6,
        title: "Dancing Dog Surprise",
        hook: "The family walked into the room and the dog started dancing.",
        summary: "A heartwarming moment",
        transcriptText: "",
        visualNotes: [
          { t: 0.4, note: "The frame is mostly dark with no visible subjects." },
          { t: 6, note: "The frame is mostly dark with no visible subjects." },
        ],
      }),
    ).toBe(false);

    expect(
      candidateTextGrounded({
        start: 10,
        end: 25,
        title: "Separated from family",
        hook: "He ended up alone in the city",
        summary: "Danger was waiting for him",
        transcriptText: "He got separated from his family and ended up alone in a city where danger was waiting for him",
        visualNotes: [{ t: 12, note: "A person walks down a street at night." }],
      }),
    ).toBe(true);
  });

  it("allows a real-sized encode that matches declared duration", () => {
    const ok = assessMediaQuality({
      durationSeconds: 5.04,
      width: 1280,
      height: 720,
      fileSizeBytes: 2_572_516,
      hasVideo: true,
      hasAudio: true,
      expectedDurationSeconds: 5,
    });
    expect(ok.ok).toBe(true);
  });
});
