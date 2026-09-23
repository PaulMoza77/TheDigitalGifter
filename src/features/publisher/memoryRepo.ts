import type {
  PublisherAttempt,
  PublisherDestinationJob,
  PublisherLibraryAsset,
  PublisherPublication,
  PublisherScheduleRule,
  PublisherSlot,
} from "./types";
import type { PublisherRepo } from "./engine";

export class MemoryPublisherRepo implements PublisherRepo {
  rules = new Map<string, PublisherScheduleRule>();
  slots = new Map<string, PublisherSlot>();
  publications = new Map<string, PublisherPublication>();
  jobs = new Map<string, PublisherDestinationJob>();
  attempts: PublisherAttempt[] = [];
  assets = new Map<string, PublisherLibraryAsset>();
  clock = Date.parse("2026-03-20T10:00:00.000Z");

  nowMs(): number {
    return this.clock;
  }

  listActiveRules(): PublisherScheduleRule[] {
    return [...this.rules.values()].filter((rule) => rule.active && !rule.deletedAt);
  }
  listRules(): PublisherScheduleRule[] {
    return [...this.rules.values()];
  }
  getRule(id: string): PublisherScheduleRule | null {
    return this.rules.get(id) || null;
  }
  upsertRule(rule: PublisherScheduleRule): PublisherScheduleRule {
    this.rules.set(rule.id, rule);
    return rule;
  }
  listSlots(): PublisherSlot[] {
    return [...this.slots.values()];
  }
  listSlotsForRule(ruleId: string): PublisherSlot[] {
    return this.listSlots().filter((slot) => slot.ruleId === ruleId);
  }
  insertSlot(slot: PublisherSlot): PublisherSlot {
    const key = `${slot.ruleId}:${slot.scheduledAt}`;
    for (const existing of this.slots.values()) {
      if (`${existing.ruleId}:${existing.scheduledAt}` === key) return existing;
    }
    this.slots.set(slot.id, slot);
    return slot;
  }
  updateSlot(id: string, patch: Partial<PublisherSlot>): PublisherSlot {
    const current = this.slots.get(id);
    if (!current) throw new Error("slot missing");
    const next = { ...current, ...patch };
    this.slots.set(id, next);
    return next;
  }
  deleteSlot(id: string): void {
    this.slots.delete(id);
  }
  listPublications(): PublisherPublication[] {
    return [...this.publications.values()];
  }
  getPublication(id: string): PublisherPublication | null {
    return this.publications.get(id) || null;
  }
  upsertPublication(row: PublisherPublication): PublisherPublication {
    this.publications.set(row.id, row);
    return row;
  }
  listJobs(): PublisherDestinationJob[] {
    return [...this.jobs.values()];
  }
  listJobsForPublication(publicationId: string): PublisherDestinationJob[] {
    return this.listJobs().filter((job) => job.publicationId === publicationId);
  }
  upsertJob(job: PublisherDestinationJob): PublisherDestinationJob {
    const clash = [...this.jobs.values()].find(
      (row) => row.publicationId === job.publicationId && row.destination === job.destination && row.id !== job.id,
    );
    if (clash) return clash;
    this.jobs.set(job.id, job);
    return job;
  }
  appendAttempt(attempt: PublisherAttempt): PublisherAttempt {
    this.attempts.push(attempt);
    return attempt;
  }
  listAssets(): PublisherLibraryAsset[] {
    return [...this.assets.values()];
  }
  getAsset(id: string): PublisherLibraryAsset | null {
    return this.assets.get(id) || null;
  }
  upsertAssetState(id: string, patch: Partial<PublisherLibraryAsset>): void {
    const current = this.assets.get(id);
    if (!current) return;
    this.assets.set(id, { ...current, ...patch });
  }
}

export function fixtureAsset(
  id: string,
  extras: Partial<PublisherLibraryAsset> = {},
): PublisherLibraryAsset {
  return {
    id,
    title: extras.title || id,
    src: extras.src || `/assets/${id}.mp4`,
    filename: extras.filename || `${id}.mp4`,
    kind: extras.kind || "reel",
    category: extras.category || "christmas_reels",
    tags: extras.tags || [],
    exists: extras.exists ?? true,
    ready: extras.ready ?? true,
    processing: extras.processing ?? false,
    failed: extras.failed ?? false,
    excluded: extras.excluded ?? false,
    eligible: extras.eligible ?? true,
    contentType: extras.contentType || "video",
    lastUsedByDestination: extras.lastUsedByDestination || {},
    poster: extras.poster || null,
    durationSeconds: extras.durationSeconds ?? 15,
    width: extras.width ?? 1080,
    height: extras.height ?? 1920,
  };
}

export function fixtureRule(
  id: string,
  extras: Partial<PublisherScheduleRule> = {},
): PublisherScheduleRule {
  const now = new Date().toISOString();
  return {
    id,
    name: extras.name || "Morning Reels",
    timezone: extras.timezone || "Europe/Bucharest",
    weekdays: extras.weekdays || [1, 2, 3, 4, 5, 6, 7],
    times: extras.times || ["10:00"],
    contentType: extras.contentType || "video",
    destinations: extras.destinations || ["instagram_reel_post", "tiktok"],
    libraryCategory: extras.libraryCategory ?? null,
    libraryTags: extras.libraryTags || [],
    autoAssign: extras.autoAssign ?? true,
    reuseCooldownDays: extras.reuseCooldownDays ?? 14,
    approvalRequired: extras.approvalRequired ?? true,
    active: extras.active ?? true,
    deletedAt: extras.deletedAt ?? null,
    createdAt: extras.createdAt || now,
    updatedAt: extras.updatedAt || now,
  };
}
