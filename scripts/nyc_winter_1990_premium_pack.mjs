#!/usr/bin/env node
/**
 * Premium TDG pack: New York Winter Time 1990
 * Generates 5 images, 5 Kling v3 Pro clips, 12–15s reel, finish + publish.
 * Run inside thedigitalgifter container (HF + Supabase env required).
 */
import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire("/app/package.json");
const { createClient } = require("@supabase/supabase-js");
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { spawnSync } from "node:child_process";
import { get as httpsGet } from "node:https";
import { get as httpGet } from "node:http";

const HIGGSFIELD_API_BASE = "https://api.higgsfield.ai";
const IMAGE_MODEL = "recraft/v4.1/pro/text-to-image";
const KLING_PATH = "/kling-video/v3.0/pro/image-to-video";
const KLING_ESTIMATE = "/estimate/kling-video/v3.0/pro/image-to-video";
const VISUAL_SUFFIX =
  " Vertical 9:16 photorealistic photograph, not illustration or cartoon. No animated or stylized characters. Clear focal subject, strong first-frame composition, natural lighting, realistic materials and geometry, emotionally readable Christmas or winter mood when relevant. Suitable for subtle image-to-video animation. No logos, no watermarks, no readable text overlays, no malformed architecture, no impossible anatomy or hands, no plastic CGI look, no excessive HDR. Subtle cinematic film grain, 1990s Manhattan holiday nostalgia, premium luxury memory.";
const MOTION_SUFFIX =
  " Slow cinematic camera movement only. Natural environmental motion such as snowfall, Christmas light shimmer, or gentle street ambience. Stable architecture and subject identity. No morphing, no object transformation, no hyperlapse, no wild camera spins.";

const PACK_ID = "nyc-winter-1990-20260926";
const PROD_DIR = `/var/lib/tdg/clip-factory/long-form/productions/${PACK_ID}`;
const ORIGIN = "http://127.0.0.1:8080";

const SCENES = [
  {
    id: "01_manhattan_dusk_cab",
    imageCore:
      "Photoreal cinematic vertical photograph, snowy Manhattan street at blue-hour dusk circa 1990, yellow taxi with warm headlights, luxury storefront Christmas windows glowing, wet pavement reflections, gentle snowfall, classic pre-9/11 skyline feel, timeless holiday elegance, no readable signage text.",
    motionCore:
      "Photoreal cinematic 9:16 New York Christmas night. This exact photograph comes alive for five seconds. Preserve the yellow cab, storefront windows, wet street, and skyline exactly. Very slow cinematic push-in. Gentle snowfall. Taxi rolls a few feet with natural wheel motion. Christmas lights shimmer subtly. No warped buildings or faces.",
  },
  {
    id: "02_rockefeller_tree",
    imageCore:
      "Photoreal cinematic vertical photograph, Rockefeller Center style winter scene, giant Christmas tree and ice rink, skaters as soft silhouettes, glowing city lights, light snow, 1990s New York holiday atmosphere, premium emotional composition, no readable logos or text.",
    motionCore:
      "Photoreal cinematic 9:16 Rockefeller-style Christmas night. Preserve the tree, rink, skaters, and city lights exactly. Gentle camera drift. Christmas lights twinkle softly. Skaters glide with tiny natural motion. Falling snow. Architecture stays rigid.",
  },
  {
    id: "03_townhouse_entrance",
    imageCore:
      "Photoreal cinematic vertical photograph, elegant Upper East Side Manhattan brownstone townhouse entrance at Christmas, wreaths, garlands, warm doorway light, soft snow on steps, 1990s nostalgic cozy luxury, no readable house numbers or text.",
    motionCore:
      "Photoreal cinematic 9:16 cozy Manhattan townhouse Christmas night. Preserve the doorway, wreaths, garlands, and warm interior glow exactly. Slow dolly-in. Soft falling snow. Subtle candle and interior light flicker. No morphing doors or architecture.",
  },
  {
    id: "04_central_park_carriage",
    imageCore:
      "Photoreal cinematic vertical photograph, Central Park winter path with horse-drawn carriage and snowy trees, distant Manhattan glow, romantic 1990s nostalgic New York Christmas mood, premium cinematic depth, no readable text.",
    motionCore:
      "Photoreal cinematic 9:16 Central Park winter evening. Preserve the carriage, horses, path, and city glow exactly. Smooth slow pan with subtle push. Atmospheric snowfall. Carriage makes tiny realistic movement. Peaceful premium motion only.",
  },
  {
    id: "05_holiday_shopping",
    imageCore:
      "Photoreal cinematic vertical photograph, classic New York holiday shopping street scene, elegant people in timeless winter coats, warm storefront glow, light snowfall, 1990s Manhattan Christmas magic, luxury editorial feel, faces natural and distant, no readable store signs.",
    motionCore:
      "Photoreal cinematic 9:16 New York holiday shopping evening. Preserve storefront glow, pedestrians, and street geometry exactly. Subtle street-life movement, slow push-in, elegant holiday ambience, gentle snowfall, no face morphing or duplicated people.",
  },
];

