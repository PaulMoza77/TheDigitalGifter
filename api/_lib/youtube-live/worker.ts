import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";

import {
  assertLiveDurationHours,
  isActiveLiveStatus,
  plannedEndAtIso,
  publicLiveSession,
  redactIngestion,
  youtubeWatchUrl,
  type LiveDurationHours,
  type PublicYoutubeLiveSession,
  type YoutubeLivePrivacy,
} from "../../../src/features/youtube-live/policy";
import { youtubeRtmpCopySafe, buildFfmpegLiveArgs } from "./ffmpegLoop";
import { encryptLiveSecret, decryptLiveSecret } from "./crypto";
import { invokeYouTubeLiveEdge } from "./edge";
import { resolveLongFormLocalSource } from "./source";
import {
  assertConcurrentCapacity,
  getLiveSession,
  insertPreparingSession,
  listActiveLiveRows,
  listLiveSessions,
  patchLiveSession,
  publicOrThrow,
  type LiveSessionRow,
} from "./sessions";

export type LiveStartInput = {
  libraryAssetId: string;
  productionId?: string;
  title?: string;
  description?: string;
  privacyStatus?: YoutubeLivePrivacy;
  madeForKids?: boolean;
  durationHours?: unknown;
};

export type YoutubeLiveRuntime = {
  now: () => number;
  allowNetwork: boolean;
  resolveSource: typeof resolveLongFormLocalSource;
  insert: typeof insertPreparingSession;
  patch: typeof patchLiveSession;
  get: typeof getLiveSession;
  listActive: typeof listActiveLiveRows;
  encrypt: (value: string) => string;
  decrypt: (value: string | null | undefined) => string | null;
  edgePrepare: (input: {
    title: string;
    description: string;
    privacy_status: string;
    made_for_kids: boolean;
  }) => Promise<{
    ok: boolean;
    broadcastId?: string;
    streamId?: string;
    videoId?: string;
    ingestion?: { ingestUrl: string; streamName: string };
    error?: string;
  }>;
  edgeStatus: (streamId: string) => Promise<{ ok: boolean; streamStatus?: string; error?: string }>;
  edgeTransition: (
    broadcastId: string,
    broadcastStatus: "testing" | "live" | "complete",
  ) => Promise<{ ok: boolean; error?: string }>;
  spawnFfmpeg: (args: string[]) => { pid: number };
  pidAlive: (pid: number) => boolean;
  killPid: (pid: number) => void;
  waitForActiveMs: number;
};

const startLocks = new Map<string, Promise<PublicYoutubeLiveSession>>();

export function originLiveNetworkEnabled(): boolean {
  if (process.env.VITEST === "true") return false;
  if (process.env.YOUTUBE_LIVE_DISABLE === "1") return false;
  return true;
}

export function defaultYoutubeLiveRuntime(): YoutubeLiveRuntime {
  return {
    now: () => Date.now(),
    allowNetwork: originLiveNetworkEnabled(),
    resolveSource: resolveLongFormLocalSource,
    insert: insertPreparingSession,
    patch: patchLiveSession,
    get: getLiveSession,
    listActive: listActiveLiveRows,
    encrypt: encryptLiveSecret,
    decrypt: decryptLiveSecret,
    edgePrepare: (input) =>
      invokeYouTubeLiveEdge("youtube_live_internal_prepare", input),
    edgeStatus: (streamId) => invokeYouTubeLiveEdge("youtube_live_internal_status", { stream_id: streamId }),
    edgeTransition: (broadcastId, broadcastStatus) =>
      invokeYouTubeLiveEdge("youtube_live_internal_transition", {
        broadcast_id: broadcastId,
        broadcast_status: broadcastStatus,
      }),
    spawnFfmpeg: (args) => {
      const child = spawn("ffmpeg", args, { detached: true, stdio: ["ignore", "ignore", "pipe"] });
      child.stderr?.on("data", () => undefined);
      child.unref();
      const pid = child.pid || 0;
      if (!pid) throw new Error("Could not start the live encoder.");
      return { pid };
    },
    pidAlive: (pid) => {
      if (!pid) return false;
      try {
        process.kill(pid, 0);
        return true;
      } catch {
        return false;
      }
    },
    killPid: (pid) => {
      if (!pid) return;
      try {
        process.kill(pid, "SIGINT");
      } catch {
        /* already gone */
      }
      setTimeout(() => {
        try {
          process.kill(pid, "SIGKILL");
        } catch {
          /* already gone */
        }
      }, 4000);
    },
    waitForActiveMs: 90_000,
  };
}

