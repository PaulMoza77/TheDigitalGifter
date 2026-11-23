/**
 * Manual licensed-song production state machine (Mission 02D).
 * No Suno automation. Commercial rights must be explicitly recorded.
 */
import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { MediaJobRecord, SongProductionState } from "./types.ts";
import { LocalJobStore } from "./localJobStore.ts";
import {
  resolveUnderRoot,
  safeJobFileName,
  sha256File,
  validateAudioFile,
} from "./safePaths.ts";

const TRANSITIONS: Record<SongProductionState, SongProductionState[]> = {
  awaiting_song_production: ["in_production", "song_uploaded", "failed"],
  in_production: ["song_uploaded", "failed", "awaiting_song_production"],
  song_uploaded: ["rights_verification_pending", "in_production", "failed"],
  rights_verification_pending: [
    "ready_for_buyer_review",
    "in_production",
    "failed",
  ],
  ready_for_buyer_review: ["revision_requested", "approved", "failed"],
  revision_requested: ["in_production", "failed"],
  approved: [],
  failed: ["awaiting_song_production", "in_production"],
};

export function assertSongTransition(from: SongProductionState, to: SongProductionState) {
  if (from === to) return;
  if (!TRANSITIONS[from]?.includes(to)) {
    throw new Error(`invalid_song_transition:${from}->${to}`);
  }
}

export type SongUploadInput = {
  jobId: string;
  adminToken: string;
  expectedAdminToken: string;
  workspaceRoot: string;
  sourceAudioPath: string;
  outDir: string;
  providerName: string;
  providerRef: string;
  commercialLicenseEvidence: string;
  creationDate: string;
  downloadDate: string;
  durationSec?: number;
  lyricsBrief?: string;
};

export function requireAdmin(adminToken: string, expected: string) {
  const a = String(adminToken || "");
  const e = String(expected || "");
  if (!e || e.length < 24) throw new Error("admin_token_unconfigured");
  if (a.length !== e.length) throw new Error("unauthorized_admin");
  // timing-safe-ish compare
  const ha = createHash("sha256").update(a).digest();
  const he = createHash("sha256").update(e).digest();
  let ok = 0;
  for (let i = 0; i < ha.length; i++) ok |= ha[i]! ^ he[i]!;
  if (ok !== 0) throw new Error("unauthorized_admin");
}

export function createSongJob(
  store: LocalJobStore,
  orderId: string,
  brief: Record<string, unknown>,
): MediaJobRecord {
  // Never store private photos in the music brief.
  const safeBrief = {
    recipientFirstName: String(brief.recipientFirstName || "").slice(0, 40),
    relationship: String(brief.relationship || "").slice(0, 40),
    memories: Array.isArray(brief.memories)
      ? brief.memories.map((m) => String(m).slice(0, 120)).slice(0, 8)
      : [],
    songGenre: String(brief.songGenre || "").slice(0, 40),
    tone: String(brief.tone || "").slice(0, 40),
    language: String(brief.language || "en").slice(0, 12),
    dedicationSnippet: String(brief.dedicationSnippet || "").slice(0, 160),
    // Explicitly omit photos / emails / full addresses
  };
  return store.create({
    orderId,
    jobType: "song",
    provider: "manual",
    status: "awaiting_manual",
    productionState: "awaiting_song_production",
    metadata: { brief: safeBrief, versions: [] },
  });
}

export function attachLicensedSong(
  store: LocalJobStore,
  input: SongUploadInput,
): MediaJobRecord {
  requireAdmin(input.adminToken, input.expectedAdminToken);
  const job = store.get(input.jobId);
  if (!job || job.jobType !== "song") throw new Error("job_not_found");
  if (!job.productionState) throw new Error("missing_production_state");

  const evidence = String(input.commercialLicenseEvidence || "").trim();
  if (evidence.length < 12) throw new Error("license_evidence_required");
  if (/free|trial|unofficial|scraped/i.test(evidence) && !/not[_\s-]?free/i.test(evidence)) {
    throw new Error("license_evidence_rejected");
  }

  const abs = resolveUnderRoot(input.workspaceRoot, input.sourceAudioPath);
  const kind = validateAudioFile(abs);
  const outDir = resolveUnderRoot(input.workspaceRoot, input.outDir);
  mkdirSync(outDir, { recursive: true });
  const version =
    (Array.isArray(job.metadata.versions) ? job.metadata.versions.length : 0) + 1;
  const dest = join(outDir, safeJobFileName(job.id, `song-v${version}.${kind.kind === "wav" ? "wav" : "mp3"}`));
  copyFileSync(abs, dest);
  const checksum = sha256File(dest);

  const from = job.productionState;
  assertSongTransition(from, "song_uploaded");
  job.productionState = "song_uploaded";
  job.status = "awaiting_manual";
  job.resultAssetPath = dest;
  job.outputChecksum = checksum;
  const versions = Array.isArray(job.metadata.versions)
    ? [...job.metadata.versions]
    : [];
  versions.push({
    version,
    path: dest,
    checksum,
    providerName: String(input.providerName || "").slice(0, 80),
    providerRef: String(input.providerRef || "").slice(0, 120),
    commercialLicenseEvidence: evidence.slice(0, 500),
    creationDate: input.creationDate,
    downloadDate: input.downloadDate,
    durationSec: input.durationSec ?? null,
    uploadedAt: new Date().toISOString(),
  });
  job.metadata = {
    ...job.metadata,
    versions,
    lyricsBrief: String(input.lyricsBrief || "").slice(0, 4000),
    rightsDisclaimer:
      "AI-assisted generation does not by itself confer copyright ownership or commercial license. Operator must attach contractual evidence.",
  };
  store.save(job);
  return job;
}

export function advanceSongState(
  store: LocalJobStore,
  jobId: string,
  adminToken: string,
  expectedAdminToken: string,
  to: SongProductionState,
  note?: string,
): MediaJobRecord {
  requireAdmin(adminToken, expectedAdminToken);
  const job = store.get(jobId);
  if (!job || !job.productionState) throw new Error("job_not_found");
  assertSongTransition(job.productionState, to);
  job.productionState = to;
  if (to === "ready_for_buyer_review") job.status = "ready";
  if (to === "approved") {
    job.status = "ready";
    job.metadata = { ...job.metadata, buyerApproved: true };
  }
  if (to === "revision_requested") {
    job.status = "awaiting_manual";
    job.metadata = {
      ...job.metadata,
      revisionReason: String(note || "").slice(0, 500),
    };
  }
  if (to === "failed") job.status = "failed";
  store.save(job);
  return job;
}

export function songAssetExists(job: MediaJobRecord): boolean {
  return Boolean(job.resultAssetPath && existsSync(job.resultAssetPath));
}
