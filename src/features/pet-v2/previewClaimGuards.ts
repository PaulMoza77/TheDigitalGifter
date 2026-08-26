/**
 * Fail-closed claim / provider-persist guards mirrored by pet-v2-preview.
 * Unit-tested here; edge function must keep the same contracts.
 */

export type BeginRpcResult = {
  action?: string;
  prediction_id?: string;
  status?: string;
  [key: string]: unknown;
} | null;

export function mapBeginRpcFailure(begin: BeginRpcResult): {
  status: number;
  errorCode: "claim_unavailable" | "claim_orphan" | "rate_limited";
  allowReplicate: boolean;
} | null {
  if (begin == null || typeof begin.action !== "string") {
    return { status: 503, errorCode: "claim_unavailable", allowReplicate: false };
  }
  if (
    begin.action === "claim_unavailable" ||
    begin.action === "invalid" ||
    begin.action === "missing"
  ) {
    return { status: 503, errorCode: "claim_unavailable", allowReplicate: false };
  }
  if (begin.action === "orphan_timeout") {
    return { status: 200, errorCode: "claim_orphan", allowReplicate: false };
  }
  if (begin.action === "quota_denied") {
    return { status: 429, errorCode: "rate_limited", allowReplicate: false };
  }
  if (begin.action === "create") {
    return null; // proceed
  }
  if (begin.action === "resume" || begin.action === "wait") {
    return null; // handled without new create
  }
  return { status: 503, errorCode: "claim_unavailable", allowReplicate: false };
}

export async function persistPredictionIdOrCancel(input: {
  markAttempt: () => Promise<boolean>;
  cancelPrediction: () => Promise<void>;
}): Promise<{ ok: true } | { ok: false; errorCode: "provider_state_persist_failed" }> {
  const persisted = await input.markAttempt();
  if (persisted) return { ok: true };
  await input.cancelPrediction();
  return { ok: false, errorCode: "provider_state_persist_failed" };
}

/** Active processing reservations expire with the orphan lease; succeeded keep 24h. */
export function countsTowardQuotaReservation(input: {
  status: string;
  live_generation?: boolean | null;
  started_at?: string | null;
  created_at?: string | null;
  nowMs: number;
  orphanMs: number;
  windowMs: number;
}): boolean {
  if (input.live_generation && input.status === "succeeded") {
    const created = input.created_at ? Date.parse(input.created_at) : NaN;
    return Number.isFinite(created) && input.nowMs - created < input.windowMs;
  }
  if (input.status === "processing") {
    const started = input.started_at ? Date.parse(input.started_at) : NaN;
    return Number.isFinite(started) && input.nowMs - started < input.orphanMs;
  }
  return false;
}
