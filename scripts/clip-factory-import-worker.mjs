#!/usr/bin/env node
/**
 * Outbound Clip Factory importer. Pulls YouTube jobs over HTTPS, downloads with
 * yt-dlp, checks the file with ffprobe/ffmpeg, then streams it to the VPS disk.
 * A validated file in clip-cache is reused. It is not deleted when an upload fails.
 * Confirmed caches are kept for 72 hours so another job for the same video can reuse them,
 * then removed on a later start. The token is read from the macOS Keychain and is never logged.
 */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream, promises as fs } from "node:fs";
import { statfs } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
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
  chunkBytes: 4 * 1024 * 1024,
  cacheRetentionMs: 72 * 60 * 60 * 1000,
};
const SUPPORT = join(homedir(), "Library/Application Support/TheDigitalGifter");
const CONFIG_PATH = join(SUPPORT, "clip-factory-import.json");
const CACHE_ROOT = join(SUPPORT, "clip-cache");
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
    onlyJobId: /^[0-9a-f-]{36}$/i.test(String(raw.onlyJobId || "")) ? String(raw.onlyJobId) : "",
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
        "--ffmpeg-location",
        dirname(config.ffmpeg),
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
    try {
      await fs.stat(dest);
    } catch {
      const error = new Error("yt-dlp produced no file");
      error.code = "import_unavailable";
      throw error;
    }
  } finally {
    clearInterval(timer);
  }
}

async function saveState(state) {
  await fs.mkdir(SUPPORT, { recursive: true });
  const tmp = `${STATE_PATH}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(state), { mode: 0o600 });
  await fs.rename(tmp, STATE_PATH);
}

async function clearState() {
  await fs.rm(STATE_PATH, { force: true });
}

async function writeJsonAtomic(path, value) {
  const tmp = `${path}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(value), { mode: 0o600 });
  await fs.rename(tmp, path);
}

