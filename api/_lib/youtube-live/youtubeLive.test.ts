import { describe, expect, it } from "vitest";

import {
  assertLiveDurationHours,
  hasIngestionLeak,
  plannedEndAtIso,
  publicLiveSession,
  youtubeLiveMaxConcurrent,
} from "../../../src/features/youtube-live/policy";
import { buildFfmpegLiveArgs, ffmpegLiveSummary, youtubeRtmpCopySafe } from "./ffmpegLoop";
import { originLiveNetworkEnabled, startYoutubeLive, stopYoutubeLive, tickYoutubeLive } from "./worker";
import type { YoutubeLiveRuntime } from "./worker";
import { preferRtmpsIngestUrl } from "../../../supabase/functions/_shared/social/youtubeLive";
import { REQUIRED_YOUTUBE_LIVE_SCOPES, REQUIRED_YOUTUBE_SCOPES, diffYouTubeLiveScopes } from "../../../src/features/social-publisher/youtube";

function memoryRuntime(): YoutubeLiveRuntime & { rows: Record<string, Record<string, unknown>>; edgeCalls: string[] } {
  const rows: Record<string, Record<string, unknown>> = {};
  const edgeCalls: string[] = [];
  const runtime: YoutubeLiveRuntime & { rows: Record<string, Record<string, unknown>>; edgeCalls: string[] } = {
    rows,
    edgeCalls,
    now: () => Date.parse("2026-09-25T12:00:00.000Z"),
    allowNetwork: true,
    resolveSource: async () => ({
      libraryAssetId: "asset-1",
      productionId: "prod-1",
      title: "Cozy hour",
      path: "/data/long-form/productions/prod-1/video.mp4",
      probe: {
        duration: 3600,
        width: 1920,
        height: 1080,
        fps: 30,
        hasAudio: true,
        videoCodec: "h264",
        audioCodec: "aac",
        fileSize: 100,
        orientation: "landscape",
      },
    }),
    insert: async (row) => {
      const active = Object.values(rows).filter((item) =>
        ["preparing", "waiting_for_ingest", "live", "stopping"].includes(String(item.status)),
      );
      if (active[0]) return active[0];
      rows[String(row.id)] = { ...row };
      return rows[String(row.id)];
    },
    patch: async (id, patch) => {
      rows[id] = { ...rows[id], ...patch };
      return rows[id];
    },
    get: async (id) => rows[id] || null,
    listActive: async () =>
      Object.values(rows).filter((item) =>
        ["preparing", "waiting_for_ingest", "live", "stopping"].includes(String(item.status)),
      ),
    encrypt: (value) => `enc:${value}`,
    decrypt: (value) => (value ? String(value).replace(/^enc:/, "") : null),
    edgePrepare: async () => {
      edgeCalls.push("prepare");
      return {
        ok: true,
        broadcastId: "b1",
        streamId: "s1",
        videoId: "b1",
        ingestion: {
          ingestUrl: "rtmps://a.rtmps.youtube.com/live2/SECRETKEY",
          streamName: "SECRETKEY",
        },
      };
    },
    edgeStatus: async () => {
      edgeCalls.push("status");
      return { ok: true, streamStatus: "active" };
    },
    edgeTransition: async (_id, status) => {
      edgeCalls.push(`transition:${status}`);
      return { ok: true };
    },
    spawnFfmpeg: () => {
      edgeCalls.push("ffmpeg");
      return { pid: 4242 };
    },
    pidAlive: (pid) => pid === 4242,
    killPid: () => {
      edgeCalls.push("kill");
    },
    waitForActiveMs: 1,
  };
  return runtime;
}

