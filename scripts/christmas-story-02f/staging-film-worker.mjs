#!/usr/bin/env node
/**
 * Mission 02F staging film worker bridge.
 * Claims local jobs, renders via FFmpeg, stores privately (local HMAC store).
 * Optional Supabase upload only when CS_STAGING_SERVICE_ROLE_KEY + CS_STAGING_SUPABASE_URL
 * are explicitly set to an *isolated* staging project (never production defaults).
 *
 * Usage:
 *   node --experimental-strip-types scripts/christmas-story-02f/staging-film-worker.mjs --once
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { randomUUID, createHash } from "node:crypto";
import { LocalJobStore } from "../../server/christmas-story-media/localJobStore.ts";
import { renderMemoryFilm } from "../../server/christmas-story-media/ffmpegFilm.ts";
import { PrivateMediaStore } from "../../server/christmas-story-media/privateStore.ts";
import { buildMediaCostModel } from "../../server/christmas-story-media/costModel.ts";

const root = resolve(process.cwd());
const args = new Set(process.argv.slice(2));
const once = args.has("--once");
const workerId = process.env.CS_FILM_WORKER_ID || `staging-${randomUUID().slice(0, 8)}`;
const storeRoot = resolve(root, process.env.CS_MEDIA_QUEUE_DIR || "artifacts/christmas-story-02f/queue");
const outRoot = resolve(root, process.env.CS_MEDIA_OUT_DIR || "artifacts/christmas-story-02f/out");
const privateRoot = resolve(root, process.env.CS_PRIVATE_STORE_DIR || "artifacts/christmas-story-02f/private-store");
const signingSecret =
  process.env.CS_MEDIA_SIGNING_SECRET || "mission-02f-isolated-signing-secret!!";

mkdirSync(storeRoot, { recursive: true });
mkdirSync(outRoot, { recursive: true });
const jobs = new LocalJobStore(storeRoot);
const privateStore = new PrivateMediaStore(privateRoot, signingSecret);

function scrubLog(obj) {
  const out = { ...obj };
  for (const k of Object.keys(out)) {
    if (/token|email|key|secret|photo|lyric/i.test(k)) delete out[k];
  }
  return out;
}

async function maybeUploadSupabase(orderId, localPath, contentType) {
  const url = process.env.CS_STAGING_SUPABASE_URL || "";
  const key = process.env.CS_STAGING_SERVICE_ROLE_KEY || "";
  const allowRemote = process.env.CS_STAGING_ALLOW_REMOTE === "true";
  if (!allowRemote || !url || !key) {
    return { uploaded: false, reason: "remote_staging_not_configured" };
  }
  // Hard refuse known-production-looking hostnames without explicit allow list.
  if (/thedigitalgifter|prod/i.test(url) && process.env.CS_STAGING_FORCE_HOST !== "true") {
    return { uploaded: false, reason: "refused_suspicious_host" };
  }
  const bytes = readFileSync(localPath);
  const path = `${orderId}/film/${createHash("sha256").update(bytes).digest("hex").slice(0, 16)}.mp4`;
  const endpoint = `${url.replace(/\/$/, "")}/storage/v1/object/christmas-story-generated/${path}`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      apikey: key,
      "Content-Type": contentType,
      "x-upsert": "true",
    },
    body: bytes,
  });
  if (!res.ok) {
    return { uploaded: false, reason: `upload_http_${res.status}` };
  }
  return { uploaded: true, path, bucket: "christmas-story-generated" };
}

async function processOne() {
  const job = jobs.claim(workerId, 180, "film");
  if (!job) return false;
  console.log(JSON.stringify(scrubLog({ event: "claimed", jobId: job.id, orderId: job.orderId, attempt: job.attempts })));
  const beat = setInterval(() => jobs.heartbeat(job.id, workerId, 180), 30_000);
  try {
    const photos = Array.isArray(job.metadata.photos) ? job.metadata.photos.map(String) : [];
    const result = await renderMemoryFilm(
      {
        photos,
        recipientName: String(job.metadata.recipientName || "you"),
        dedication: String(job.metadata.dedication || ""),
        captions: Array.isArray(job.metadata.captions) ? job.metadata.captions.map(String) : [],
        audioPath: job.metadata.audioPath ? String(job.metadata.audioPath) : null,
        aspect: job.metadata.aspect === "portrait" ? "portrait" : "landscape",
        outDir: join(outRoot, job.orderId),
        jobId: job.id,
        template: "warm_cinematic_v2",
      },
      root,
    );
    const bytes = readFileSync(result.mp4Path);
    const relative = `${job.orderId}/film/${job.id}.mp4`;
    privateStore.put(job.orderId, "christmas-story-generated", relative, bytes, "video/mp4");
    const signed = privateStore.sign(
      job.orderId,
      {
        bucket: "christmas-story-generated",
        path: relative,
        contentType: "video/mp4",
        byteSize: bytes.length,
      },
      "worker",
      120,
    );
    const remote = await maybeUploadSupabase(job.orderId, result.mp4Path, "video/mp4");
    const cost = buildMediaCostModel(result);
    jobs.complete(job.id, workerId, {
      outputChecksum: result.checksumSha256,
      resultAssetPath: relative,
      metadata: {
        posterPath: result.posterPath,
        previewMp4Path: result.previewMp4Path,
        durationSec: result.durationSec,
        privatePath: relative,
        signedExpiresIn: signed.expiresIn,
        remote,
        cost,
      },
    });
    writeFileSync(join(outRoot, job.orderId, `${job.id}-staging.json`), JSON.stringify({
      privatePath: relative,
      checksum: result.checksumSha256,
      remote,
      cost,
    }, null, 2));
    console.log(JSON.stringify(scrubLog({
      event: "completed",
      jobId: job.id,
      checksum: result.checksumSha256,
      remoteUploaded: Boolean(remote.uploaded),
    })));
  } catch (err) {
    const code = err instanceof Error ? err.message.split(":")[0] : "render_failed";
    jobs.fail(job.id, workerId, code.slice(0, 80), "render");
    console.error(JSON.stringify(scrubLog({ event: "failed", jobId: job.id, code })));
  } finally {
    clearInterval(beat);
  }
  return true;
}

if (args.has("--enqueue-demo")) {
  const stills = resolve(root, "public/assets/christmas-story-demo/stills");
  const photos = [
    "01-tree.jpg",
    "02-gifts.jpg",
    "03-ornaments.jpg",
    "04-cocoa.jpg",
  ].map((f) => join(stills, f));
  const job = jobs.create({
    orderId: randomUUID(),
    jobType: "film",
    provider: "ffmpeg",
    metadata: {
      photos,
      recipientName: "Emma",
      dedication: "For every quiet kindness this winter.",
      captions: ["Warm lights", "Gifts waiting", "Little ornaments", "Quiet cocoa"],
      aspect: "landscape",
    },
  });
  console.log(JSON.stringify({ event: "enqueued", jobId: job.id, orderId: job.orderId }));
}

let shuttingDown = false;
process.on("SIGTERM", () => {
  shuttingDown = true;
  console.log(JSON.stringify({ event: "shutdown_signal" }));
});
process.on("SIGINT", () => {
  shuttingDown = true;
  console.log(JSON.stringify({ event: "shutdown_signal" }));
});

if (once || args.has("--enqueue-demo")) {
  if (!args.has("--enqueue-demo") || once) await processOne();
  process.exit(0);
}

while (!shuttingDown) {
  const did = await processOne();
  if (!did) await new Promise((r) => setTimeout(r, 2000));
}
