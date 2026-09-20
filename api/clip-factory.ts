import type { VercelRequest, VercelResponse } from "@vercel/node";
import { randomUUID } from "node:crypto";
import { getServiceClient, isServiceRoleRequest } from "./_lib/christmas/supabaseClient";
import { requireClipFactoryAdmin } from "./_lib/clip-factory/admin";
import { ALLOWED_UPLOAD_TYPES, MAX_UPLOAD_BYTES, sanitizeFilename } from "./_lib/clip-factory/ingest";
import { signedPlaybackPath, verifyMediaSignature } from "./_lib/clip-factory/mediaSign";
import { kickClipFactoryWorker, processClipFactoryJob, renderClipFactoryCandidate, tickClipFactory } from "./_lib/clip-factory/worker";
import { classifyVideoUrl } from "../src/features/clip-factory/ingest/classify";
import { detectUrlAdapter } from "../src/features/clip-factory/ingest/registry";
import { IngestFailure } from "../src/features/clip-factory/ingest/types";
import { prepareClipFactoryJob } from "../src/features/clip-factory/createJob";
import { LIBRARY_VIDEOS } from "../src/features/admin-library/catalog";

const BUCKET = "clip-factory";

function asString(value: unknown): string {
  return String(value ?? "").trim();
}

function apiError(res: VercelResponse, status: number, error: string, message: string) {
  return res.status(status).json({ error, message });
}