const REEL_SHOTS = [
  { index: 0, start: 0.22, duration: 2.55 },
  { index: 1, start: 0.35, duration: 2.45 },
  { index: 2, start: 0.18, duration: 2.5 },
  { index: 3, start: 0.28, duration: 2.55 },
  { index: 4, start: 0.4, duration: 2.65 },
];
const XFADE = 0.14;

function authHeader() {
  const combined = String(process.env.HF_CREDENTIALS || "").trim();
  if (combined.includes(":")) {
    const i = combined.indexOf(":");
    const keyId = combined.slice(0, i).trim();
    const secret = combined.slice(i + 1).trim();
    if (keyId && secret) return `Key ${keyId}:${secret}`;
  }
  const keyId = String(process.env.HF_API_KEY_ID || "").trim();
  const secret = String(process.env.HF_API_KEY_SECRET || "").trim();
  if (keyId && secret) return `Key ${keyId}:${secret}`;
  throw new Error("higgsfield_credentials_missing");
}

async function hfJson(method, path, body) {
  const url = path.startsWith("http") ? path : `${HIGGSFIELD_API_BASE}${path}`;
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const res = await fetch(url, {
        method,
        headers: {
          Authorization: authHeader(),
          Accept: "application/json",
          "Content-Type": "application/json",
          "User-Agent": "tdg-nyc-winter-1990-pack/higgsfield",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(120_000),
      });
      const text = await res.text();
      let parsed = {};
      try {
        parsed = text ? JSON.parse(text) : {};
      } catch {
        parsed = {};
      }
      if (!res.ok) throw new Error(`higgsfield_${res.status}:${text.slice(0, 200)}`);
      return parsed;
    } catch (error) {
      lastError = error;
      if (attempt < 4) await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function terminalStatus(status) {
  const s = String(status || "").toLowerCase();
  return ["completed", "succeeded", "success", "failed", "error", "cancelled"].includes(s);
}
function successStatus(status) {
  const s = String(status || "").toLowerCase();
  return ["completed", "succeeded", "success"].includes(s);
}

async function pollRequest(requestId, opts = {}) {
  const max = opts.maxAttempts ?? 80;
  const sleepMs = opts.sleepMs ?? 3500;
  for (let i = 0; i < max; i += 1) {
    const body = await hfJson("GET", `/requests/${requestId}/status`);
    const status = String(body.status || "");
    if (terminalStatus(status)) {
      return { ok: successStatus(status), body };
    }
    await new Promise((r) => setTimeout(r, sleepMs));
  }
  return { ok: false, body: null };
}

function extractImageUrl(body) {
  const images = body?.images;
  if (Array.isArray(images)) {
    for (const image of images) {
      if (image && typeof image === "object" && typeof image.url === "string") return image.url;
      if (typeof image === "string" && /^https?:\/\//i.test(image)) return image;
    }
  }
  if (typeof body?.image_url === "string") return body.image_url;
  return null;
}

function extractVideoUrl(body) {
  const video = body?.video;
  if (video && typeof video === "object" && typeof video.url === "string") return video.url;
  if (typeof body?.video_url === "string") return body.video_url;
  return null;
}

async function downloadUrl(url, dest) {
  await new Promise((resolve, reject) => {
    const lib = url.startsWith("https:") ? httpsGet : httpGet;
    lib(url, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        downloadUrl(res.headers.location, dest).then(resolve, reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`download_${res.statusCode}`));
        return;
      }
      pipeline(res, createWriteStream(dest)).then(resolve).catch(reject);
    }).on("error", reject);
  });
}

