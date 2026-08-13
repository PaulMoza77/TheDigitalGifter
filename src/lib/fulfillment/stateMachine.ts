/**
 * Pure order/generation state machine used by webhook fulfillment.
 * Generation is started only after an idempotent pending → paid claim.
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
  | { kind: "claimed"; shouldStartGeneration: true }
  | { kind: "duplicate_event"; shouldStartGeneration: false }
  | { kind: "already_paid"; shouldStartGeneration: false }
  | { kind: "not_pending"; shouldStartGeneration: false; status: string };

export function claimPaidOrder(args: {
  eventAlreadyProcessed: boolean;
  orderStatus: string;
}): ClaimPaidResult {
  if (args.eventAlreadyProcessed) {
    return { kind: "duplicate_event", shouldStartGeneration: false };
  }

  if (args.orderStatus === "pending") {
    return { kind: "claimed", shouldStartGeneration: true };
  }

  if (args.orderStatus === "paid" || args.orderStatus === "fulfilling" || args.orderStatus === "completed") {
    return { kind: "already_paid", shouldStartGeneration: false };
  }

  return {
    kind: "not_pending",
    shouldStartGeneration: false,
    status: args.orderStatus,
  };
}

export type ClaimGenerationResult =
  | { kind: "claimed"; runGeneration: true }
  | { kind: "already_running"; runGeneration: false }
  | { kind: "already_complete"; runGeneration: false }
  | { kind: "retry_allowed"; runGeneration: true }
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
    return { kind: "already_running", runGeneration: false };
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

export function canUseIncludedRegeneration(args: {
  orderStatus: string;
  allowed: number;
  used: number;
}): boolean {
  if (args.orderStatus !== "completed" && args.orderStatus !== "paid" && args.orderStatus !== "fulfilling") {
    return false;
  }
  return args.used < args.allowed;
}
