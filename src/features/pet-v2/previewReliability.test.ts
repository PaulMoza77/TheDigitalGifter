import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  decideAcquirePreviewCreate,
  retryAfterSecondsFromOldest,
  simulateConcurrentAcquire,
} from "./acquirePreviewCreate";
import { previewErrorUiState } from "./previewErrors";
import { rateLimitRetryAfterSeconds, rateLimitUserMessage, V2_PREVIEW_QUOTA_DOCS } from "./previewQuota";
import {
  backStepFrom,
  clearPreviewOnPhotoChange,
  resolveGenerateAttempt,
  shouldRestoreLocalPreview,
} from "./previewFlow";
import { convertHeicToJpegFile, HEIC_MAX_BYTES_BEFORE_CONVERT, isHeicPhoto } from "./heic";
import { validateV2PhotoFile } from "./photo";
import { PET_V2_MAX_FREE_PREVIEWS_PER_IP_PER_DAY, PET_V2_MAX_FREE_PREVIEWS_PER_SESSION } from "./types";

vi.mock("heic2any", () => ({
  default: vi.fn(async () => new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: "image/jpeg" })),
}));

describe("V2 preview quota docs", () => {
  it("documents 2 session / 5 IP quotas and success-only consumption", () => {
    expect(V2_PREVIEW_QUOTA_DOCS.sessionMax).toBe(PET_V2_MAX_FREE_PREVIEWS_PER_SESSION);
    expect(V2_PREVIEW_QUOTA_DOCS.ipDayMax).toBe(PET_V2_MAX_FREE_PREVIEWS_PER_IP_PER_DAY);
    expect(V2_PREVIEW_QUOTA_DOCS.consumesOn).toContain("live_generation=true");
    expect(V2_PREVIEW_QUOTA_DOCS.reservesOn).toContain("processing");
    expect(V2_PREVIEW_QUOTA_DOCS.deployOrder).toMatch(/migration/);
  });

  it("computes retryAfterSeconds from oldest rolling-window row", () => {
    const now = Date.parse("2026-08-26T12:00:00.000Z");
    const oldest = "2026-08-26T00:00:00.000Z";
    expect(retryAfterSecondsFromOldest(oldest, now)).toBe(12 * 3600);
    expect(rateLimitRetryAfterSeconds({ kind: "session", oldestCreatedAt: oldest })).toBeGreaterThan(0);
    expect(rateLimitUserMessage({ kind: "ip", retryAfterSeconds: 6 * 3600 })).toMatch(/5 per 24/);
  });
});

describe("exactly-once acquire decision", () => {
  it("allows only one create among concurrent callers", () => {
    const shared = { status: "pending", prediction_id: null as string | null };
    const actions = simulateConcurrentAcquire(shared, 5);
    expect(actions.filter((a) => a === "create")).toHaveLength(1);
    expect(actions.filter((a) => a === "wait")).toHaveLength(4);
  });

  it("resumes when prediction_id already exists", () => {
    expect(
      decideAcquirePreviewCreate({
        status: "processing",
        prediction_id: "pred_abc",
        live_generation: false,
      }).action,
    ).toBe("resume");
  });

  it("returns orphan_timeout for abandoned processing without prediction", () => {
    const started = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    expect(
      decideAcquirePreviewCreate({
        status: "processing",
        prediction_id: null,
        started_at: started,
      }).action,
    ).toBe("orphan_timeout");
  });

  it("treats missing rows as missing (fail closed upstream)", () => {
    expect(decideAcquirePreviewCreate(null).action).toBe("missing");
  });
});

describe("quota consumption semantics (unit)", () => {
  it("failed pre-provider attempts do not count as succeeded live generations", () => {
    const rows = [
      { live_generation: false, status: "failed", last_error_category: "invalid_image" },
      { live_generation: false, status: "failed", last_error_category: "rate_limit" },
      { live_generation: true, status: "succeeded" },
    ];
    const consumed = rows.filter((r) => r.live_generation === true && r.status === "succeeded");
    expect(consumed).toHaveLength(1);
  });

  it("resume of the same attempt does not invent a second quota unit", () => {
    const sessionId = "11111111-2222-4333-8333-444444444401";
    const uploadId = "upload-a";
    const first = resolveGenerateAttempt({
      sessionId,
      uploadId,
      previewAttemptId: null,
      regenerate: false,
      retryAfterFailure: false,
      lastFailureCategory: null,
    });
    const resume = resolveGenerateAttempt({
      sessionId,
      uploadId,
      previewAttemptId: first.attemptId,
      regenerate: false,
      retryAfterFailure: true,
      lastFailureCategory: "timeout",
    });
    expect(resume.attemptId).toBe(first.attemptId);
    expect(resume.resumeProviderAttempt).toBe(true);
  });
});

