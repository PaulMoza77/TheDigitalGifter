#!/usr/bin/env node
/**
 * Mission 02D local media E2E — real FFmpeg renders + job/song controls.
 * Run: node --experimental-strip-types scripts/christmas-story-02d/e2e-media.mjs
 */
import { mkdirSync, writeFileSync, existsSync, copyFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { renderMemoryFilm } from "../../server/christmas-story-media/ffmpegFilm.ts";
import { LocalJobStore } from "../../server/christmas-story-media/localJobStore.ts";
import {
  attachLicensedSong,
  advanceSongState,
  createSongJob,
  requireAdmin,
} from "../../server/christmas-story-media/songProduction.ts";
import { ffprobeJson } from "../../server/christmas-story-media/runCommand.ts";
import { buildMediaCostModel } from "../../server/christmas-story-media/costModel.ts";

const root = resolve(process.cwd());
const fixtures = join(root, "artifacts/christmas-story-02d/fixtures");
const out = join(root, "artifacts/christmas-story-02d/e2e-out");
const queue = join(root, "artifacts/christmas-story-02d/e2e-queue");
mkdirSync(fixtures, { recursive: true });
mkdirSync(out, { recursive: true });
mkdirSync(queue, { recursive: true });

function ensureFixture(name, args) {
  const path = join(fixtures, name);
  if (existsSync(path)) return path;
  const r = spawnSync("ffmpeg", ["-y", ...args, path], { encoding: "utf8" });
  if (r.status !== 0) throw new Error(`fixture_failed:${name}:${r.stderr?.slice(-200)}`);
  return path;
}

const landscape = ensureFixture("photo_landscape.jpg", [
  "-f", "lavfi", "-i", "color=c=0x2a1a12:s=1280x720:d=0.1", "-frames:v", "1", "-update", "1",
]);
const portrait = ensureFixture("photo_portrait.jpg", [
  "-f", "lavfi", "-i", "color=c=0x3d2a1f:s=720x1280:d=0.1", "-frames:v", "1", "-update", "1",
]);
const landscape2 = ensureFixture("photo_landscape_2.jpg", [
  "-f", "lavfi", "-i", "color=c=0x4a3020:s=1600x900:d=0.1", "-frames:v", "1", "-update", "1",
]);
const corrupt = join(fixtures, "corrupt.jpg");
writeFileSync(corrupt, Buffer.from([0x00, 0x01, 0x02, 0x03, 0xff]));
const audio = ensureFixture("tone.mp3", [
  "-f", "lavfi", "-i", "sine=frequency=440:duration=6", "-c:a", "libmp3lame", "-b:a", "128k",
]);

let failed = 0;
function pass(name) {
  console.log(`PASS  ${name}`);
}
function fail(name, detail) {
  failed += 1;
  console.error(`FAIL  ${name} — ${detail}`);
}

// 1) Valid multi-photo render
try {
  const result = await renderMemoryFilm(
    {
      photos: [landscape, portrait, landscape2],
      recipientName: "Emma",
      dedication: "For every quiet kindness this winter.",
      captions: ["Morning", "Homeward", "Promise"],
      audioPath: null,
      aspect: "landscape",
      outDir: join(out, "multi"),
      jobId: "e2e-multi",
    },
    root,
  );
  const probe = await ffprobeJson(result.mp4Path);
  const streams = probe.streams || [];
  const video = streams.find((s) => s.codec_type === "video");
  if (video?.codec_name !== "h264") throw new Error("not_h264");
  if (video?.pix_fmt && video.pix_fmt !== "yuv420p") throw new Error(`pix:${video.pix_fmt}`);
  if (!existsSync(result.posterPath)) throw new Error("poster_missing");
  writeFileSync(join(out, "multi-metrics.json"), JSON.stringify({ ...result, cost: buildMediaCostModel(result) }, null, 2));
  pass("valid multi-photo render + ffprobe");
} catch (e) {
  fail("valid multi-photo render + ffprobe", e instanceof Error ? e.message : String(e));
}

// 2) Mixed orientation portrait output
try {
  const result = await renderMemoryFilm(
    {
      photos: [portrait, landscape, portrait],
      recipientName: "Alex",
      dedication: "With love.",
      aspect: "portrait",
      outDir: join(out, "portrait"),
      jobId: "e2e-portrait",
    },
    root,
  );
  if (result.height <= result.width) throw new Error("not_portrait");
  pass("mixed portrait/landscape → portrait film");
} catch (e) {
  fail("mixed portrait/landscape → portrait film", e instanceof Error ? e.message : String(e));
}

// 3) Missing audio (silent) already covered; with audio
try {
  const result = await renderMemoryFilm(
    {
      photos: [landscape, landscape2],
      recipientName: "Sam",
      dedication: "Always.",
      audioPath: audio,
      aspect: "landscape",
      outDir: join(out, "with-audio"),
      jobId: "e2e-audio",
    },
    root,
  );
  if (!result.hasAudio) throw new Error("expected_audio");
  pass("authorized audio mux");
} catch (e) {
  fail("authorized audio mux", e instanceof Error ? e.message : String(e));
}

// 4) Corrupt photo
try {
  await renderMemoryFilm(
    {
      photos: [landscape, corrupt],
      recipientName: "X",
      dedication: "Y",
      aspect: "landscape",
      outDir: join(out, "corrupt"),
      jobId: "e2e-corrupt",
    },
    root,
  );
  fail("corrupt photo rejected", "should have thrown");
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.includes("photo_magic_invalid") || msg.includes("photo_")) pass("corrupt photo rejected");
  else fail("corrupt photo rejected", msg);
}