export async function startYoutubeLive(
  input: LiveStartInput,
  runtime: YoutubeLiveRuntime = defaultYoutubeLiveRuntime(),
): Promise<PublicYoutubeLiveSession> {
  const libraryAssetId = String(input.libraryAssetId || "").trim();
  if (!libraryAssetId) throw Object.assign(new Error("library_asset_id is required."), { status: 400 });
  const hours = assertLiveDurationHours(input.durationHours ?? 11);
  const existingLock = startLocks.get(libraryAssetId);
  if (existingLock) return existingLock;
  const pending = startYoutubeLiveLocked(input, hours, runtime).finally(() => {
    startLocks.delete(libraryAssetId);
  });
  startLocks.set(libraryAssetId, pending);
  return pending;
}

async function startYoutubeLiveLocked(
  input: LiveStartInput,
  hours: LiveDurationHours,
  runtime: YoutubeLiveRuntime,
): Promise<PublicYoutubeLiveSession> {
  const libraryAssetId = String(input.libraryAssetId || "").trim();
  const active = await runtime.listActive();
  const existing = assertConcurrentCapacity(active, libraryAssetId);
  if (existing) return publicOrThrow(existing);

  const source = await runtime.resolveSource({
    libraryAssetId,
    productionId: input.productionId,
  });
  const copy = youtubeRtmpCopySafe(source.probe);
  const startedAtMs = runtime.now();
  const row = await runtime.insert({
    id: randomUUID(),
    library_asset_id: source.libraryAssetId,
    production_id: source.productionId,
    status: "preparing",
    title: String(input.title || source.title || "TDG Live").slice(0, 100),
    description: String(input.description || "").slice(0, 5000),
    privacy_status: input.privacyStatus || "private",
    made_for_kids: input.madeForKids === true,
    duration_hours: hours,
    started_at: new Date(startedAtMs).toISOString(),
    planned_end_at: plannedEndAtIso(startedAtMs, hours),
    source_copy: copy,
    last_error: null,
  });

  if (!runtime.allowNetwork) {
    await runtime.patch(String(row.id), {
      status: "failed",
      last_error: "Live start is disabled in this environment. No YouTube broadcast was created.",
      ended_at: new Date(runtime.now()).toISOString(),
    });
    throw Object.assign(new Error("YouTube Live start is disabled here. No broadcast was created."), { status: 409 });
  }

  const prepared = await runtime.edgePrepare({
    title: String(row.title),
    description: String(row.description || ""),
    privacy_status: String(row.privacy_status || "private"),
    made_for_kids: row.made_for_kids === true,
  });
  if (!prepared.ok || !prepared.ingestion || !prepared.broadcastId || !prepared.streamId) {
    const failed = await runtime.patch(String(row.id), {
      status: "failed",
      last_error: redactIngestion(prepared.error || "YouTube Live prepare failed."),
      ended_at: new Date(runtime.now()).toISOString(),
    });
    throw Object.assign(new Error(String(failed.last_error || prepared.error || "YouTube Live prepare failed.")), {
      status: 409,
    });
  }

  const ingestUrl = prepared.ingestion.ingestUrl;
  await runtime.patch(String(row.id), {
    youtube_broadcast_id: prepared.broadcastId,
    youtube_stream_id: prepared.streamId,
    youtube_video_id: prepared.videoId || prepared.broadcastId,
    youtube_url: youtubeWatchUrl(prepared.videoId || prepared.broadcastId),
    ingestion_ciphertext: runtime.encrypt(JSON.stringify(prepared.ingestion)),
    status: "waiting_for_ingest",
  });

  const args = buildFfmpegLiveArgs({ sourcePath: source.path, ingestUrl, copy });
  const spawned = runtime.spawnFfmpeg(args);
  await runtime.patch(String(row.id), { ffmpeg_pid: spawned.pid });

  const pollEveryMs = Math.min(2000, Math.max(1, runtime.waitForActiveMs));
  let waited = 0;
  let streamStatus = "";
  while (waited <= runtime.waitForActiveMs) {
    const liveRow = await runtime.get(String(row.id));
    if (!liveRow || String(liveRow.status) === "stopping") break;
    const status = await runtime.edgeStatus(prepared.streamId);
    streamStatus = String(status.streamStatus || "");
    if (streamStatus === "active") break;
    await new Promise((resolve) => setTimeout(resolve, pollEveryMs));
    waited += pollEveryMs;
  }
  if (streamStatus !== "active") {
    runtime.killPid(spawned.pid);
    await runtime.edgeTransition(prepared.broadcastId, "complete").catch(() => undefined);
    const failed = await runtime.patch(String(row.id), {
      status: "failed",
      last_error: redactIngestion(`YouTube ingest did not become active (${streamStatus || "unknown"}).`),
      ended_at: new Date(runtime.now()).toISOString(),
      ffmpeg_pid: null,
    });
    throw Object.assign(new Error(String(failed.last_error)), { status: 409 });
  }

  const live = await runtime.edgeTransition(prepared.broadcastId, "live");
  if (!live.ok) {
    runtime.killPid(spawned.pid);
    await runtime.edgeTransition(prepared.broadcastId, "complete").catch(() => undefined);
    const failed = await runtime.patch(String(row.id), {
      status: "failed",
      last_error: redactIngestion(live.error || "Could not transition the YouTube broadcast to live."),
      ended_at: new Date(runtime.now()).toISOString(),
      ffmpeg_pid: null,
    });
    throw Object.assign(new Error(String(failed.last_error)), { status: 409 });
  }

  const next = await runtime.patch(String(row.id), { status: "live" });
  return publicOrThrow(next);
}

