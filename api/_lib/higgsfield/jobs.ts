import type { SupabaseClient } from "@supabase/supabase-js";
import {
  budgetAllows,
  buildImageToVideoPayload,
  HIGGSFIELD_MODELS,
  isHiggsfieldModelKey,
  type HiggsfieldModelKey,
} from "../../../src/features/admin-library/higgsfieldModels";
import {
  canSubmitPaidGeneration,
  mapProviderStatus,
  resumeAction,
  shouldRetryImport,
  type HiggsfieldJobStatus,
} from "../../../src/features/admin-library/jobState";
import { getHiggsfieldTransport, videoUrlFromStatus, type HiggsfieldTransport } from "./client";
import { commandKey, uploadLibraryPhoto } from "./photos";
import { downloadBinary, probeMp4, signedLibraryUrl, TDG_LIBRARY_BUCKET, uploadLibraryObject } from "./storage";

export type HiggsfieldJobRow = {
  id: string;
  command_key: string;
  status: HiggsfieldJobStatus;
  photo_id: string;
  prompt: string;
  model_key: string;
  model_id: string;
  requested_params: Record<string, unknown>;
  submitted_params: Record<string, unknown>;
  provider_request_id: string | null;
  provider_status_url: string | null;
  provider_video_url: string | null;
  estimated_cost_usd: number | null;
  confirmed_cost_usd: number | null;
  estimated_credits: string | null;
  budget_usd: number | null;
  library_item_id: string | null;
  storage_bucket: string | null;
  storage_path: string | null;
  effective_duration_seconds: number | null;
  effective_width: number | null;
  effective_height: number | null;
  last_error: string | null;
  created_by: string | null;
};

function asRow(data: Record<string, unknown>): HiggsfieldJobRow {
  return data as unknown as HiggsfieldJobRow;
}

export async function loadJobById(service: SupabaseClient, id: string): Promise<HiggsfieldJobRow | null> {
  const { data, error } = await service.from("tdg_higgsfield_jobs").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? asRow(data as Record<string, unknown>) : null;
}

export async function loadJobByCommandKey(service: SupabaseClient, key: string): Promise<HiggsfieldJobRow | null> {
  const { data, error } = await service.from("tdg_higgsfield_jobs").select("*").eq("command_key", key).maybeSingle();
  if (error) throw error;
  return data ? asRow(data as Record<string, unknown>) : null;
}

export async function loadJobByProviderId(service: SupabaseClient, providerId: string): Promise<HiggsfieldJobRow | null> {
  const { data, error } = await service
    .from("tdg_higgsfield_jobs")
    .select("*")
    .eq("provider_request_id", providerId)
    .maybeSingle();
  if (error) throw error;
  return data ? asRow(data as Record<string, unknown>) : null;
}

async function patchJob(service: SupabaseClient, id: string, patch: Record<string, unknown>): Promise<HiggsfieldJobRow> {
  const { data, error } = await service
    .from("tdg_higgsfield_jobs")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return asRow(data as Record<string, unknown>);
}

export async function estimateJob(input: {
  service: SupabaseClient;
  transport?: HiggsfieldTransport;
  photoId: string;
  prompt: string;
  modelKey: string;
  createdBy: string | null;
  clientKey?: string | null;
}): Promise<{ job: HiggsfieldJobRow; notes: string[]; estimate: { usd: number; credits: string | null } | null }> {
  if (!isHiggsfieldModelKey(input.modelKey)) throw new Error("Unsupported model");
  const modelKey = input.modelKey as HiggsfieldModelKey;
  const transport = input.transport || getHiggsfieldTransport();
  const { photo, imageUrl } = await uploadLibraryPhoto(transport, input.photoId);
  const payload = buildImageToVideoPayload({
    modelKey,
    imageUrl,
    prompt: input.prompt,
  });
  const estimate = await transport.estimate(payload.model.estimatePath, payload.submitted);
  const key = commandKey({
    photoId: photo.id,
    prompt: input.prompt,
    modelKey,
    durationSeconds: payload.requested.durationSeconds,
    resolution: payload.requested.resolution,
    audio: payload.requested.audio,
    clientKey: input.clientKey,
  });
  const existing = await loadJobByCommandKey(input.service, key);
  const fields = {
    command_key: key,
    photo_id: photo.id,
    source_photo_src: photo.src,
    prompt: input.prompt.trim(),
    model_key: modelKey,
    model_id: payload.model.modelId,
    requested_params: payload.requested,
    submitted_params: payload.submitted,
    omitted_params: payload.omitted,
    param_notes: payload.notes,
    estimated_cost_usd: estimate?.usd ?? null,
    estimated_credits: estimate?.credits ?? null,
    status: existing?.provider_request_id ? existing.status : "estimated",
    created_by: input.createdBy,
    last_error: null,
  };
  if (existing) {
    const job = await patchJob(input.service, existing.id, fields);
    return { job, notes: payload.notes, estimate: estimate ? { usd: estimate.usd, credits: estimate.credits } : null };
  }
  const { data, error } = await input.service
    .from("tdg_higgsfield_jobs")
    .insert({
      ...fields,
      status: "estimated",
    })
    .select("*")
    .single();
  if (error) throw error;
  return {
    job: asRow(data as Record<string, unknown>),
    notes: payload.notes,
    estimate: estimate ? { usd: estimate.usd, credits: estimate.credits } : null,
  };
}

