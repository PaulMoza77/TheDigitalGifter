import { getServiceClient } from "./_lib/christmas/supabaseClient";
import type { NodeApiRequest, NodeApiResponse } from "./_lib/nodeHandler";
import { kickClipFactoryWorker } from "./_lib/clip-factory/worker";
import {
  IMPORT_MAX_BYTES,
  IMPORT_MAX_DURATION_SECONDS,
  bearerMatches,
  evaluateImportClaim,
  importFailureDisposition,
  importObjectPath,
  isFixedImportPath,
  publicImportError,
  validDeviceId,
  youtubeWatchUrl,
} from "../src/features/clip-factory/importDevice";

const BUCKET = "clip-factory";

function apiError(res: NodeApiResponse, status: number, error: string, message: string) {
  return res.status(status).json({ error, message });
}

function presentedToken(header: string | undefined): string {
  return String(header || "").replace(/^Bearer\s+/i, "").trim();
}

function authorized(header: string | undefined): boolean {
  const expected = String(process.env.CLIP_FACTORY_IMPORT_WORKER_TOKEN || "");
  return bearerMatches(presentedToken(header), expected);
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

async function loadJob(id: string) {
  const service = getServiceClient();
  const { data, error } = await service.from("clip_factory_jobs").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

function claimView(job: Record<string, unknown>, attemptId: string, workerId: string) {
  return evaluateImportClaim({
    jobAttemptId: asString(job.import_attempt_id) || null,
    jobWorkerId: asString(job.import_worker_id) || null,
    jobStatus: asString(job.status),
    leaseExpiresAt: asString(job.import_lease_expires_at) || null,
    mediaId: asString(job.media_id) || null,
    objectPath: asString(job.import_object_path) || null,
    requestAttemptId: attemptId,
    requestWorkerId: workerId,
    now: Date.now(),
  });
}

async function objectByteSize(objectPath: string): Promise<number | null> {
  const service = getServiceClient();
  const parts = objectPath.split("/");
  const name = parts.pop() || "";
  const folder = parts.join("/");
  const listed = await service.storage.from(BUCKET).list(folder, { limit: 20, search: name });
  if (listed.error || !listed.data) return null;
  const row = listed.data.find((item) => item.name === name);
  const size = Number((row?.metadata as { size?: number } | null)?.size || 0);
  return size > 0 ? size : null;
}

export default async function handler(req: NodeApiRequest, res: NodeApiResponse) {
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "POST") return apiError(res, 405, "method", "Method not allowed");
  if (!authorized(req.headers.authorization)) {
    return apiError(res, 401, "unauthorized", "Unauthorized");
  }

  const body = (typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {}) as Record<string, unknown>;
  const action = asString(body.action);
  const deviceId = asString(body.device_id);
  if (!validDeviceId(deviceId)) return apiError(res, 400, "invalid_request", "Import device id is invalid.");
  const service = getServiceClient();

  try {
    if (action === "presence") {
      const now = new Date().toISOString();
      const saved = await service.from("clip_factory_import_devices").upsert({ device_id: deviceId, last_seen_at: now }, { onConflict: "device_id" });
      if (saved.error) throw saved.error;
      return res.status(200).json({ ok: true });
    }

    if (action === "claim") {
      const claimed = await service.rpc("claim_clip_factory_import", {
        p_worker_id: deviceId,
        p_now: new Date().toISOString(),
      });
      if (claimed.error) throw claimed.error;
      const rows = Array.isArray(claimed.data) ? claimed.data : claimed.data ? [claimed.data] : [];
      const job = rows[0] as Record<string, unknown> | undefined;
      if (!job) return res.status(200).json({ ok: true, job: null });
      const payload = (job.source_payload || {}) as { url?: string };
      const watch = youtubeWatchUrl(String(payload.url || ""));
      if (!watch) return apiError(res, 409, "invalid_url", "Claimed job is not a YouTube video.");
      return res.status(200).json({
        ok: true,
        job: {
          id: job.id,
          attempt_id: job.import_attempt_id,
          url: watch,
          label: job.source_label || "YouTube video",
          attempt_count: job.import_attempt_count,
        },
      });
    }

    const jobId = asString(body.job_id);
    const attemptId = asString(body.attempt_id);
    if (!jobId || !attemptId) return apiError(res, 400, "invalid_request", "Job and attempt are required.");
    const job = await loadJob(jobId);
    if (!job) return apiError(res, 404, "not_found", "Job not found.");
    const decision = claimView(job, attemptId, deviceId);

    if (action === "heartbeat") {
      if (!decision.ok) return apiError(res, 409, decision.error, "Import claim is no longer valid.");
      if (decision.already) return res.status(200).json({ ok: true, already: true });
      const beat = await service.rpc("heartbeat_clip_factory_import", {
        p_job_id: jobId,
        p_attempt_id: attemptId,
        p_worker_id: deviceId,
        p_now: new Date().toISOString(),
      });
      if (beat.error) throw beat.error;
      if (!beat.data) return apiError(res, 409, "lease_expired", "Import claim is no longer valid.");
      return res.status(200).json({ ok: true });
    }

    if (action === "upload_url") {
      if (!decision.ok || decision.already) return apiError(res, 409, decision.ok ? "claim_mismatch" : decision.error, "Import claim is no longer valid.");
      const objectPath = importObjectPath(jobId, attemptId);
      const marked = await service
        .from("clip_factory_jobs")
        .update({ import_object_path: objectPath, updated_at: new Date().toISOString() })
        .eq("id", jobId)
        .eq("import_attempt_id", attemptId)
        .eq("status", "importing")
        .is("media_id", null)
        .select("id");
      if (marked.error) throw marked.error;
      if (!marked.data?.length) return apiError(res, 409, "claim_mismatch", "Import claim is no longer valid.");
      const signed = await service.storage.from(BUCKET).createSignedUploadUrl(objectPath, { upsert: true });
      if (signed.error || !signed.data?.signedUrl) throw signed.error || new Error("upload_url_failed");
      return res.status(200).json({ ok: true, uploadUrl: signed.data.signedUrl, contentType: "video/mp4" });
    }

    if (action === "complete") {
      if (!decision.ok) return apiError(res, 409, decision.error, "Import claim is no longer valid.");
      if (decision.already && asString(job.status) !== "importing") {
        return res.status(200).json({ ok: true, already: true, job_id: jobId });
      }
      const objectPath = importObjectPath(jobId, attemptId);
      if (!isFixedImportPath(jobId, attemptId, objectPath) || asString(job.import_object_path) !== objectPath) {
        return apiError(res, 409, "claim_mismatch", "Upload destination does not match this claim.");
      }
      const bytes = Number(body.bytes);
      const sha256 = asString(body.sha256).toLowerCase();
      const duration = Number(body.duration_seconds);
      const width = Number(body.width);
      const height = Number(body.height);
      if (!Number.isFinite(bytes) || bytes <= 0 || bytes > IMPORT_MAX_BYTES) {
        return apiError(res, 400, "huge_file", "Imported file is outside the size limit.");
      }
      if (!/^[a-f0-9]{64}$/.test(sha256)) return apiError(res, 400, "corrupt_file", "Imported file hash is invalid.");
      if (!Number.isFinite(duration) || duration < 3 || duration > IMPORT_MAX_DURATION_SECONDS) {
        return apiError(res, 400, "duration_exceeded", "Imported file duration is outside the limit.");
      }
      if (!Number.isFinite(width) || !Number.isFinite(height) || width < 240 || height < 240) {
        return apiError(res, 400, "corrupt_file", "Imported file has no usable video.");
      }
      const storedBytes = await objectByteSize(objectPath);
      if (storedBytes == null || storedBytes !== bytes) {
        return apiError(res, 409, "corrupt_file", "Uploaded file size does not match the import.");
      }
      const probe = {
        duration,
        width,
        height,
        fps: Number(body.fps) || null,
        videoCodec: asString(body.video_codec) || null,
        audioCodec: asString(body.audio_codec) || null,
        hasAudio: body.has_audio === true,
        fileSize: bytes,
      };
      const existing = await service.from("clip_factory_media").select("id,invalidated_at").eq("media_hash", sha256).maybeSingle();
      if (existing.error) throw existing.error;
      let mediaId = existing.data?.id || null;
      if (existing.data?.invalidated_at) {
        const revived = await service
          .from("clip_factory_media")
          .update({
            invalidated_at: null,
            invalid_reason: null,
            storage_path: objectPath,
            file_size_bytes: bytes,
            duration_seconds: duration,
            width,
            height,
            has_audio: probe.hasAudio,
            probe,
          })
          .eq("id", existing.data.id)
          .select("id")
          .single();
        if (revived.error) throw revived.error;
        mediaId = revived.data.id;
      }
      if (!mediaId) {
        const payload = (job.source_payload || {}) as { url?: string };
        const inserted = await service
          .from("clip_factory_media")
          .insert({
            media_hash: sha256,
            source_kind: "youtube",
            source_label: job.source_label,
            source_url: payload.url || null,
            storage_bucket: BUCKET,
            storage_path: objectPath,
            content_type: "video/mp4",
            file_size_bytes: bytes,
            duration_seconds: duration,
            width,
            height,
            fps: probe.fps,
            codec_video: probe.videoCodec,
            codec_audio: probe.audioCodec,
            has_audio: probe.hasAudio,
            orientation: height >= width ? "portrait" : "landscape",
            probe,
          })
          .select("id")
          .single();
        if (inserted.error) throw inserted.error;
        mediaId = inserted.data.id;
      }
      const payload = { ...((job.source_payload || {}) as Record<string, unknown>), importSha256: sha256, ingestProvider: "mac_ytdlp" };
      const finished = await service
        .from("clip_factory_jobs")
        .update({
          media_id: mediaId,
          media_hash: sha256,
          status: "queued",
          stage: "queued",
          progress: 18,
          progress_label: "Finding moments",
          source_payload: payload,
          error_code: null,
          error_message: null,
          failed_stage: null,
          lease_expires_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", jobId)
        .eq("import_attempt_id", attemptId)
        .eq("status", "importing")
        .select("id");
      if (finished.error) throw finished.error;
      if (!finished.data?.length) return apiError(res, 409, "claim_mismatch", "Import claim is no longer valid.");
      kickClipFactoryWorker();
      return res.status(200).json({ ok: true, job_id: jobId });
    }

    if (action === "fail") {
      if (!decision.ok || decision.already) return apiError(res, 409, "claim_mismatch", "Import claim is no longer valid.");
      const code = asString(body.code) || "import_unavailable";
      const attemptCount = Number(job.import_attempt_count) || 1;
      const disposition = importFailureDisposition(code, attemptCount);
      const message = publicImportError(code);
      const patch =
        disposition === "retry"
          ? {
              status: "waiting_for_import",
              stage: "waiting_for_import",
              progress: 4,
              progress_label: "Waiting for import device",
              error_code: null,
              error_message: null,
              import_attempt_id: null,
              import_worker_id: null,
              import_lease_expires_at: null,
              import_object_path: null,
            }
          : {
              status: "failed",
              stage: "failed",
              failed_stage: "importing",
              progress_label: "Failed",
              error_code: code,
              error_message: message,
              import_lease_expires_at: null,
            };
      const updated = await service
        .from("clip_factory_jobs")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", jobId)
        .eq("import_attempt_id", attemptId)
        .eq("status", "importing")
        .is("media_id", null)
        .select("id");
      if (updated.error) throw updated.error;
      if (!updated.data?.length) return apiError(res, 409, "claim_mismatch", "Import claim is no longer valid.");
      return res.status(200).json({ ok: true, disposition });
    }

    return apiError(res, 400, "invalid_request", "Unknown import action.");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import request failed.";
    return apiError(res, 500, "import_failed", message.slice(0, 240));
  }
}
