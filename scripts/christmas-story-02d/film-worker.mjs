#!/usr/bin/env node
/**
 * Local Christmas Story film worker (Mission 02D).
 * Usage:
 *   node --experimental-strip-types scripts/christmas-story-02d/film-worker.mjs --once
 * Does not deploy. Does not use browser credentials.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { LocalJobStore } from "../../server/christmas-story-media/localJobStore.ts";
import { renderMemoryFilm } from "../../server/christmas-story-media/ffmpegFilm.ts";
import { buildMediaCostModel } from "../../server/christmas-story-media/costModel.ts";
import { sha256File } from "../../server/christmas-story-media/safePaths.ts";

const root = resolve(process.cwd());
const args = new Set(process.argv.slice(2));
const once = args.has("--once");
const workerId = process.env.CS_FILM_WORKER_ID || `local-${randomUUID().slice(0, 8)}`;
const storeRoot = resolve(root, process.env.CS_MEDIA_QUEUE_DIR || "artifacts/christmas-story-02d/queue");
const outRoot = resolve(root, process.env.CS_MEDIA_OUT_DIR || "artifacts/christmas-story-02d/out");

mkdirSync(storeRoot, { recursive: true });
mkdirSync(outRoot, { recursive: true });
const store = new LocalJobStore(storeRoot);

async function processOne() {
  const job = store.claim(workerId, 180, "film");
  if (!job) return false;
  console.log(JSON.stringify({ event: "claimed", jobId: job.id, orderId: job.orderId, attempt: job.attempts }));
  const beat = setInterval(() => {
    store.heartbeat(job.id, workerId, 180);
  }, 30_000);
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
        template: "warm_cinematic_v1",
      },
      root,
    );
    const cost = buildMediaCostModel(result);
    store.complete(job.id, workerId, {
      outputChecksum: result.checksumSha256,
      resultAssetPath: result.mp4Path,
      metadata: {
        posterPath: result.posterPath,
        previewMp4Path: result.previewMp4Path,
        durationSec: result.durationSec,
        width: result.width,
        height: result.height,
        hasAudio: result.hasAudio,
        cost,
      },
    });
    writeFileSync(
      join(outRoot, job.orderId, `${job.id}-cost.json`),
      JSON.stringify(cost, null, 2),
    );
    console.log(JSON.stringify({ event: "completed", jobId: job.id, mp4: result.mp4Path, checksum: result.checksumSha256 }));
  } catch (err) {
    const code = err instanceof Error ? err.message.split(":")[0] : "render_failed";
    store.fail(job.id, workerId, code.slice(0, 80), "render");
    console.error(JSON.stringify({ event: "failed", jobId: job.id, code }));
  } finally {
    clearInterval(beat);
  }
  return true;
}

if (args.has("--enqueue-demo")) {
  const fixtures = resolve(root, "artifacts/christmas-story-02d/fixtures");
  const job = store.create({
    orderId: "demo-local-order",
    jobType: "film",
    provider: "ffmpeg",
    status: "queued",
    inputChecksum: sha256File(join(fixtures, "photo_landscape.jpg")),
    metadata: {
      photos: [
        join(fixtures, "photo_landscape.jpg"),
        join(fixtures, "photo_portrait.jpg"),
        join(fixtures, "photo_landscape.jpg"),
      ],
      recipientName: "Emma",
      dedication: "For every quiet kindness this winter.",
      captions: ["Morning light", "The long way home", "Kept promises"],
      aspect: "landscape",
    },
  });
  console.log(JSON.stringify({ event: "enqueued", jobId: job.id }));
}

if (once) {
  const worked = await processOne();
  process.exit(worked ? 0 : 2);
} else {
  console.log(JSON.stringify({ event: "worker_started", workerId }));
  for (;;) {
    const worked = await processOne();
    if (!worked) await new Promise((r) => setTimeout(r, 1500));
  }
}