export async function submitJob(input: {
  service: SupabaseClient;
  transport?: HiggsfieldTransport;
  jobId?: string;
  photoId?: string;
  prompt?: string;
  modelKey?: string;
  budgetUsd: number;
  createdBy: string | null;
  clientKey?: string | null;
}): Promise<{ job: HiggsfieldJobRow; submitted: boolean; notes: string[] }> {
  const transport = input.transport || getHiggsfieldTransport();
  let job: HiggsfieldJobRow | null = input.jobId ? await loadJobById(input.service, input.jobId) : null;
  if (!job) {
    const estimated = await estimateJob({
      service: input.service,
      transport,
      photoId: String(input.photoId || ""),
      prompt: String(input.prompt || ""),
      modelKey: String(input.modelKey || ""),
      createdBy: input.createdBy,
      clientKey: input.clientKey,
    });
    job = estimated.job;
  }
  if (job.provider_request_id) {
    const synced = await syncJob({ service: input.service, transport, jobId: job.id });
    return { job: synced.job, submitted: false, notes: ["Existing Higgsfield request_id reused; no duplicate paid submit."] };
  }
  if (!canSubmitPaidGeneration(job.status, job.provider_request_id)) {
    throw new Error(`Job ${job.id} cannot start a paid generation in status ${job.status}.`);
  }
  const gate = budgetAllows({ budgetUsd: input.budgetUsd, estimatedUsd: job.estimated_cost_usd });
  if (!gate.ok) throw new Error(gate.reason || "Budget rejected");

  job = await patchJob(input.service, job.id, {
    status: "submitting",
    budget_usd: input.budgetUsd,
    last_error: null,
  });

  const submittedParams = (job.submitted_params || {}) as Record<string, unknown>;
  if (!isHiggsfieldModelKey(job.model_key)) throw new Error("Unsupported model");
  const model = HIGGSFIELD_MODELS[job.model_key as HiggsfieldModelKey];
  const created = await transport.submit(model.submitPath, submittedParams);
  job = await patchJob(input.service, job.id, {
    provider_request_id: created.request_id,
    provider_status_url: created.status_url || null,
    status: mapProviderStatus(created.status) || "queued",
  });
  return { job, submitted: true, notes: [] };
}

export async function syncJob(input: {
  service: SupabaseClient;
  transport?: HiggsfieldTransport;
  jobId: string;
}): Promise<{ job: HiggsfieldJobRow; imported: boolean }> {
  const transport = input.transport || getHiggsfieldTransport();
  let job = await loadJobById(input.service, input.jobId);
  if (!job) throw new Error("Job not found");
  const action = resumeAction(job.status, job.provider_request_id);
  if (action === "none") return { job, imported: job.status === "imported" };
  if (action === "import") {
    job = await importJobResult({ service: input.service, job });
    return { job, imported: job.status === "imported" };
  }
  if (action === "submit") {
    return { job, imported: false };
  }
  if (!job.provider_request_id) return { job, imported: false };
  const status = await transport.status(job.provider_status_url || job.provider_request_id);
  const mapped = mapProviderStatus(status.status) || job.status;
  const videoUrl = videoUrlFromStatus(status);
  job = await patchJob(input.service, job.id, {
    status: mapped === "completed" && job.status === "imported" ? "imported" : mapped,
    provider_video_url: videoUrl,
    last_error: status.error ? String(status.error).slice(0, 500) : job.last_error,
  });
  if (mapped === "completed" && videoUrl && job.status !== "imported") {
    job = await importJobResult({ service: input.service, job: { ...job, provider_video_url: videoUrl } });
  }
  return { job, imported: job.status === "imported" };
}