export async function stopYoutubeLive(
  sessionId: string,
  runtime: YoutubeLiveRuntime = defaultYoutubeLiveRuntime(),
): Promise<PublicYoutubeLiveSession> {
  const row = await runtime.get(sessionId);
  if (!row) throw Object.assign(new Error("Live session not found."), { status: 404 });
  if (!isActiveLiveStatus(String(row.status)) && String(row.status) !== "live") {
    return publicOrThrow(row);
  }
  await runtime.patch(sessionId, { status: "stopping" });
  const pid = Number(row.ffmpeg_pid || 0);
  if (pid) runtime.killPid(pid);
  const broadcastId = String(row.youtube_broadcast_id || "");
  if (broadcastId && runtime.allowNetwork) {
    await runtime.edgeTransition(broadcastId, "complete").catch(async (error) => {
      await runtime.patch(sessionId, {
        last_error: redactIngestion(error instanceof Error ? error.message : "complete_failed"),
      });
    });
  }
  const next = await runtime.patch(sessionId, {
    status: "completed",
    ended_at: new Date(runtime.now()).toISOString(),
    ffmpeg_pid: null,
    youtube_url: youtubeWatchUrl(String(row.youtube_video_id || row.youtube_broadcast_id || "")) || row.youtube_url,
  });
  return publicOrThrow(next);
}

export async function tickYoutubeLive(runtime: YoutubeLiveRuntime = defaultYoutubeLiveRuntime()): Promise<{
  checked: number;
  stopped: number;
  failed: number;
}> {
  const active = await runtime.listActive();
  let stopped = 0;
  let failed = 0;
  for (const row of active) {
    const id = String(row.id);
    const pid = Number(row.ffmpeg_pid || 0);
    const planned = row.planned_end_at ? Date.parse(String(row.planned_end_at)) : 0;
    if (planned && runtime.now() >= planned) {
      await stopYoutubeLive(id, runtime);
      stopped += 1;
      continue;
    }
    if (pid && !runtime.pidAlive(pid)) {
      const broadcastId = String(row.youtube_broadcast_id || "");
      if (broadcastId && runtime.allowNetwork) {
        await runtime.edgeTransition(broadcastId, "complete").catch(() => undefined);
      }
      await runtime.patch(id, {
        status: "failed",
        last_error: "The live encoder stopped unexpectedly.",
        ended_at: new Date(runtime.now()).toISOString(),
        ffmpeg_pid: null,
      });
      failed += 1;
    }
  }
  return { checked: active.length, stopped, failed };
}

export async function youtubeLiveReadiness(runtime: YoutubeLiveRuntime = defaultYoutubeLiveRuntime()) {
  const active = await runtime.listActive().catch(() => []);
  let probe: Record<string, unknown> = { ok: false, error: "not_checked" };
  if (runtime.allowNetwork) {
    try {
      probe = await invokeYouTubeLiveEdge("youtube_live_internal_probe");
    } catch (error) {
      probe = { ok: false, error: error instanceof Error ? error.message : "probe_failed" };
    }
  } else {
    probe = { ok: false, error: "live_network_disabled" };
  }
  return {
    maxConcurrent: Number(process.env.YOUTUBE_LIVE_MAX_CONCURRENT || 1),
    activeCount: active.length,
    conflict: active.length >= 1,
    probe,
  };
}

export { listLiveSessions, publicLiveSession };
