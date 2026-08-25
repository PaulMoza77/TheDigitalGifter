import { describe, expect, it } from "vitest";
import { buildV2PreviewAttemptId } from "./previewAttempt";
import { v2IdempotencyKey } from "./analytics";

describe("V2 preview attempt identity", () => {
  it("keeps the first attempt stable for the same session + upload", () => {
    const first = buildV2PreviewAttemptId({
      sessionId: "11111111-2222-4333-8333-444444444401",
      uploadId: "upload-abc",
    });
    const retry = buildV2PreviewAttemptId({
      sessionId: "11111111-2222-4333-8333-444444444401",
      uploadId: "upload-abc",
    });
    expect(first).toBe("preview:11111111-2222-4333-8333-444444444401:upload-abc");
    expect(retry).toBe(first);
  });

  it("mints a distinct key for explicit regenerate", () => {
    const base = buildV2PreviewAttemptId({
      sessionId: "sess",
      uploadId: "up",
    });
    const regen = buildV2PreviewAttemptId({
      sessionId: "sess",
      uploadId: "up",
      regenerate: true,
      regenNonce: "nonce-1",
    });
    expect(regen).toBe("preview:sess:up:regen:nonce-1");
    expect(regen).not.toBe(base);
  });
});

describe("V2 preview analytics attempt dedupe", () => {
  it("dedupes started/completed/failed by attempt id", () => {
    const started = v2IdempotencyKey({
      sessionId: "sess-1",
      eventName: "v2_preview_generation_started",
      species: "dog",
      attemptId: "preview:sess-1:up-1",
    });
    const startedAgain = v2IdempotencyKey({
      sessionId: "sess-1",
      eventName: "v2_preview_generation_started",
      species: "dog",
      attemptId: "preview:sess-1:up-1",
    });
    const completed = v2IdempotencyKey({
      sessionId: "sess-1",
      eventName: "v2_preview_generation_completed",
      species: "dog",
      attemptId: "preview:sess-1:up-1",
    });
    expect(started).toBe(startedAgain);
    expect(started).toContain("preview:sess-1:up-1");
    expect(completed).not.toBe(started);
  });
});
