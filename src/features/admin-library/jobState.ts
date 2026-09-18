export const SUBMIT_CLAIM_TIMEOUT_MS = 10 * 60 * 1000;

export const HIGGSFIELD_JOB_STATUSES = [
  "created",
  "estimated",
  "submitting",
  "submit_unconfirmed",
  "queued",
  "in_progress",
  "completed",
  "importing",
  "imported",
  "import_failed",
  "failed",
  "nsfw",
  "canceled",
] as const;

export type HiggsfieldJobStatus = (typeof HIGGSFIELD_JOB_STATUSES)[number];

const TERMINAL_PROVIDER = new Set(["completed", "failed", "nsfw", "canceled"]);
const OPEN_PROVIDER = new Set(["queued", "in_progress"]);
const CLAIMABLE = new Set(["created", "estimated"]);

export function mapProviderStatus(status: string): HiggsfieldJobStatus | null {
  const normalized = String(status || "").trim().toLowerCase();
  if (normalized === "queued") return "queued";
  if (normalized === "in_progress" || normalized === "in-progress" || normalized === "processing") {
    return "in_progress";
  }
  if (normalized === "completed" || normalized === "succeeded" || normalized === "success") return "completed";
  if (normalized === "failed" || normalized === "error") return "failed";
  if (normalized === "nsfw") return "nsfw";
  if (normalized === "canceled" || normalized === "cancelled") return "canceled";
  return null;
}

export function shouldPollProvider(status: HiggsfieldJobStatus, providerRequestId: string | null): boolean {
  if (!providerRequestId) return false;
  return OPEN_PROVIDER.has(status) || status === "submitting";
}

export function shouldRetryImport(status: HiggsfieldJobStatus): boolean {
  return status === "completed" || status === "import_failed" || status === "importing";
}

export function isProviderTerminal(status: string): boolean {
  const mapped = mapProviderStatus(status);
  return mapped != null && TERMINAL_PROVIDER.has(mapped);
}

export type ResumeAction = "poll" | "import" | "submit" | "wait" | "mark_unconfirmed" | "none";

/**
 * Higgsfield does not accept an idempotency key on generation POST
 * (docs: do not retry POST after an ambiguous timeout).
 * submitting + no request_id must never auto-submit.
 */
export function resumeAction(
  status: HiggsfieldJobStatus,
  providerRequestId: string | null,
  submitClaimedAtMs: number | null = null,
  nowMs = Date.now(),
  timeoutMs = SUBMIT_CLAIM_TIMEOUT_MS,
): ResumeAction {
  if (status === "imported") return "none";
  if (status === "submit_unconfirmed") {
    return providerRequestId ? "poll" : "none";
  }
  if (shouldRetryImport(status) && providerRequestId) return "import";
  if (providerRequestId && (shouldPollProvider(status, providerRequestId) || CLAIMABLE.has(status))) {
    return "poll";
  }
  if (status === "submitting" && !providerRequestId) {
    if (submitClaimedAtMs != null && nowMs - submitClaimedAtMs >= timeoutMs) return "mark_unconfirmed";
    return "wait";
  }
  if (!providerRequestId && CLAIMABLE.has(status)) return "submit";
  return "none";
}

/** Paid POST is allowed only from created/estimated with no provider id. Never from submitting. */
export function canSubmitPaidGeneration(status: HiggsfieldJobStatus, providerRequestId: string | null): boolean {
  if (providerRequestId) return false;
  return CLAIMABLE.has(status);
}

export type SubmitClaimReason =
  | "has_provider_id"
  | "already_submitting"
  | "submit_unconfirmed"
  | "status"
  | "lost_race";

export function evaluateSubmitClaim(job: {
  status: HiggsfieldJobStatus;
  provider_request_id: string | null;
}): { allowed: boolean; reason: SubmitClaimReason | null } {
  if (job.provider_request_id) return { allowed: false, reason: "has_provider_id" };
  if (job.status === "submitting") return { allowed: false, reason: "already_submitting" };
  if (job.status === "submit_unconfirmed") return { allowed: false, reason: "submit_unconfirmed" };
  if (!CLAIMABLE.has(job.status)) return { allowed: false, reason: "status" };
  return { allowed: true, reason: null };
}

/** estimateJob may refresh tariffs but must not roll an in-flight/paid state back to estimated. */
export function canResetEstimateStatus(status: HiggsfieldJobStatus, providerRequestId: string | null): boolean {
  if (providerRequestId) return false;
  return CLAIMABLE.has(status);
}

export type MemoryJob = {
  id: string;
  status: HiggsfieldJobStatus;
  provider_request_id: string | null;
  submit_claimed_at: string | null;
  budget_usd: number | null;
};

/** In-memory model of the atomic UPDATE … WHERE status IN (created,estimated) AND provider_request_id IS NULL. */
export function claimSubmitInStore(
  store: Map<string, MemoryJob>,
  jobId: string,
  budgetUsd: number,
  nowIso: string,
): { claimed: boolean; job: MemoryJob | null; reason: SubmitClaimReason | null } {
  const job = store.get(jobId) ?? null;
  if (!job) return { claimed: false, job: null, reason: "status" };
  const gate = evaluateSubmitClaim(job);
  if (!gate.allowed) return { claimed: false, job, reason: gate.reason };
  job.status = "submitting";
  job.budget_usd = budgetUsd;
  job.submit_claimed_at = nowIso;
  store.set(jobId, job);
  return { claimed: true, job, reason: null };
}

export function persistProviderIdInStore(
  store: Map<string, MemoryJob>,
  jobId: string,
  providerRequestId: string,
): MemoryJob {
  const job = store.get(jobId);
  if (!job) throw new Error("Job not found");
  job.provider_request_id = providerRequestId;
  if (job.status === "submitting" || job.status === "submit_unconfirmed") job.status = "queued";
  store.set(jobId, job);
  return job;
}

/** Persist failed after provider accepted: keep request_id when possible, never reopen paid POST. */
export function markSubmitUnconfirmedInStore(
  store: Map<string, MemoryJob>,
  jobId: string,
  providerRequestId: string | null,
): MemoryJob {
  const job = store.get(jobId);
  if (!job) throw new Error("Job not found");
  job.status = "submit_unconfirmed";
  if (providerRequestId) job.provider_request_id = providerRequestId;
  store.set(jobId, job);
  return job;
}
