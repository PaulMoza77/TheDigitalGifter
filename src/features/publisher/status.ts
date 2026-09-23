import type { PublisherDestinationJob, PublisherPublication, PublisherSlot, PublisherStatus } from "./types";

export function rollupJobStatuses(statuses: PublisherStatus[]): PublisherStatus {
  if (!statuses.length) return "needs_content";
  if (statuses.every((status) => status === "cancelled")) return "cancelled";
  if (statuses.some((status) => status === "processing")) return "processing";
  if (statuses.some((status) => status === "failed") && statuses.every((status) => status === "failed" || status === "completed" || status === "cancelled")) {
    return statuses.some((status) => status === "completed") ? "failed" : "failed";
  }
  if (statuses.some((status) => status === "failed")) return "failed";
  if (statuses.every((status) => status === "completed")) return "completed";
  if (statuses.some((status) => status === "needs_content")) return "needs_content";
  if (statuses.some((status) => status === "needs_approval")) return "needs_approval";
  if (statuses.some((status) => status === "scheduled")) return "scheduled";
  return statuses[0];
}

export function publicationStatusFromParts(input: {
  libraryAssetId: string | null;
  approved: boolean;
  approvalRequired: boolean;
  jobs: Array<Pick<PublisherDestinationJob, "status">>;
  cancelled?: boolean;
}): PublisherStatus {
  if (input.cancelled) return "cancelled";
  if (!input.libraryAssetId) return "needs_content";
  const jobStatuses = input.jobs.map((job) => job.status);
  if (jobStatuses.some((status) => status === "processing")) return "processing";
  if (jobStatuses.some((status) => status === "completed" || status === "failed") && jobStatuses.every((status) => status === "completed" || status === "failed" || status === "cancelled")) {
    return jobStatuses.every((status) => status === "completed") ? "completed" : "failed";
  }
  if (input.approvalRequired && !input.approved) return "needs_approval";
  return "scheduled";
}

export function jobIsClaimable(
  job: Pick<PublisherDestinationJob, "status" | "nextRetryAt" | "leaseExpiresAt" | "attempts" | "maxAttempts" | "remotePostId">,
  publication: Pick<PublisherPublication, "approved" | "status" | "scheduledAt" | "libraryAssetId">,
  nowMs: number,
  approvalRequired: boolean,
): boolean {
  if (!publication.libraryAssetId) return false;
  if (publication.status === "cancelled") return false;
  if (approvalRequired && !publication.approved) return false;
  if (publication.status === "needs_approval" || publication.status === "needs_content") return false;
  if (job.remotePostId) return false;
  if (job.status !== "scheduled" && job.status !== "failed") return false;
  if (job.attempts >= job.maxAttempts && job.status === "failed") return false;
  const scheduled = Date.parse(publication.scheduledAt);
  if (!Number.isFinite(scheduled) || scheduled > nowMs) return false;
  if (job.nextRetryAt && Date.parse(job.nextRetryAt) > nowMs) return false;
  if (job.leaseExpiresAt && Date.parse(job.leaseExpiresAt) > nowMs) return false;
  return true;
}

export function selectClaimableJobs<T extends { id: string; scheduledAtMs: number }>(
  rows: T[],
  limit: number,
): T[] {
  return [...rows]
    .sort((a, b) => a.scheduledAtMs - b.scheduledAtMs || a.id.localeCompare(b.id))
    .slice(0, Math.max(0, limit));
}

export function retryDelayMs(attempts: number): number {
  const bounded = Math.min(Math.max(attempts, 1), 5);
  return bounded * 30_000;
}

export function slotIsProtected(slot: Pick<PublisherSlot, "locked" | "manuallyEdited" | "status" | "assignmentLocked">): boolean {
  if (slot.locked || slot.manuallyEdited || slot.assignmentLocked) return true;
  return slot.status === "completed" || slot.status === "processing" || slot.status === "cancelled";
}

export function slotIsEditableFuture(
  slot: Pick<PublisherSlot, "locked" | "manuallyEdited" | "status" | "assignmentLocked" | "scheduledAt">,
  nowMs: number,
): boolean {
  if (slotIsProtected(slot)) return false;
  const scheduled = Date.parse(slot.scheduledAt);
  if (!Number.isFinite(scheduled) || scheduled <= nowMs) return false;
  return true;
}
