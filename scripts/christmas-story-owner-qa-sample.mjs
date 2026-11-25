#!/usr/bin/env node
/**
 * Owner QA sample — service-role fulfill (Stripe TEST RPC, no LIVE charge),
 * real FFmpeg film + uploaded assets on configured Supabase.
 *
 * Requires env (never commit):
 *   API_EXTERNAL_URL or SUPABASE_URL
 *   SERVICE_ROLE_KEY
 *   SITE_URL (optional, default https://www.thedigitalgifter.com)
 *
 * Optional: OWNER_QA_ENV_FILE=/path/to.env
 */
import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "node:crypto";
import { readFileSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { renderMemoryFilm } from "../server/christmas-story-media/ffmpegFilm.ts";
import { buildMediaCostModel } from "../server/christmas-story-media/costModel.ts";
import { ffprobeJson } from "../server/christmas-story-media/runCommand.ts";

const root = resolve(process.cwd());
const PRICE = 3499;
const OUT = join(root, "artifacts/christmas-story-owner-qa");
const REPORT = join(OUT, "owner-preview-report.json");

function loadEnvFile() {
  const path = process.env.OWNER_QA_ENV_FILE || "/tmp/tdg-story-qa.env";
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

function sha256(value) {
  return createHash("sha256").update(String(value), "utf8").digest("hex");
}

function token() {
  return randomBytes(32).toString("hex");
}

function ensureSongMaster(workDir) {
  const songPath = join(workDir, "qa-instrumental.mp3");
  if (existsSync(songPath)) return songPath;
  const manifest = join(root, "public/assets/music/christmas/LICENSE_MANIFEST.json");
  if (existsSync(manifest)) {
    const tracks = JSON.parse(readFileSync(manifest, "utf8")).tracks || [];
    const pick = tracks.find((t) => t.slug === "silent-night-lofi");
    if (pick?.fileUrl) {
      const r = spawnSync("curl", ["-fsSL", "-o", songPath, pick.fileUrl], { encoding: "utf8" });
      if (r.status === 0 && existsSync(songPath)) return songPath;
    }
  }
  const r = spawnSync(
    "ffmpeg",
    ["-y", "-f", "lavfi", "-i", "sine=frequency=392:duration=45", "-c:a", "libmp3lame", "-b:a", "192k", songPath],
    { encoding: "utf8" },
  );
  if (r.status !== 0) throw new Error(`song_fixture_failed:${r.stderr?.slice(-200)}`);
  return songPath;
}

loadEnvFile();
const supabaseUrl = process.env.SUPABASE_URL || process.env.API_EXTERNAL_URL || "";
const serviceKey = process.env.SERVICE_ROLE_KEY || "";
const siteUrl = (process.env.SITE_URL || "https://www.thedigitalgifter.com").replace(/\/$/, "");

if (!supabaseUrl.startsWith("https://") || !serviceKey) {
  console.error("missing SUPABASE_URL/API_EXTERNAL_URL or SERVICE_ROLE_KEY");
  process.exit(2);
}

mkdirSync(OUT, { recursive: true });
const workDir = join(OUT, `run-${Date.now()}`);
mkdirSync(workDir, { recursive: true });

const service = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
const started = Date.now();

const buyerToken = token();
const recipientToken = token();
const buyerHash = sha256(buyerToken);
const recipientHash = sha256(recipientToken);
const email = "thedigitalgifter@gmail.com";
const idempotencyKey = `owner-qa-${new Date().toISOString().slice(0, 10)}-${randomBytes(4).toString("hex")}`;

const content = {
  dedication: "For every quiet kindness this winter — owner QA sample.",
  memories: ["Tree lights", "Cocoa evenings", "Snowy walks"],
  relationship: "partner",
  recipientName: "Moza",
};

const { data: draft, error: draftErr } = await service
  .from("christmas_story_drafts")
  .insert({
    buyer_access_token_hash: buyerHash,
    buyer_email: email,
    payload: content,
    photo_count: 6,
  })
  .select("id")
  .single();
if (draftErr) throw draftErr;

const { data: order, error: orderErr } = await service
  .from("christmas_story_orders")
  .insert({
    draft_id: draft.id,
    product_key: "our_christmas_story",
    status: "CHECKOUT_PENDING",
    payment_status: "pending",
    amount_cents: PRICE,
    currency: "usd",
    buyer_email: email,
    buyer_access_token_hash: buyerHash,
    stripe_mode: "test",
    idempotency_key: idempotencyKey,
    recipient_name: "Moza",
    from_name: "The Digital Gifter (QA)",
    content,
    digital_consent_at: new Date().toISOString(),
    metadata: { qa: true, stripe_mode: "test", no_live_charge: true, owner_preview: true },
  })
  .select("*")
  .single();
if (orderErr) throw orderErr;

await service.from("christmas_story_access_grants").insert({
  order_id: order.id,
  grant_kind: "recipient",
  token_hash: recipientHash,
  enabled: false,
});

const fakeEvent = `qa_evt_${randomBytes(8).toString("hex")}`;
const { data: fulfill, error: fulfillErr } = await service.rpc("christmas_story_fulfill_payment", {
  p_order_id: order.id,
  p_stripe_session_id: `cs_test_qa_${randomBytes(6).toString("hex")}`,
  p_stripe_payment_intent_id: `pi_test_qa_${randomBytes(6).toString("hex")}`,
  p_amount_cents: PRICE,
  p_currency: "usd",
  p_stripe_event_id: fakeEvent,
});
if (fulfillErr) throw fulfillErr;
if (!fulfill?.ok) throw new Error(`fulfill_rejected:${fulfill?.code}`);

for (const to of ["CONTENT_PENDING", "GENERATING"]) {
  const { error } = await service.rpc("christmas_story_transition_order", {
    p_order_id: order.id,
    p_to: to,
    p_actor: "owner_qa",
    p_metadata: { qa: true },
  });
  if (error) throw error;
}

const { data: jobs, error: jobsErr } = await service
  .from("christmas_story_jobs")
  .insert([
    { order_id: order.id, job_type: "story", provider: "mock", status: "ready" },
    {
      order_id: order.id,
      job_type: "song",
      provider: "manual",
      status: "awaiting_manual",
      production_state: "awaiting_song_production",
    },
    { order_id: order.id, job_type: "film", provider: "ffmpeg", status: "queued" },
  ])
  .select("*");
if (jobsErr) throw jobsErr;

await service.rpc("christmas_story_transition_order", {
  p_order_id: order.id,
  p_to: "REVIEW_REQUIRED",
  p_actor: "owner_qa",
  p_metadata: { note: "media_production" },
});

const stillsDir = join(root, "public/assets/christmas-story-demo/stills");
const manifest = JSON.parse(readFileSync(join(stillsDir, "MANIFEST.json"), "utf8"));
const photoPaths = (manifest.stills || manifest.items || [])
  .map((i) => join(root, String(i.file || "").replace(/^\//, "").replace(/^assets\//, "public/assets/")))
  .filter((p) => existsSync(p));
if (photoPaths.length < 4) throw new Error("insufficient_stills");

for (const localPath of photoPaths.slice(0, 8)) {
  const name = localPath.split("/").pop();
  const remote = `${order.id}/source/${name}`;
  const bytes = readFileSync(localPath);
  const { error } = await service.storage.from("christmas-story-source").upload(remote, bytes, {
    contentType: "image/jpeg",
    upsert: true,
  });
  if (error) throw error;
}

const songPath = ensureSongMaster(workDir);
const renderStarted = Date.now();
const film = await renderMemoryFilm(
  {
    photos: photoPaths.slice(0, 8),
    recipientName: "Moza",
    dedication: content.dedication,
    captions: ["Tree", "Gifts", "Ornaments", "Cocoa", "Lights", "Snow", "Fireplace", "Table"].slice(
      0,
      photoPaths.length,
    ),
    audioPath: songPath,
    aspect: "landscape",
    template: "warm_cinematic_v2",
    secondsPerPhoto: 4,
    outDir: workDir,
    jobId: `owner-qa-${order.id.slice(0, 8)}`,
  },
  root,
);
const renderMs = Date.now() - renderStarted;
const cost = buildMediaCostModel(film);

const filmBytes = readFileSync(film.mp4Path);
const filmRemote = `${order.id}/film/${createHash("sha256").update(filmBytes).digest("hex").slice(0, 20)}.mp4`;
const { error: filmUpErr } = await service.storage.from("christmas-story-generated").upload(filmRemote, filmBytes, {
  contentType: "video/mp4",
  upsert: true,
});
if (filmUpErr) throw filmUpErr;

const songBytes = readFileSync(songPath);
const songRemote = `${order.id}/song/qa-master.mp3`;
const { error: songUpErr } = await service.storage.from("christmas-story-generated").upload(songRemote, songBytes, {
  contentType: "audio/mpeg",
  upsert: true,
});
if (songUpErr) throw songUpErr;

const { data: filmAsset, error: filmAssetErr } = await service
  .from("christmas_story_assets")
  .insert({
    order_id: order.id,
    asset_kind: "film",
    storage_bucket: "christmas-story-generated",
    storage_path: filmRemote,
    content_type: "video/mp4",
    byte_size: filmBytes.length,
    is_private: true,
    metadata: { checksum: film.checksumSha256, qa: true },
  })
  .select("id")
  .single();
if (filmAssetErr) throw filmAssetErr;

const { data: songAsset, error: songAssetErr } = await service
  .from("christmas_story_assets")
  .insert({
    order_id: order.id,
    asset_kind: "song",
    storage_bucket: "christmas-story-generated",
    storage_path: songRemote,
    content_type: "audio/mpeg",
    byte_size: songBytes.length,
    is_private: true,
    metadata: {
      provider: "manual",
      commercial_rights: "CC0 HoliznaCC0 silent-night-lofi via FMA (QA instrumental; custom vocals pending)",
      qa: true,
    },
  })
  .select("id")
  .single();
if (songAssetErr) throw songAssetErr;

const filmJob = jobs.find((j) => j.job_type === "film");
const songJob = jobs.find((j) => j.job_type === "song");
await service
  .from("christmas_story_jobs")
  .update({
    status: "ready",
    result_asset_id: filmAsset.id,
    output_checksum: film.checksumSha256,
    finished_at: new Date().toISOString(),
    metadata: { durationSec: film.durationSec, renderMs, cost },
  })
  .eq("id", filmJob.id);
await service
  .from("christmas_story_jobs")
  .update({
    status: "ready",
    production_state: "ready_for_buyer_review",
    result_asset_id: songAsset.id,
    metadata: { rightsDisclaimer: "QA instrumental only — not a personalized vocal master" },
  })
  .eq("id", songJob.id);

for (const to of ["APPROVED", "READY_TO_SEND", "SENT"]) {
  const { error } = await service.rpc("christmas_story_transition_order", {
    p_order_id: order.id,
    p_to: to,
    p_actor: "owner_qa",
    p_metadata: {},
  });
  if (error) throw error;
}

await service
  .from("christmas_story_access_grants")
  .update({ enabled: true, updated_at: new Date().toISOString() })
  .eq("order_id", order.id)
  .eq("grant_kind", "recipient");

const fnRes = await fetch(`${supabaseUrl.replace(/\/$/, "")}/functions/v1/christmas-story`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
    apikey: serviceKey,
  },
  body: JSON.stringify({
    action: "getRecipientGift",
    recipient_token: recipientToken,
  }),
});

const recipientPayload = await fnRes.json();
const audioProbe = await ffprobeJson(songPath);
const filmProbe = await ffprobeJson(film.mp4Path);

const durationSeconds = Math.round((Date.now() - started) / 1000);
const vpsEstimateUsd = film.renderMs ? Number(((film.renderMs / 1000) * 0.00002).toFixed(4)) : null;

const report = {
  generated_at: new Date().toISOString(),
  sample_url: `${siteUrl}/gift/${recipientToken}`,
  buyer_dashboard_url: `${siteUrl}/christmas-story/order/${order.id}`,
  order_id: order.id,
  buyer_access_token: buyerToken,
  recipient_token: recipientToken,
  cost_usd_estimate: {
    stripe_charge_usd: 0,
    api_generation_usd: 0,
    vps_compute_usd_estimate: vpsEstimateUsd,
    notes: "No LIVE Stripe; fulfill via service_role TEST RPC; film is local FFmpeg on owner Mac.",
  },
  duration_seconds: durationSeconds,
  render_ms: film.renderMs,
  assets_ok: {
    music: Boolean(songAsset.id) && (audioProbe.streams || []).some((s) => s.codec_type === "audio"),
    images: photoPaths.length >= 6,
    video: Boolean(filmAsset.id) && film.hasAudio,
    audio: film.hasAudio,
  },
  rights_notes:
    "Film uses first-party demo stills (MANIFEST). Song job uses CC0 lofi instrumental (HoliznaCC0) as QA stand-in — not a commercial personalized vocal master.",
  automation_payment_to_delivery_status: "partial",
  delivery_email_status: "not_implemented_christmas_story",
  recipient_api_ok: recipientPayload?.ok === true,
  recipient_status: recipientPayload?.gift?.status,
  checkout_enabled: false,
  approved_price_usd_cents: PRICE,
  retry_hooks: {
    christmas_story_claim_job: true,
    christmas_story_heartbeat_job: true,
    local_job_store_retry: true,
    media_revision_request: true,
  },
  blockers: [
    "Christmas Story has no Resend send on markSent (delivery email path partial vs Santa Call).",
    "Custom personalized song still manual — QA used CC0 instrumental.",
    "Remote VPS film worker not deployed on Contabo (render ran on owner Mac, upload to Supabase).",
  ],
  film_metrics: { ...film, cost },
  probes: { film: filmProbe.format, audio: audioProbe.format },
};

writeFileSync(REPORT, JSON.stringify(report, null, 2));
writeFileSync(join(OUT, ".gitkeep"), "");
console.log(JSON.stringify({ ok: true, report_path: REPORT, sample_url: report.sample_url, duration_seconds: durationSeconds }, null, 2));