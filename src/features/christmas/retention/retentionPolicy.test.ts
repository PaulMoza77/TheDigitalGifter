import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  CHRISTMAS_GENERATED_BUCKET,
  CHRISTMAS_MEDIA_RETENTION,
  CHRISTMAS_SOURCE_BUCKET,
  DEFAULT_UNPAID_UPLOAD_TTL_DAYS,
  SANTA_FINAL_VIDEO_TTL_DAYS,
  SANTA_INTERMEDIATE_TTL_DAYS,
  SANTA_PERSONALIZATION_TTL_DAYS,
  UNPAID_UPLOAD_PREFIX,
  classifyRetentionObject,
  documentedRetentionMatrix,
  isPaidPaymentStatus,
  isUnpaidUploadPath,
  paidSourceKeys,
  planRetentionPurge,
  resolveUnpaidUploadTtlDays,
} from "./retentionPolicy";

function readSrc(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

const nowMs = Date.parse("2026-09-09T12:00:00.000Z");

function daysAgo(days: number): string {
  return new Date(nowMs - days * 86_400_000).toISOString();
}

describe("christmas retention ops TTL policy", () => {
  it("keeps founder legal TTL pending and documents Santa/kids holds", () => {
    expect(CHRISTMAS_MEDIA_RETENTION.policy).toBe("policy_pending_founder_legal");
    expect(DEFAULT_UNPAID_UPLOAD_TTL_DAYS).toBe(7);
    expect(SANTA_FINAL_VIDEO_TTL_DAYS).toBe(365);
    expect(SANTA_PERSONALIZATION_TTL_DAYS).toBe(90);
    expect(SANTA_INTERMEDIATE_TTL_DAYS).toBe(14);
    const matrix = documentedRetentionMatrix();
    expect(matrix.every((row) => row.legalTtl === "policy_pending_founder_legal")).toBe(true);
    expect(matrix.some((row) => /Kids Christmas/i.test(row.surface))).toBe(true);
    expect(matrix.some((row) => /Santa final video/i.test(row.surface))).toBe(true);
    expect(matrix.find((row) => /Paid portrait sources/i.test(row.surface))?.purgeJob).toMatch(
      /never delete/i,
    );
  });

  it("only treats uploads/ objects as unpaid-upload candidates", () => {
    expect(isUnpaidUploadPath("uploads/abc.jpg")).toBe(true);
    expect(isUnpaidUploadPath("/uploads/abc.jpg")).toBe(true);
    expect(isUnpaidUploadPath("uploads/")).toBe(false);
    expect(isUnpaidUploadPath("paid/abc.jpg")).toBe(false);
    expect(isUnpaidUploadPath("results/abc.jpg")).toBe(false);
    expect(isPaidPaymentStatus("paid")).toBe(true);
    expect(isPaidPaymentStatus("pending")).toBe(false);
    expect(isPaidPaymentStatus("draft")).toBe(false);
  });

  it("clamps invalid TTL overrides back to the ops default", () => {
    expect(resolveUnpaidUploadTtlDays(undefined)).toBe(7);
    expect(resolveUnpaidUploadTtlDays("14")).toBe(14);
    expect(resolveUnpaidUploadTtlDays("0")).toBe(7);
    expect(resolveUnpaidUploadTtlDays(999)).toBe(7);
    expect(resolveUnpaidUploadTtlDays("nope")).toBe(7);
  });

  it("purges expired unpaid uploads/ and retains paid sources on the same prefix", () => {
    const paidKeys = paidSourceKeys([
      {
        sourcePath: "uploads/paid-keep.jpg",
        sourceBucket: CHRISTMAS_SOURCE_BUCKET,
        paymentStatus: "paid",
      },
      {
        sourcePath: "uploads/abandoned.jpg",
        sourceBucket: CHRISTMAS_SOURCE_BUCKET,
        paymentStatus: "pending",
      },
    ]);
    expect([...paidKeys]).toEqual([`${CHRISTMAS_SOURCE_BUCKET}:uploads/paid-keep.jpg`]);

    const paid = classifyRetentionObject({
      object: {
        bucket: CHRISTMAS_SOURCE_BUCKET,
        path: "uploads/paid-keep.jpg",
        createdAt: daysAgo(40),
      },
      paidKeys,
      nowMs,
    });
    expect(paid).toMatchObject({ action: "keep", reason: "paid_source" });

    const freshUnpaid = classifyRetentionObject({
      object: {
        bucket: CHRISTMAS_SOURCE_BUCKET,
        path: "uploads/fresh.jpg",
        createdAt: daysAgo(1),
      },
      paidKeys,
      nowMs,
    });
    expect(freshUnpaid).toMatchObject({ action: "keep", reason: "within_unpaid_ttl" });

    const expiredUnpaid = classifyRetentionObject({
      object: {
        bucket: CHRISTMAS_SOURCE_BUCKET,
        path: "uploads/abandoned.jpg",
        createdAt: daysAgo(8),
      },
      paidKeys,
      nowMs,
    });
    expect(expiredUnpaid).toMatchObject({ action: "purge", reason: "unpaid_upload_expired" });
  });

  it("never classifies generated results or non-upload prefixes as purgeable", () => {
    const paidKeys = new Set<string>();
    expect(
      classifyRetentionObject({
        object: {
          bucket: CHRISTMAS_GENERATED_BUCKET,
          path: "uploads/result.png",
          createdAt: daysAgo(400),
        },
        paidKeys,
        nowMs,
      }).reason,
    ).toBe("legal_hold_generated");
    expect(
      classifyRetentionObject({
        object: {
          bucket: CHRISTMAS_SOURCE_BUCKET,
          path: "orders/paid-moved.jpg",
          createdAt: daysAgo(40),
        },
        paidKeys,
        nowMs,
      }).reason,
    ).toBe("outside_uploads_prefix");
  });

  it("plans a mixed batch without inventing runtime mock data", () => {
    const plan = planRetentionPurge({
      nowMs,
      unpaidTtlDays: 7,
      orders: [
        { sourcePath: "uploads/paid.jpg", sourceBucket: "christmas-source", paymentStatus: "paid" },
        { sourcePath: "uploads/draft.jpg", sourceBucket: "christmas-source", paymentStatus: "draft" },
      ],
      objects: [
        { bucket: "christmas-source", path: "uploads/paid.jpg", createdAt: daysAgo(30) },
        { bucket: "christmas-source", path: "uploads/draft.jpg", createdAt: daysAgo(30) },
        { bucket: "christmas-source", path: "uploads/orphan.jpg", createdAt: daysAgo(30) },
        { bucket: "christmas-source", path: "uploads/recent.jpg", createdAt: daysAgo(2) },
        { bucket: "christmas-generated", path: "results/paid-out.png", createdAt: daysAgo(30) },
      ],
    });
    expect(plan.purge.map((row) => row.path).sort()).toEqual([
      "uploads/draft.jpg",
      "uploads/orphan.jpg",
    ]);
    expect(plan.keep.map((row) => row.path).sort()).toEqual([
      "results/paid-out.png",
      "uploads/paid.jpg",
      "uploads/recent.jpg",
    ]);
  });
});

describe("christmas retention purge wiring", () => {
  it("keeps src and edge policy copies aligned on TTLs and legal hold", () => {
    const src = readSrc("src/features/christmas/retention/retentionPolicy.ts");
    const edge = readSrc("supabase/functions/_shared/christmas/retentionPolicy.ts");
    for (const token of [
      'policy: "policy_pending_founder_legal"',
      "DEFAULT_UNPAID_UPLOAD_TTL_DAYS = 7",
      'UNPAID_UPLOAD_PREFIX = "uploads/"',
      "legal_hold_generated",
      "unpaid_upload_expired",
      "paid_source",
    ]) {
      expect(src).toContain(token);
      expect(edge).toContain(token);
    }
  });

  it("schedules a service-role purge job that never mocks Supabase", () => {
    const fn = readSrc("supabase/functions/christmas-retention-purge/index.ts");
    const workflow = readSrc(".github/workflows/christmas-retention-purge.yml");
    expect(fn).toContain("getServiceClient()");
    expect(fn).toContain("from(CHRISTMAS_SOURCE_BUCKET)");
    expect(fn).toContain('from("christmas_orders")');
    expect(fn).toContain("planRetentionPurge");
    expect(fn).not.toContain("mock runtime");
    expect(fn).not.toContain("CHRISTMAS_GENERATION_MOCK");
    expect(fn).toContain("dry_run");
    expect(fn).toContain("CHRISTMAS_RETENTION_PURGE_APPLY");
    expect(workflow).toContain("cron:");
    expect(workflow).toContain("christmas-retention-purge");
    expect(workflow).toContain("workflow_dispatch");
    expect(readSrc("supabase/config.toml")).toContain("[functions.christmas-retention-purge]");
  });

  it("documents ops TTLs and founder-pending legal TTL", () => {
    const doc = readSrc("docs/TDG_CHRISTMAS_RETENTION.md");
    expect(doc).toContain("uploads/");
    expect(doc).toContain("policy_pending_founder_legal");
    expect(doc).toContain("christmas-retention-purge");
    expect(doc).toContain("Santa");
    expect(doc).toContain("Kids");
    expect(readSrc("docs/TDG_CHRISTMAS_PHOTO_GENERATOR.md")).toContain(
      "docs/TDG_CHRISTMAS_RETENTION.md",
    );
    expect(readSrc("docs/TDG_CHRISTMAS_SANTA_VIDEO.md")).toContain(
      "docs/TDG_CHRISTMAS_RETENTION.md",
    );
  });
});
