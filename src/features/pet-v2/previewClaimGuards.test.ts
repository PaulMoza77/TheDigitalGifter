import { describe, expect, it, vi } from "vitest";
import {
  countsTowardQuotaReservation,
  mapBeginRpcFailure,
  persistPredictionIdOrCancel,
} from "./previewClaimGuards";

describe("begin RPC fail-closed", () => {
  it("RPC unavailable/malformed → 503 claim_unavailable and zero provider creates", () => {
    let replicateCreates = 0;
    const cases: Array<Parameters<typeof mapBeginRpcFailure>[0]> = [
      null,
      {},
      { action: undefined },
      { action: "claim_unavailable" },
      { action: "missing" },
      { action: "invalid" },
      { action: "unexpected_action" },
    ];
    for (const begin of cases) {
      const mapped = mapBeginRpcFailure(begin);
      expect(mapped).not.toBeNull();
      expect(mapped!.errorCode).toBe("claim_unavailable");
      expect(mapped!.status).toBe(503);
      expect(mapped!.allowReplicate).toBe(false);
      if (!mapped!.allowReplicate) {
        /* do not call Replicate */
      } else {
        replicateCreates += 1;
      }
    }
    expect(replicateCreates).toBe(0);
  });

  it("create action is the only path that may proceed to provider create", () => {
    expect(mapBeginRpcFailure({ action: "create" })).toBeNull();
    expect(mapBeginRpcFailure({ action: "resume", prediction_id: "p1" })).toBeNull();
    expect(mapBeginRpcFailure({ action: "wait" })).toBeNull();
  });
});

describe("prediction_id persist gap", () => {
  it("does not continue polling when persist fails; cancels provider prediction", async () => {
    const cancelPrediction = vi.fn(async () => undefined);
    const pollPrediction = vi.fn(async () => ({ url: "https://example.com/out.jpg" }));

    const result = await persistPredictionIdOrCancel({
      markAttempt: async () => false,
      cancelPrediction,
    });
    expect(result).toEqual({ ok: false, errorCode: "provider_state_persist_failed" });
    expect(cancelPrediction).toHaveBeenCalledTimes(1);
    if (result.ok) {
      await pollPrediction();
    }
    expect(pollPrediction).not.toHaveBeenCalled();
  });

  it("continues only after persist succeeds", async () => {
    const cancelPrediction = vi.fn(async () => undefined);
    const result = await persistPredictionIdOrCancel({
      markAttempt: async () => true,
      cancelPrediction,
    });
    expect(result).toEqual({ ok: true });
    expect(cancelPrediction).not.toHaveBeenCalled();
  });
});

describe("orphan lease quota counting", () => {
  const now = Date.parse("2026-08-26T12:00:00.000Z");
  const orphanMs = 90_000;
  const windowMs = 24 * 3600 * 1000;

  it("expired orphan processing does not reserve capacity", () => {
    expect(
      countsTowardQuotaReservation({
        status: "processing",
        started_at: new Date(now - 10 * 60 * 1000).toISOString(),
        nowMs: now,
        orphanMs,
        windowMs,
      }),
    ).toBe(false);
  });

  it("active processing within lease reserves capacity", () => {
    expect(
      countsTowardQuotaReservation({
        status: "processing",
        started_at: new Date(now - 30_000).toISOString(),
        nowMs: now,
        orphanMs,
        windowMs,
      }),
    ).toBe(true);
  });

  it("succeeded live still consumes for full 24h window", () => {
    expect(
      countsTowardQuotaReservation({
        status: "succeeded",
        live_generation: true,
        created_at: new Date(now - 2 * 3600 * 1000).toISOString(),
        nowMs: now,
        orphanMs,
        windowMs,
      }),
    ).toBe(true);
  });
});
