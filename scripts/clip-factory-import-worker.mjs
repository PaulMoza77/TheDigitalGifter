#!/usr/bin/env node
/**
 * Outbound Clip Factory importer. Pulls YouTube jobs over HTTPS, downloads with
 * yt-dlp, checks the file with ffprobe/ffmpeg, then uploads to the server-fixed path.
 * The token is read from the macOS Keychain and is never written to logs.
 */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream, promises as fs } from "node:fs";
import { statfs } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const LIMITS = {
  maxDurationSeconds: 7200,
  maxBytes: 2 * 1024 * 1024 * 1024,
  ytdlpTimeoutMs: 90 * 60 * 1000,
  minFreeBytes: 4 * 1024 * 1024 * 1024,
  heartbeatMs: 30 * 1000,
  pollMs: 8 * 1000,
};
const SUPPORT = join(homedir(), "Library/Application Support/TheDigitalGifter");
const CONFIG_PATH = join(SUPPORT, "clip-factory-import.json");
const STATE_PATH = join(SUPPORT, "clip-factory-import-state.json");
const KEYCHAIN_SERVICE = "com.thedigitalgifter.clip-factory-import";
const KEYCHAIN_ACCOUNT = "worker-token";

function log(event, extra = {}) {
  console.log(JSON.stringify({ source: "clip-factory-import", event, ...extra }));
}

async function readConfig() {
  const raw = JSON.parse(await fs.readFile(CONFIG_PATH, "utf8"));
  const apiBase = String(raw.apiBase || "").replace(/\/$/, "");
  const deviceId = String(raw.deviceId || "").trim();
  if (!/^https:\/\//.test(apiBase)) throw new Error("apiBase must be https");
  if (!/^[A-Za-z0-9._-]{1,64}$/.test(deviceId)) throw new Error("deviceId is invalid");
  return {
    apiBase,
    deviceId,
    ytDlp: raw.ytDlp || raw.ytDlpBin || join(SUPPORT, "bin/yt-dlp"),
    ffmpeg: raw.ffmpeg || raw.ffmpegBin || "/opt/homebrew/bin/ffmpeg",
    ffprobe: raw.ffprobe || raw.ffprobeBin || "/opt/homebrew/bin/ffprobe",
  };
}

async function readToken() {
  const { stdout } = await execFileAsync("security", [
    "find-generic-password",
    "-s",
    KEYCHAIN_SERVICE,
    "-a",
    KEYCHAIN_ACCOUNT,
    "-w",
  ]);
  const token = stdout.trim();
  if (token.length < 24) throw new Error("worker token missing");
  return token;
}

async function api(config, token, body) {
  const response = await fetch(`${config.apiBase}/api/clip-factory-import`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ ...body, device_id: config.deviceId }),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(json.message || json.error || `import api ${response.status}`);
    error.code = json.error || "import_failed";
    error.status = response.status;
    throw error;
  }
  return json;
}

function youtubeId(url) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (host === "youtu.be") return parsed.pathname.replace(/^\//, "").split("/")[0];
    const id = parsed.searchParams.get("v") || "";
    return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : "";
  } catch {
    return "";
  }
}

function run(bin, args, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      const error = new Error(`${bin} timed out`);
      error.code = "network";
      reject(error);
    }, timeoutMs);
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
      if (stdout.length > 200_000) stdout = stdout.slice(-100_000);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
      if (stderr.length > 80_000) stderr = stderr.slice(-40_000);
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}

async function freeBytes(path) {
  const info = await statfs(dirname(path));
  return Number(info.bavail) * Number(info.bsize);
}

function classifyYtdlp(text) {
  if (/sign in to confirm|not a bot|cookies-from-browser/i.test(text)) return "bot_check";
  if (/private video|login_required/i.test(text)) return "video_private";
  if (/video unavailable|removed|copyright/i.test(text)) return "video_unavailable";
  return "import_unavailable";
}

