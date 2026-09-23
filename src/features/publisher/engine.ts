import { DryRunPublisherAdapter, newAttemptId, sanitizeAdapterLog } from "./adapters";
import { futureAssignedAssetIds, publicationDuplicateKey, selectLibraryAsset } from "./assignment";
import { planSlotsForRule, slotUniqueKey } from "./slotGeneration";
import {
  jobIsClaimable,
  publicationStatusFromParts,
  retryDelayMs,
  selectClaimableJobs,
  slotIsEditableFuture,
} from "./status";
import type {
  PublisherAttempt,
  PublisherDestination,
  PublisherDestinationJob,
  PublisherLibraryAsset,
  PublisherPublication,
  PublisherScheduleRule,
  PublisherSlot,
  PublisherStatus,
} from "./types";
import { DEFAULT_MAX_ATTEMPTS, ROLLING_HORIZON_DAYS } from "./types";

function newId(): string {
  return globalThis.crypto?.randomUUID?.() || `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export type PublisherRepo = {
  listActiveRules(): PublisherScheduleRule[];
  listRules(): PublisherScheduleRule[];
  getRule(id: string): PublisherScheduleRule | null;
  upsertRule(rule: PublisherScheduleRule): PublisherScheduleRule;
  listSlots(): PublisherSlot[];
  listSlotsForRule(ruleId: string): PublisherSlot[];
  insertSlot(slot: PublisherSlot): PublisherSlot;
  updateSlot(id: string, patch: Partial<PublisherSlot>): PublisherSlot;
  deleteSlot(id: string): void;
  listPublications(): PublisherPublication[];
  getPublication(id: string): PublisherPublication | null;
  upsertPublication(row: PublisherPublication): PublisherPublication;
  listJobs(): PublisherDestinationJob[];
  listJobsForPublication(publicationId: string): PublisherDestinationJob[];
  upsertJob(job: PublisherDestinationJob): PublisherDestinationJob;
  appendAttempt(attempt: PublisherAttempt): PublisherAttempt;
  listAssets(): PublisherLibraryAsset[];
  getAsset(id: string): PublisherLibraryAsset | null;
  upsertAssetState(id: string, patch: Partial<PublisherLibraryAsset>): void;
  nowMs(): number;
};

function approvalRequiredFor(rule: PublisherScheduleRule | null, publication: PublisherPublication): boolean {
  if (rule) return rule.approvalRequired;
  return true;
}

function syncPublicationStatus(
  repo: PublisherRepo,
  publication: PublisherPublication,
  rule: PublisherScheduleRule | null,
): PublisherPublication {
  const jobs = repo.listJobsForPublication(publication.id);
  const status = publicationStatusFromParts({
    libraryAssetId: publication.libraryAssetId,
    approved: publication.approved,
    approvalRequired: approvalRequiredFor(rule, publication),
    jobs,
    cancelled: publication.status === "cancelled",
  });
  const next = { ...publication, status };
  repo.upsertPublication(next);
  if (next.slotId) {
    const slot = repo.listSlots().find((row) => row.id === next.slotId);
    if (slot) repo.updateSlot(slot.id, { status, publicationId: next.id });
  }
  return next;
}

function ensureJobs(repo: PublisherRepo, publication: PublisherPublication): PublisherDestinationJob[] {
  const existing = repo.listJobsForPublication(publication.id);
  const byDest = new Map(existing.map((job) => [job.destination, job]));
  const jobs: PublisherDestinationJob[] = [];
  for (const destination of publication.destinations) {
    const current = byDest.get(destination);
    if (current) {
      jobs.push(current);
      continue;
    }
    const status: PublisherStatus = !publication.libraryAssetId
      ? "needs_content"
      : publication.approved
        ? "scheduled"
        : "needs_approval";
    const created: PublisherDestinationJob = {
      id: newId(),
      publicationId: publication.id,
      destination,
      status,
      attempts: 0,
      maxAttempts: DEFAULT_MAX_ATTEMPTS,
      nextRetryAt: null,
      claimedBy: null,
      claimedAt: null,
      leaseExpiresAt: null,
      remotePostId: null,
      remoteUrl: null,
      lastError: null,
      lastErrorCode: null,
    };
    jobs.push(repo.upsertJob(created));
  }
  return jobs;
}

export function createSlotPublication(
  repo: PublisherRepo,
  slot: PublisherSlot,
  rule: PublisherScheduleRule,
): PublisherPublication {
  const existing = repo.listPublications().find((row) => row.slotId === slot.id);
  if (existing) return existing;
  const row: PublisherPublication = {
    id: newId(),
    slotId: slot.id,
    libraryAssetId: null,
    caption: "",
    contentType: rule.contentType,
    assignmentSource: "none",
    approved: !rule.approvalRequired,
    approvedAt: rule.approvalRequired ? null : new Date(repo.nowMs()).toISOString(),
    status: "needs_content",
    scheduledAt: slot.scheduledAt,
    timezone: slot.timezone,
    locked: false,
    destinations: rule.destinations,
    duplicateKey: null,
  };
  const saved = repo.upsertPublication(row);
  repo.updateSlot(slot.id, { publicationId: saved.id, status: saved.status });
  ensureJobs(repo, saved);
  return saved;
}

export function assignSlotContent(repo: PublisherRepo, slot: PublisherSlot, rule: PublisherScheduleRule): PublisherPublication {
  const publication = createSlotPublication(repo, slot, rule);
  if (publication.locked || slot.assignmentLocked || slot.manuallyEdited) return publication;
  if (publication.libraryAssetId) return publication;
  const assigned = futureAssignedAssetIds(repo.listPublications(), repo.nowMs(), publication.id);
  const decision = selectLibraryAsset({
    assets: repo.listAssets(),
    contentType: rule.contentType,
    destinations: rule.destinations,
    nowMs: repo.nowMs(),
    cooldownDays: rule.reuseCooldownDays,
    assignedFutureAssetIds: assigned,
    autoAssign: rule.autoAssign,
    category: rule.libraryCategory,
    tags: rule.libraryTags,
  });
  if (!decision.ok) {
    repo.updateSlot(slot.id, { status: "needs_content", contentReason: decision.detail, publicationId: publication.id });
    const next = { ...publication, status: "needs_content" as const, assignmentSource: "none" as const };
    repo.upsertPublication(next);
    return next;
  }
  const next: PublisherPublication = {
    ...publication,
    libraryAssetId: decision.assetId,
    assignmentSource: "auto",
    caption: repo.getAsset(decision.assetId)?.title || "",
    approved: !rule.approvalRequired,
    approvedAt: rule.approvalRequired ? null : new Date(repo.nowMs()).toISOString(),
    duplicateKey: publicationDuplicateKey(decision.assetId, publication.scheduledAt, publication.destinations),
  };
  repo.upsertPublication(next);
  const jobs = ensureJobs(repo, next);
  for (const job of jobs) {
    job.status = next.approved ? "scheduled" : "needs_approval";
    repo.upsertJob(job);
  }
  return syncPublicationStatus(repo, next, rule);
}

export function generateRollingSlots(repo: PublisherRepo, horizonDays = ROLLING_HORIZON_DAYS): { created: number; existing: number } {
  const now = repo.nowMs();
  let created = 0;
  let existing = 0;
  const existingKeys = new Set(repo.listSlots().map((slot) => slotUniqueKey(slot.ruleId, slot.scheduledAt)));
  for (const rule of repo.listActiveRules()) {
    const planned = planSlotsForRule(rule, now, horizonDays);
    for (const item of planned) {
      if (existingKeys.has(item.uniqueKey)) {
        existing += 1;
        continue;
      }
      const slot: PublisherSlot = {
        id: newId(),
        ruleId: item.ruleId,
        scheduledAt: item.scheduledAt,
        timezone: item.timezone,
        status: "needs_content",
        locked: false,
        manuallyEdited: false,
        assignmentLocked: false,
        contentReason: null,
        publicationId: null,
      };
      repo.insertSlot(slot);
      existingKeys.add(item.uniqueKey);
      created += 1;
      assignSlotContent(repo, slot, rule);
    }
  }
  return { created, existing };
}

export function reconcileRuleSlots(repo: PublisherRepo, rule: PublisherScheduleRule): { removed: number; created: number } {
  const now = repo.nowMs();
  const planned = new Set(planSlotsForRule(rule, now).map((item) => item.uniqueKey));
  let removed = 0;
  for (const slot of repo.listSlotsForRule(rule.id)) {
    if (!slotIsEditableFuture(slot, now)) continue;
    const key = slotUniqueKey(slot.ruleId, slot.scheduledAt);
    if (!rule.active || rule.deletedAt || !planned.has(key)) {
      const publication = repo.listPublications().find((row) => row.slotId === slot.id);
      if (publication?.approved || publication?.locked) continue;
      if (publication) {
        repo.upsertPublication({ ...publication, status: "cancelled" });
        for (const job of repo.listJobsForPublication(publication.id)) {
          repo.upsertJob({ ...job, status: "cancelled" });
        }
      }
      repo.deleteSlot(slot.id);
      removed += 1;
    }
  }
  const { created } = generateRollingSlots(repo);
  return { removed, created };
}

export function pauseRule(repo: PublisherRepo, ruleId: string): PublisherScheduleRule {
  const rule = repo.getRule(ruleId);
  if (!rule) throw new Error("Rule not found");
  const next = { ...rule, active: false, updatedAt: new Date(repo.nowMs()).toISOString() };
  return repo.upsertRule(next);
}

export function claimJobs(repo: PublisherRepo, workerId: string, limit = 8): PublisherDestinationJob[] {
  const now = repo.nowMs();
  const publications = new Map(repo.listPublications().map((row) => [row.id, row]));
  const rules = new Map(repo.listRules().map((row) => [row.id, row]));
  const due: Array<PublisherDestinationJob & { scheduledAtMs: number }> = [];
  for (const job of repo.listJobs()) {
    const publication = publications.get(job.publicationId);
    if (!publication) continue;
    const slot = publication.slotId ? repo.listSlots().find((row) => row.id === publication.slotId) : null;
    const rule = slot ? rules.get(slot.ruleId) || null : null;
    if (!jobIsClaimable(job, publication, now, rule ? rule.approvalRequired : true)) continue;
    due.push({ ...job, scheduledAtMs: Date.parse(publication.scheduledAt) });
  }
  const selected = selectClaimableJobs(due, limit);
  const claimed: PublisherDestinationJob[] = [];
  for (const row of selected) {
    const latest = repo.listJobs().find((job) => job.id === row.id);
    if (!latest) continue;
    if (latest.claimedBy && latest.leaseExpiresAt && Date.parse(latest.leaseExpiresAt) > now) continue;
    const publication = publications.get(latest.publicationId);
    if (!publication) continue;
    const slot = publication.slotId ? repo.listSlots().find((s) => s.id === publication.slotId) : null;
    const rule = slot ? rules.get(slot.ruleId) || null : null;
    if (!jobIsClaimable(latest, publication, now, rule ? rule.approvalRequired : true)) continue;
    const next: PublisherDestinationJob = {
      ...latest,
      status: "processing",
      attempts: latest.attempts + 1,
      claimedBy: workerId,
      claimedAt: new Date(now).toISOString(),
      leaseExpiresAt: new Date(now + 5 * 60 * 1000).toISOString(),
    };
    repo.upsertJob(next);
    repo.upsertPublication({ ...publication, status: "processing" });
    claimed.push(next);
  }
  return claimed;
}

export async function processClaimedJob(repo: PublisherRepo, job: PublisherDestinationJob): Promise<PublisherAttempt> {
  const publication = repo.getPublication(job.publicationId);
  if (!publication) throw new Error("Publication missing");
  if (!publication.approved) {
    throw new Error("Unapproved publication must never reach a publishing adapter");
  }
  const asset = publication.libraryAssetId ? repo.getAsset(publication.libraryAssetId) : null;
  const adapter = new DryRunPublisherAdapter();
  const result = await adapter.publish({
    destination: job.destination,
    libraryAssetId: publication.libraryAssetId || "",
    mediaUrl: asset?.src || "",
    caption: publication.caption,
    contentType: publication.contentType,
    scheduledAt: publication.scheduledAt,
    forceFail: /\[dry-run:fail\]/i.test(publication.caption),
  });
  const attempt: PublisherAttempt = {
    id: newAttemptId(),
    jobId: job.id,
    kind: "dry_run",
    success: result.ok,
    resultCode: result.code,
    message: String(sanitizeAdapterLog(result.message)),
    remotePostId: result.remotePostId,
    remoteUrl: result.remoteUrl,
    createdAt: new Date(repo.nowMs()).toISOString(),
  };
  repo.appendAttempt(attempt);
  if (result.ok) {
    repo.upsertJob({
      ...job,
      status: "completed",
      remotePostId: result.remotePostId,
      remoteUrl: result.remoteUrl,
      lastError: null,
      lastErrorCode: null,
      leaseExpiresAt: null,
    });
    if (asset) {
      repo.upsertAssetState(asset.id, {
        lastUsedByDestination: {
          ...asset.lastUsedByDestination,
          [job.destination]: new Date(repo.nowMs()).toISOString(),
        },
      });
    }
  } else {
    const retryable = result.retryable && job.attempts < job.maxAttempts;
    repo.upsertJob({
      ...job,
      status: retryable ? "failed" : "failed",
      lastError: result.message,
      lastErrorCode: result.code,
      nextRetryAt: retryable ? new Date(repo.nowMs() + retryDelayMs(job.attempts)).toISOString() : null,
      leaseExpiresAt: retryable ? null : job.leaseExpiresAt,
    });
  }
  const slot = publication.slotId ? repo.listSlots().find((row) => row.id === publication.slotId) : null;
  const rule = slot ? repo.getRule(slot.ruleId) : null;
  syncPublicationStatus(repo, repo.getPublication(publication.id) || publication, rule);
  return attempt;
}

export async function tickPublisher(repo: PublisherRepo, workerId = "publisher-worker"): Promise<{
  slotsCreated: number;
  claimed: number;
  attempts: number;
}> {
  const generated = generateRollingSlots(repo);
  const claimed = claimJobs(repo, workerId);
  let attempts = 0;
  for (const job of claimed) {
    await processClaimedJob(repo, job);
    attempts += 1;
  }
  return { slotsCreated: generated.created, claimed: claimed.length, attempts };
}

export function replacePublicationAsset(
  repo: PublisherRepo,
  publicationId: string,
  assetId: string,
  lock = false,
): PublisherPublication {
  const publication = repo.getPublication(publicationId);
  if (!publication) throw new Error("Publication not found");
  const asset = repo.getAsset(assetId);
  if (!asset) throw new Error("Library asset not found");
  if (asset.contentType !== publication.contentType) throw new Error("Asset type does not match this slot");
  const duplicateKey = publicationDuplicateKey(assetId, publication.scheduledAt, publication.destinations);
  const clash = repo.listPublications().find(
    (row) => row.id !== publicationId && row.duplicateKey === duplicateKey && row.status !== "cancelled",
  );
  if (clash) throw new Error("A publication with this asset, time, and destinations already exists");
  const next: PublisherPublication = {
    ...publication,
    libraryAssetId: assetId,
    assignmentSource: "manual",
    caption: publication.caption || asset.title,
    duplicateKey,
    locked: publication.locked || lock,
  };
  repo.upsertPublication(next);
  if (publication.slotId) {
    repo.updateSlot(publication.slotId, {
      assignmentLocked: lock,
      manuallyEdited: true,
      contentReason: null,
    });
  }
  const jobs = ensureJobs(repo, next);
  for (const job of jobs) {
    if (job.status === "completed") continue;
    job.status = next.approved ? "scheduled" : "needs_approval";
    repo.upsertJob(job);
  }
  const slot = publication.slotId ? repo.listSlots().find((row) => row.id === publication.slotId) : null;
  return syncPublicationStatus(repo, next, slot ? repo.getRule(slot.ruleId) : null);
}

export function returnContentToPool(repo: PublisherRepo, publicationId: string): PublisherPublication {
  const publication = repo.getPublication(publicationId);
  if (!publication) throw new Error("Publication not found");
  if (publication.status === "completed" || publication.status === "processing") {
    throw new Error("Cannot return content for a completed or processing publication");
  }
  const next: PublisherPublication = {
    ...publication,
    libraryAssetId: null,
    assignmentSource: "none",
    approved: false,
    approvedAt: null,
    duplicateKey: null,
    locked: false,
    status: "needs_content",
  };
  repo.upsertPublication(next);
  for (const job of repo.listJobsForPublication(publication.id)) {
    if (job.status !== "completed") repo.upsertJob({ ...job, status: "needs_content" });
  }
  if (publication.slotId) {
    repo.updateSlot(publication.slotId, {
      status: "needs_content",
      assignmentLocked: false,
      contentReason: "Content returned to the Library pool.",
    });
  }
  return next;
}

export function approvePublication(repo: PublisherRepo, publicationId: string): PublisherPublication {
  const publication = repo.getPublication(publicationId);
  if (!publication) throw new Error("Publication not found");
  if (!publication.libraryAssetId) throw new Error("Attach Library content before approving");
  const next = {
    ...publication,
    approved: true,
    approvedAt: new Date(repo.nowMs()).toISOString(),
    status: "scheduled" as const,
  };
  repo.upsertPublication(next);
  for (const job of repo.listJobsForPublication(publication.id)) {
    if (job.status === "needs_approval" || job.status === "needs_content") {
      repo.upsertJob({ ...job, status: "scheduled" });
    }
  }
  const slot = publication.slotId ? repo.listSlots().find((row) => row.id === publication.slotId) : null;
  return syncPublicationStatus(repo, next, slot ? repo.getRule(slot.ruleId) : null);
}

export function cancelPublication(repo: PublisherRepo, publicationId: string): PublisherPublication {
  const publication = repo.getPublication(publicationId);
  if (!publication) throw new Error("Publication not found");
  const next = { ...publication, status: "cancelled" as const };
  repo.upsertPublication(next);
  for (const job of repo.listJobsForPublication(publication.id)) {
    if (job.status !== "completed") repo.upsertJob({ ...job, status: "cancelled" });
  }
  if (publication.slotId) repo.updateSlot(publication.slotId, { status: "cancelled" });
  return next;
}

export function reschedulePublication(repo: PublisherRepo, publicationId: string, scheduledAt: string): PublisherPublication {
  const publication = repo.getPublication(publicationId);
  if (!publication) throw new Error("Publication not found");
  if (publication.status === "completed" || publication.status === "processing") {
    throw new Error("Cannot reschedule a completed or processing publication");
  }
  const duplicateKey = publication.libraryAssetId
    ? publicationDuplicateKey(publication.libraryAssetId, scheduledAt, publication.destinations)
    : null;
  const clash = duplicateKey
    ? repo.listPublications().find((row) => row.id !== publicationId && row.duplicateKey === duplicateKey && row.status !== "cancelled")
    : null;
  if (clash) throw new Error("Reschedule would create a duplicate publication");
  const next = { ...publication, scheduledAt, duplicateKey, status: publication.approved ? "scheduled" as const : publication.status };
  repo.upsertPublication(next);
  if (publication.slotId) {
    repo.updateSlot(publication.slotId, { scheduledAt, manuallyEdited: true, locked: true });
  }
  return next;
}

export function createManualPublication(
  repo: PublisherRepo,
  input: {
    libraryAssetId: string;
    destinations: PublisherDestination[];
    caption: string;
    scheduledAt: string;
    timezone: string;
    approve: boolean;
  },
): PublisherPublication {
  const asset = repo.getAsset(input.libraryAssetId);
  if (!asset) throw new Error("Library asset not found");
  const duplicateKey = publicationDuplicateKey(input.libraryAssetId, input.scheduledAt, input.destinations);
  const clash = repo.listPublications().find((row) => row.duplicateKey === duplicateKey && row.status !== "cancelled");
  if (clash) throw new Error("A publication with this asset, time, and destinations already exists");
  const row: PublisherPublication = {
    id: newId(),
    slotId: null,
    libraryAssetId: input.libraryAssetId,
    caption: input.caption || asset.title,
    contentType: asset.contentType,
    assignmentSource: "manual",
    approved: input.approve,
    approvedAt: input.approve ? new Date(repo.nowMs()).toISOString() : null,
    status: input.approve ? "scheduled" : "needs_approval",
    scheduledAt: input.scheduledAt,
    timezone: input.timezone,
    locked: false,
    destinations: input.destinations,
    duplicateKey,
  };
  const saved = repo.upsertPublication(row);
  ensureJobs(repo, saved);
  for (const job of repo.listJobsForPublication(saved.id)) {
    repo.upsertJob({ ...job, status: saved.status });
  }
  return saved;
}

export function overviewCounts(repo: PublisherRepo): Record<string, number> {
  const counts: Record<string, number> = {
    needs_content: 0,
    needs_approval: 0,
    scheduled: 0,
    dry_run_completed: 0,
    failed: 0,
  };
  for (const publication of repo.listPublications()) {
    if (publication.status === "needs_content") counts.needs_content += 1;
    else if (publication.status === "needs_approval") counts.needs_approval += 1;
    else if (publication.status === "scheduled") counts.scheduled += 1;
    else if (publication.status === "completed") counts.dry_run_completed += 1;
    else if (publication.status === "failed") counts.failed += 1;
  }
  return counts;
}
