import { describe, expect, it } from "vitest";

import { formatZonedDateTime } from "@/features/social-publisher/timezone";
import { DryRunPublisherAdapter, NotConnectedPublisherAdapter, sanitizeAdapterLog } from "./adapters";
import { selectLibraryAsset } from "./assignment";
import { bulkTimes } from "./destinations";
import {
  approvePublication,
  assignSlotContent,
  cancelPublication,
  claimJobs,
  createManualPublication,
  generateRollingSlots,
  pauseRule,
  processClaimedJob,
  reconcileRuleSlots,
  replacePublicationAsset,
  reschedulePublication,
  returnContentToPool,
  tickPublisher,
} from "./engine";
import { fixtureAsset, fixtureRule, MemoryPublisherRepo } from "./memoryRepo";
import { planSlotsForRule, wallTimeUtcOrNull } from "./slotGeneration";
import { jobIsClaimable } from "./status";

function seedVideoRepo(overrides: { assets?: number; cooldown?: number } = {}) {
  const repo = new MemoryPublisherRepo();
  const count = overrides.assets ?? 3;
  for (let i = 1; i <= count; i++) {
    repo.assets.set(`asset-${i}`, fixtureAsset(`asset-${i}`, { title: `Reel ${i}` }));
  }
  repo.upsertRule(
    fixtureRule("rule-1", {
      times: ["12:00"],
      reuseCooldownDays: overrides.cooldown ?? 14,
    }),
  );
  return repo;
}

describe("rolling slot generation", () => {
  it("fills the next seven days, skips the past, and is idempotent", () => {
    const repo = seedVideoRepo();
    repo.clock = Date.parse("2026-03-20T10:00:00.000Z");
    const first = generateRollingSlots(repo);
    expect(first.created).toBe(7);
    const times = repo
      .listSlots()
      .map((slot) => slot.scheduledAt)
      .sort();
    expect(times[0]).toBe("2026-03-20T10:00:00.000Z");
    expect(times[times.length - 1]).toBe("2026-03-26T10:00:00.000Z");
    const second = generateRollingSlots(repo);
    expect(second.created).toBe(0);
    expect(repo.listSlots()).toHaveLength(7);
    repo.clock = Date.parse("2026-03-21T10:00:00.000Z");
    const rolled = generateRollingSlots(repo);
    expect(rolled.created).toBe(1);
    expect(repo.listSlots()).toHaveLength(8);
  });

  it("does not generate slots beyond the seven-day horizon", () => {
    const rule = fixtureRule("rule-1", { times: ["12:00"], weekdays: [1, 2, 3, 4, 5, 6, 7] });
    const now = Date.parse("2026-03-20T10:00:00.000Z");
    const planned = planSlotsForRule(rule, now, 7);
    const horizon = now + 7 * 24 * 60 * 60 * 1000;
    expect(planned.every((slot) => Date.parse(slot.scheduledAt) < horizon)).toBe(true);
    expect(planned.length).toBe(7);
  });
});

describe("Europe/Bucharest timezone and DST", () => {
  it("stores UTC while preserving Bucharest winter and summer offsets", () => {
    const winter = wallTimeUtcOrNull("2026-01-15", "12:00", "Europe/Bucharest");
    const summer = wallTimeUtcOrNull("2026-07-15", "12:00", "Europe/Bucharest");
    expect(new Date(winter!).toISOString()).toBe("2026-01-15T10:00:00.000Z");
    expect(new Date(summer!).toISOString()).toBe("2026-07-15T09:00:00.000Z");
    expect(formatZonedDateTime(winter!, "Europe/Bucharest")).toEqual({ date: "2026-01-15", time: "12:00" });
    expect(formatZonedDateTime(summer!, "Europe/Bucharest")).toEqual({ date: "2026-07-15", time: "12:00" });
  });

  it("skips the spring-forward gap and keeps a valid post-DST wall time", () => {
    expect(wallTimeUtcOrNull("2026-03-29", "03:30", "Europe/Bucharest")).toBeNull();
    const after = wallTimeUtcOrNull("2026-03-29", "04:30", "Europe/Bucharest");
    expect(new Date(after!).toISOString()).toBe("2026-03-29T01:30:00.000Z");
    const rule = fixtureRule("dst", { times: ["03:30", "04:30"], weekdays: [7] });
    const planned = planSlotsForRule(rule, Date.parse("2026-03-28T22:00:00.000Z"), 2);
    expect(planned.map((slot) => slot.scheduledAt)).toEqual(["2026-03-29T01:30:00.000Z"]);
  });
});