async function sha256File(path) {
  const hash = createHash("sha256");
  await pipeline(createReadStream(path), hash);
  return hash.digest("hex");
}

async function probeFile(ffprobe, ffmpeg, path) {
  const listed = await run(ffprobe, ["-v", "error", "-show_streams", "-show_format", "-of", "json", path], 60_000);
  if (listed.code !== 0) {
    const error = new Error("ffprobe failed");
    error.code = "corrupt_file";
    throw error;
  }
  const parsed = JSON.parse(listed.stdout || "{}");
  const streams = Array.isArray(parsed.streams) ? parsed.streams : [];
  const video = streams.find((stream) => stream.codec_type === "video");
  const audio = streams.find((stream) => stream.codec_type === "audio");
  const duration = Number(parsed.format?.duration || video?.duration || 0);
  const size = Number(parsed.format?.size || 0);
  if (!video || !duration) {
    const error = new Error("no video stream");
    error.code = "corrupt_file";
    throw error;
  }
  const decoded = await run(
    ffmpeg,
    ["-hide_banner", "-nostdin", "-v", "error", "-xerror", "-ss", "1", "-t", "2", "-i", path, "-map", "0:v:0", "-f", "null", "-"],
    120_000,
  );
  if (decoded.code !== 0) {
    const error = new Error("video decode failed");
    error.code = "corrupt_file";
    throw error;
  }
  if (audio) {
    const audioDecoded = await run(
      ffmpeg,
      ["-hide_banner", "-nostdin", "-v", "error", "-xerror", "-ss", "1", "-t", "2", "-i", path, "-map", "0:a:0", "-f", "null", "-"],
      120_000,
    );
    if (audioDecoded.code !== 0) {
      const error = new Error("audio decode failed");
      error.code = "corrupt_file";
      throw error;
    }
  }
  return {
    duration,
    width: Number(video.width || 0),
    height: Number(video.height || 0),
    fps: String(video.avg_frame_rate || ""),
    videoCodec: video.codec_name || "",
    audioCodec: audio?.codec_name || "",
    hasAudio: Boolean(audio),
    size,
  };
}

async function downloadYoutube(config, url, dest, heartbeat) {
  const id = youtubeId(url);
  if (!id) {
    const error = new Error("missing video id");
    error.code = "invalid_url";
    throw error;
  }
  const watch = `https://www.youtube.com/watch?v=${id}`;
  const timer = setInterval(() => {
    void heartbeat().catch(() => undefined);
  }, LIMITS.heartbeatMs);
  try {
    const result = await run(
      config.ytDlp,
      [
        "--no-playlist",
        "--no-warnings",
        "--newline",
        "--no-mtime",
        "--no-progress",
        "-f",
        "bv*[height<=1080]+ba/b[height<=1080]/b",
        "--merge-output-format",
        "mp4",
        "-o",
        dest,
        "--force-overwrites",
        watch,
      ],
      LIMITS.ytdlpTimeoutMs,
    );
    if (result.code !== 0) {
      const error = new Error("yt-dlp failed");
      error.code = classifyYtdlp(`${result.stderr} ${result.stdout}`);
      throw error;
    }
  } finally {
    clearInterval(timer);
  }
}

async function uploadFile(uploadUrl, path, contentType) {
  const stat = await fs.stat(path);
  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "content-type": contentType,
      "content-length": String(stat.size),
    },
    duplex: "half",
    body: Readable.toWeb(createReadStream(path)),
  });
  if (!response.ok) {
    const error = new Error(`upload failed ${response.status}`);
    error.code = "network";
    throw error;
  }
  return stat.size;
}

async function saveState(state) {
  await fs.mkdir(SUPPORT, { recursive: true });
  await fs.writeFile(STATE_PATH, JSON.stringify(state), { mode: 0o600 });
}

async function clearState() {
  await fs.rm(STATE_PATH, { force: true });
}

