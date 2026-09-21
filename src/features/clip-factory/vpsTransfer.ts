/**
 * Rules for the Mac → VPS clip source transfer.
 * The server chooses every path. A client-supplied path is never accepted.
 * Chunks stay small so they are not parsed as JSON and stay under typical proxy buffers.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const VPS_CHUNK_BYTES = 4 * 1024 * 1024;
export const VPS_MAX_SOURCE_BYTES = 2 * 1024 * 1024 * 1024;
/** Clips at or under this size can use Supabase. The project cap is 50 MB. */
export const SUPABASE_OBJECT_LIMIT_BYTES = 48 * 1024 * 1024;
/** Keep this much free space beyond the bytes still to arrive, for renders. */
export const VPS_FREE_HEADROOM_BYTES = 2 * 1024 * 1024 * 1024;
/** Validated Mac caches and abandoned partials are removed after this age. */
export const VPS_PARTIAL_RETENTION_MS = 24 * 60 * 60 * 1000;
export const MAC_CACHE_RETENTION_MS = 72 * 60 * 60 * 1000;

export function sourceRelpath(sha256: string): string {
  if (!/^[a-f0-9]{64}$/.test(sha256)) throw new Error("invalid source hash");
  return `sources/${sha256}/source.mp4`;
}

export function partialRelpath(jobId: string, attemptId: string): string {
  if (!UUID.test(jobId) || !UUID.test(attemptId)) throw new Error("invalid import id");
  return `incoming/${jobId}/${attemptId}.partial`;
}

export function renderRelpath(jobId: string, renderId: string, ext: "mp4" | "jpg"): string {
  if (!UUID.test(jobId) || !UUID.test(renderId)) throw new Error("invalid render id");
  return `renders/${jobId}/${renderId}.${ext}`;
}

/** Reject absolute paths, traversal, and anything except the relative forms above. */
export function isSafeRelpath(rel: string): boolean {
  if (!rel || rel.startsWith("/") || rel.includes("\\") || rel.includes("\0")) return false;
  if (rel.split("/").some((part) => part === "" || part === "." || part === "..")) return false;
  return /^(?:sources\/[a-f0-9]{64}\/source\.mp4|incoming\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.partial|renders\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(?:mp4|jpg))$/i.test(rel);
}

export function chunkDecision(input: {
  currentBytes: number;
  offset: number;
  chunkBytes: number;
  totalBytes: number;
}): { ok: true; nextBytes: number } | { ok: false; error: "offset_mismatch" | "huge_file" | "invalid_request"; receivedBytes: number } {
  const { currentBytes, offset, chunkBytes, totalBytes } = input;
  if (!Number.isInteger(offset) || offset < 0 || !Number.isInteger(chunkBytes) || chunkBytes <= 0 || chunkBytes > VPS_CHUNK_BYTES) {
    return { ok: false, error: "invalid_request", receivedBytes: currentBytes };
  }
  if (!Number.isInteger(totalBytes) || totalBytes <= 0 || totalBytes > VPS_MAX_SOURCE_BYTES) {
    return { ok: false, error: "huge_file", receivedBytes: currentBytes };
  }
  if (offset > currentBytes) {
    return { ok: false, error: "offset_mismatch", receivedBytes: currentBytes };
  }
  if (offset + chunkBytes > totalBytes) {
    return { ok: false, error: "invalid_request", receivedBytes: currentBytes };
  }
  return { ok: true, nextBytes: offset + chunkBytes };
}
