/**
 * Decision table for acquire_pet_v2_preview_create (mirrored in SQL migration).
 * Used by unit tests; the database function is authoritative at runtime.
 */
export type AcquirePreviewCreateAction = "create" | "resume" | "wait" | "missing";

export type AcquirePreviewCreateRow = {
  status: string | null | undefined;
  prediction_id?: string | null;
  live_generation?: boolean | null;
};

export function decideAcquirePreviewCreate(
  row: AcquirePreviewCreateRow | null,
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
    return { action: "wait", status: "processing" };
  }
  if (row.status !== "pending" && row.status !== "failed") {
    return {
      action: "resume",
      prediction_id: predictionId || undefined,
      status: String(row.status || ""),
      live_generation: Boolean(row.live_generation),
    };
  }
  return { action: "create", status: "processing" };
}

/** Concurrent callers: only the first create wins; others must wait/resume. */
export function simulateConcurrentAcquire(
  shared: { status: string; prediction_id: string | null },
  callers: number,
): AcquirePreviewCreateAction[] {
  const results: AcquirePreviewCreateAction[] = [];
  for (let i = 0; i < callers; i += 1) {
    const decision = decideAcquirePreviewCreate(shared);
    results.push(decision.action);
    if (decision.action === "create") {
      shared.status = "processing";
    }
  }
  return results;
}
