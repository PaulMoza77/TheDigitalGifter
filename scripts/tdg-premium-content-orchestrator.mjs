#!/usr/bin/env node
/**
 * TDG premium content orchestrator (Mozas / thedigitalgifter container).
 *
 * Env / CLI:
 *   TDG_THEME          (required unless --theme)
 *   TDG_STYLE          visual direction (default: premium cinematic photoreal)
 *   TDG_SCENE_COUNT    default 5
 *   TDG_CLIP_DURATION  default 5 (Kling seconds)
 *   TDG_REEL_MIN       default 12
 *   TDG_REEL_MAX       default 15.3
 *   TDG_PUBLISH        1|0 default 1
 *   TDG_SKIP_PUBLISH   alias to disable publish
 *   TDG_RESUME         1 default — resume from manifest in pack dir
 *
 * Generates: scenes (OpenAI) → Recraft images → QC → Kling v3 Pro clips → QC →
 * 12–15s silent reel → library + finish (music) → optional publish.
 */
import { createHash } from "node:crypto";
import { createWriteStream, existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { pipeline } from "node:stream/promises";
import { spawnSync } from "node:child_process";
import { get as httpsGet } from "node:https";
import { get as httpGet } from "node:http";

const require = createRequire("/app/package.json");
const { createClient } = require("@supabase/supabase-js");

const HIGGSFIELD_API_BASE = "https://api.higgsfield.ai";
const IMAGE_MODEL =
  String(process.env.CONTENT_AUTOPILOT_HIGGSFIELD_IMAGE_MODEL || "recraft/v4.1/pro/text-to-image").replace(/^\/+/, "") ||
  "recraft/v4.1/pro/text-to-image";
const KLING_MODEL = "kling-video/v3.0/pro/image-to-video";
const KLING_PATH = `/${KLING_MODEL}`;
const KLING_ESTIMATE = `/estimate/${KLING_MODEL}`;
const ORIGIN = String(process.env.TDG_INTERNAL_ORIGIN || "http://127.0.0.1:8080").replace(/\/$/, "");
const XFADE = 0.14;
const MAX_IMAGE_ATTEMPTS = 3;
const MAX_CLIP_ATTEMPTS = 2;

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--theme") out.theme = argv[++i];
    else if (a === "--style") out.style = argv[++i];
    else if (a === "--scene-count") out.sceneCount = Number(argv[++i]);
    else if (a === "--clip-duration") out.clipDuration = Number(argv[++i]);
    else if (a === "--reel-min") out.reelMin = Number(argv[++i]);
    else if (a === "--reel-max") out.reelMax = Number(argv[++i]);
    else if (a === "--no-publish") out.publish = false;
  }
  return out;
}