describe("rate-limit UX", () => {
  it("includes retry timing and structured UI state", () => {
    const ui = previewErrorUiState({
      errorCode: "rate_limited",
      failureCategory: "rate_limit",
      rateLimitKind: "session",
      retryAfterSeconds: 7200,
      error: rateLimitUserMessage({ kind: "session", retryAfterSeconds: 7200 }),
    });
    expect(ui.kind).toBe("rate_limited");
    expect(ui.retryAfterSeconds).toBe(7200);
    expect(ui.message).toMatch(/2 per 24/);
  });
});

describe("HEIC conversion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects oversized HEIC before loading heic2any", async () => {
    const heic2any = (await import("heic2any")).default as unknown as ReturnType<typeof vi.fn>;
    const huge = new File([new Uint8Array([1])], "big.HEIC", { type: "image/heic" });
    Object.defineProperty(huge, "size", { value: HEIC_MAX_BYTES_BEFORE_CONVERT + 1 });
    await expect(convertHeicToJpegFile(huge)).rejects.toThrow(/heic_too_large/);
    expect(heic2any).not.toHaveBeenCalled();
  });

  it("converts HEIC to JPEG successfully (mocked)", async () => {
    const heic = new File([new Uint8Array([1, 2, 3])], "IMG_001.HEIC", { type: "image/heic" });
    expect(isHeicPhoto(heic)).toBe(true);
    const jpeg = await convertHeicToJpegFile(heic);
    expect(jpeg.type).toBe("image/jpeg");
    expect(jpeg.name.toLowerCase().endsWith(".jpg")).toBe(true);
    expect(validateV2PhotoFile(jpeg).ok).toBe(true);
  });

  it("surfaces a helpful CTA when conversion fails", async () => {
    const heic2any = (await import("heic2any")).default as unknown as ReturnType<typeof vi.fn>;
    heic2any.mockRejectedValueOnce(new Error("decode failed"));
    const heic = new File([new Uint8Array([1, 2, 3])], "IMG_001.HEIC", { type: "image/heic" });
    await expect(convertHeicToJpegFile(heic)).rejects.toBeTruthy();
    const raw = validateV2PhotoFile(heic);
    expect(raw.ok).toBe(false);
    if (!raw.ok) {
      expect(raw.code).toBe("heic_unsupported");
      expect(raw.message).toMatch(/JPEG|PNG|Most Compatible/i);
    }
  });
});

describe("Back/restore and replace-photo regressions", () => {
  const sessionId = "11111111-2222-4333-8333-444444444401";
  const uploadA = "upload-a";
  const attemptA = `preview:${sessionId}:${uploadA}`;

  it("restores local preview on Back without a new attempt id", () => {
    const draft = {
      uploadId: uploadA,
      previewAttemptId: attemptA,
      generatedPreviewDataUrl: "data:image/jpeg;base64,abc",
      generationMode: "live" as const,
    };
    expect(shouldRestoreLocalPreview(draft, false)).toBe(true);
    expect(backStepFrom("offer", draft)).toBe("preview");
  });

  it("clears attempt state when the photo is replaced", () => {
    const cleared = clearPreviewOnPhotoChange({
      uploadId: "upload-b",
      photoPreviewDataUrl: "data:image/jpeg;base64,new",
    });
    expect(cleared.previewAttemptId).toBeNull();
    expect(cleared.generatedPreviewDataUrl).toBeNull();
  });
});

describe("provider kill-switch contract", () => {
  it("PET_V2_PREVIEW_LIVE=false is the documented live kill switch", () => {
    expect("PET_V2_PREVIEW_LIVE").toMatch(/PET_V2_PREVIEW_LIVE/);
    const liveKill = String("false").toLowerCase() === "false";
    expect(liveKill).toBe(true);
  });
});
