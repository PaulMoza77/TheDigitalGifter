import { supabase } from "@/lib/supabase";
import type { MusicTrack, PlaylistEntry } from "./types";

async function invoke<T>(action: string, body: Record<string, unknown> = {}): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("Sign in required");
  const response = await fetch("/api/long-form-studio", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ action, ...body }),
  });
  const json = (await response.json().catch(() => ({}))) as T & { error?: string; message?: string };
  if (!response.ok) {
    throw new Error(json.message || json.error || `Studio request failed (${response.status})`);
  }
  return json;
}

export const longFormApi = {
  bootstrap: () => invoke<{ music: MusicTrack[]; scenes: Array<Record<string, unknown>>; productions: Array<Record<string, unknown>> }>("bootstrap"),
  previewPlaylist: (mood: string, durationSeconds: number, shuffle: boolean, seed?: number) =>
    invoke<{ entries: PlaylistEntry[]; selected: MusicTrack[]; musicDuration: number }>("preview_playlist", {
      mood,
      duration_seconds: durationSeconds,
      shuffle,
      seed,
    }),
  createVideo: (payload: Record<string, unknown>) => invoke<Record<string, unknown>>("create_video", payload),
  getProduction: (id: string) => invoke<{ production: Record<string, unknown> }>("get_production", { production_id: id }),
  libraryVideos: () => invoke<{ videos: Array<Record<string, unknown>> }>("library_videos"),
  importYal: (payload: Record<string, unknown>) => invoke<{ track: MusicTrack }>("import_youtube_audio_library", payload),
  animateScene: (sceneId: string) => invoke<{ src: string; note: string }>("animate_scene", { scene_id: sceneId }),
};
