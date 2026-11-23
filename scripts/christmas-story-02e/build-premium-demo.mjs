#!/usr/bin/env node
/**
 * Rebuild the fictional Emma premium demo film from first-party illustrated stills.
 * Run: node --experimental-strip-types scripts/christmas-story-02e/build-premium-demo.mjs
 */
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { renderMemoryFilm } from "../../server/christmas-story-media/ffmpegFilm.ts";
import { buildMediaCostModel } from "../../server/christmas-story-media/costModel.ts";

const root = resolve(process.cwd());
const stillsDir = join(root, "public/assets/christmas-story-demo/stills");
const demoDir = join(root, "public/assets/christmas-story-demo");
const outDir = join(root, "artifacts/christmas-story-02e/after");
const qaDir = join(root, "artifacts/christmas-story-02e/qa");

mkdirSync(outDir, { recursive: true });
mkdirSync(qaDir, { recursive: true });

// Prefer existing licensed/stock stills with MANIFEST provenance.
// Do not overwrite photographic stills with illustrated generators.
if (!existsSync(join(stillsDir, "MANIFEST.json"))) {
  const gen = spawnSync("python3", ["scripts/christmas-story-02e/generate-demo-stills.py"], {
    cwd: root,
    encoding: "utf8",
  });
  if (gen.status !== 0) {
    console.error(gen.stderr || gen.stdout);
    process.exit(1);
  }
}

const photos = readdirSync(stillsDir)
  .filter((f) => f.endsWith(".jpg"))
  .sort()
  .map((f) => join(stillsDir, f));

if (photos.length < 6) {
  console.error("need_at_least_6_stills", photos.length);
  process.exit(1);
}

const captions = [
  "The tree, glowing for you",
  "Gifts waiting under the lights",
  "Little ornaments, big memories",
  "Cocoa and quiet evenings",
  "Warm lights in the dark",
  "Snow outside — us inside",
  "By the fire together",
  "The table set for us",
];

const started = Date.now();
const result = await renderMemoryFilm(
  {
    photos,
    recipientName: "Emma",
    dedication: "For every quiet kindness this winter — and every ordinary moment you made extraordinary.",
    captions: captions.slice(0, photos.length),
    aspect: "landscape",
    secondsPerPhoto: 4.0,
    template: "warm_cinematic_v2",
    outDir,
    jobId: "emma-premium-demo",
  },
  root,
);

const cost = buildMediaCostModel(result);
const metrics = { ...result, cost, wallClockMs: Date.now() - started };
writeFileSync(join(outDir, "metrics.json"), JSON.stringify(metrics, null, 2));

// Publish into public demo paths
copyFileSync(result.mp4Path, join(demoDir, "emma-memory-film.mp4"));
copyFileSync(result.posterPath, join(demoDir, "emma-poster.jpg"));
if (result.previewMp4Path && existsSync(result.previewMp4Path)) {
  copyFileSync(result.previewMp4Path, join(demoDir, "emma-memory-film-preview.mp4"));
}

// Contact sheet + sample frames
spawnSync(
  "ffmpeg",
  [
    "-y",
    "-i",
    join(demoDir, "emma-memory-film.mp4"),
    "-vf",
    "fps=0.5,scale=320:-1,tile=5x4",
    "-frames:v",
    "1",
    "-update",
    "1",
    join(outDir, "contact-sheet.jpg"),
  ],
  { encoding: "utf8" },
);

spawnSync(
  "ffmpeg",
  [
    "-y",
    "-i",
    join(demoDir, "emma-memory-film.mp4"),
    "-vf",
    "select='eq(n\\,30)+eq(n\\,120)+eq(n\\,240)+eq(n\\,360)+eq(n\\,480)+eq(n\\,600)+eq(n\\,720)+eq(n\\,900)',scale=640:-1",
    "-fps_mode",
    "vfr",
    join(outDir, "frame-%02d.jpg"),
  ],
  { encoding: "utf8" },
);

const probe = spawnSync(
  "ffprobe",
  [
    "-v",
    "error",
    "-show_entries",
    "stream=codec_name,width,height,pix_fmt,bit_rate",
    "-show_entries",
    "format=duration,size,bit_rate",
    "-of",
    "json",
    join(demoDir, "emma-memory-film.mp4"),
  ],
  { encoding: "utf8" },
);
writeFileSync(join(outDir, "ffprobe.json"), probe.stdout || "{}");

const readme = `# Christmas Story demo media

Fictional sample assets for the landing/demo experience only.

- \`emma-memory-film.mp4\` — Mission 02E premium illustrated demo (first-party original artwork stills; not a customer gift; not photographic customer memories).
- \`emma-poster.jpg\` — poster frame from the same render.
- \`stills/\` — original illustrated scene stills with \`MANIFEST.json\` provenance.
- Demo song audio remains **unavailable** until an authorized first-party/licensed demo master is provided (see \`docs/christmas-story/DEMO_SONG_OPERATOR_CHECKLIST.md\`).

Never copy paying-customer media into this folder.
Never present blank color plates as a finished premium example.
`;
writeFileSync(join(demoDir, "README.md"), readme);

console.log(JSON.stringify({
  ok: true,
  durationSec: result.durationSec,
  fileSizeBytes: result.fileSizeBytes,
  renderMs: result.renderMs,
  peakRssMb: result.peakRssMb,
  checksum: result.checksumSha256,
  photos: photos.length,
}, null, 2));
