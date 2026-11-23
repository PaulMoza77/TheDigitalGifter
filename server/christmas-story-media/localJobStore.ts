/**
 * Local durable job store for Mission 02D testing.
 * File-backed queue with atomic claim/lease — mirrors future VPS worker semantics
 * without requiring remote Supabase credentials.
 */
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { MediaJobRecord, MediaJobStatus, SongProductionState } from "./types.ts";

function nowIso() {
  return new Date().toISOString();
}

function atomicWrite(path: string, data: unknown) {
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8");
  renameSync(tmp, path);
}

export class LocalJobStore {
  readonly root: string;
  private readonly jobsDir: string;

  constructor(root: string) {
    this.root = root;
    this.jobsDir = join(root, "jobs");
    mkdirSync(this.jobsDir, { recursive: true });
  }

  private pathFor(id: string) {
    return join(this.jobsDir, `${id}.json`);
  }

  list(): MediaJobRecord[] {
    return readdirSync(this.jobsDir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => this.get(f.replace(/\.json$/, ""))!)
      .filter(Boolean) as MediaJobRecord[];
  }

  get(id: string): MediaJobRecord | null {
    const p = this.pathFor(id);
    if (!existsSync(p)) return null;
    return JSON.parse(readFileSync(p, "utf8")) as MediaJobRecord;
  }

  save(job: MediaJobRecord) {
    job.updatedAt = nowIso();
    atomicWrite(this.pathFor(job.id), job);
  }

  create(input: {
    orderId: string;
    jobType: MediaJobRecord["jobType"];
    provider: MediaJobRecord["provider"];
    status?: MediaJobStatus;
    productionState?: SongProductionState | null;
    metadata?: Record<string, unknown>;
    inputChecksum?: string | null;
  }): MediaJobRecord {
    const job: MediaJobRecord = {
      id: randomUUID(),
      orderId: input.orderId,
      jobType: input.jobType,
      provider: input.provider,
      status: input.status || "queued",
      attempts: 0,
      maxAttempts: 5,
      workerId: null,
      leasedUntil: null,
      heartbeatAt: null,
      startedAt: null,
      finishedAt: null,
      nextRetryAt: null,
      inputChecksum: input.inputChecksum || null,
      outputChecksum: null,
      errorCode: null,
      errorClass: null,
      productionState: input.productionState ?? null,
      metadata: input.metadata || {},
      resultAssetPath: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    this.save(job);
    return job;
  }

  /**
   * Atomic claim: only one worker wins for queued/retryable failed jobs.
   * Defaults to film (matches SQL christmas_story_claim_job). Pass jobType to scope.
   */
  claim(
    workerId: string,
    leaseSeconds = 120,
    jobType: MediaJobRecord["jobType"] = "film",
  ): MediaJobRecord | null {
    const now = Date.now();
    const candidates = this.list()
      .filter((j) => {
        if (j.jobType !== jobType) return false;
        if (j.status === "cancelled" || j.status === "ready") return false;
        if (j.status === "queued") return true;
        if (j.status === "failed" && j.attempts < j.maxAttempts) {
          if (!j.nextRetryAt) return true;
          return new Date(j.nextRetryAt).getTime() <= now;
        }
        if (j.status === "generating" && j.leasedUntil) {
          return new Date(j.leasedUntil).getTime() < now; // crash recovery
        }
        return false;
      })
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    for (const job of candidates) {
      const fresh = this.get(job.id);
      if (!fresh) continue;
      if (fresh.jobType !== jobType) continue;
      if (fresh.status === "generating" && fresh.leasedUntil) {
        if (new Date(fresh.leasedUntil).getTime() >= Date.now()) continue;
      }
      if (fresh.status === "ready" || fresh.status === "cancelled") continue;
      if (fresh.status !== "queued" && fresh.status !== "failed" && fresh.status !== "generating") {
        continue;
      }
      fresh.status = "generating";
      fresh.workerId = workerId;
      fresh.attempts += 1;
      fresh.startedAt = fresh.startedAt || nowIso();
      fresh.heartbeatAt = nowIso();
      fresh.leasedUntil = new Date(Date.now() + leaseSeconds * 1000).toISOString();
      fresh.errorCode = null;
      this.save(fresh);
      return fresh;
    }
    return null;
  }

  heartbeat(jobId: string, workerId: string, leaseSeconds = 120): boolean {
    const job = this.get(jobId);
    if (!job || job.workerId !== workerId) return false;
    if (job.status !== "generating") return false;
    job.heartbeatAt = nowIso();
    job.leasedUntil = new Date(Date.now() + leaseSeconds * 1000).toISOString();
    this.save(job);
    return true;
  }

  complete(jobId: string, workerId: string, result: {
    outputChecksum: string;
    resultAssetPath: string;
    metadata?: Record<string, unknown>;
  }): MediaJobRecord {
    const job = this.get(jobId);
    if (!job || job.workerId !== workerId) throw new Error("claim_mismatch");
    job.status = "ready";
    job.outputChecksum = result.outputChecksum;
    job.resultAssetPath = result.resultAssetPath;
    job.finishedAt = nowIso();
    job.leasedUntil = null;
    job.metadata = { ...job.metadata, ...(result.metadata || {}) };
    this.save(job);
    return job;
  }

  fail(jobId: string, workerId: string, errorCode: string, errorClass: string): MediaJobRecord {
    const job = this.get(jobId);
    if (!job || job.workerId !== workerId) throw new Error("claim_mismatch");
    const retryable = !["photo_magic_invalid", "photo_count_invalid", "cancelled"].includes(errorCode);
    job.errorCode = errorCode;
    job.errorClass = errorClass;
    job.workerId = null;
    job.leasedUntil = null;
    if (retryable && job.attempts < job.maxAttempts) {
      job.status = "failed";
      const backoffSec = Math.min(900, 5 * 2 ** Math.max(0, job.attempts - 1));
      job.nextRetryAt = new Date(Date.now() + backoffSec * 1000).toISOString();
    } else {
      job.status = "failed";
      job.finishedAt = nowIso();
      job.nextRetryAt = null;
    }
    this.save(job);
    return job;
  }

  cancel(jobId: string): MediaJobRecord {
    const job = this.get(jobId);
    if (!job) throw new Error("job_not_found");
    job.status = "cancelled";
    job.leasedUntil = null;
    job.workerId = null;
    job.finishedAt = nowIso();
    this.save(job);
    return job;
  }
}
