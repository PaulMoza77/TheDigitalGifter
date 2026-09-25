import { supabase } from "@/lib/supabase";
import type { PublicYoutubeLiveSession } from "./policy";

async function invoke<T>(action: string, body: Record<string, unknown> = {}): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("Sign in required");
  const response = await fetch("/api/youtube-live", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ action, ...body }),
  });
  const json = (await response.json().catch(() => ({}))) as T & { error?: string; message?: string };
  if (!response.ok) {
    throw new Error(json.message || json.error || `YouTube Live request failed (${response.status})`);
  }
  return json;
}

export const youtubeLiveApi = {
  list: () => invoke<{ sessions: PublicYoutubeLiveSession[] }>("list"),
  readiness: () =>
    invoke<{
      maxConcurrent: number;
      activeCount: number;
      conflict: boolean;
      probe: { ok?: boolean; error?: string; youtube_live_ready?: boolean };
    }>("readiness"),
  start: (payload: Record<string, unknown>) => invoke<{ session: PublicYoutubeLiveSession }>("start", payload),
  stop: (sessionId: string) => invoke<{ session: PublicYoutubeLiveSession }>("stop", { session_id: sessionId }),
  publishVideo: (payload: Record<string, unknown>) =>
    invoke<{ ok: true; platform: "youtube_video"; videoId: string; url: string }>("publish_video", payload),
};
