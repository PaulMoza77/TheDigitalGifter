/**
 * Decision helpers for begin_pet_v2_preview_create / acquire_pet_v2_preview_create.
 * Database RPCs are authoritative; these mirror the fail-closed / orphan rules for unit tests.
 */

export type AcquirePreviewCreateAction =
  | "create"
  | "resume"
  | "wait"
  | "missing"
  | "orphan_timeout"
  | "quota_denied"
  | "claim_unavailable"
  | "invalid";

export type AcquirePreviewCreateRow = {
  status: string | null | undefined;
  prediction_id?: string | null;
  live_generation?: boolean | null;
  started_at?: string | null;
};

const ORPHAN_MS = 90_000;

export function decideAcquirePreviewCreate(
  row: AcquirePreviewCreateRow | null,
  nowMs = Date.now(),
): {
  action: AcquirePreviewCreateAction;
  prediction_id?: string;
  status?: string;
  live_generation?: boolean;
} {
  if (!row) return { action: "missing" };
  const predictionId = String(row.prediction_id || "").trim();
  if (predictionId) {
    return {
      action: "resume",
      prediction_id: predictionId,
      status: String(row.status || ""),
      live_generation: Boolean(row.live_generation),
    };
  }
  if (row.status === "processing") {
    const started = row.started_at ? Date.parse(row.started_at) : NaN;
    if (Number.isFinite(started) && nowMs - started < ORPHAN_MS) {
      return { action: "wait", status: "processing" };
    }
    return { action: "orphan_timeout", status: "processing" };
  }
  if (row.status !== "pending" && row.status !== "failed") {
    return { action: "claim_unavailable", status: String(row.status || "") };
  }
  return { action: "create", status: "processing" };
}

/** Concurrent callers: only the first create wins; others must wait (not create). */
export function simulateConcurrentAcquire(
  shared: { status: string; prediction_id: string | null; started_at?: string | null },
  callers: number,
  nowMs = Date.now(),
): AcquirePreviewCreateAction[] {
  const results: AcquirePreviewCreateAction[] = [];
  for (let i = 0; i < callers; i += 1) {
    const decision = decideAcquirePreviewCreate(shared, nowMs);
    results.push(decision.action);
    if (decision.action === "create") {
      shared.status = "processing";
      shared.started_at = new Date(nowMs).toISOString();
    }
  }
  return results;
}

export function retryAfterSecondsFromOldest(oldestIso: string | null | undefined, nowMs = Date.now()): number {
  if (!oldestIso) return 1;
  const oldest = Date.parse(oldestIso);
  if (!Number.isFinite(oldest)) return 1;
  const resetAt = oldest + 24 * 60 * 60 * 1000;
  return Math.max(1, Math.ceil((resetAt - nowMs) / 1000));
}