async function removeWork(dir) {
  if (dir) await fs.rm(dir, { recursive: true, force: true });
}

let busy = false;

async function processJob(config, token, job) {
  const workDir = join(tmpdir(), `tdg-import-${job.id}`);
  await fs.mkdir(workDir, { recursive: true });
  const dest = join(workDir, "source.mp4");
  await saveState({ jobId: job.id, attemptId: job.attempt_id, url: job.url, workDir, phase: "download" });
  const heartbeat = () => api(config, token, { action: "heartbeat", job_id: job.id, attempt_id: job.attempt_id });
  try {
    const free = await freeBytes(dest);
    if (free < LIMITS.minFreeBytes) {
      const error = new Error("low disk");
      error.code = "network";
      throw error;
    }
    await downloadYoutube(config, job.url, dest, heartbeat);
    await heartbeat();
    const stat = await fs.stat(dest);
    if (stat.size <= 0 || stat.size > LIMITS.maxBytes) {
      const error = new Error("size");
      error.code = "huge_file";
      throw error;
    }
    const probed = await probeFile(config.ffprobe, config.ffmpeg, dest);
    if (probed.duration > LIMITS.maxDurationSeconds) {
      const error = new Error("duration");
      error.code = "duration_exceeded";
      throw error;
    }
    const sha256 = await sha256File(dest);
    await saveState({ jobId: job.id, attemptId: job.attempt_id, url: job.url, workDir, phase: "upload" });
    const upload = await api(config, token, { action: "upload_url", job_id: job.id, attempt_id: job.attempt_id });
    await uploadFile(upload.uploadUrl, dest, upload.contentType || "video/mp4");
    await api(config, token, {
      action: "complete",
      job_id: job.id,
      attempt_id: job.attempt_id,
      bytes: stat.size,
      sha256,
      duration_seconds: probed.duration,
      width: probed.width,
      height: probed.height,
      fps: probed.fps,
      video_codec: probed.videoCodec,
      audio_codec: probed.audioCodec,
      has_audio: probed.hasAudio,
    });
    await removeWork(workDir);
    await clearState();
    log("import_completed", { job_id: job.id, bytes: stat.size, duration_seconds: Math.round(probed.duration) });
  } catch (error) {
    const code = error.code || "import_unavailable";
    log("import_failed", { job_id: job.id, code });
    if (error.status !== 409 && code !== "claim_mismatch" && code !== "lease_expired") {
      await api(config, token, { action: "fail", job_id: job.id, attempt_id: job.attempt_id, code }).catch(() => undefined);
    }
    await removeWork(workDir);
    await clearState();
  }
}

async function tick() {
  if (busy) return;
  busy = true;
  try {
    const config = await readConfig();
    const token = await readToken();
    await api(config, token, { action: "presence" });
    let state = null;
    try {
      state = JSON.parse(await fs.readFile(STATE_PATH, "utf8"));
    } catch {
      state = null;
    }
    if (state?.jobId && state.attemptId && state.url) {
      try {
        await api(config, token, { action: "heartbeat", job_id: state.jobId, attempt_id: state.attemptId });
        await processJob(config, token, { id: state.jobId, attempt_id: state.attemptId, url: state.url });
        return;
      } catch {
        await clearState();
      }
    }
    const claimed = await api(config, token, { action: "claim" });
    if (!claimed.job) return;
    log("claimed", { job_id: claimed.job.id, attempt: claimed.job.attempt_count });
    await processJob(config, token, claimed.job);
  } catch (error) {
    log("tick_error", { message: error instanceof Error ? error.message.slice(0, 180) : "error" });
  } finally {
    busy = false;
  }
}

async function main() {
  log("worker_started", { concurrency: 1 });
  await tick();
  setInterval(() => {
    void tick();
  }, LIMITS.pollMs);
}

main().catch((error) => {
  log("worker_exit", { message: error instanceof Error ? error.message.slice(0, 180) : "error" });
  process.exit(1);
});