// 5) Invalid count / oversized path escape
try {
  await renderMemoryFilm(
    {
      photos: [landscape],
      recipientName: "X",
      dedication: "Y",
      aspect: "landscape",
      outDir: join(out, "count"),
      jobId: "e2e-count",
    },
    root,
  );
  fail("photo count validation", "should throw");
} catch (e) {
  pass("photo count validation");
}

try {
  await renderMemoryFilm(
    {
      photos: [landscape, "/etc/passwd"],
      recipientName: "X",
      dedication: "Y",
      aspect: "landscape",
      outDir: join(out, "escape"),
      jobId: "e2e-escape",
    },
    root,
  );
  fail("path escape rejected", "should throw");
} catch {
  pass("path escape rejected");
}

// 6-9) Worker claim / crash / retry / idempotency
const store = new LocalJobStore(queue);
const workerA = "worker-a";
const workerB = "worker-b";
const job = store.create({
  orderId: "order-e2e",
  jobType: "film",
  provider: "ffmpeg",
  metadata: {
    photos: [landscape, portrait, landscape2],
    recipientName: "Emma",
    dedication: "For you",
    aspect: "landscape",
  },
});
const claimed = store.claim(workerA, 2);
if (!claimed || claimed.id !== job.id) fail("claim job", "no claim");
else pass("claim job");

const stolen = store.claim(workerB, 2);
if (stolen) fail("duplicate claim blocked", "second claim succeeded early");
else pass("duplicate claim blocked");

// Simulate crash: expire lease
claimed.leasedUntil = new Date(Date.now() - 1000).toISOString();
store.save(claimed);
const recovered = store.claim(workerB, 60);
if (!recovered || recovered.workerId !== workerB) fail("crash recovery reclaim", "no reclaim");
else pass("crash recovery reclaim");

try {
  const result = await renderMemoryFilm(
    {
      photos: [landscape, portrait],
      recipientName: "Emma",
      dedication: "For you",
      aspect: "landscape",
      outDir: join(out, "worker"),
      jobId: recovered.id,
    },
    root,
  );
  store.complete(recovered.id, workerB, {
    outputChecksum: result.checksumSha256,
    resultAssetPath: result.mp4Path,
  });
  const again = store.get(recovered.id);
  if (again?.status !== "ready") throw new Error("not_ready");
  // Idempotent: claiming ready jobs returns null
  if (store.claim(workerA, 30)) throw new Error("reclaimed_ready");
  pass("complete + idempotent ready jobs");
} catch (e) {
  fail("complete + idempotent ready jobs", e instanceof Error ? e.message : String(e));
}

// 10-12) Song admin unauthorized + licensed upload
const admin = "test-admin-token-mission-02d-local-only!!";
try {
  requireAdmin("wrong", admin);
  fail("unauthorized admin blocked", "should throw");
} catch {
  pass("unauthorized admin blocked");
}

const songJob = createSongJob(store, "order-e2e", {
  recipientFirstName: "Emma",
  memories: ["kitchen mornings"],
  songGenre: "soft acoustic",
  dedicationSnippet: "For every quiet kindness",
  photos: ["SHOULD_NOT_PERSIST.jpg"],
});
if (JSON.stringify(songJob.metadata).includes("SHOULD_NOT_PERSIST")) {
  fail("song brief omits photos", "photo leaked");
} else pass("song brief omits photos");

try {
  attachLicensedSong(store, {
    jobId: songJob.id,
    adminToken: admin,
    expectedAdminToken: admin,
    workspaceRoot: root,
    sourceAudioPath: audio,
    outDir: join(out, "songs"),
    providerName: "AuthorizedStudio",
    providerRef: "contract-demo-001",
    commercialLicenseEvidence: "Commercial license invoice INV-02D-DEMO retained by ops.",
    creationDate: "2026-11-23",
    downloadDate: "2026-11-23",
  });
  advanceSongState(store, songJob.id, admin, admin, "rights_verification_pending");
  advanceSongState(store, songJob.id, admin, admin, "ready_for_buyer_review");
  const ready = store.get(songJob.id);
  if (ready?.productionState !== "ready_for_buyer_review" || ready.status !== "ready") {
    throw new Error("not_ready_for_review");
  }
  pass("licensed song upload + provenance states");
} catch (e) {
  fail("licensed song upload + provenance states", e instanceof Error ? e.message : String(e));
}

// Buyer revision
try {
  advanceSongState(store, songJob.id, admin, admin, "revision_requested", "Softer chorus please");
  advanceSongState(store, songJob.id, admin, admin, "in_production");
  pass("buyer revision cycle");
} catch (e) {
  fail("buyer revision cycle", e instanceof Error ? e.message : String(e));
}

// Free/trial license rejected
try {
  const j2 = createSongJob(store, "order-bad", { recipientFirstName: "Pat" });
  advanceSongState(store, j2.id, admin, admin, "in_production");
  attachLicensedSong(store, {
    jobId: j2.id,
    adminToken: admin,
    expectedAdminToken: admin,
    workspaceRoot: root,
    sourceAudioPath: audio,
    outDir: join(out, "songs"),
    providerName: "x",
    providerRef: "y",
    commercialLicenseEvidence: "free trial download",
    creationDate: "2026-11-23",
    downloadDate: "2026-11-23",
  });
  fail("reject free/trial license evidence", "should throw");
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.includes("license_evidence_rejected") || msg.includes("invalid_song_transition")) {
    pass("reject free/trial license evidence");
  } else fail("reject free/trial license evidence", msg);
}

console.log(failed === 0 ? "\nRESULT: all media E2E checks passed" : `\nRESULT: ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
