import { getServiceClient } from "../christmas/supabaseClient";
import {
  isActiveLiveStatus,
  publicLiveSession,
  youtubeLiveMaxConcurrent,
  type PublicYoutubeLiveSession,
  type YoutubeLiveStatus,
} from "../../../src/features/youtube-live/policy";

const ACTIVE = ["preparing", "waiting_for_ingest", "live", "stopping"];

export type LiveSessionRow = Record<string, unknown>;

export async function listLiveSessions(): Promise<PublicYoutubeLiveSession[]> {
  const service = getServiceClient();
  const { data, error } = await service
    .from("youtube_live_sessions")
    .select(
      "id,library_asset_id,production_id,youtube_broadcast_id,youtube_stream_id,youtube_video_id,youtube_url,status,title,description,privacy_status,made_for_kids,duration_hours,started_at,planned_end_at,ended_at,last_error,source_copy,created_at,updated_at",
    )
    .order("created_at", { ascending: false })
    .limit(40);
  if (error) throw new Error(error.message);
  return (data || []).map((row) => publicLiveSession(row as Record<string, unknown>)).filter(Boolean) as PublicYoutubeLiveSession[];
}

export async function listActiveLiveRows(): Promise<LiveSessionRow[]> {
  const service = getServiceClient();
  const { data, error } = await service
    .from("youtube_live_sessions")
    .select("*")
    .in("status", ACTIVE)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []) as LiveSessionRow[];
}

export async function getLiveSession(id: string): Promise<LiveSessionRow | null> {
  const service = getServiceClient();
  const { data, error } = await service.from("youtube_live_sessions").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as LiveSessionRow) || null;
}

export async function insertPreparingSession(row: Record<string, unknown>): Promise<LiveSessionRow> {
  const service = getServiceClient();
  const inserted = await service.from("youtube_live_sessions").insert(row).select("*").single();
  if (inserted.error) {
    if (/youtube_live_sessions_one_active/i.test(inserted.error.message || "")) {
      const active = await listActiveLiveRows();
      if (active[0]) return active[0];
    }
    throw inserted.error;
  }
  return inserted.data as LiveSessionRow;
}

export async function patchLiveSession(id: string, patch: Record<string, unknown>): Promise<LiveSessionRow> {
  const service = getServiceClient();
  const { data, error } = await service
    .from("youtube_live_sessions")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as LiveSessionRow;
}

export function assertConcurrentCapacity(active: LiveSessionRow[], libraryAssetId: string): LiveSessionRow | null {
  const max = youtubeLiveMaxConcurrent(process.env.YOUTUBE_LIVE_MAX_CONCURRENT);
  const same = active.find((row) => String(row.library_asset_id) === libraryAssetId && isActiveLiveStatus(String(row.status)));
  if (same) return same;
  if (active.length >= max) {
    throw Object.assign(
      new Error(`A YouTube Live session is already running. V1 allows ${max} concurrent live${max === 1 ? "" : "s"}.`),
      { status: 409, existing: active[0] },
    );
  }
  return null;
}

export function publicOrThrow(row: LiveSessionRow | null): PublicYoutubeLiveSession {
  const pub = publicLiveSession(row);
  if (!pub) throw new Error("Live session not found.");
  return pub;
}

export function asStatus(value: unknown): YoutubeLiveStatus {
  return String(value || "failed") as YoutubeLiveStatus;
}