export async function importJobResult(input: {
  service: SupabaseClient;
  job: HiggsfieldJobRow;
}): Promise<HiggsfieldJobRow> {
  const job = input.job;
  if (job.status === "imported" && job.library_item_id) return job;
  if (!shouldRetryImport(job.status) && job.status !== "completed") {
    throw new Error(`Cannot import job in status ${job.status}`);
  }
  const videoUrl = job.provider_video_url;
  if (!videoUrl) throw new Error("No provider video URL to import");
  await patchJob(input.service, job.id, { status: "importing", last_error: null });
  try {
    const bytes = await downloadBinary(videoUrl);
    const probe = await probeMp4(bytes);
    const filename = `${job.photo_id}-${job.model_key}.mp4`;
    const storagePath = `clips/${job.id}/${filename}`;
    await uploadLibraryObject(storagePath, bytes, "video/mp4");
    const catalogId = `hf-${job.id}`;
    const { data: item, error: itemErr } = await input.service
      .from("tdg_library_items")
      .upsert(
        {
          catalog_id: catalogId,
          title: `${job.model_key} · ${job.photo_id}`,
          description: job.prompt,
          filename,
          category: "christmas_reels",
          kind: "short",
          duration_seconds: probe.durationSeconds,
          storage_bucket: TDG_LIBRARY_BUCKET,
          storage_path: storagePath,
          source_photo_id: job.photo_id,
          prompt: job.prompt,
          model_key: job.model_key,
          model_id: job.model_id,
          requested_params: job.requested_params,
          submitted_params: job.submitted_params,
          provider_request_id: job.provider_request_id,
          effective_duration_seconds: probe.durationSeconds,
          effective_width: probe.width,
          effective_height: probe.height,
          estimated_cost_usd: job.estimated_cost_usd,
          confirmed_cost_usd: job.confirmed_cost_usd,
          job_id: job.id,
        },
        { onConflict: "catalog_id" },
      )
      .select("id")
      .single();
    if (itemErr) throw itemErr;
    return await patchJob(input.service, job.id, {
      status: "imported",
      library_item_id: item.id,
      storage_bucket: TDG_LIBRARY_BUCKET,
      storage_path: storagePath,
      effective_duration_seconds: probe.durationSeconds,
      effective_width: probe.width,
      effective_height: probe.height,
      last_error: null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return await patchJob(input.service, job.id, {
      status: "import_failed",
      last_error: message.slice(0, 500),
    });
  }
}

export async function retryImport(input: {
  service: SupabaseClient;
  transport?: HiggsfieldTransport;
  jobId: string;
}): Promise<HiggsfieldJobRow> {
  const transport = input.transport || getHiggsfieldTransport();
  let job = await loadJobById(input.service, input.jobId);
  if (!job) throw new Error("Job not found");
  if (!job.provider_request_id) throw new Error("No provider request to import; refusing paid regenerate");
  if (!job.provider_video_url) {
    const status = await transport.status(job.provider_status_url || job.provider_request_id);
    const videoUrl = videoUrlFromStatus(status);
    if (!videoUrl) throw new Error("Provider result is not ready for import");
    job = await patchJob(input.service, job.id, {
      provider_video_url: videoUrl,
      status: mapProviderStatus(status.status) || job.status,
    });
  }
  return importJobResult({ service: input.service, job });
}

export async function listOpenJobs(service: SupabaseClient): Promise<HiggsfieldJobRow[]> {
  const { data, error } = await service
    .from("tdg_higgsfield_jobs")
    .select("*")
    .in("status", ["submitting", "queued", "in_progress", "completed", "importing", "import_failed"])
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data || []).map((row) => asRow(row as Record<string, unknown>));
}

export async function listLibraryItems(service: SupabaseClient): Promise<
  Array<{
    id: string;
    title: string;
    description: string;
    src: string;
    filename: string;
    category: "christmas_reels";
    kind: "reel" | "short" | "photo";
    durationSeconds?: number;
  }>
> {
  const { data, error } = await service
    .from("tdg_library_items")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  const items = [];
  for (const row of data || []) {
    const rec = row as Record<string, unknown>;
    const path = String(rec.storage_path || "");
    const src = path ? (await signedLibraryUrl(path)) || `/api/admin-library?action=media&id=${rec.catalog_id}` : "";
    items.push({
      id: String(rec.catalog_id),
      title: String(rec.title || rec.catalog_id),
      description: String(rec.description || ""),
      src,
      filename: String(rec.filename || "clip.mp4"),
      category: "christmas_reels" as const,
      kind: (rec.kind as "reel" | "short" | "photo") || "short",
      durationSeconds: rec.duration_seconds != null ? Number(rec.duration_seconds) : undefined,
    });
  }
  return items;
}

export async function syncOpenJobs(service: SupabaseClient, transport?: HiggsfieldTransport): Promise<number> {
  const jobs = await listOpenJobs(service);
  let n = 0;
  for (const job of jobs) {
    if (job.status === "imported") continue;
    await syncJob({ service, transport, jobId: job.id });
    n += 1;
  }
  return n;
}