async function runImageQc(imagePath, prompt) {
  const key = String(process.env.OPENAI_API_KEY || "").trim();
  if (!key) return { verdict: "PASS", reason: "qc_skipped_no_openai" };
  const b64 = readFileSync(imagePath).toString("base64");
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Strict TDG 9:16 photoreal Christmas QC. JSON { verdict: PASS|REGENERATE|REJECT, reason }. PASS only for premium WOW realism.",
        },
        {
          role: "user",
          content: [
            { type: "text", text: `Prompt:\n${prompt}\nEvaluate.` },
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${b64}` } },
          ],
        },
      ],
    }),
  });
  const json = await res.json();
  const content = String(json?.choices?.[0]?.message?.content || "{}");
  let parsed = {};
  try {
    parsed = JSON.parse(content);
  } catch {
    parsed = {};
  }
  const verdict = String(parsed.verdict || "REGENERATE").toUpperCase();
  return { verdict, reason: String(parsed.reason || verdict) };
}

function ffprobe(path) {
  const out = spawnSync(
    "ffprobe",
    [
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "stream=width,height,avg_frame_rate,codec_name",
      "-show_entries",
      "format=duration,bit_rate,size",
      "-of",
      "json",
      path,
    ],
    { encoding: "utf8" },
  );
  if (out.status !== 0) throw new Error(out.stderr || "ffprobe_failed");
  const data = JSON.parse(out.stdout);
  const stream = (data.streams || [])[0] || {};
  const fmt = data.format || {};
  return {
    duration: Number(fmt.duration || 0),
    width: Number(stream.width || 0),
    height: Number(stream.height || 0),
  };
}

function assembleReel(clipPaths, outputPath) {
  const grade = "eq=contrast=1.035:brightness=0.006:saturation=1.045:gamma=1.01";
  const inputs = [];
  const filters = [];
  const durs = [];
  for (let i = 0; i < REEL_SHOTS.length; i += 1) {
    const shot = REEL_SHOTS[i];
    const src = clipPaths[shot.index];
    inputs.push("-i", src);
    filters.push(
      `[${i}:v]trim=start=${shot.start}:duration=${shot.duration},setpts=PTS-STARTPTS,fps=30,scale=1080:1920:flags=lanczos,setsar=1,${grade},format=yuv420p[v${i}]`,
    );
    durs.push(shot.duration);
  }
  let current = "v0";
  let offset = durs[0] - XFADE;
  for (let i = 1; i < REEL_SHOTS.length; i += 1) {
    const out = i === REEL_SHOTS.length - 1 ? "out" : `x${i}`;
    filters.push(`[${current}][v${i}]xfade=transition=fade:duration=${XFADE}:offset=${offset.toFixed(3)}[${out}]`);
    current = out;
    if (i < REEL_SHOTS.length - 1) offset += durs[i] - XFADE;
  }
  const args = [
    "-y",
    ...inputs,
    "-filter_complex",
    filters.join(";"),
    "-map",
    "[out]",
    "-an",
    "-c:v",
    "libx264",
    "-preset",
    "slow",
    "-profile:v",
    "high",
    "-pix_fmt",
    "yuv420p",
    "-r",
    "30",
    "-b:v",
    "18M",
    "-movflags",
    "+faststart",
    outputPath,
  ];
  const run = spawnSync("ffmpeg", args, { encoding: "utf8" });
  if (run.status !== 0) throw new Error(run.stderr?.slice(-800) || "ffmpeg_assemble_failed");
  const probe = ffprobe(outputPath);
  if (probe.width !== 1080 || probe.height !== 1920) throw new Error("reel_not_1080x1920");
  if (probe.duration < 12 || probe.duration > 15.3) throw new Error(`reel_duration_${probe.duration}`);
  return probe;
}

async function apiPost(path, body = {}) {
  const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  const cron = String(process.env.CLIP_FACTORY_CRON_SECRET || "").trim();
  const res = await fetch(`${ORIGIN}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceKey}`,
      ...(cron ? { "x-cron-secret": cron } : {}),
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text.slice(0, 300) };
  }
  return { status: res.status, json };
}

function log(step, data) {
  console.log(JSON.stringify({ step, ts: new Date().toISOString(), ...data }));
}

async function main() {
  mkdirSync(PROD_DIR, { recursive: true });
  const manifest = { packId: PACK_ID, scenes: [], clips: [], reel: null, libraryAssetId: null, publicationId: null, publish: {} };

  for (let index = 0; index < SCENES.length; index += 1) {
    const scene = SCENES[index];
    const imagePrompt = `${scene.imageCore}${VISUAL_SUFFIX}`;
    const imagePath = join(PROD_DIR, `clip-${index}.jpg`);
    const videoPath = join(PROD_DIR, `clip-${index}.mp4`);
    let imageUrl = null;

    if (existsSync(videoPath)) {
      const vprobe = ffprobe(videoPath);
      manifest.clips.push({ index, id: scene.id, videoPath, resumed: true, probe: vprobe });
      log("clip_skip_existing", { index, scene: scene.id, probe: vprobe });
      continue;
    }

    if (existsSync(imagePath)) {
      log("image_skip_existing", { index, scene: scene.id, imagePath });
    } else {
      for (let attempt = 1; attempt <= 2; attempt += 1) {
        log("image_submit", { index, scene: scene.id, attempt });
        const submitted = await hfJson("POST", `/${IMAGE_MODEL}`, { prompt: imagePrompt, aspect_ratio: "9:16" });
        const requestId = String(submitted.request_id || "");
        if (!requestId) throw new Error("image_request_missing");
        const polled = await pollRequest(requestId, { maxAttempts: 90, sleepMs: 4000 });
        if (!polled.ok || !polled.body) throw new Error(`image_failed_${scene.id}`);
        imageUrl = extractImageUrl(polled.body);
        if (!imageUrl) throw new Error(`image_url_missing_${scene.id}`);
        await downloadUrl(imageUrl, imagePath);
        const qc = await runImageQc(imagePath, imagePrompt);
        log("image_qc", { index, scene: scene.id, qc });
        manifest.scenes.push({ index, id: scene.id, imagePath, imageUrl, qc });
        if (qc.verdict === "PASS") break;
        if (qc.verdict === "REJECT" && attempt >= 2) throw new Error(`image_qc_reject_${scene.id}:${qc.reason}`);
      }
    }
    if (!existsSync(imagePath)) throw new Error(`missing_image_${index}`);

    if (!imageUrl) {
      const submitted = await hfJson("POST", `/${IMAGE_MODEL}`, { prompt: imagePrompt, aspect_ratio: "9:16" });
      const requestId = String(submitted.request_id || "");
      const polled = await pollRequest(requestId, { maxAttempts: 90, sleepMs: 4000 });
      imageUrl = polled.body ? extractImageUrl(polled.body) : null;
      if (!imageUrl) {
        const upload = await hfJson("POST", "/files/generate-upload-url", { content_type: "image/jpeg" });
        const uploadUrl = String(upload.upload_url || "");
        const publicUrl = String(upload.public_url || "");
        if (!uploadUrl || !publicUrl) throw new Error("image_public_url_missing");
        const bytes = readFileSync(imagePath);
        await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": "image/jpeg" }, body: bytes });
        imageUrl = publicUrl;
      }
    }

    const motionPrompt = `${scene.motionCore}${MOTION_SUFFIX}`;
    log("video_submit", { index, scene: scene.id });
    await hfJson("POST", KLING_ESTIMATE, { image_url: imageUrl, prompt: motionPrompt, duration: 5, sound: "off" });
    const vsub = await hfJson("POST", KLING_PATH, { image_url: imageUrl, prompt: motionPrompt, duration: 5, sound: "off" });
    const vidReq = String(vsub.request_id || "");
    if (!vidReq) throw new Error("video_request_missing");
    const vpolled = await pollRequest(vidReq, { maxAttempts: 120, sleepMs: 5000 });
    if (!vpolled.ok || !vpolled.body) throw new Error(`video_failed_${scene.id}`);
    const videoUrl = extractVideoUrl(vpolled.body);
    if (!videoUrl) throw new Error(`video_url_missing_${scene.id}`);
    await downloadUrl(videoUrl, videoPath);
    const vprobe = ffprobe(videoPath);
    manifest.clips.push({ index, id: scene.id, videoPath, videoUrl, probe: vprobe });
    log("clip_ready", { index, scene: scene.id, probe: vprobe });
  }

  const clipPaths = SCENES.map((_, i) => join(PROD_DIR, `clip-${i}.mp4`));
  const sourceReel = join(PROD_DIR, "source-reel.mp4");
  const reelProbe = assembleReel(clipPaths, sourceReel);
  manifest.reel = { path: sourceReel, probe: reelProbe };
  log("reel_assembled", manifest.reel);

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const caption =
    "Snowy streets, golden lights, and that old New York Christmas magic ✨🎄❄️\n\n#NewYorkChristmas #NYC #ChristmasNostalgia #90sChristmas #HolidayMagic #WinterInTheCity #ChristmasReels #TheDigitalGifter";
  const inserted = await supabase
    .from("library_assets")
    .insert({
      title: "New York Winter Time 1990",
      description: "Premium nostalgic 1990s Manhattan Christmas reel — snowy streets, warm lights, timeless holiday magic.",
      src: `/api/content-autopilot?action=media&id=${PACK_ID}`,
      filename: "nyc-winter-1990-reel.mp4",
      category: "christmas_reels",
      kind: "video",
      duration_seconds: reelProbe.duration,
      width: reelProbe.width,
      height: reelProbe.height,
      provenance: { source: "nyc_winter_1990_premium_pack", pack_id: PACK_ID, scenes: manifest.scenes, clips: manifest.clips },
      content_tags: ["christmas_nostalgia", "new_york", "nyc", "1990", "premium_pack"],
      publish_status: "pending_finish",
      publisher_eligible: false,
      source_video_path: `productions/${PACK_ID}/source-reel.mp4`,
      storage_bucket: "vps",
      storage_path: `productions/${PACK_ID}/source-reel.mp4`,
    })
    .select("id")
    .single();
  if (inserted.error) throw inserted.error;
  const libraryAssetId = inserted.data.id;
  manifest.libraryAssetId = libraryAssetId;
  log("library_inserted", { libraryAssetId });

  const finishQueue = await apiPost("/api/christmas-reel-pipeline?action=queue_finish", {
    library_asset_id: libraryAssetId,
  });
  log("finish_queued", finishQueue);

  for (let i = 0; i < 40; i += 1) {
    const tick = await apiPost("/api/christmas-reel-pipeline?action=tick");
    const asset = await supabase.from("library_assets").select("publish_status,publisher_eligible,finish_error").eq("id", libraryAssetId).single();
    log("finish_tick", { attempt: i + 1, tick: tick.json, asset: asset.data });
    if (asset.data?.publish_status === "ready_to_publish" && asset.data?.publisher_eligible) break;
    if (asset.data?.publish_status === "failed") throw new Error(asset.data.finish_error || "finish_failed");
    await new Promise((r) => setTimeout(r, 8000));
  }

  const scheduledAt = new Date().toISOString();
  const pub = await apiPost("/api/publisher", {
    action: "create_manual",
    library_asset_id: libraryAssetId,
    destinations: ["instagram_reel_post", "facebook_reel_post", "youtube_short"],
    scheduled_at: scheduledAt,
    approve: true,
    caption,
  });
  log("publication_created", pub);
  if (pub.status !== 200) throw new Error(JSON.stringify(pub.json));
  manifest.publicationId = pub.json?.publication?.id;

  for (let i = 0; i < 30; i += 1) {
    const ptick = await apiPost("/api/publisher", { action: "tick" });
    log("publisher_tick", { attempt: i + 1, ptick: ptick.json });
    if (manifest.publicationId) {
      const jobs = await supabase
        .from("publisher_destination_jobs")
        .select("destination,status,remote_post_id,remote_url,last_error")
        .eq("publication_id", manifest.publicationId);
      manifest.publish.jobs = jobs.data;
      const done = (jobs.data || []).every((j) => j.status === "completed" || j.status === "published" || j.status === "failed");
      const anyPublished = (jobs.data || []).some((j) => j.remote_post_id || j.remote_url);
      if (done && anyPublished) break;
    }
    await new Promise((r) => setTimeout(r, 12000));
  }

  writeFileSync(join(PROD_DIR, "manifest.json"), JSON.stringify(manifest, null, 2));
  log("complete", manifest);
}

main().catch((error) => {
  console.error(JSON.stringify({ step: "fatal", message: error instanceof Error ? error.message : String(error) }));
  process.exit(1);
});
