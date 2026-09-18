/**
 * Admin-only TDG Library + Higgsfield image-to-video.
 * Never expose Higgsfield credentials to the browser.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { libraryPhotos } from "../src/features/admin-library/libraryMerge";
import { HIGGSFIELD_MODELS } from "../src/features/admin-library/higgsfieldModels";
import { requireAdmin } from "./_lib/higgsfield/adminAuth";
import { composeLibraryReel } from "./_lib/higgsfield/compose";
import {
  estimateJob,
  listLibraryItems,
  listOpenJobs,
  loadJobByCommandKey,
  loadJobById,
  retryImport,
  submitJob,
  syncJob,
  syncOpenJobs,
} from "./_lib/higgsfield/jobs";
import { signedLibraryUrl } from "./_lib/higgsfield/storage";

type Body = Record<string, unknown>;

function parseBody(req: VercelRequest): Body {
  const raw = req.body;
  if (!raw) return {};
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as Body;
    } catch {
      return {};
    }
  }
  if (typeof raw === "object") return raw as Body;
  return {};
}

function sendError(res: VercelResponse, error: unknown) {
  const status = (error as { status?: number }).status || 400;
  const message = error instanceof Error ? error.message : String(error);
  return res.status(status).json({ error: message });
}

function publicJob(job: Record<string, unknown> | null) {
  if (!job) return null;
  return {
    id: job.id,
    command_key: job.command_key,
    status: job.status,
    photo_id: job.photo_id,
    prompt: job.prompt,
    model_key: job.model_key,
    model_id: job.model_id,
    requested_params: job.requested_params,
    submitted_params: job.submitted_params,
    omitted_params: job.omitted_params,
    param_notes: job.param_notes,
    provider_request_id: job.provider_request_id,
    estimated_cost_usd: job.estimated_cost_usd,
    confirmed_cost_usd: job.confirmed_cost_usd,
    estimated_credits: job.estimated_credits,
    budget_usd: job.budget_usd,
    effective_duration_seconds: job.effective_duration_seconds,
    effective_width: job.effective_width,
    effective_height: job.effective_height,
    library_item_id: job.library_item_id,
    last_error: job.last_error,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "authorization, content-type");
  if (req.method === "OPTIONS") return res.status(200).send("ok");

  try {
    const auth = await requireAdmin(req.headers.authorization);
    const queryAction = String(req.query.action || "");
    const body = parseBody(req);
    const action = String(body.action || queryAction || "list");

    if (req.method === "GET" && action === "media") {
      const id = String(req.query.id || "");
      const { data, error } = await auth.service.from("tdg_library_items").select("storage_path").eq("catalog_id", id).maybeSingle();
      if (error) throw error;
      const path = data ? String((data as { storage_path?: string }).storage_path || "") : "";
      const url = path ? await signedLibraryUrl(path) : null;
      if (!url) return res.status(404).json({ error: "Media not found" });
      return res.status(302).setHeader("Location", url).json({ url });
    }

    if (action === "models") {
      return res.status(200).json({
        models: HIGGSFIELD_MODELS,
        defaults: { durationSeconds: 5, aspectRatio: "9:16", resolution: "1080p", audio: false },
        mock: String(process.env.HIGGSFIELD_MOCK || "").toLowerCase() === "true" || process.env.HIGGSFIELD_MOCK === "1",
        credentialsConfigured: Boolean(String(process.env.HF_CREDENTIALS || process.env.HF_API_KEY_ID || "").trim()),
      });
    }

    if (action === "photos") {
      return res.status(200).json({ photos: libraryPhotos().map((p) => ({ id: p.id, title: p.title, filename: p.filename, src: p.src })) });
    }

    if (action === "list") {
      await syncOpenJobs(auth.service).catch(() => 0);
      const [items, jobs] = await Promise.all([listLibraryItems(auth.service), listOpenJobs(auth.service)]);
      return res.status(200).json({ items, jobs: jobs.map((job) => publicJob(job as unknown as Record<string, unknown>)) });
    }

    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    if (action === "estimate") {
      const result = await estimateJob({
        service: auth.service,
        photoId: String(body.photoId || body.photo || ""),
        prompt: String(body.prompt || ""),
        modelKey: String(body.model || body.modelKey || "kling-3.0-pro"),
        createdBy: auth.email,
        clientKey: body.commandKey ? String(body.commandKey) : null,
      });
      return res.status(200).json({
        job: publicJob(result.job as unknown as Record<string, unknown>),
        estimate: result.estimate,
        notes: result.notes,
        charged: false,
      });
    }

    if (action === "submit" || action === "generate") {
      const budgetUsd = Number(body.budgetUsd);
      const result = await submitJob({
        service: auth.service,
        jobId: body.jobId ? String(body.jobId) : undefined,
        photoId: body.photoId ? String(body.photoId) : undefined,
        prompt: body.prompt ? String(body.prompt) : undefined,
        modelKey: body.model || body.modelKey ? String(body.model || body.modelKey) : undefined,
        budgetUsd,
        createdBy: auth.email,
        clientKey: body.commandKey ? String(body.commandKey) : null,
      });
      return res.status(200).json({
        job: publicJob(result.job as unknown as Record<string, unknown>),
        submitted: result.submitted,
        notes: result.notes,
      });
    }

    if (action === "sync" || action === "status") {
      const jobId = String(body.jobId || req.query.jobId || "");
      const commandKey = String(body.commandKey || "");
      const row = jobId
        ? await loadJobById(auth.service, jobId)
        : commandKey
          ? await loadJobByCommandKey(auth.service, commandKey)
          : null;
      if (!row) return res.status(404).json({ error: "Job not found" });
      const synced = await syncJob({ service: auth.service, jobId: row.id });
      return res.status(200).json({
        job: publicJob(synced.job as unknown as Record<string, unknown>),
        imported: synced.imported,
      });
    }

    if (action === "retry-import") {
      const job = await retryImport({ service: auth.service, jobId: String(body.jobId || "") });
      return res.status(200).json({ job: publicJob(job as unknown as Record<string, unknown>), regenerated: false });
    }

    if (action === "compose") {
      const clipIds = Array.isArray(body.clipIds) ? body.clipIds.map((id) => String(id)) : [];
      const reel = await composeLibraryReel({
        service: auth.service,
        clipIds,
        title: body.title ? String(body.title) : undefined,
        createdBy: auth.email,
      });
      return res.status(200).json({ reel, charged: false });
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });
  } catch (error) {
    return sendError(res, error);
  }
}
