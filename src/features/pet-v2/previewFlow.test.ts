import { describe, expect, it } from "vitest";
import { mapV2CountsToPrimarySteps, namedEventCounts } from "../pet/funnelDatasetConfig";
import { v2IdempotencyKey } from "./analytics";
import { previewErrorMessage } from "./previewErrors";
import {
  backStepFrom,
  buildV2PreviewRetryAttemptId,
  clearPreviewOnPhotoChange,
  resolveGenerateAttempt,
  shouldRestoreLocalPreview,
} from "./previewFlow";

const sessionId = "11111111-2222-4333-8333-444444444401";
const uploadA = "upload-a";
const uploadB = "upload-b";
const attemptA = `preview:${sessionId}:${uploadA}`;

describe("V2 preview navigation + attempt flow", () => {
  it("restores a successful local preview cache without duplicate generation", () => {
    const draft = {
      uploadId: uploadA,
      previewAttemptId: attemptA,
      generatedPreviewDataUrl: "data:image/jpeg;base64,abc",
      generationMode: "live" as const,
    };
    expect(shouldRestoreLocalPreview(draft, false)).toBe(true);
    // Live/legacy (V3 shared helper): offer → preview when a live preview exists.
    expect(backStepFrom("offer", draft)).toBe("preview");
    // Teaser rebuild: never land on clear free AI preview.
    expect(backStepFrom("teaser", { ...draft, generationMode: "teaser" })).toBe("photo");
    expect(backStepFrom("offer", { ...draft, generationMode: "teaser" })).toBe("photo");
    expect(
      resolveGenerateAttempt({
        sessionId,
        uploadId: uploadA,
        previewAttemptId: attemptA,
        regenerate: false,
        retryAfterFailure: false,
        lastFailureCategory: null,
      }).attemptId,
    ).toBe(attemptA);
  });

  it("clears stale preview state when the photo is replaced", () => {
    const cleared = clearPreviewOnPhotoChange({
      uploadId: uploadB,
      photoPreviewDataUrl: "data:image/jpeg;base64,new",
    });
    expect(cleared.previewAttemptId).toBeNull();
    expect(cleared.generatedPreviewDataUrl).toBeNull();
    expect(cleared.generationMode).toBeNull();

    const draft = {
      uploadId: uploadB,
      previewAttemptId: null,
      generatedPreviewDataUrl: null,
      generationMode: null,
    };
    expect(shouldRestoreLocalPreview(draft, false)).toBe(false);
    const next = resolveGenerateAttempt({
      sessionId,
      uploadId: uploadB,
      previewAttemptId: null,
      regenerate: false,
      retryAfterFailure: false,
      lastFailureCategory: null,
    });
    expect(next.attemptId).toBe(`preview:${sessionId}:${uploadB}`);
    expect(next.attemptId).not.toBe(attemptA);
  });

  it("keeps the same attempt id on timeout retry so Replicate can resume", () => {
    const resolved = resolveGenerateAttempt({
      sessionId,
      uploadId: uploadA,
      previewAttemptId: attemptA,
      regenerate: false,
      retryAfterFailure: true,
      lastFailureCategory: "timeout",
    });
    expect(resolved.attemptId).toBe(attemptA);
    expect(resolved.resumeProviderAttempt).toBe(true);
  });

  it("mints a fresh retry attempt after terminal/stale failure", () => {
    const resolved = resolveGenerateAttempt({
      sessionId,
      uploadId: uploadA,
      previewAttemptId: attemptA,
      regenerate: false,
      retryAfterFailure: true,
      lastFailureCategory: "server_error",
    });
    expect(resolved.attemptId).toMatch(/^preview:.*:retry:/);
    expect(resolved.attemptId).not.toBe(attemptA);
    expect(buildV2PreviewRetryAttemptId(attemptA, "nonce-1")).toBe(`${attemptA}:retry:nonce-1`);
  });

  it("maps failure categories to safe actionable UI copy", () => {
    expect(previewErrorMessage({ failureCategory: "timeout" })).toMatch(/Try again/i);
    expect(previewErrorMessage({ failureCategory: "server_error" })).toMatch(/replace the photo/i);
    expect(previewErrorMessage({ failureCategory: "rate_limit", error: "Too many free previews" })).toBe(
      "Too many free previews",
    );
    expect(previewErrorMessage({ failureCategory: "rate_limit" })).toMatch(/Try again in a moment/i);
    expect(previewErrorMessage({ errorCode: "rate_limited" })).toMatch(/free previews/i);
  });
});

describe("V2 unlock analytics", () => {
  it("records one unlock click per event id and dashboard counts it", () => {
    const eventId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
    const unlockKey = v2IdempotencyKey({
      sessionId,
      eventName: "v2_unlock_clicked",
      species: "dog",
      eventId,
    });
    const unlockKeyDup = v2IdempotencyKey({
      sessionId,
      eventName: "v2_unlock_clicked",
      species: "dog",
      eventId,
    });
    const unlockKeyOtherClick = v2IdempotencyKey({
      sessionId,
      eventName: "v2_unlock_clicked",
      species: "dog",
      eventId: "ffffffff-1111-4222-8333-444444444402",
    });

    expect(unlockKey).toBe(unlockKeyDup);
    expect(unlockKey).toContain("v2_unlock_clicked");
    expect(unlockKey).toContain(eventId);
    expect(unlockKeyOtherClick).not.toBe(unlockKey);

    const counts = namedEventCounts([
      { event_name: "v2_landing_view", unique_sessions: 1 },
      { event_name: "v2_preview_viewed", unique_sessions: 1 },
      { event_name: "v2_unlock_clicked", unique_sessions: 1 },
    ]);
    const mapped = mapV2CountsToPrimarySteps({
      v2_landing_view: counts.v2_landing_view,
      v2_upload_completed: counts.v2_upload_completed || 0,
      v2_preview_viewed: counts.v2_preview_viewed,
      v2_unlock_clicked: counts.v2_unlock_clicked,
    });
    expect(mapped.order_review_viewed).toBe(1);
  });
});
