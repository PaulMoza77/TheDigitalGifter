import { describe, expect, it } from "vitest";
import { selectDiverseCandidates } from "./diversity";
import type { ViralCandidate } from "./types";
import {
  bearerMatches,
  evaluateImportClaim,
  importFailureDisposition,
  importObjectPath,
  isFixedImportPath,
  publicImportError,
  youtubeProgressLabel,
  youtubeWatchUrl,
} from "./importDevice";

const JOB = "11111111-1111-4111-8111-111111111111";
const ATTEMPT = "22222222-2222-4222-8222-222222222222";
const OTHER = "33333333-3333-4333-8333-333333333333";

describe("clip factory import device", () => {
  it("normalizes YouTube links and rejects other hosts", () => {
    expect(youtubeWatchUrl("https://youtu.be/pV9UPP7n0Po?si=abc")).toBe("https://www.youtube.com/watch?v=pV9UPP7n0Po");
    expect(youtubeWatchUrl("https://example.com/watch?v=pV9UPP7n0Po")).toBeNull();
    expect(youtubeWatchUrl("https://www.youtube.com/watch?v=short")).toBeNull();
  });

  it("fixes the upload object to the claimed job and attempt", () => {
    const path = importObjectPath(JOB, ATTEMPT);
    expect(path).toBe(`imports/${JOB}/${ATTEMPT}/source.mp4`);
    expect(isFixedImportPath(JOB, ATTEMPT, path)).toBe(true);
    expect(isFixedImportPath(JOB, ATTEMPT, `imports/${JOB}/${OTHER}/source.mp4`)).toBe(false);
    expect(isFixedImportPath(JOB, ATTEMPT, `imports/${JOB}/${ATTEMPT}/../source.mp4`)).toBe(false);
    expect(() => importObjectPath(JOB, "../etc")).toThrow(/invalid import id/);
  });

  it("rejects a missing, mismatched, or expired claim", () => {
    const now = Date.parse("2026-09-21T20:00:00.000Z");
    expect(
      evaluateImportClaim({
        jobAttemptId: ATTEMPT,
        jobWorkerId: "mac-mini",
        jobStatus: "importing",
        leaseExpiresAt: "2026-09-21T20:03:00.000Z",
        mediaId: null,
        objectPath: null,
        requestAttemptId: OTHER,
        requestWorkerId: "mac-mini",
        now,
      }).ok,
    ).toBe(false);
    expect(
      evaluateImportClaim({
        jobAttemptId: ATTEMPT,
        jobWorkerId: "mac-mini",
        jobStatus: "importing",
        leaseExpiresAt: "2026-09-21T19:59:00.000Z",
        mediaId: null,
        objectPath: null,
        requestAttemptId: ATTEMPT,
        requestWorkerId: "mac-mini",
        now,
      }),
    ).toEqual({ ok: false, error: "lease_expired" });
    expect(
      evaluateImportClaim({
        jobAttemptId: null,
        jobWorkerId: null,
        jobStatus: "waiting_for_import",
        leaseExpiresAt: null,
        mediaId: null,
        objectPath: null,
        requestAttemptId: ATTEMPT,
        requestWorkerId: "mac-mini",
        now,
      }),
    ).toEqual({ ok: false, error: "claim_mismatch" });
  });

  it("accepts the current claim and an exact replay after the file is stored", () => {
    const now = Date.parse("2026-09-21T20:00:00.000Z");
    expect(
      evaluateImportClaim({
        jobAttemptId: ATTEMPT,
        jobWorkerId: "mac-mini",
        jobStatus: "importing",
        leaseExpiresAt: "2026-09-21T20:03:00.000Z",
        mediaId: null,
        objectPath: null,
        requestAttemptId: ATTEMPT,
        requestWorkerId: "mac-mini",
        now,
      }),
    ).toEqual({ ok: true, already: false });
    expect(
      evaluateImportClaim({
        jobAttemptId: ATTEMPT,
        jobWorkerId: "mac-mini",
        jobStatus: "queued",
        leaseExpiresAt: null,
        mediaId: "media-1",
        objectPath: `imports/${JOB}/${ATTEMPT}/source.mp4`,
        requestAttemptId: ATTEMPT,
        requestWorkerId: "other-mac",
        now,
      }),
    ).toEqual({ ok: true, already: true });
  });

  it("keeps a sleeping Mac as waiting and fails only terminal or exhausted attempts", () => {
    expect(importFailureDisposition("bot_check", 1)).toBe("retry");
    expect(importFailureDisposition("network", 4)).toBe("retry");
    expect(importFailureDisposition("network", 5)).toBe("fail");
    expect(importFailureDisposition("video_private", 1)).toBe("fail");
    expect(publicImportError("bot_check")).toContain("not a bot");
  });

  it("requires a dedicated worker token and ignores a short or blank secret", () => {
    expect(bearerMatches("abcd", "")).toBe(false);
    expect(bearerMatches("short-token", "short-token")).toBe(false);
    const token = "a".repeat(32);
    expect(bearerMatches(token, token)).toBe(true);
    expect(bearerMatches(`${token}x`, token)).toBe(false);
    expect(bearerMatches(token.replace("a", "b"), token)).toBe(false);
  });

  it("shows the five import stages without treating a wait as completion", () => {
    expect(youtubeProgressLabel("waiting_for_import")).toBe("Waiting for import device");
    expect(youtubeProgressLabel("importing")).toBe("Importing video");
    expect(youtubeProgressLabel("transcribing")).toBe("Finding moments");
    expect(youtubeProgressLabel("rendering")).toBe("Creating clips");
    expect(youtubeProgressLabel("completed")).toBe("Complete");
  });

  it("does not invent duplicate clips to fill the requested count", () => {
    const moments = [0, 30, 31, 90].map((start, index) => ({
      startTime: start,
      endTime: start + 12,
      overallViralScore: 100 - index,
    })) as ViralCandidate[];
    const selected = selectDiverseCandidates(moments, 10);
    expect(selected.length).toBe(3);
    expect(selected.map((item) => item.startTime)).toEqual([0, 30, 90]);
  });
});
