import type { PetV2Draft, PetV2FailureCategory } from "./types";
import { buildV2PreviewAttemptId, cryptoRandomId } from "./previewAttempt";

/** Clear preview output whenever the underlying upload identity changes. */
export function clearPreviewOnPhotoChange(patch: Partial<PetV2Draft>): Partial<PetV2Draft> {
  return {
    ...patch,
    previewAttemptId: null,
    generatedPreviewDataUrl: null,
    generationMode: null,
    lastError: null,
  };
}

/**
 * After a successful live preview, navigating Back and tapping generate again for the
 * same upload must restore the cached preview — not start another Replicate job.
 */
export function shouldRestoreLocalPreview(
  draft: Pick<
    PetV2Draft,
    "uploadId" | "previewAttemptId" | "generatedPreviewDataUrl" | "generationMode"
  >,
  regenerate: boolean,
): boolean {
  if (regenerate) return false;
  if (!draft.uploadId || !draft.previewAttemptId || !draft.generatedPreviewDataUrl) return false;
  return true;
}

export type ResolveGenerateAttemptInput = {
  sessionId: string;
  uploadId: string;
  previewAttemptId: string | null;
  regenerate: boolean;
  /** Set when the user taps Try again on the generating screen. */
  retryAfterFailure: boolean;
  lastFailureCategory: PetV2FailureCategory | null;
};

export type ResolveGenerateAttemptResult = {
  attemptId: string;
  /** When true, keep the same provider attempt (resume polling). */
  resumeProviderAttempt: boolean;
};

/**
 * Mint attempt ids:
 * - first generate / regen → stable per session+upload or regen nonce
 * - timeout retry → same id (resume Replicate prediction)
 * - terminal/stale failure → fresh retry suffix so DB poison cannot block the next call
 * - upload identity change → never reuse a previous upload's attempt id
 */
export function resolveGenerateAttempt(input: ResolveGenerateAttemptInput): ResolveGenerateAttemptResult {
  const resumeProviderAttempt =
    input.retryAfterFailure && input.lastFailureCategory === "timeout";

  const attemptMatchesUpload =
    !input.previewAttemptId ||
    input.previewAttemptId.includes(`:${input.uploadId}`) ||
    input.previewAttemptId.includes(`:${input.uploadId}:`);

  if (input.regenerate) {
    return {
      attemptId: buildV2PreviewAttemptId({
        sessionId: input.sessionId,
        uploadId: input.uploadId,
        regenerate: true,
        regenNonce: cryptoRandomId(),
      }),
      resumeProviderAttempt: false,
    };
  }

  if (resumeProviderAttempt && input.previewAttemptId && attemptMatchesUpload) {
    return { attemptId: input.previewAttemptId, resumeProviderAttempt: true };
  }

  if (
    input.retryAfterFailure &&
    input.previewAttemptId &&
    attemptMatchesUpload &&
    input.lastFailureCategory &&
    input.lastFailureCategory !== "timeout"
  ) {
    return {
      attemptId: buildV2PreviewRetryAttemptId(input.previewAttemptId),
      resumeProviderAttempt: false,
    };
  }

  if (input.previewAttemptId && !input.retryAfterFailure && attemptMatchesUpload) {
    return { attemptId: input.previewAttemptId, resumeProviderAttempt: false };
  }

  return {
    attemptId: buildV2PreviewAttemptId({
      sessionId: input.sessionId,
      uploadId: input.uploadId,
    }),
    resumeProviderAttempt: false,
  };
}

export function buildV2PreviewRetryAttemptId(baseAttemptId: string, retryNonce?: string): string {
  const nonce = String(retryNonce || cryptoRandomId()).slice(0, 64);
  return `${baseAttemptId}:retry:${nonce}`.slice(0, 180);
}

/**
 * Back navigation:
 * - V2 teaser rebuild: teaser/offer → photo (never clear free AI preview).
 * - V3 (and legacy live preview): offer → preview when a live preview exists.
 */
export function backStepFrom(
  current: PetV2Draft["step"],
  draft: Pick<PetV2Draft, "generatedPreviewDataUrl" | "generationMode">,
): PetV2Draft["step"] {
  if (current === "teaser") return "photo";
  if (current === "offer") {
    if (draft.generationMode === "teaser") return "photo";
    return draft.generatedPreviewDataUrl ? "preview" : "photo";
  }
  if (current === "preview" || current === "generating") return "photo";
  if (current === "photo") return "landing";
  return "landing";
}
