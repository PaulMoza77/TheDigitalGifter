import { describe, expect, it } from "vitest";
import { PetApiError } from "./api";
import {
  isFatalOrderLookupError,
  isTerminalOrderStatus,
  isTransientPollError,
  mergeOrderWithProgress,
  ORDER_POLL_INTERVAL_MS,
  shouldKeepPolling,
  withTimeout,
} from "./orderStatusPolling";
import { createPreviewOrderFixture } from "./previewApi";
import type { PetGenerationProgress } from "./types";

function progressFor(order = createPreviewOrderFixture("processing")): PetGenerationProgress {
  return {
    orderId: order.id,
    publicToken: order.publicToken,
    orderStatus: "quality_control",
    phase: "portrait_qc",
    overallPercent: 40,
    readyCount: 4,
    failedCount: 0,
    totalCount: 12,
    videoReadyCount: 0,
    videoFailedCount: 0,
    videoTotalCount: 2,
    scenes: order.scenes.map((scene, index) =>
      index === 0 ? { ...scene, status: "generating", progressPercent: 40 } : scene
    ),
    clips: order.clips ?? [],
    humanQualityControl: true,
  };
}

describe("order status polling", () => {
  it("keeps polling while portraits are queued or generating, and stops on terminal statuses", () => {
    expect(shouldKeepPolling({ status: "paid", scenes: [{ status: "queued" }] })).toBe(true);
    expect(shouldKeepPolling({ status: "processing", scenes: [{ status: "generating" }] })).toBe(true);
    expect(shouldKeepPolling({ status: "complete", scenes: [{ status: "ready" }] })).toBe(false);
    expect(isTerminalOrderStatus("complete")).toBe(true);
    expect(shouldKeepPolling({ status: "failed" })).toBe(false);
    expect(shouldKeepPolling({ status: "refunded" })).toBe(false);
  });

  it("treats rate limits, timeouts, and network errors as non-blocking after an order is on screen", () => {
    expect(isTransientPollError(new PetApiError("INVALID_REQUEST", "Too many requests. Please wait.", 429))).toBe(true);
    expect(isTransientPollError(new PetApiError("INVALID_REQUEST", "Status check timed out.", 408))).toBe(true);
    expect(isTransientPollError(new PetApiError("INVALID_REQUEST", "Pet funnel request failed", 503))).toBe(true);
    expect(isTransientPollError(new DOMException("Aborted", "AbortError"))).toBe(true);
    expect(isTransientPollError(new PetApiError("ORDER_NOT_FOUND", "missing", 404))).toBe(false);
    expect(isFatalOrderLookupError(new PetApiError("ORDER_NOT_FOUND", "missing", 404))).toBe(true);
    expect(isFatalOrderLookupError(new PetApiError("INVALID_REQUEST", "Too many requests. Please wait.", 429))).toBe(false);
  });

  it("merges live progress into the order without dropping identity fields", () => {
    const order = createPreviewOrderFixture("processing", { petName: "Akira" });
    const merged = mergeOrderWithProgress(order, progressFor(order));
    expect(merged.petName).toBe("Akira");
    expect(merged.status).toBe("quality_control");
    expect(merged.phase).toBe("portrait_qc");
    expect(merged.scenes[0]?.status).toBe("generating");
    expect(merged.scenes[0]?.progressPercent).toBe(40);
  });

  it("does not let a hung status check freeze the UI", async () => {
    await expect(withTimeout(new Promise(() => undefined), 20)).rejects.toMatchObject({
      status: 408,
    });
  });

  it("polls slower than the funnel rate-limit window so the page can stay open", () => {
    expect(ORDER_POLL_INTERVAL_MS).toBeGreaterThanOrEqual(8_000);
  });
});

describe("withTimeout", () => {
  it("returns the resolved value when the request finishes in time", async () => {
    await expect(withTimeout(Promise.resolve("ok"), 50)).resolves.toBe("ok");
  });

});