describe("YouTube Live policy", () => {
  it("keeps the hard limit under 12 hours and defaults to 11", () => {
    expect(assertLiveDurationHours(11)).toBe(11);
    expect(assertLiveDurationHours(3)).toBe(3);
    expect(() => assertLiveDurationHours(12)).toThrow(/under 12/);
    expect(() => assertLiveDurationHours(24)).toThrow(/under 12/);
    const end = plannedEndAtIso(Date.parse("2026-09-25T00:00:00.000Z"), 11);
    expect(Date.parse(end) - Date.parse("2026-09-25T00:00:00.000Z")).toBe(11 * 3600 * 1000);
    expect(youtubeLiveMaxConcurrent("1")).toBe(1);
    expect(youtubeLiveMaxConcurrent("9")).toBe(4);
  });

  it("never puts the stream key on a public session", () => {
    const pub = publicLiveSession({
      id: "sess-1",
      library_asset_id: "asset-1",
      production_id: "prod-1",
      youtube_broadcast_id: "b1",
      youtube_stream_id: "s1",
      youtube_video_id: "b1",
      youtube_url: "https://www.youtube.com/watch?v=b1",
      status: "live",
      title: "Live",
      description: "",
      privacy_status: "private",
      made_for_kids: false,
      duration_hours: 11,
      started_at: "2026-09-25T12:00:00.000Z",
      planned_end_at: "2026-09-25T23:00:00.000Z",
      ended_at: null,
      last_error: null,
      source_copy: true,
      created_at: "2026-09-25T12:00:00.000Z",
      updated_at: "2026-09-25T12:00:00.000Z",
      ingestion_ciphertext: "enc-secret",
      ffmpeg_pid: 9,
      streamName: "SECRETKEY",
    });
    expect(pub).toBeTruthy();
    expect(JSON.stringify(pub)).not.toMatch(/SECRETKEY|ingestion|rtmps|ffmpeg_pid|streamName/);
    expect(hasIngestionLeak(pub)).toBe(false);
  });

  it("prefers RTMPS and loops with FFmpeg stream_loop", () => {
    expect(preferRtmpsIngestUrl("rtmp://a.rtmp.youtube.com/live2", "KEY")).toBe(
      "rtmps://a.rtmps.youtube.com/live2/KEY",
    );
    const args = buildFfmpegLiveArgs({
      sourcePath: "/data/long-form/a.mp4",
      ingestUrl: "rtmps://a.rtmps.youtube.com/live2/KEY",
      copy: true,
    });
    expect(args).toContain("-stream_loop");
    expect(args).toContain("-1");
    expect(args).toContain("-re");
    expect(ffmpegLiveSummary(args).join(" ")).not.toContain("KEY");
    expect(
      youtubeRtmpCopySafe({
        duration: 60,
        width: 1920,
        height: 1080,
        fps: 30,
        hasAudio: true,
        videoCodec: "h264",
        audioCodec: "aac",
        fileSize: 1,
        orientation: "landscape",
      }),
    ).toBe(true);
  });

  it("requires the Live OAuth scope", () => {
    expect(REQUIRED_YOUTUBE_SCOPES).toContain("https://www.googleapis.com/auth/youtube.force-ssl");
    expect(REQUIRED_YOUTUBE_LIVE_SCOPES[0]).toContain("youtube.force-ssl");
    expect(diffYouTubeLiveScopes(["https://www.googleapis.com/auth/youtube.upload"]).missing.length).toBe(1);
    expect(
      diffYouTubeLiveScopes([
        "https://www.googleapis.com/auth/youtube.upload",
        "https://www.googleapis.com/auth/youtube.force-ssl",
      ]).missing,
    ).toEqual([]);
  });
});

describe("YouTube Live worker", () => {
  it("does not start a real live from tests", () => {
    expect(originLiveNetworkEnabled()).toBe(false);
    expect(process.env.VITEST).toBe("true");
  });

  it("treats a double start as idempotent and does not create two broadcasts", async () => {
    const runtime = memoryRuntime();
    const first = await startYoutubeLive({ libraryAssetId: "asset-1", durationHours: 3 }, runtime);
    const second = await startYoutubeLive({ libraryAssetId: "asset-1", durationHours: 3 }, runtime);
    expect(first.id).toBe(second.id);
    expect(runtime.edgeCalls.filter((item) => item === "prepare")).toHaveLength(1);
    expect(JSON.stringify(first)).not.toContain("SECRETKEY");
    expect(first.status).toBe("live");
  });

  it("stops by completing the broadcast", async () => {
    const runtime = memoryRuntime();
    const live = await startYoutubeLive({ libraryAssetId: "asset-1", durationHours: 6 }, runtime);
    const stopped = await stopYoutubeLive(live.id, runtime);
    expect(stopped.status).toBe("completed");
    expect(runtime.edgeCalls).toContain("transition:complete");
    expect(runtime.edgeCalls).toContain("kill");
  });

  it("marks a worker crash as failed and attempts YouTube completion", async () => {
    const runtime = memoryRuntime();
    const live = await startYoutubeLive({ libraryAssetId: "asset-1", durationHours: 3 }, runtime);
    runtime.pidAlive = () => false;
    const result = await tickYoutubeLive(runtime);
    expect(result.failed).toBe(1);
    const row = await runtime.get(live.id);
    expect(row?.status).toBe("failed");
    expect(runtime.edgeCalls).toContain("transition:complete");
  });
});
