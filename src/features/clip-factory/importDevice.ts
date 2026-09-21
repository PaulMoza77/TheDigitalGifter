import { extractYoutubeId } from "./ingest/adapters/youtube";

export const IMPORT_MAX_ATTEMPTS = 5;
export const IMPORT_LEASE_MS = 4 * 60 * 1000;
export const IMPORT_DEVICE_ONLINE_MS = 45_000;
export const IMPORT_MAX_BYTES = 2 * 1024 * 1024 * 1024;
export const IMPORT_MAX_DURATION_SECONDS = 7200;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const YOUTUBE_PROGRESS_STAGES = [
  { id: "waiting", label: "Waiting for import device" },
  { id: "importing", label: "Importing video" },
  { id: "moments", label: "Finding moments" },
  { id: "clips", label: "Creating clips" },
  { id: "complete", label: "Complete" },
] as const;

const TERMINAL_IMPORT_CODES = new Set([
  "invalid_url",
  "video_private",
  "video_unavailable",
  "duration_exceeded",
  "huge_file",
  "rights_required",
  "ssrf_blocked",
  "corrupt_file",
]);

export function youtubeWatchUrl(raw: string): string | null {
  const id = extractYoutubeId(raw);
  if (!id) return null;
  return `https://www.youtube.com/watch?v=${id}`;
}

export function importObjectPath(jobId: string, attemptId: string): string {
  if (!UUID.test(jobId) || !UUID.test(attemptId)) {
    throw new Error("invalid import id");
  }
  return `imports/${jobId}/${attemptId}/source.mp4`;
}

export function isFixedImportPath(jobId: string, attemptId: string, objectPath: string): boolean {
  if (!UUID.test(jobId) || !UUID.test(attemptId)) return false;
  return objectPath === importObjectPath(jobId, attemptId);
}

export function validDeviceId(value: string): boolean {
  return /^[A-Za-z0-9._-]{1,64}$/.test(value);
}

export function bearerMatches(provided: string, expected: string): boolean {
  const left = String(provided || "");
  const right = String(expected || "").trim();
  if (right.length < 24 || left.length !== right.length) return false;
  let mismatch = 0;
  for (let i = 0; i < left.length; i += 1) {
    mismatch |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }
  return mismatch === 0;
}

export function importFailureDisposition(code: string, attemptCount: number): "retry" | "fail" {
  if (TERMINAL_IMPORT_CODES.has(code)) return "fail";
  if (attemptCount >= IMPORT_MAX_ATTEMPTS) return "fail";
  return "retry";
}

export function publicImportError(code: string): string {
  if (code === "bot_check") {
    return "YouTube asked the import device to confirm it is not a bot. No clips were created.";
  }
  if (code === "video_private") return "This video is private, so no clips were created.";
  if (code === "video_unavailable") return "This video is unavailable, so no clips were created.";
  if (code === "duration_exceeded") return "This video is longer than the import limit, so no clips were created.";
  if (code === "huge_file") return "This video is larger than the import limit, so no clips were created.";
  if (code === "corrupt_file") return "The imported file could not be read as video. No clips were created.";
  if (code === "import_attempts_exhausted") {
    return "The import device could not finish this video after several attempts. No clips were created.";
  }
  return "We couldn't import this source video. No clips were created.";
}

export function youtubeProgressIndex(status: string): number {
  if (status === "waiting_for_import") return 0;
  if (["queued", "importing", "downloading", "ingesting", "uploading", "source_detected"].includes(status)) return 1;
  if (
    ["extracting_audio", "transcribing", "analyzing", "selecting_moments", "analyzing_audio", "understanding_scenes", "finding_hooks", "scoring", "ready"].includes(
      status,
    )
  ) {
    return 2;
  }
  if (["rendering", "captioning", "saving", "finalizing", "partial"].includes(status)) return 3;
  if (status === "completed") return 4;
  return 1;
}

export function youtubeProgressLabel(status: string): string {
  return YOUTUBE_PROGRESS_STAGES[youtubeProgressIndex(status)].label;
}

export function importDeviceOnline(lastSeenAt: string | null | undefined, now: number): boolean {
  if (!lastSeenAt) return false;
  const seen = Date.parse(lastSeenAt);
  return Number.isFinite(seen) && now - seen >= 0 && now - seen <= IMPORT_DEVICE_ONLINE_MS;
}

export type ImportClaimCheck = {
  jobAttemptId: string | null;
  jobWorkerId: string | null;
  jobStatus: string;
  leaseExpiresAt: string | null;
  mediaId: string | null;
  objectPath: string | null;
  requestAttemptId: string;
  requestWorkerId: string;
  now: number;
};

export function evaluateImportClaim(input: ImportClaimCheck): { ok: true; already: boolean } | { ok: false; error: "claim_mismatch" | "lease_expired" } {
  if (input.mediaId && input.jobAttemptId && input.jobAttemptId === input.requestAttemptId) {
    return { ok: true, already: true };
  }
  if (!input.jobAttemptId || input.jobAttemptId !== input.requestAttemptId || input.jobWorkerId !== input.requestWorkerId) {
    return { ok: false, error: "claim_mismatch" };
  }
  if (input.jobStatus !== "importing") {
    return { ok: false, error: "claim_mismatch" };
  }
  const expires = input.leaseExpiresAt ? Date.parse(input.leaseExpiresAt) : 0;
  if (!Number.isFinite(expires) || expires <= input.now) {
    return { ok: false, error: "lease_expired" };
  }
  return { ok: true, already: false };
}