async function pruneCache() {
  let names = [];
  try {
    names = await fs.readdir(CACHE_ROOT);
  } catch {
    return;
  }
  const cutoff = Date.now() - LIMITS.cacheRetentionMs;
  for (const name of names) {
    const metaPath = join(CACHE_ROOT, name, "meta.json");
    try {
      const meta = JSON.parse(await fs.readFile(metaPath, "utf8"));
      const stamp = Date.parse(meta.completedAt || meta.validatedAt || "");
      if (Number.isFinite(stamp) && stamp < cutoff) await fs.rm(join(CACHE_ROOT, name), { recursive: true, force: true });
    } catch {
      /* keep an unreadable cache entry until the next successful validation */
    }
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureSource(config, url, heartbeat) {
  const id = youtubeId(url);
  if (!id) {
    const error = new Error("missing video id");
    error.code = "invalid_url";
    throw error;
  }
  const dir = join(CACHE_ROOT, id);
  await fs.mkdir(dir, { recursive: true });
  const dest = join(dir, "source.mp4");
  const metaPath = join(dir, "meta.json");
  let meta = null;
  try {
    meta = JSON.parse(await fs.readFile(metaPath, "utf8"));
  } catch {
    meta = null;
  }
  let size = 0;
  try {
    size = (await fs.stat(dest)).size;
  } catch {
    size = 0;
  }
  if (size > 0 && size <= LIMITS.maxBytes) {
    try {
      if (!(meta?.validated && meta.sha256 && meta.bytes === size)) {
        const probed = await probeFile(config.ffprobe, config.ffmpeg, dest);
        await heartbeat();
        if (probed.duration > LIMITS.maxDurationSeconds) {
          const error = new Error("duration");
          error.code = "duration_exceeded";
          throw error;
        }
        const sha256 = await sha256File(dest);
        await heartbeat();
        meta = {
          validated: true,
          bytes: size,
          sha256,
          duration: probed.duration,
          width: probed.width,
          height: probed.height,
          fps: probed.fps,
          videoCodec: probed.videoCodec,
          audioCodec: probed.audioCodec,
          hasAudio: probed.hasAudio,
          validatedAt: new Date().toISOString(),
        };
        await writeJsonAtomic(metaPath, meta);
      }
      log("cache_reused", { bytes: size });
      return { dest, meta };
    } catch (error) {
      if (error.code === "duration_exceeded") throw error;
      await fs.rm(dest, { force: true });
      await fs.rm(metaPath, { force: true });
    }
  }
  const part = join(dir, "download.mp4");
  const free = await freeBytes(part);
  if (free < LIMITS.minFreeBytes) {
    const error = new Error("low disk");
    error.code = "network";
    throw error;
  }
  await downloadYoutube(config, url, part, heartbeat);
  await heartbeat();
  const stat = await fs.stat(part);
  if (stat.size <= 0 || stat.size > LIMITS.maxBytes) {
    await fs.rm(part, { force: true });
    const error = new Error("size");
    error.code = "huge_file";
    throw error;
  }
  await fs.rename(part, dest);
  const probed = await probeFile(config.ffprobe, config.ffmpeg, dest);
  await heartbeat();
  if (probed.duration > LIMITS.maxDurationSeconds) {
    const error = new Error("duration");
    error.code = "duration_exceeded";
    throw error;
  }
  const sha256 = await sha256File(dest);
  await heartbeat();
  const validated = await fs.stat(dest);
  meta = {
    validated: true,
    bytes: validated.size,
    sha256,
    duration: probed.duration,
    width: probed.width,
    height: probed.height,
    fps: probed.fps,
    videoCodec: probed.videoCodec,
    audioCodec: probed.audioCodec,
    hasAudio: probed.hasAudio,
    validatedAt: new Date().toISOString(),
  };
  await writeJsonAtomic(metaPath, meta);
  return { dest, meta };
}

async function putChunk(config, token, job, offset, total, body) {
  const response = await fetch(`${config.apiBase}/api/clip-factory-import-bytes`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "content-type": "application/octet-stream",
      "x-device-id": config.deviceId,
      "x-job-id": job.id,
      "x-attempt-id": job.attempt_id,
      "x-offset": String(offset),
      "x-total-bytes": String(total),
    },
    body,
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(json.message || `chunk ${response.status}`);
    error.code = json.error || "network";
    error.status = response.status;
    error.receivedBytes = Number(json.receivedBytes);
    throw error;
  }
  return json;
}

async function transferSource(config, token, job, file, meta, heartbeat) {
  const total = meta.bytes;
  const status = await api(config, token, {
    action: "transfer_status",
    job_id: job.id,
    attempt_id: job.attempt_id,
    total_bytes: total,
    sha256: meta.sha256,
  });
  if (status.reuse || status.already) return;
  let offset = Number(status.receivedBytes) || 0;
  const handle = await fs.open(file, "r");
  try {
    while (offset < total) {
      await heartbeat();
      const length = Math.min(LIMITS.chunkBytes, total - offset);
      const buf = Buffer.alloc(length);
      await handle.read(buf, 0, length, offset);
      let sent = false;
      for (let attempt = 0; attempt < 4 && !sent; attempt += 1) {
        try {
          const result = await putChunk(config, token, job, offset, total, buf);
          offset = Number(result.receivedBytes);
          sent = true;
        } catch (error) {
          if (error.status === 409 && error.code === "offset_mismatch" && Number.isFinite(error.receivedBytes) && error.receivedBytes < offset) {
            offset = error.receivedBytes;
            continue;
          }
          if (error.status === 409 || error.code === "claim_mismatch" || error.code === "lease_expired" || error.code === "huge_file") throw error;
          if (attempt === 3) throw error;
          await sleep(2000 * 2 ** attempt);
        }
      }
    }
  } finally {
    await handle.close();
  }
}

let busy = false;

async function processJob(config, token, job) {
  const heartbeat = () => api(config, token, { action: "heartbeat", job_id: job.id, attempt_id: job.attempt_id });
  const beat = setInterval(() => {
    void heartbeat().catch(() => undefined);
  }, LIMITS.heartbeatMs);
  let validated = false;
  try {
    await saveState({ jobId: job.id, attemptId: job.attempt_id, url: job.url, phase: "download" });
    const source = await ensureSource(config, job.url, heartbeat);
    validated = true;
    await saveState({ jobId: job.id, attemptId: job.attempt_id, url: job.url, phase: "validated", sha256: source.meta.sha256, bytes: source.meta.bytes });
    await heartbeat();
    await saveState({ jobId: job.id, attemptId: job.attempt_id, url: job.url, phase: "uploading", sha256: source.meta.sha256, bytes: source.meta.bytes });
    await transferSource(config, token, job, source.dest, source.meta, heartbeat);
    await heartbeat();
    await saveState({ jobId: job.id, attemptId: job.attempt_id, url: job.url, phase: "uploaded", sha256: source.meta.sha256, bytes: source.meta.bytes });
    await api(config, token, {
      action: "finalize",
      job_id: job.id,
      attempt_id: job.attempt_id,
      bytes: source.meta.bytes,
      sha256: source.meta.sha256,
    });
    source.meta.completedAt = new Date().toISOString();
    await writeJsonAtomic(join(CACHE_ROOT, youtubeId(job.url), "meta.json"), source.meta);
    await saveState({ jobId: job.id, attemptId: job.attempt_id, url: job.url, phase: "completed" });
    await clearState();
    log("import_completed", { job_id: job.id, bytes: source.meta.bytes, duration_seconds: Math.round(source.meta.duration || 0) });
  } catch (error) {
    const code = error.code || "import_unavailable";
    log("import_failed", { job_id: job.id, code });
    const lost = error.status === 409 || code === "claim_mismatch" || code === "lease_expired";
    if (!lost) {
      await api(config, token, { action: "fail", job_id: job.id, attempt_id: job.attempt_id, code }).catch(() => undefined);
    }
    if (!validated || code === "invalid_url" || code === "video_private" || code === "video_unavailable" || code === "duration_exceeded") {
      const id = youtubeId(job.url);
      if (id && !validated) await fs.rm(join(CACHE_ROOT, id, "download.mp4"), { force: true });
    }
    await clearState();
  } finally {
    clearInterval(beat);
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
    if (state?.jobId && state.attemptId && state.url && state.phase !== "completed") {
      try {
        await api(config, token, { action: "heartbeat", job_id: state.jobId, attempt_id: state.attemptId });
        await processJob(config, token, { id: state.jobId, attempt_id: state.attemptId, url: state.url });
        return;
      } catch {
        await clearState();
      }
    }
    const claimed = await api(config, token, { action: "claim", ...(config.onlyJobId ? { job_id: config.onlyJobId } : {}) });
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
  await pruneCache();
  await tick();
  setInterval(() => {
    void tick();
  }, LIMITS.pollMs);
}

main().catch((error) => {
  log("worker_exit", { message: error instanceof Error ? error.message.slice(0, 180) : "error" });
  process.exit(1);
});