function slugify(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function utcDateStamp() {
  return new Date().toISOString().slice(0, 10);
}

function loadConfig() {
  const cli = parseArgs(process.argv);
  const theme = String(cli.theme || process.env.TDG_THEME || "").trim();
  if (!theme) throw new Error("TDG_THEME or --theme is required");
  const style =
    String(cli.style || process.env.TDG_STYLE || "").trim() ||
    "Premium cinematic photoreal, emotionally warm, scroll-stopping, luxury short-form reel aesthetic.";
  const sceneCount = Math.max(2, Math.min(6, Number(cli.sceneCount || process.env.TDG_SCENE_COUNT || 5)));
  const clipDuration = Math.max(3, Math.min(10, Number(cli.clipDuration || process.env.TDG_CLIP_DURATION || 5)));
  const reelMin = Number(cli.reelMin || process.env.TDG_REEL_MIN || 12);
  const reelMax = Number(cli.reelMax || process.env.TDG_REEL_MAX || 15.3);
  const publish =
    cli.publish === false
      ? false
      : String(process.env.TDG_SKIP_PUBLISH || process.env.TDG_PUBLISH || "1").trim() !== "0";
  const resume = String(process.env.TDG_RESUME || "1").trim() !== "0";
  const packSlug = `${slugify(theme)}-${utcDateStamp().replace(/-/g, "")}`;
  const prodDir = `/var/lib/tdg/clip-factory/long-form/productions/${packSlug}`;
  return { theme, style, sceneCount, clipDuration, reelMin, reelMax, publish, resume, packSlug, prodDir };
}

function visualSuffix(style) {
  return (
    ` ${style} Vertical 9:16 photorealistic photograph, not illustration or cartoon. Clear focal subject, strong first-frame composition, natural lighting, realistic materials, premium emotional mood. No logos, watermarks, or readable text in frame. No malformed anatomy or hands. No plastic CGI look. Suitable for subtle image-to-video animation.`
  );
}

function motionSuffix(clipDuration) {
  return (
    ` Slow cinematic camera movement only for ${clipDuration} seconds. Natural environmental motion only. Stable architecture and subject identity. No morphing, hyperlapse, or wild camera spins. Photoreal live-action cinema camera.`
  );
}

function buildReelShots(sceneCount, reelTarget) {
  const totalClipTime = reelTarget + (sceneCount - 1) * XFADE;
  const baseDur = totalClipTime / sceneCount;
  const startPattern = [0.22, 0.35, 0.18, 0.28, 0.4, 0.25];
  const shots = [];
  for (let i = 0; i < sceneCount; i += 1) {
    const duration = i === sceneCount - 1 ? baseDur * 1.05 : baseDur * 0.98;
    shots.push({
      index: i,
      start: startPattern[i % startPattern.length],
      duration: Math.round(duration * 100) / 100,
    });
  }
  return shots;
}

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
          "User-Agent": "tdg-premium-content-orchestrator/higgsfield",
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
    if (terminalStatus(status)) return { ok: successStatus(status), body };
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

function parseUsd(body) {
  const usd = Number(body?.usd);
  return Number.isFinite(usd) && usd >= 0 ? usd : 0;
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

async function openaiJson(messages, schemaHint) {
  const key = String(process.env.OPENAI_API_KEY || "").trim();
  if (!key) throw new Error("OPENAI_API_KEY missing");
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.6,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: schemaHint },
        ...messages,
      ],
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(String(json?.error?.message || `openai_${res.status}`));
  const content = String(json?.choices?.[0]?.message?.content || "{}");
  return JSON.parse(content);
}

async function generateScenePack(config) {
  const manifestPath = join(config.prodDir, "manifest.json");
  if (config.resume && existsSync(manifestPath)) {
    try {
      const prior = JSON.parse(readFileSync(manifestPath, "utf8"));
      if (Array.isArray(prior.scenes) && prior.scenes.length === config.sceneCount && prior.scenes[0]?.imageCore) {
        return prior.scenes;
      }
    } catch {
      /* regenerate */
    }
  }
  const parsed = await openaiJson(
    [
      {
        role: "user",
        content: `Theme: ${config.theme}\nStyle: ${config.style}\nGenerate exactly ${config.sceneCount} distinct vertical reel scenes.`,
      },
    ],
    `Return JSON { scenes: [{ id, label, imageCore, motionCore }] }. id is snake_case slug. imageCore is a photoreal 9:16 still prompt WITHOUT aspect ratio tokens. motionCore is Kling I2V motion for the exact still. Scenes must match the theme, feel premium/WOW, no readable text/signage, no collage.`,
  );
  const scenes = (parsed.scenes || []).slice(0, config.sceneCount);
  if (scenes.length !== config.sceneCount) throw new Error("scene_generation_count_mismatch");
  return scenes.map((s, i) => ({
    id: String(s.id || `scene_${i + 1}`).replace(/[^a-z0-9_]+/gi, "_").slice(0, 40),
    label: String(s.label || s.id || `Scene ${i + 1}`),
    imageCore: String(s.imageCore || ""),
    motionCore: String(s.motionCore || ""),
  }));
}

async function generateCaption(config) {
  const parsed = await openaiJson(
    [{ role: "user", content: `Write one Instagram reel caption + 6-8 hashtags for theme: ${config.theme}. Style: ${config.style}. Emotional, short hook, not spammy.` }],
    'Return JSON { caption: string } — caption includes line break before hashtags.',
  );
  return String(parsed.caption || config.theme);
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
            "Strict TDG 9:16 photoreal QC. JSON { verdict: PASS|REGENERATE|REJECT, reason }. PASS only for premium WOW realism suitable for viral Christmas/winter reels.",
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
  const verdictRaw = String(parsed.verdict || "REGENERATE").toUpperCase();
  const verdict = verdictRaw === "PASS" || verdictRaw === "REJECT" || verdictRaw === "REGENERATE" ? verdictRaw : "REGENERATE";
  return { verdict, reason: String(parsed.reason || verdictRaw) };
}

