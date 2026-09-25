import type { PublicationStatus, TargetOutcome, TargetStatus } from "./types";

export function rollupPublicationStatus(targets: Array<Pick<TargetOutcome, "status">>): PublicationStatus {
  if (targets.length === 0) return "draft";
  const statuses = targets.map((t) => t.status);
  if (statuses.every((s) => s === "cancelled")) return "cancelled";
  if (statuses.every((s) => s === "draft")) return "draft";
  if (statuses.some((s) => s === "processing")) return "processing";

  const active = statuses.filter((s) => s !== "cancelled");
  const published = active.filter((s) => s === "published").length;
  const failed = active.filter((s) => s === "failed").length;
  const scheduled = active.filter((s) => s === "scheduled" || s === "draft").length;

  if (published === active.length && active.length > 0) return "published";
  if (published > 0 && (failed > 0 || scheduled > 0)) return "partial";
  if (failed === active.length && active.length > 0 && scheduled === 0) return "failed";
  if (scheduled > 0) return "scheduled";
  if (failed > 0 && published === 0) return "failed";
  return "partial";
}

export function canRetryTarget(target: {
  status: TargetStatus;
  remotePostId?: string | null;
}): boolean {
  if (target.remotePostId) return false;
  return target.status === "failed";
}

export function shouldSkipPublish(target: {
  status: TargetStatus;
  remotePostId?: string | null;
}): boolean {
  if (target.remotePostId) return true;
  return target.status === "published" || target.status === "cancelled";
}

export function targetIdempotencyKey(publicationId: string, platform: string): string {
  return `${publicationId}:${platform}`;
}

export function isDueForClaim(input: {
  status: TargetStatus;
  remotePostId: string | null;
  scheduledAtMs: number;
  publicationStatus: PublicationStatus;
  nextRetryAtMs: number | null;
  leaseExpiresAtMs: number | null;
  nowMs: number;
  skipReason?: string | null;
  livePostsEnabledAtMs?: number | null;
  livePostsEnabled?: boolean;
}): boolean {
  if (input.remotePostId) return false;
  if (input.skipReason) return false;
  if (input.livePostsEnabled === false) return false;
  if (input.livePostsEnabledAtMs != null && input.scheduledAtMs < input.livePostsEnabledAtMs) return false;
  if (input.publicationStatus === "cancelled" || input.publicationStatus === "draft") return false;
  if (input.status !== "scheduled") return false;
  if (input.scheduledAtMs > input.nowMs) return false;
  if (input.nextRetryAtMs != null && input.nextRetryAtMs > input.nowMs) return false;
  if (input.leaseExpiresAtMs != null && input.leaseExpiresAtMs > input.nowMs) return false;
  return true;
}

export function nextRetryAtMs(nowMs: number, attempts: number): number {
  const minutes = Math.min(60, 2 ** Math.max(0, attempts - 1));
  return nowMs + minutes * 60_000;
}
