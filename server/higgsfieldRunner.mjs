import { spawnSync } from "node:child_process";
import { higgsfieldMockEnabled, readHiggsfieldCredentials } from "../api/_lib/higgsfield/client.ts";

export const runnerState = {
  enabled: false,
  lastStartedAt: null,
  lastFinishedAt: null,
  lastError: null,
  lastSynced: 0,
  lastJobErrors: 0,
  ticks: 0,
  ffmpeg: false,
  ffprobe: false,
  credentialsConfigured: false,
  mock: false,
};

function toolExists(name) {
  const result = spawnSync(name, ["-version"], { encoding: "utf8" });
  return result.status === 0;
}

function credentialsConfigured() {
  try {
    readHiggsfieldCredentials(process.env);
    return true;
  } catch {
    return false;
  }
}

export function snapshotRunner() {
  return {
    ...runnerState,
    ffmpeg: toolExists("ffmpeg"),
    ffprobe: toolExists("ffprobe"),
    credentialsConfigured: credentialsConfigured(),
    mock: higgsfieldMockEnabled(process.env),
    periodicResume: runnerState.enabled,
    note: "Vercel cron existence is not this runner. This process loop is the VPS resume mechanism.",
  };
}

export function startHiggsfieldRunner() {
  if (String(process.env.TDG_HIGGSFIELD_RUNNER || "1").trim() === "0") {
    runnerState.enabled = false;
    return;
  }
  runnerState.enabled = true;
  const intervalMs = Number(process.env.TDG_HIGGSFIELD_POLL_MS || 120000);
  const tick = async () => {
    runnerState.lastStartedAt = new Date().toISOString();
    try {
      const { getServiceClient } = await import("../api/_lib/christmas/supabaseClient.ts");
      const { syncOpenJobs } = await import("../api/_lib/higgsfield/jobs.ts");
      const result = await syncOpenJobs(getServiceClient());
      runnerState.lastSynced = result.synced;
      runnerState.lastJobErrors = result.errors.length;
      runnerState.lastError = result.errors[0]?.message || null;
      runnerState.ticks += 1;
    } catch (error) {
      runnerState.lastError = error instanceof Error ? error.message.slice(0, 240) : "runner_failed";
    } finally {
      runnerState.lastFinishedAt = new Date().toISOString();
    }
  };
  void tick();
  setInterval(() => {
    void tick();
  }, Number.isFinite(intervalMs) && intervalMs >= 15000 ? intervalMs : 120000);
}
