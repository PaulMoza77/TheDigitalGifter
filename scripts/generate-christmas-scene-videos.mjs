#!/usr/bin/env node
/**
 * Image → short photoreal video (fire + tree lights) via Replicate Kling v2.1.
 * Does NOT modify source stills.
 *
 *   set -a && source .env && set +a
 *   node scripts/generate-christmas-scene-videos.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const TOKEN = process.env.REPLICATE_API_TOKEN || process.env.REPLICATE_API_KEY;

if (!TOKEN) {
  console.error("Missing REPLICATE_API_TOKEN");
  process.exit(1);
}

const MODEL = "kwaivgi/kling-v2.1";

const JOBS = [
  {
    name: "mobile-portrait",
    still: path.join(ROOT, "public/christmas/gifts/video-src/scene-mobile-portrait.png"),
    out: path.join(ROOT, "public/christmas/gifts/scene-mobile.mp4"),
    prompt:
      "Locked camera, photoreal Christmas chalet. Only animate: fireplace fire burning with realistic flickering orange flames and soft ember glow; Christmas tree warm string lights gently twinkling and sparkling; subtle shimmer on the glowing star topper and gold ornaments; candles on the mantel barely flickering. Keep furniture, tree shape, gifts, and composition completely unchanged. Cinematic clarity, high detail, natural motion.",
  },
  {
    name: "desktop-landscape",
    still: path.join(ROOT, "public/christmas/gifts/video-src/scene-desktop-landscape.png"),
    out: path.join(ROOT, "public/christmas/gifts/scene-desktop.mp4"),
    prompt:
      "Locked wide camera, photoreal luxury Christmas chalet living room. Only animate: roaring fireplace with realistic flame flicker and warm light pulse on the stone; Christmas tree fairy lights softly twinkling; gentle sparkle on star topper and ornaments; candle flames on mantel and lanterns barely moving. Keep room layout, tree, gifts, windows, and mountains unchanged. Ultra clear, cinematic, natural motion.",
  },
];

async function createPrediction(input) {
  const res = await fetch(`https://api.replicate.com/v1/models/${MODEL}/predictions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ input }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`create ${res.status}: ${text}`);
  return JSON.parse(text);
}

async function waitPrediction(id) {
  for (let i = 0; i < 180; i++) {
    const res = await fetch(`https://api.replicate.com/v1/predictions/${id}`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    if (!res.ok) throw new Error(`poll ${res.status}`);
    const data = await res.json();
    process.stdout.write(`  [${i}] ${data.status}\n`);
    if (data.status === "succeeded") return data;
    if (data.status === "failed" || data.status === "canceled") {
      throw new Error(`${data.status}: ${JSON.stringify(data.error)}`);
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
  throw new Error("timeout waiting for prediction");
}

function dataUrlFromFile(filePath) {
  const buf = fs.readFileSync(filePath);
  return `data:image/png;base64,${buf.toString("base64")}`;
}

async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download ${res.status}`);
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

async function runJob(job) {
  console.log(`\n→ ${job.name}`);
  const input = {
    mode: "pro", // 1080p
    duration: 5,
    prompt: job.prompt,
    start_image: dataUrlFromFile(job.still),
    negative_prompt:
      "camera move, zoom, pan, tilt, morphing, warping tree, moving furniture, text, watermark, logo, UI, cartoon, low quality, blurry, distorted gifts",
  };
  let prediction = await createPrediction(input);
  console.log(`  id=${prediction.id}`);
  if (prediction.status !== "succeeded") {
    prediction = await waitPrediction(prediction.id);
  }
  const url = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
  if (!url) throw new Error(`no output: ${JSON.stringify(prediction.output)}`);
  fs.mkdirSync(path.dirname(job.out), { recursive: true });
  await download(url, job.out);
  console.log(`  saved ${job.out} (${Math.round(fs.statSync(job.out).size / 1024)} KB)`);
  return job.out;
}

async function main() {
  const outs = [];
  for (const job of JOBS) outs.push(await runJob(job));
  const art = "/opt/cursor/artifacts/christmas-video";
  fs.mkdirSync(art, { recursive: true });
  for (const out of outs) fs.copyFileSync(out, path.join(art, path.basename(out)));
  console.log("\nDone.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
