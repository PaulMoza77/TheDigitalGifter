/**
 * Pure order/generation state machine used by webhook fulfillment.
 * The webhook never runs generation. It only claims paid and enqueues a job.
 */

export const ORDER_STATUSES = [
  "pending",
  "paid",
  "fulfilling",
  "completed",
  "failed",
  "refunded",
  "canceled",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const GENERATION_STATUSES = [
  "pending",
  "processing",
  "completed",
  "failed",
] as const;

export type GenerationStatus = (typeof GENERATION_STATUSES)[number];

export type ClaimPaidResult =
  | { kind: "claimed"; enqueueJob: true }
  | { kind: "duplicate_event"; enqueueJob: false }
  | { kind: "already_paid"; enqueueJob: false }
  | { kind: "not_pending"; enqueueJob: false; status: string };

export function claimPaidOrder(args: {
  eventAlreadyProcessed: boolean;
  orderStatus: string;
}): ClaimPaidResult {
  if (args.eventAlreadyProcessed) {
    return { kind: "duplicate_event", enqueueJob: false };
  }

  if (args.orderStatus === "pending") {
    return { kind: "claimed", enqueueJob: true };
  }

  if (
    args.orderStatus === "paid" ||
    args.orderStatus === "fulfilling" ||
    args.orderStatus === "completed" ||
    args.orderStatus === "failed"
  ) {
    return { kind: "already_paid", enqueueJob: false };
  }

  return {
    kind: "not_pending",
    enqueueJob: false,
    status: args.orderStatus,
  };
}

export type ClaimGenerationResult =
  | { kind: "claimed"; runGeneration: true }
  | { kind: "already_running"; runGeneration: false }
  | { kind: "already_complete"; runGeneration: false }
  | { kind: "retry_allowed"; runGeneration: true }
  | { kind: "stale_reclaim"; runGeneration: true }
  | { kind: "blocked"; runGeneration: false; reason: string };

export function claimGenerationStart(args: {
  generationStatus: string;
  attemptCount: number;
  maxAttempts: number;
}): ClaimGenerationResult {
  const status = args.generationStatus;

  if (status === "pending") {
    return { kind: "claimed", runGeneration: true };
  }

  if (status === "processing") {
    if (args.attemptCount >= args.maxAttempts) {
      return {
        kind: "blocked",
        runGeneration: false,
        reason: "max_attempts_reached",
      };
    }
    return { kind: "stale_reclaim", runGeneration: true };
  }

  if (status === "completed") {
    return { kind: "already_complete", runGeneration: false };
  }

  if (status === "failed") {
    if (args.attemptCount >= args.maxAttempts) {
      return {
        kind: "blocked",
        runGeneration: false,
        reason: "max_attempts_reached",
      };
    }
    return { kind: "retry_allowed", runGeneration: true };
  }

  return {
    kind: "blocked",
    runGeneration: false,
    reason: `unexpected_status:${status}`,
  };
}

export function jobBackoffMs(attempts: number): number {
  const capped = Math.min(Math.max(attempts, 1), 6);
  return 1000 * 2 ** capped;
}

export function rescheduleFailedJob(args: {
  attempts: number;
  maxAttempts: number;
}): { status: "queued" | "dead"; retry: boolean; runAfterMs: number } {
  if (args.attempts >= args.maxAttempts) {
    return { status: "dead", retry: false, runAfterMs: 0 };
  }
  return { status: "queued", retry: true, runAfterMs: jobBackoffMs(args.attempts) };
}

export function recoverStaleRunningJob(args: {
  status: string;
  lockedAtMs: number | null;
  nowMs: number;
  staleAfterMs: number;
}): boolean {
  if (args.status !== "running" || args.lockedAtMs == null) return false;
  return args.nowMs - args.lockedAtMs >= args.staleAfterMs;
}

export function canUseIncludedRegeneration(args: {
  orderStatus: string;
  allowed: number;
  used: number;
}): boolean {
  if (args.orderStatus !== "completed" && args.orderStatus !== "paid") return false;
  return args.used < args.allowed;
}