describe("rule editing and pausing", () => {
  it("updates only future unlocked slots when times change", () => {
    const repo = seedVideoRepo();
    repo.clock = Date.parse("2026-03-20T10:00:00.000Z");
    generateRollingSlots(repo);
    const locked = repo.listSlots().sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))[0];
    repo.updateSlot(locked.id, { locked: true, manuallyEdited: true });
    const rule = repo.getRule("rule-1")!;
    repo.upsertRule({ ...rule, times: ["18:00"] });
    reconcileRuleSlots(repo, repo.getRule("rule-1")!);
    const remaining = repo.listSlots();
    expect(remaining.some((slot) => slot.id === locked.id)).toBe(true);
    expect(remaining.filter((slot) => !slot.locked).every((slot) => slot.scheduledAt.endsWith("T16:00:00.000Z"))).toBe(
      true,
    );
  });

  it("pausing stops generation without deleting history", () => {
    const repo = seedVideoRepo();
    repo.clock = Date.parse("2026-03-20T10:00:00.000Z");
    generateRollingSlots(repo);
    const before = repo.listSlots().length;
    pauseRule(repo, "rule-1");
    repo.clock = Date.parse("2026-03-21T10:00:00.000Z");
    const after = generateRollingSlots(repo);
    expect(after.created).toBe(0);
    expect(repo.listSlots()).toHaveLength(before);
  });
});

describe("automatic Library assignment", () => {
  it("prefers never-used assets then least recently used, deterministically", () => {
    const assets = [
      fixtureAsset("b", { lastUsedByDestination: { tiktok: "2026-03-01T00:00:00.000Z" } }),
      fixtureAsset("a", { lastUsedByDestination: { tiktok: "2026-02-01T00:00:00.000Z" } }),
      fixtureAsset("c"),
    ];
    const first = selectLibraryAsset({
      assets,
      contentType: "video",
      destinations: ["tiktok"],
      nowMs: Date.parse("2026-03-20T00:00:00.000Z"),
      cooldownDays: 7,
      assignedFutureAssetIds: new Set(),
      autoAssign: true,
    });
    expect(first.assetId).toBe("c");
    const second = selectLibraryAsset({
      assets: assets.filter((asset) => asset.id !== "c"),
      contentType: "video",
      destinations: ["tiktok"],
      nowMs: Date.parse("2026-03-20T00:00:00.000Z"),
      cooldownDays: 7,
      assignedFutureAssetIds: new Set(),
      autoAssign: true,
    });
    expect(second.assetId).toBe("a");
  });

  it("honors reuse cooldown per destination and leaves needs_content when nothing is eligible", () => {
    const repo = seedVideoRepo({ assets: 1, cooldown: 14 });
    repo.clock = Date.parse("2026-03-20T10:00:00.000Z");
    repo.upsertAssetState("asset-1", {
      lastUsedByDestination: { instagram_reel_post: "2026-03-18T00:00:00.000Z" },
    });
    generateRollingSlots(repo);
    expect(repo.listPublications().every((row) => row.status === "needs_content")).toBe(true);
    expect(repo.listSlots()[0].contentReason).toMatch(/cooldown/i);
  });

  it("skips excluded, processing, type-mismatched, and already assigned assets", () => {
    const assets = [
      fixtureAsset("busy", {}),
      fixtureAsset("photo", { contentType: "image", kind: "photo", filename: "x.jpg" }),
      fixtureAsset("proc", { processing: true, ready: false }),
      fixtureAsset("out", { excluded: true }),
    ];
    const result = selectLibraryAsset({
      assets,
      contentType: "video",
      destinations: ["tiktok"],
      nowMs: Date.now(),
      cooldownDays: 14,
      assignedFutureAssetIds: new Set(["busy"]),
      autoAssign: true,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("already_assigned");
  });

  it("keeps locked and manual selections when regenerating", () => {
    const repo = seedVideoRepo();
    repo.clock = Date.parse("2026-03-20T10:00:00.000Z");
    generateRollingSlots(repo);
    const publication = repo.listPublications().sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))[0];
    replacePublicationAsset(repo, publication.id, "asset-3", true);
    generateRollingSlots(repo);
    expect(repo.getPublication(publication.id)?.libraryAssetId).toBe("asset-3");
    expect(repo.getPublication(publication.id)?.assignmentSource).toBe("manual");
  });
});

