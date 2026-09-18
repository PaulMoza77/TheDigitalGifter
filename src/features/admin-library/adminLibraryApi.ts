import { supabase } from "@/lib/supabase";
import type { LibraryVideo } from "./catalog";
import type { HiggsfieldModelKey } from "./higgsfieldModels";

async function authHeader(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sign in as admin first");
  return `Bearer ${token}`;
}

async function call<T>(action: string, body: Record<string, unknown> = {}, method: "GET" | "POST" = "POST"): Promise<T> {
  const url = method === "GET" ? `/api/admin-library?action=${encodeURIComponent(action)}` : "/api/admin-library";
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: await authHeader(),
      "Content-Type": "application/json",
    },
    body: method === "POST" ? JSON.stringify({ action, ...body }) : undefined,
    credentials: "same-origin",
  });
  const json = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
  return json;
}

export type PublicJob = {
  id: string;
  status: string;
  photo_id: string;
  prompt: string;
  model_key: string;
  provider_request_id: string | null;
  estimated_cost_usd: number | null;
  confirmed_cost_usd: number | null;
  budget_usd: number | null;
  param_notes?: string[];
  spec_ok?: boolean | null;
  spec_notes?: string[] | null;
  last_error: string | null;
  effective_width: number | null;
  effective_height: number | null;
};

export async function fetchLibraryState(): Promise<{
  items: LibraryVideo[];
  jobs: PublicJob[];
}> {
  return call("list", {}, "GET");
}

export async function fetchLibraryPhotos(): Promise<{
  photos: Array<{ id: string; title: string; filename: string; src: string; source?: string }>;
}> {
  return call("photos", {}, "GET");
}

export async function uploadLibraryStill(input: { filename: string; title?: string; bytesBase64: string }): Promise<{
  photoId: string;
  width: number;
  height: number;
}> {
  return call("upload-photo", input);
}

export async function estimateLibraryClip(input: {
  photoId: string;
  prompt: string;
  modelKey: HiggsfieldModelKey;
}): Promise<{ job: PublicJob; estimate: { usd: number; credits: string | null } | null; notes: string[] }> {
  return call("estimate", input);
}

export async function submitLibraryClip(input: {
  jobId: string;
  budgetUsd: number;
}): Promise<{ job: PublicJob; submitted: boolean; notes: string[] }> {
  return call("submit", input);
}

export async function syncLibraryJob(jobId: string): Promise<{ job: PublicJob; imported: boolean }> {
  return call("sync", { jobId });
}

export async function retryLibraryImport(jobId: string): Promise<{ job: PublicJob; regenerated: boolean }> {
  return call("retry-import", { jobId });
}

export async function composeLibraryReel(clipIds: string[], title?: string): Promise<{ reel: { catalogId: string } }> {
  return call("compose", { clipIds, title });
}
