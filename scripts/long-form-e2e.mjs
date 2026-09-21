#!/usr/bin/env node
/**
 * One-hour Christmas ambience proof for Long-Form Studio.
 * Run: node --experimental-strip-types scripts/long-form-e2e.mjs
 * or:  npx vitest run api/_lib/long-form-studio/hour.e2e.test.ts
 */
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createAndRenderProduction } from "../api/_lib/long-form-studio/worker.ts";
import { ensureAllOriginalMusic } from "../api/_lib/long-form-studio/originalMusic.ts";
import { ffprobeFile } from "../api/_lib/clip-factory/ffmpeg.ts";

const HOUR = 3600;

const result = await createAndRenderProduction({
  sceneIds: ["reel-cozy-01", "reel-cozy-02", "reel-cozy-03"],
  mood: "cozy_instrumental",
  style: "cozy",
  durationSeconds: HOUR,
  shuffle: true,
  seed: 21,
});

if (!result.rendered) {
  throw new Error("Hour render did not produce a video");
}
const probe = await ffprobeFile(result.rendered.outputPath);
const report = {
  duration: probe.duration,
  width: probe.width,
  height: probe.height,
  hasAudio: probe.hasAudio,
  videoCodec: probe.videoCodec,
  audioCodec: probe.audioCodec,
  fileSize: probe.fileSize,
  tracks: result.rights.manifest.music.length,
  musicSource: result.rights.manifest.music[0]?.source,
  rights: result.production.status,
  librarySrc: result.libraryAsset?.src,
  ffprobe: probe.duration >= HOUR - 2.5 && probe.width >= 1920 && probe.hasAudio ? "PASS" : "FAIL",
};
await writeFile(join(process.cwd(), "output/long-form/hour-report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (report.ffprobe !== "PASS") process.exit(1);
void ensureAllOriginalMusic;
