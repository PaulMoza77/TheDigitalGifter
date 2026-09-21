/**
 * Raw byte transfer for a claimed YouTube import.
 * The body is application/octet-stream and is never parsed as JSON.
 * The destination path is derived from the job and attempt; the client cannot choose it.
 */
import type { NodeApiRequest, NodeApiResponse } from "./_lib/nodeHandler";
import { getServiceClient } from "./_lib/christmas/supabaseClient";
import { bearerMatches, evaluateImportClaim, validDeviceId } from "../src/features/clip-factory/importDevice";
import { chunkDecision, partialRelpath, VPS_CHUNK_BYTES, VPS_MAX_SOURCE_BYTES } from "../src/features/clip-factory/vpsTransfer";
import { assertRoom, fileSize, resolveMediaPath, writeChunk } from "./_lib/clip-factory/vpsMedia";

function apiError(res: NodeApiResponse, status: number, error: string, message: string, extra: Record<string, unknown> = {}) {
  return res.status(status).json({ error, message, ...extra });
}

function header(req: NodeApiRequest, name: string): string {
  const value = req.headers[name];
  return String(Array.isArray(value) ? value[0] : value || "").trim();
}

async function readChunk(req: NodeApiRequest): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buf.length;
    if (size > VPS_CHUNK_BYTES) {
      req.destroy();
      const error = new Error("chunk");
      (error as Error & { statusCode: number }).statusCode = 413;
      throw error;
    }
    chunks.push(buf);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req: NodeApiRequest, res: NodeApiResponse) {
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "PUT") return apiError(res, 405, "method", "Method not allowed");
  const expected = String(process.env.CLIP_FACTORY_IMPORT_WORKER_TOKEN || "");
  const presented = header(req, "authorization").replace(/^Bearer\s+/i, "");
  if (!bearerMatches(presented, expected)) return apiError(res, 401, "unauthorized", "Unauthorized");
  if (!String(req.headers["content-type"] || "").includes("application/octet-stream")) {
    return apiError(res, 415, "invalid_request", "Import bytes must be sent as a raw stream.");
  }

  const deviceId = header(req, "x-device-id");
  const jobId = header(req, "x-job-id");
  const attemptId = header(req, "x-attempt-id");
  const offset = Number(header(req, "x-offset"));
  const totalBytes = Number(header(req, "x-total-bytes"));
  if (!validDeviceId(deviceId) || !jobId || !attemptId) return apiError(res, 400, "invalid_request", "Import claim headers are incomplete.");
  if (!Number.isInteger(totalBytes) || totalBytes <= 0 || totalBytes > VPS_MAX_SOURCE_BYTES) {
    return apiError(res, 400, "huge_file", "Imported file is outside the size limit.");
  }

  const service = getServiceClient();
  const loaded = await service.from("clip_factory_jobs").select("*").eq("id", jobId).maybeSingle();
  if (loaded.error) throw loaded.error;
  const job = loaded.data;
  if (!job) return apiError(res, 404, "not_found", "Job not found.");
  const decision = evaluateImportClaim({
    jobAttemptId: job.import_attempt_id || null,
    jobWorkerId: job.import_worker_id || null,
    jobStatus: job.status,
    leaseExpiresAt: job.import_lease_expires_at || null,
    mediaId: job.media_id || null,
    objectPath: job.import_object_path || null,
    requestAttemptId: attemptId,
    requestWorkerId: deviceId,
    now: Date.now(),
  });
  if (!decision.ok || decision.already) {
    return apiError(res, 409, decision.ok ? "claim_mismatch" : decision.error, "Import claim is no longer valid.");
  }

  let body: Buffer;
  try {
    body = await readChunk(req);
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode || 400;
    return apiError(res, status, status === 413 ? "huge_file" : "invalid_request", "Import chunk was rejected.");
  }
  let rel: string;
  try {
    rel = partialRelpath(jobId, attemptId);
  } catch {
    return apiError(res, 400, "invalid_request", "Import claim headers are incomplete.");
  }
  const current = await fileSize(resolveMediaPath(rel));
  const decided = chunkDecision({ currentBytes: current, offset, chunkBytes: body.length, totalBytes });
  if (!decided.ok) {
    return apiError(res, decided.error === "huge_file" ? 400 : 409, decided.error, "Import chunk does not continue this file.", {
      receivedBytes: decided.receivedBytes,
    });
  }
  try {
    await assertRoom(rel, totalBytes - offset);
    const receivedBytes = await writeChunk(rel, offset, body);
    return res.status(200).json({ ok: true, receivedBytes, complete: receivedBytes === totalBytes });
  } catch (error) {
    const code = (error as { code?: string; receivedBytes?: number }).code;
    if (code === "offset_mismatch") {
      return apiError(res, 409, "offset_mismatch", "Import chunk does not continue this file.", {
        receivedBytes: (error as { receivedBytes?: number }).receivedBytes ?? current,
      });
    }
    if (code === "huge_file") return apiError(res, 507, "huge_file", "The import server does not have enough free disk.");
    throw error;
  }
}