async function hydrateJob(service: ReturnType<typeof getServiceClient>, job: Record<string, unknown>) {
  const jobId = String(job.id);
  const [{ data: candidates }, { data: renders }, { data: media }] = await Promise.all([
    service.from("clip_factory_candidates").select("*").eq("job_id", jobId).order("overall_viral_score", { ascending: false }),
    service.from("clip_factory_renders").select("*").eq("job_id", jobId).order("created_at", { ascending: false }),
    job.media_id
      ? service.from("clip_factory_media").select("duration_seconds,width,height,has_audio,orientation").eq("id", job.media_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  return {
    ...job,
    media,
    source_thumbnail_url: job.source_thumbnail_path
      ? signedPlaybackPath("thumb", `job:${jobId}`)
      : ((job.source_metadata as { thumbnailUrl?: string } | null | undefined)?.thumbnailUrl || null),
    progress_label: job.progress_label || null,
    provider: job.provider || job.source_kind,
    rights_confirmed: Boolean(job.rights_confirmed),
    source_metadata: job.source_metadata || {},
    playback_url: job.media_id ? signedPlaybackPath("source", String(job.media_id)) : null,
    candidates: (candidates || []).map((row) => ({
      ...row,
      suggested_platforms: row.suggested_platforms || [],
      hashtags: row.hashtags || [],
      why_it_works: row.why_it_works || [],
      scores: row.scores || {},
    })),
    renders: (renders || []).map((row) => ({
      ...row,
      playback_url: row.status === "completed" ? signedPlaybackPath("render", row.id) : null,
      thumbnail_url: row.thumbnail_path ? signedPlaybackPath("thumb", row.id) : null,
    })),
  };
}

async function streamStorage(res: VercelResponse, storagePath: string, contentType: string) {
  const service = getServiceClient();
  const { data, error } = await service.storage.from(BUCKET).download(storagePath);
  if (error || !data) {
    res.status(404).json({ error: "not_found", message: "Media is not available." });
    return;
  }
  const buf = Buffer.from(await data.arrayBuffer());
  res.status(200);
  res.setHeader("Content-Type", contentType);
  res.setHeader("Cache-Control", "private, max-age=300");
  res.setHeader("Content-Length", String(buf.length));
  res.end(buf);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  const action = asString(req.query.action || (req.body as { action?: string })?.action);

  if (req.method === "GET" && action === "media") {
    const kind = asString(req.query.kind);
    const id = asString(req.query.id);
    const exp = asString(req.query.exp);
    const sig = asString(req.query.sig);
    if (!verifyMediaSignature(`${kind}:${id}`, exp, sig)) {
      return apiError(res, 401, "unauthorized", "This media link has expired. Refresh the page.");
    }
    const service = getServiceClient();
    if (kind === "source") {
      const { data } = await service.from("clip_factory_media").select("storage_path").eq("id", id).maybeSingle();
      if (!data?.storage_path) return apiError(res, 404, "not_found", "Source video is not available.");
      await streamStorage(res, data.storage_path, "video/mp4");
      return;
    }
    if (kind === "render") {
      const { data } = await service.from("clip_factory_renders").select("storage_path").eq("id", id).maybeSingle();
      if (!data?.storage_path) return apiError(res, 404, "not_found", "Rendered clip is not available.");
      await streamStorage(res, data.storage_path, "video/mp4");
      return;
    }
    if (kind === "thumb") {
      if (id.startsWith("job:")) {
        const { data } = await service.from("clip_factory_jobs").select("source_thumbnail_path").eq("id", id.slice(4)).maybeSingle();
        if (!data?.source_thumbnail_path) return apiError(res, 404, "not_found", "Thumbnail is not available.");
        await streamStorage(res, data.source_thumbnail_path, "image/jpeg");
        return;
      }
      const { data } = await service.from("clip_factory_renders").select("thumbnail_path").eq("id", id).maybeSingle();
      if (!data?.thumbnail_path) return apiError(res, 404, "not_found", "Thumbnail is not available.");
      await streamStorage(res, data.thumbnail_path, "image/jpeg");
      return;
    }
    return apiError(res, 400, "invalid_request", "Unknown media kind.");
  }

  if (req.method !== "POST") return apiError(res, 405, "method", "Method not allowed");

  const body = (typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {}) as Record<string, unknown>;
  const postAction = asString(body.action);

  if (postAction === "tick") {
    const cronSecret = String(process.env.CLIP_FACTORY_CRON_SECRET || process.env.CRON_SECRET || process.env.SOCIAL_PUBLISHER_CRON_SECRET || "").trim();
    const provided = asString(req.headers["x-cron-secret"] || req.headers.authorization).replace(/^Bearer\s+/i, "");
    if (!isServiceRoleRequest(req.headers.authorization) && (!cronSecret || provided !== cronSecret)) {
      return apiError(res, 401, "unauthorized", "Unauthorized");
    }
    const result = await tickClipFactory("cron");
    return res.status(200).json({ ok: true, ...result });
  }

  let admin;
  try {
    admin = await requireClipFactoryAdmin(req.headers.authorization);
  } catch (err) {
    const status = (err as Error & { status?: number }).status || 401;
    return apiError(res, status, "unauthorized", err instanceof Error ? err.message : "Unauthorized");
  }

  const service = getServiceClient();

  try {
    if (postAction === "signed_upload") {
      const contentType = asString(body.content_type);
      const byteSize = Number(body.byte_size);
      if (!ALLOWED_UPLOAD_TYPES.has(contentType)) {
        return apiError(res, 400, "unsupported_codec", "Upload MP4, MOV, or WebM.");
      }
      if (!Number.isFinite(byteSize) || byteSize <= 0 || byteSize > MAX_UPLOAD_BYTES) {
        return apiError(res, 400, "huge_file", "File must be under 500MB.");
      }
      const objectPath = `uploads/${admin.email.replace(/[^a-z0-9@._-]/g, "_")}/${randomUUID()}-${sanitizeFilename(asString(body.file_name))}`;
      const { data, error } = await service.storage.from(BUCKET).createSignedUploadUrl(objectPath);
      if (error || !data?.signedUrl) throw error || new Error("Could not create upload URL");
      return res.status(200).json({
        uploadUrl: data.signedUrl,
        objectPath,
        headers: { "content-type": contentType },
      });
    }

    if (postAction === "inspect_url") {
      const raw = asString(body.url);
      const classified = classifyVideoUrl(raw);
      if (!classified.ok) return apiError(res, 400, classified.code, classified.message);
      try {
        const adapter = detectUrlAdapter(raw);
        const metadata = adapter ? await adapter.getMetadata(raw) : null;
        const capability = metadata?.ingestionCapability || classified.ingestionCapability;
        const ready = capability === "FULL_IMPORT";
        return res.status(200).json({
          classification: classified,
          metadata,
          source: metadata
            ? {
                sourceId: metadata.sourceId,
                sourceType: metadata.sourceType,
                originalUrl: metadata.originalUrl,
                title: metadata.title,
                thumbnail: metadata.thumbnail || metadata.thumbnailUrl,
                duration: metadata.duration ?? metadata.durationSeconds,
                author: metadata.author,
                mediaUrl: metadata.mediaUrl || null,
                mediaAsset: metadata.mediaAsset || null,
                metadata: metadata.metadata || {},
                ingestionCapability: capability,
              }
            : null,
          ready,
          ingestionCapability: capability,
        });
      } catch (err) {
        if (err instanceof IngestFailure) return apiError(res, 400, err.code, err.message);
        const message = err instanceof Error ? err.message : "Could not inspect that URL.";
        return apiError(res, 400, "import_failed", message);
      }
    }

    if (postAction === "library_sources") {
      const catalog = LIBRARY_VIDEOS.filter((v) => v.kind !== "photo").map((v) => ({
        id: v.id,
        title: v.title,
        src: v.src,
        kind: v.kind,
        filename: v.filename,
        durationSeconds: v.durationSeconds,
        libraryKind: "catalog" as const,
      }));
      const { data: assets } = await service
        .from("library_assets")
        .select("id,title,filename,kind,duration_seconds")
        .order("created_at", { ascending: false })
        .limit(80);
      const generated = (assets || []).map((row) => ({
        id: row.id,
        title: `${row.title} (Library)`,
        src: "",
        kind: row.kind,
        filename: row.filename,
        durationSeconds: row.duration_seconds,
        libraryKind: "asset" as const,
      }));
      return res.status(200).json({ videos: [...generated, ...catalog] });
    }

    if (postAction === "list_library_assets") {
      const { data, error } = await service.from("library_assets").select("*").order("created_at", { ascending: false }).limit(80);
      if (error) throw error;
      const videos = (data || []).map((row) => ({
        id: row.id,
        title: row.title,
        description: row.description,
        src: signedPlaybackPath("render", row.provenance?.candidate_id ? String(row.id) : row.id),
        filename: row.filename,
        category: "clip_factory",
        kind: row.kind,
        durationSeconds: row.duration_seconds,
        poster: row.thumbnail_path ? signedPlaybackPath("thumb", row.id) : undefined,
        width: row.width,
        height: row.height,
      }));
      const { data: renders } = await service
        .from("clip_factory_renders")
        .select("id,library_asset_id,thumbnail_path")
        .in("library_asset_id", (data || []).map((r) => r.id));
      const byAsset = new Map((renders || []).map((r) => [r.library_asset_id, r]));
      for (const video of videos) {
        const render = byAsset.get(video.id);
        if (render) {
          video.src = signedPlaybackPath("render", render.id);
          video.poster = signedPlaybackPath("thumb", render.id);
        }
      }
      return res.status(200).json({ videos });
    }

    if (postAction === "attach_media") {
      const jobId = asString(body.job_id);
      const { data: job } = await service.from("clip_factory_jobs").select("*").eq("id", jobId).maybeSingle();
      if (!job) return apiError(res, 404, "not_found", "Job not found.");
      if (job.media_id) return apiError(res, 409, "media_already_attached", "This project already has media.");
      const payload = { ...(job.source_payload || {}) } as Record<string, unknown>;
      if (asString(body.object_path).startsWith("uploads/")) {
        payload.objectPath = asString(body.object_path);
        payload.mediaKind = "upload";
      } else if (asString(body.library_asset_id)) {
        const libraryAssetId = asString(body.library_asset_id);
        const catalog = LIBRARY_VIDEOS.find((v) => v.id === libraryAssetId);
        const { data: asset } = catalog
          ? { data: null }
          : await service.from("library_assets").select("id,title").eq("id", libraryAssetId).maybeSingle();
        if (!catalog && !asset) return apiError(res, 400, "invalid_request", "Choose a video from the Library.");
        payload.libraryAssetId = libraryAssetId;
        payload.libraryKind = catalog ? "catalog" : "asset";
        payload.mediaKind = "library";
      } else {
        return apiError(res, 400, "invalid_request", "Upload a file or choose one from the Library.");
      }
      await service
        .from("clip_factory_jobs")
        .update({
          source_payload: payload,
          status: "queued",
          stage: "queued",
          progress: 4,
          progress_label: "Uploading video",
          error_message: null,
          error_code: null,
          lease_expires_at: null,
          rights_confirmed: true,
          rights_confirmed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", jobId);
      kickClipFactoryWorker();
      const { data: fresh } = await service.from("clip_factory_jobs").select("*").eq("id", jobId).single();
      return res.status(200).json({ job: await hydrateJob(service, fresh) });
    }

    if (postAction === "create_job") {
      const prepared = prepareClipFactoryJob({
        source_kind: asString(body.source_kind),
        url: asString(body.url),
        object_path: asString(body.object_path),
        file_name: asString(body.file_name),
        library_asset_id: asString(body.library_asset_id),
        library_kind: body.library_kind === "asset" ? "asset" : "catalog",
        source_label: asString(body.source_label),
        rights_confirmed: body.rights_confirmed === true,
        options: body.options as never,
        auto_render: body.auto_render !== false,
      });
      if (!prepared.ok) return apiError(res, 400, prepared.code, prepared.message);
      const sourceKind = prepared.sourceKind;
      const sourcePayload = prepared.sourcePayload;
      let sourceLabel = prepared.sourceLabel;
      const options = prepared.options;
      const idempotencyKey = asString(body.idempotency_key) || null;
      if (sourceKind === "library") {
        const libraryAssetId = asString(body.library_asset_id);
        const catalog = LIBRARY_VIDEOS.find((v) => v.id === libraryAssetId);
        if (catalog) {
          sourceLabel = catalog.title;
          sourcePayload.libraryKind = "catalog";
        } else {
          const { data: asset } = await service.from("library_assets").select("id,title").eq("id", libraryAssetId).maybeSingle();
          if (!asset) return apiError(res, 400, "invalid_request", "Choose a video from the Library.");
          sourceLabel = asset.title;
          sourcePayload.libraryKind = "asset";
        }
      }
      let sourceMetadata = {};
      if (asString(body.url)) {
        try {
          const adapter = detectUrlAdapter(asString(body.url));
          if (adapter) sourceMetadata = await adapter.getMetadata(asString(body.url));
        } catch (err) {
          if (err instanceof IngestFailure) return apiError(res, 400, err.code, err.message);
        }
      }
      const metaCapability = (sourceMetadata as { ingestionCapability?: string }).ingestionCapability;
      const waitingForMedia =
        prepared.waitingForMedia ||
        (metaCapability ? metaCapability !== "FULL_IMPORT" && !asString(body.object_path) && !asString(body.library_asset_id) : prepared.waitingForMedia);
      if (metaCapability) {
        sourcePayload.ingestionCapability = metaCapability;
        if ((sourceMetadata as { mediaUrl?: string }).mediaUrl) {
          sourcePayload.mediaUrl = (sourceMetadata as { mediaUrl?: string }).mediaUrl;
        }
      }

      if (idempotencyKey) {
        const { data: existing } = await service
          .from("clip_factory_jobs")
          .select("*")
          .eq("created_by_email", admin.email)
          .eq("idempotency_key", idempotencyKey)
          .maybeSingle();
        if (existing) {
          kickClipFactoryWorker();
          return res.status(200).json({ job: await hydrateJob(service, existing), duplicate: true });
        }
      }

      const inserted = await service
        .from("clip_factory_jobs")
        .insert({
          created_by: admin.userId,
          created_by_email: admin.email,
          idempotency_key: idempotencyKey,
          status: waitingForMedia ? "waiting_for_media" : "queued",
          stage: waitingForMedia ? "source_detected" : "queued",
          progress: waitingForMedia ? 5 : 2,
          progress_label: waitingForMedia
            ? (sourceMetadata as { message?: string }).message || "Source detected. Original media is required to continue."
            : "Queued",
          source_kind: sourceKind,
          source_payload: sourcePayload,
          source_label: (sourceMetadata as { title?: string }).title || sourceLabel,
          options,
          provider: prepared.provider,
          source_metadata: sourceMetadata,
          rights_confirmed: prepared.rightsConfirmed,
          rights_confirmed_at: prepared.rightsConfirmed ? new Date().toISOString() : null,
          auto_render: prepared.autoRender,
        })
        .select("*")
        .single();
      if (inserted.error) throw inserted.error;
      if (!waitingForMedia) kickClipFactoryWorker();
      return res.status(200).json({ job: await hydrateJob(service, inserted.data) });
    }

    if (postAction === "get_job") {
      const { data, error } = await service.from("clip_factory_jobs").select("*").eq("id", asString(body.job_id)).maybeSingle();
      if (error) throw error;
      if (!data) return apiError(res, 404, "not_found", "Job not found.");
      kickClipFactoryWorker();
      return res.status(200).json({ job: await hydrateJob(service, data) });
    }

    if (postAction === "list_jobs") {
      const { data, error } = await service.from("clip_factory_jobs").select("*").order("created_at", { ascending: false }).limit(40);
      if (error) throw error;
      const jobs = [];
      for (const row of data || []) jobs.push(await hydrateJob(service, row));
      return res.status(200).json({ jobs });
    }

    if (postAction === "retry_job") {
      const jobId = asString(body.job_id);
      const { data } = await service.from("clip_factory_jobs").select("*").eq("id", jobId).maybeSingle();
      if (!data) return apiError(res, 404, "not_found", "Job not found.");
      const nextStatus = data.failed_stage === "render" ? "rendering" : "queued";
      await service
        .from("clip_factory_jobs")
        .update({
          status: nextStatus,
          stage: nextStatus === "rendering" ? "rendering" : "queued",
          progress: 5,
          progress_label: nextStatus === "rendering" ? "Rendering clips" : "Retrying",
          error_message: null,
          error_code: null,
          retry_count: (data.retry_count || 0) + 1,
          lease_expires_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", jobId);
      if (data.failed_stage === "render") {
        await service
          .from("clip_factory_renders")
          .update({ status: "queued", error_message: null })
          .eq("job_id", jobId)
          .eq("status", "failed");
      }
      kickClipFactoryWorker();
      const { data: fresh } = await service.from("clip_factory_jobs").select("*").eq("id", jobId).single();
      return res.status(200).json({ job: await hydrateJob(service, fresh) });
    }

    if (postAction === "reject_candidate") {
      await service
        .from("clip_factory_candidates")
        .update({ rejected: Boolean(body.rejected) })
        .eq("id", asString(body.candidate_id))
        .eq("job_id", asString(body.job_id));
      return res.status(200).json({ ok: true });
    }

    if (postAction === "update_candidate") {
      const patch = (body.patch || {}) as Record<string, unknown>;
      const allowed: Record<string, unknown> = {};
      if (typeof patch.start_time === "number") allowed.start_time = patch.start_time;
      if (typeof patch.end_time === "number") allowed.end_time = patch.end_time;
      if (typeof patch.start_time === "number" && typeof patch.end_time === "number") {
        allowed.duration = Number(patch.end_time) - Number(patch.start_time);
      }
      if (typeof patch.caption_style === "string") allowed.crop = undefined;
      if (Object.keys(allowed).length) {
        await service.from("clip_factory_candidates").update(allowed).eq("id", asString(body.candidate_id)).eq("job_id", asString(body.job_id));
      }
      return res.status(200).json({ ok: true });
    }

    if (postAction === "render_clips") {
      const jobId = asString(body.job_id);
      const ids = Array.isArray(body.candidate_ids) ? body.candidate_ids.map((id) => asString(id)).filter(Boolean) : [];
      if (!ids.length) return apiError(res, 400, "invalid_request", "Select at least one moment to generate.");
      const captionStyle = asString(body.caption_style) || undefined;
      const aiHook = typeof body.ai_hook === "boolean" ? body.ai_hook : undefined;
      for (const candidateId of ids) {
        const { data: existing } = await service
          .from("clip_factory_renders")
          .select("id,status")
          .eq("job_id", jobId)
          .eq("candidate_id", candidateId)
          .maybeSingle();
        if (!existing) {
          await service.from("clip_factory_renders").insert({
            job_id: jobId,
            candidate_id: candidateId,
            status: "queued",
            start_time: 0,
            end_time: 0,
            caption_style: captionStyle || "auto",
            ai_hook_enabled: aiHook ?? true,
          });
        } else if (existing.status === "failed") {
          await service.from("clip_factory_renders").update({ status: "queued", error_message: null }).eq("id", existing.id);
        }
      }
      await service.from("clip_factory_jobs").update({ status: "rendering", stage: "rendering", progress: 40, updated_at: new Date().toISOString() }).eq("id", jobId);
      kickClipFactoryWorker();
      void (async () => {
        for (const candidateId of ids) {
          try {
            await renderClipFactoryCandidate({
              jobId,
              candidateId,
              captionStyle: captionStyle as never,
              aiHook,
            });
          } catch {
            /* persisted on the render row */
          }
        }
      })();
      const { data: renders } = await service.from("clip_factory_renders").select("*").eq("job_id", jobId).in("candidate_id", ids);
      return res.status(200).json({ renders: renders || [] });
    }

    if (postAction === "process_now" && admin.service) {
      await processClipFactoryJob(asString(body.job_id));
      return res.status(200).json({ ok: true });
    }

    return apiError(res, 400, "invalid_request", "Unknown action.");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(JSON.stringify({ source: "clip-factory", event: "handler_error", message: message.slice(0, 400) }));
    return apiError(res, 500, "handler_failed", message.slice(0, 300));
  }
}