function runClipQc(videoPath, clipDuration) {
  const probe = ffprobe(videoPath);
  const okDuration = probe.duration >= clipDuration * 0.9 && probe.duration <= clipDuration + 1.5;
  const okSize = probe.size > 800_000;
  const okVertical = probe.height >= 1800 && probe.width >= 1000;
  if (okDuration && okSize && okVertical) return { ok: true, probe };
  return {
    ok: false,
    probe,
    reason: `clip_qc_fail dur=${probe.duration} size=${probe.size} ${probe.width}x${probe.height}`,
  };
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
      "stream=width,height",
      "-show_entries",
      "format=duration,size",
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
    size: Number(fmt.size || 0),
  };
}

function assembleReel(clipPaths, reelShots, outputPath, reelMin, reelMax) {
  const grade = "eq=contrast=1.035:brightness=0.006:saturation=1.045:gamma=1.01";
  const inputs = [];
  const filters = [];
  const durs = [];
  for (let i = 0; i < reelShots.length; i += 1) {
    const shot = reelShots[i];
    const src = clipPaths[shot.index];
    inputs.push("-i", src);
    filters.push(
      `[${i}:v]trim=start=${shot.start}:duration=${shot.duration},setpts=PTS-STARTPTS,fps=30,scale=1080:1920:flags=lanczos,setsar=1,${grade},format=yuv420p[v${i}]`,
    );
    durs.push(shot.duration);
  }
  let current = "v0";
  let offset = durs[0] - XFADE;
  for (let i = 1; i < reelShots.length; i += 1) {
    const out = i === reelShots.length - 1 ? "out" : `x${i}`;
    filters.push(`[${current}][v${i}]xfade=transition=fade:duration=${XFADE}:offset=${offset.toFixed(3)}[${out}]`);
    current = out;
    if (i < reelShots.length - 1) offset += durs[i] - XFADE;
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
  if (probe.duration < reelMin || probe.duration > reelMax) throw new Error(`reel_duration_${probe.duration}`);
  return probe;
}

function registerSourceReel(sourceReelPath) {
  const hash = createHash("sha256").update(readFileSync(sourceReelPath)).digest("hex");
  const rel = `sources/${hash}/source.mp4`;
  const abs = `/var/lib/tdg/clip-factory/${rel}`;
  mkdirSync(dirname(abs), { recursive: true });
  if (!existsSync(abs)) {
    spawnSync("cp", ["-f", sourceReelPath, abs], { encoding: "utf8" });
  }
  return rel;
}

async function imagePublicUrl(imagePath) {
  const upload = await hfJson("POST", "/files/generate-upload-url", { content_type: "image/jpeg" });
  const uploadUrl = String(upload.upload_url || "");
  const publicUrl = String(upload.public_url || "");
  if (!uploadUrl || !publicUrl) throw new Error("image_public_url_missing");
  const bytes = readFileSync(imagePath);
  const put = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": "image/jpeg" }, body: bytes });
  if (!put.ok) throw new Error("image_upload_failed");
  return publicUrl;
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

function loadManifest(prodDir) {
  const p = join(prodDir, "manifest.json");
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

function saveManifest(prodDir, manifest) {
  writeFileSync(join(prodDir, "manifest.json"), JSON.stringify(manifest, null, 2));
}

async function ensureLibraryAndFinish(supabase, config, manifest, sourceRel, reelProbe) {
  if (manifest.libraryAssetId) {
    const asset = await supabase.from("library_assets").select("*").eq("id", manifest.libraryAssetId).maybeSingle();
    if (asset.data?.publish_status === "ready_to_publish" && asset.data?.publisher_eligible) {
      return manifest.libraryAssetId;
    }
    if (asset.data?.id) {
      await supabase
        .from("library_assets")
        .update({
          source_video_path: sourceRel,
          storage_path: sourceRel,
          publish_status: "pending_finish",
          finish_error: null,
        })
        .eq("id", manifest.libraryAssetId);
      await apiPost("/api/christmas-reel-pipeline?action=queue_finish", { library_asset_id: manifest.libraryAssetId });
    }
  } else {

  const title = config.theme.slice(0, 120);
  const inserted = await supabase
    .from("library_assets")
    .insert({
      title,
      description: `${config.style} — TDG premium orchestrator pack ${config.packSlug}`,
      src: `/api/christmas-reel-pipeline?action=media&id=pending`,
      filename: `${config.packSlug}.mp4`,
      category: "christmas_reels",
      kind: "video",
      duration_seconds: reelProbe.duration,
      width: reelProbe.width,
      height: reelProbe.height,
      provenance: {
        source: "tdg_premium_content_orchestrator",
        pack_slug: config.packSlug,
        theme: config.theme,
        style: config.style,
        scenes: manifest.scenes,
        clips: manifest.clips,
        models: manifest.models,
        cost_usd: manifest.costs,
      },
      content_tags: ["premium_pack", slugify(config.theme).slice(0, 32)],
      publish_status: "pending_finish",
      publisher_eligible: false,
      source_video_path: sourceRel,
      storage_bucket: "vps",
      storage_path: sourceRel,
    })
    .select("id")
    .single();
    if (inserted.error) throw inserted.error;
    manifest.libraryAssetId = inserted.data.id;
    saveManifest(config.prodDir, manifest);
    await apiPost("/api/christmas-reel-pipeline?action=queue_finish", { library_asset_id: inserted.data.id });
  }

  const libraryAssetId = manifest.libraryAssetId;
  for (let i = 0; i < 40; i += 1) {
    await apiPost("/api/christmas-reel-pipeline?action=tick");
    const asset = await supabase
      .from("library_assets")
      .select("publish_status,publisher_eligible,finish_error,music_track_id,src")
      .eq("id", libraryAssetId)
      .single();
    log("finish_tick", { attempt: i + 1, asset: asset.data });
    if (asset.data?.publish_status === "ready_to_publish" && asset.data?.publisher_eligible) {
      manifest.musicTrackId = asset.data.music_track_id;
      return libraryAssetId;
    }
    if (asset.data?.publish_status === "failed") throw new Error(asset.data.finish_error || "finish_failed");
    await new Promise((r) => setTimeout(r, 8000));
  }
  throw new Error("finish_timeout");
}

async function publishReel(supabase, config, manifest, libraryAssetId, caption) {
  if (!config.publish) {
    log("publish_skipped", { libraryAssetId });
    return { skipped: true };
  }

  const { data: existingPub } = await supabase
    .from("publisher_publications")
    .select("id,status")
    .eq("library_asset_id", libraryAssetId)
    .neq("status", "cancelled")
    .order("created_at", { ascending: false })
    .limit(1);
  if (manifest.publicationId) {
    log("publish_resume", { publicationId: manifest.publicationId });
  } else if (existingPub?.length) {
    manifest.publicationId = existingPub[0].id;
    saveManifest(config.prodDir, manifest);
    log("publish_existing", { publicationId: manifest.publicationId });
  } else {
    const scheduledAt = new Date().toISOString();
    manifest.scheduledAt = scheduledAt;
    const pub = await apiPost("/api/publisher", {
      action: "create_manual",
      library_asset_id: libraryAssetId,
      destinations: ["instagram_reel_post", "facebook_reel_post", "youtube_short"],
      scheduled_at: scheduledAt,
      approve: true,
      caption,
    });
    if (pub.status === 200) {
      manifest.publicationId = pub.json?.publication?.id;
      saveManifest(config.prodDir, manifest);
      log("publication_created", { publicationId: manifest.publicationId });
    } else if (String(pub.json?.message || "").includes("already exists")) {
      log("publication_duplicate_blocked", pub.json);
    } else {
      throw new Error(JSON.stringify(pub.json));
    }
  }

  const publicationId = manifest.publicationId;
  if (!publicationId) return { error: "no_publication_id" };

  for (let i = 0; i < 30; i += 1) {
    await apiPost("/api/publisher", { action: "tick" });
    const jobs = await supabase
      .from("publisher_destination_jobs")
      .select("destination,status,remote_post_id,remote_url,last_error")
      .eq("publication_id", publicationId);
    const { data: socialPub } = await supabase
      .from("social_publications")
      .select("id")
      .eq("publisher_publication_id", publicationId)
      .maybeSingle();
    let targets = [];
    if (socialPub?.id) {
      const t = await supabase
        .from("social_publication_targets")
        .select("platform,status,remote_post_id,remote_url,last_error")
        .eq("publication_id", socialPub.id);
      targets = t.data || [];
    }
    manifest.publish = { jobs: jobs.data, targets };
    saveManifest(config.prodDir, manifest);
    log("publisher_tick", { attempt: i + 1, jobs: jobs.data, targets });
    const done = (jobs.data || []).every((j) => ["completed", "failed"].includes(j.status));
    const published = (targets || []).some((t) => t.remote_post_id || t.remote_url);
    if (done && published) break;
    await new Promise((r) => setTimeout(r, 12000));
  }
  return manifest.publish;
}

export async function runPremiumContentOrchestrator(overrides = {}) {
  if (overrides.theme) process.env.TDG_THEME = String(overrides.theme);
  if (overrides.style) process.env.TDG_STYLE = String(overrides.style);
  if (overrides.sceneCount != null) process.env.TDG_SCENE_COUNT = String(overrides.sceneCount);
  if (overrides.publish === false) process.env.TDG_PUBLISH = "0";
  const config = { ...loadConfig(), ...overrides };
  mkdirSync(config.prodDir, { recursive: true });

  let manifest = loadManifest(config.prodDir) || {
    packSlug: config.packSlug,
    theme: config.theme,
    style: config.style,
    models: { image: IMAGE_MODEL, video: KLING_MODEL },
    costs: { imageUsd: 0, videoUsd: 0, totalUsd: 0 },
    scenes: [],
    clips: [],
    images: [],
    reel: null,
    libraryAssetId: null,
    publicationId: null,
    publish: {},
  };

  const reelTarget = (config.reelMin + config.reelMax) / 2;
  const reelShots = buildReelShots(config.sceneCount, reelTarget);
  const sceneDefs = await generateScenePack(config);
  manifest.scenes = sceneDefs;
  saveManifest(config.prodDir, manifest);

  const vSuffix = visualSuffix(config.style);
  const mSuffix = motionSuffix(config.clipDuration);

  for (let index = 0; index < sceneDefs.length; index += 1) {
    const scene = sceneDefs[index];
    const imagePrompt = `${scene.imageCore}${vSuffix}`;
    const imagePath = join(config.prodDir, `clip-${index}.jpg`);
    const videoPath = join(config.prodDir, `clip-${index}.mp4`);

    if (config.resume && existsSync(videoPath)) {
      const qc = runClipQc(videoPath, config.clipDuration);
      if (qc.ok) {
        manifest.clips = manifest.clips.filter((c) => c.index !== index);
        manifest.clips.push({ index, id: scene.id, videoPath, resumed: true, probe: qc.probe });
        saveManifest(config.prodDir, manifest);
        log("clip_skip_existing", { index, id: scene.id });
        continue;
      }
      unlinkSync(videoPath);
    }

    let imageUrl = null;
    if (!(config.resume && existsSync(imagePath))) {
      for (let attempt = 1; attempt <= MAX_IMAGE_ATTEMPTS; attempt += 1) {
        log("image_submit", { index, id: scene.id, attempt });
        const submitted = await hfJson("POST", `/${IMAGE_MODEL}`, { prompt: imagePrompt, aspect_ratio: "9:16" });
        const requestId = String(submitted.request_id || "");
        if (!requestId) throw new Error("image_request_missing");
        const polled = await pollRequest(requestId, { maxAttempts: 90, sleepMs: 4000 });
        if (!polled.ok || !polled.body) throw new Error(`image_failed_${scene.id}`);
        imageUrl = extractImageUrl(polled.body);
        if (!imageUrl) throw new Error(`image_url_missing_${scene.id}`);
        await downloadUrl(imageUrl, imagePath);
        manifest.costs.imageUsd += Number(process.env.TDG_IMAGE_ESTIMATE_USD || 0.05);
        const qc = await runImageQc(imagePath, imagePrompt);
        log("image_qc", { index, id: scene.id, qc });
        manifest.images = manifest.images.filter((r) => r.index !== index);
        manifest.images.push({ index, id: scene.id, imagePath, qc });
        saveManifest(config.prodDir, manifest);
        if (qc.verdict === "PASS") break;
        if (qc.verdict === "REJECT" && attempt >= MAX_IMAGE_ATTEMPTS) {
          throw new Error(`image_qc_reject_${scene.id}:${qc.reason}`);
        }
      }
    } else {
      log("image_skip_existing", { index, id: scene.id });
    }

    if (!existsSync(imagePath)) throw new Error(`missing_image_${index}`);
    if (!imageUrl) imageUrl = await imagePublicUrl(imagePath);

    const motionPrompt = `${scene.motionCore}${mSuffix}`;
    for (let attempt = 1; attempt <= MAX_CLIP_ATTEMPTS; attempt += 1) {
      log("video_submit", { index, id: scene.id, attempt });
      const est = await hfJson("POST", KLING_ESTIMATE, {
        image_url: imageUrl,
        prompt: motionPrompt,
        duration: config.clipDuration,
        sound: "off",
      });
      manifest.costs.videoUsd += parseUsd(est);
      const vsub = await hfJson("POST", KLING_PATH, {
        image_url: imageUrl,
        prompt: motionPrompt,
        duration: config.clipDuration,
        sound: "off",
      });
      const vidReq = String(vsub.request_id || "");
      if (!vidReq) throw new Error("video_request_missing");
      const vpolled = await pollRequest(vidReq, { maxAttempts: 120, sleepMs: 5000 });
      if (!vpolled.ok || !vpolled.body) {
        if (attempt >= MAX_CLIP_ATTEMPTS) throw new Error(`video_failed_${scene.id}`);
        continue;
      }
      const videoUrl = extractVideoUrl(vpolled.body);
      if (!videoUrl) throw new Error(`video_url_missing_${scene.id}`);
      await downloadUrl(videoUrl, videoPath);
      const clipQc = runClipQc(videoPath, config.clipDuration);
      log("clip_qc", { index, id: scene.id, clipQc });
      if (!clipQc.ok) {
        unlinkSync(videoPath);
        if (attempt >= MAX_CLIP_ATTEMPTS) throw new Error(clipQc.reason || "clip_qc_failed");
        continue;
      }
      manifest.clips = manifest.clips.filter((c) => c.index !== index);
      manifest.clips.push({ index, id: scene.id, videoPath, probe: clipQc.probe, attempt });
      manifest.costs.totalUsd = manifest.costs.imageUsd + manifest.costs.videoUsd;
      saveManifest(config.prodDir, manifest);
      log("clip_ready", { index, id: scene.id, probe: clipQc.probe });
      break;
    }
  }

  const clipPaths = sceneDefs.map((_, i) => join(config.prodDir, `clip-${i}.mp4`));
  for (const p of clipPaths) {
    if (!existsSync(p)) throw new Error(`missing_clip_${p}`);
  }

  const sourceReel = join(config.prodDir, "source-reel.mp4");
  if (!(config.resume && existsSync(sourceReel))) {
    const reelProbe = assembleReel(clipPaths, reelShots, sourceReel, config.reelMin, config.reelMax);
    manifest.reel = { path: sourceReel, probe: reelProbe, shots: reelShots };
    saveManifest(config.prodDir, manifest);
    log("reel_assembled", manifest.reel);
  } else {
    manifest.reel = { path: sourceReel, probe: ffprobe(sourceReel), resumed: true };
  }

  const sourceRel = registerSourceReel(sourceReel);
  manifest.sourceRel = sourceRel;
  saveManifest(config.prodDir, manifest);

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const caption = manifest.caption || (await generateCaption(config));
  manifest.caption = caption;
  saveManifest(config.prodDir, manifest);

  const libraryAssetId = await ensureLibraryAndFinish(supabase, config, manifest, sourceRel, manifest.reel.probe);
  manifest.libraryAssetId = libraryAssetId;
  saveManifest(config.prodDir, manifest);

  const publishResult = await publishReel(supabase, config, manifest, libraryAssetId, caption);
  manifest.publish = publishResult;
  manifest.costs.totalUsd = manifest.costs.imageUsd + manifest.costs.videoUsd;
  saveManifest(config.prodDir, manifest);

  const report = {
    packSlug: config.packSlug,
    prodDir: config.prodDir,
    theme: config.theme,
    models: manifest.models,
    costs: manifest.costs,
    images: manifest.images.map((i) => i.imagePath),
    clips: manifest.clips.map((c) => c.videoPath),
    reel: manifest.reel?.path,
    libraryAssetId,
    publicationId: manifest.publicationId,
    musicTrackId: manifest.musicTrackId,
    publish: manifest.publish,
  };
  log("complete", report);
  return report;
}

if (process.argv[1]?.includes("tdg-premium-content-orchestrator.mjs")) {
  runPremiumContentOrchestrator().catch((error) => {
    console.error(JSON.stringify({ step: "fatal", message: error instanceof Error ? error.message : String(error) }));
    process.exit(1);
  });
}