describe("approval, destinations, and dry-run", () => {
  it("never sends unapproved publications to an adapter", async () => {
    const repo = seedVideoRepo();
    repo.clock = Date.parse("2026-03-20T10:00:00.000Z");
    generateRollingSlots(repo);
    const publication = repo.listPublications()[0];
    expect(publication.status).toBe("needs_approval");
    expect(publication.approved).toBe(false);
    repo.clock = Date.parse(publication.scheduledAt) + 1000;
    const claimed = claimJobs(repo, "w1");
    expect(claimed).toHaveLength(0);
    await expect(
      processClaimedJob(repo, {
        ...repo.listJobsForPublication(publication.id)[0],
        status: "processing",
      }),
    ).rejects.toThrow(/Unapproved/);
  });

  it("creates one child job per destination and processes dry-run success after approval", async () => {
    const repo = seedVideoRepo();
    repo.clock = Date.parse("2026-03-20T10:00:00.000Z");
    generateRollingSlots(repo);
    const publication = repo.listPublications().sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))[0];
    expect(repo.listJobsForPublication(publication.id).map((job) => job.destination).sort()).toEqual([
      "instagram_reel_post",
      "tiktok",
    ]);
    approvePublication(repo, publication.id);
    repo.clock = Date.parse(publication.scheduledAt) + 1000;
    const tick = await tickPublisher(repo, "w1");
    expect(tick.claimed).toBeGreaterThan(0);
    const jobs = repo.listJobsForPublication(publication.id);
    expect(jobs.every((job) => job.status === "completed")).toBe(true);
    expect(jobs.every((job) => job.remotePostId?.startsWith("dry-run-"))).toBe(true);
    expect(jobs.every((job) => job.remoteUrl?.includes("dry-run"))).toBe(true);
    expect(repo.attempts.every((attempt) => attempt.kind === "dry_run" && attempt.success)).toBe(true);
  });

  it("records a dry-run failure without calling a provider", async () => {
    const adapter = new DryRunPublisherAdapter();
    const failed = await adapter.publish({
      destination: "tiktok",
      libraryAssetId: "asset-1",
      mediaUrl: "/x.mp4",
      caption: "[dry-run:fail] test",
      contentType: "video",
      scheduledAt: new Date().toISOString(),
    });
    expect(failed.ok).toBe(false);
    expect(failed.dryRun).toBe(true);
    expect(failed.code).toBe("dry_run_forced_failure");
  });

  it("placeholder adapters stay disconnected and never publish", async () => {
    const adapter = new NotConnectedPublisherAdapter("meta", "instagram_reel_post");
    expect(adapter.connectionStatus).toBe("not_connected");
    const result = await adapter.publish({
      destination: "instagram_reel_post",
      libraryAssetId: "a",
      mediaUrl: "/a.mp4",
      caption: "",
      contentType: "video",
      scheduledAt: new Date().toISOString(),
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("not_connected");
  });
});

