import { supabase } from "@/lib/supabase";
import type { CaptionStyle, ClipFactoryOptions } from "./types";

export type ClipFactoryJob = {
  id: string;
  status: string;
  stage: string;
  progress: number;
  source_kind: string;
  source_label: string;
  source_thumbnail_url?: string | null;
  moments_found: number;
  clips_generated: number;
  error_code?: string | null;
  error_message?: string | null;
  failed_stage?: string | null;
  options: ClipFactoryOptions;
  cost?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  progress_label?: string | null;
  provider?: string;
  rights_confirmed?: boolean;
  source_metadata?: {
    title?: string;
    author?: string;
    durationSeconds?: number | null;
    thumbnailUrl?: string | null;
    provider?: string;
    canImport?: boolean;
    message?: string | null;
  };
  media?: {
    duration_seconds?: number;
    width?: number;
    height?: number;
    has_audio?: boolean;
    orientation?: string;
  } | null;
  playback_url?: string | null;
  candidates?: ClipFactoryCandidateRow[];
  renders?: ClipFactoryRenderRow[];
};

export type ClipFactoryCandidateRow = {
  id: string;
  start_time: number;
  end_time: number;
  duration: number;
  title: string;
  hook: string;
  summary: string;
  reason: string;
  category: string;
  suggested_platforms: string[];
  suggested_caption: string;
  suggested_post_caption: string;
  hashtags: string[];
  confidence: number;
  scores: Record<string, number>;
  overall_viral_score: number;
  why_it_works: string[];
  crop: Record<string, unknown>;
  rejected: boolean;
};

export type ClipFactoryRenderRow = {
  id: string;
  candidate_id: string;
  library_asset_id: string | null;
  status: string;
  playback_url?: string | null;
  thumbnail_url?: string | null;
  error_message?: string | null;
};

async function invoke<T>(action: string, body: Record<string, unknown> = {}): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("Sign in required");
  const response = await fetch("/api/clip-factory", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ action, ...body }),
  });
  const json = (await response.json().catch(() => ({}))) as T & { error?: string; message?: string };
  if (!response.ok) {
    throw new Error(json.message || json.error || `Clip Factory request failed (${response.status})`);
  }
  if (json && typeof json === "object" && "error" in json && json.error) {
    throw new Error(String(json.message || json.error));
  }
  return json;
}

export const clipFactoryApi = {
  inspectUrl: (url: string) =>
    invoke<{
      classification: { provider: string; canImport: boolean; message?: string | null; normalizedUrl: string };
      metadata: {
        provider: string;
        title?: string | null;
        author?: string | null;
        durationSeconds?: number | null;
        thumbnailUrl?: string | null;
        canImport: boolean;
        message?: string | null;
      } | null;
      ready: boolean;
    }>("inspect_url", { url }),
  createJob: (payload: Record<string, unknown>) => invoke<{ job: ClipFactoryJob }>("create_job", payload),
  getJob: (jobId: string) => invoke<{ job: ClipFactoryJob }>("get_job", { job_id: jobId }),
  listJobs: () => invoke<{ jobs: ClipFactoryJob[] }>("list_jobs"),
  retry: (jobId: string) => invoke<{ job: ClipFactoryJob }>("retry_job", { job_id: jobId }),
  attachMedia: (payload: Record<string, unknown>) => invoke<{ job: ClipFactoryJob }>("attach_media", payload),
  rejectCandidate: (jobId: string, candidateId: string, rejected: boolean) =>
    invoke<{ ok: true }>("reject_candidate", { job_id: jobId, candidate_id: candidateId, rejected }),
  updateCandidate: (jobId: string, candidateId: string, patch: Record<string, unknown>) =>
    invoke<{ ok: true }>("update_candidate", { job_id: jobId, candidate_id: candidateId, patch }),
  render: (jobId: string, candidateIds: string[], extras?: { captionStyle?: CaptionStyle; aiHook?: boolean }) =>
    invoke<{ renders: ClipFactoryRenderRow[] }>("render_clips", {
      job_id: jobId,
      candidate_ids: candidateIds,
      caption_style: extras?.captionStyle,
      ai_hook: extras?.aiHook,
    }),
  signedUpload: (contentType: string, fileSize: number, fileName: string) =>
    invoke<{ uploadUrl: string; objectPath: string; headers: Record<string, string> }>("signed_upload", {
      content_type: contentType,
      byte_size: fileSize,
      file_name: fileName,
    }),
  libraryVideos: () => invoke<{ videos: Array<{ id: string; title: string; src: string; kind: string; filename: string }> }>("library_sources"),
  dynamicLibrary: () =>
    invoke<{ videos: Array<Record<string, unknown>> }>("list_library_assets"),
};