describe("duplicates, claiming, and safety", () => {
  it("prevents duplicate manual publications", () => {
    const repo = seedVideoRepo();
    const scheduledAt = "2026-03-21T10:00:00.000Z";
    createManualPublication(repo, {
      libraryAssetId: "asset-1",
      destinations: ["tiktok"],
      caption: "one",
      scheduledAt,
      timezone: "Europe/Bucharest",
      approve: false,
    });
    expect(() =>
      createManualPublication(repo, {
        libraryAssetId: "asset-1",
        destinations: ["tiktok"],
        caption: "two",
        scheduledAt,
        timezone: "Europe/Bucharest",
        approve: false,
      }),
    ).toThrow(/already exists/);
  });

  it("does not let two workers claim the same job", () => {
    const repo = seedVideoRepo();
    repo.clock = Date.parse("2026-03-20T10:00:00.000Z");
    generateRollingSlots(repo);
    const publication = repo.listPublications()[0];
    approvePublication(repo, publication.id);
    repo.clock = Date.parse(publication.scheduledAt) + 1000;
    const first = claimJobs(repo, "worker-a");
    const second = claimJobs(repo, "worker-b");
    const ids = new Set(first.map((job) => job.id));
    expect(second.every((job) => !ids.has(job.id))).toBe(true);
    expect(first.length).toBeGreaterThan(0);
  });

  it("jobIsClaimable rejects unapproved and future work", () => {
    const job = {
      status: "scheduled" as const,
      nextRetryAt: null,
      leaseExpiresAt: null,
      attempts: 0,
      maxAttempts: 3,
      remotePostId: null,
    };
    expect(
      jobIsClaimable(
        job,
        {
          approved: false,
          status: "needs_approval",
          scheduledAt: "2020-01-01T00:00:00.000Z",
          libraryAssetId: "a",
        },
        Date.now(),
        true,
      ),
    ).toBe(false);
  });

  it("redacts secrets from attempt logs", () => {
    expect(sanitizeAdapterLog({ access_token: "abc", url: "https://x?token=1" })).toEqual({
      access_token: "[redacted]",
      url: "[redacted-url]",
    });
  });

  it("supports replace, lock, return-to-pool, and bulk times", () => {
    const repo = seedVideoRepo();
    repo.clock = Date.parse("2026-03-20T10:00:00.000Z");
    generateRollingSlots(repo);
    const publication = repo.listPublications()[0];
    replacePublicationAsset(repo, publication.id, "asset-2", true);
    expect(
      repo.getPublication(publication.id)?.locked ||
        repo.listSlots().find((slot) => slot.id === publication.slotId)?.assignmentLocked,
    ).toBeTruthy();
    returnContentToPool(repo, publication.id);
    expect(repo.getPublication(publication.id)?.libraryAssetId).toBeNull();
    expect(repo.getPublication(publication.id)?.status).toBe("needs_content");
    expect(bulkTimes(60, "09:00", "11:00")).toEqual(["09:00", "10:00", "11:00"]);
    cancelPublication(repo, publication.id);
    expect(repo.getPublication(publication.id)?.status).toBe("cancelled");
  });

  it("reschedule writes a locked slot time", () => {
    const repo = seedVideoRepo();
    repo.clock = Date.parse("2026-03-20T10:00:00.000Z");
    generateRollingSlots(repo);
    const publication = repo.listPublications()[0];
    reschedulePublication(repo, publication.id, "2026-03-22T15:00:00.000Z");
    expect(repo.getPublication(publication.id)?.scheduledAt).toBe("2026-03-22T15:00:00.000Z");
    expect(repo.listSlots().find((slot) => slot.id === publication.slotId)?.manuallyEdited).toBe(true);
  });
});

describe("assignment after slot create", () => {
  it("assigns automatically when a slot is created", () => {
    const repo = seedVideoRepo();
    repo.clock = Date.parse("2026-03-20T10:00:00.000Z");
    const rule = repo.getRule("rule-1")!;
    generateRollingSlots(repo);
    const slot = repo.listSlots()[0];
    const publication = assignSlotContent(repo, slot, rule);
    expect(publication.libraryAssetId).toMatch(/^asset-/);
    expect(publication.status).toBe("needs_approval");
  });
});
