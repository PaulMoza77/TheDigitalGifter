#!/usr/bin/env node
/**
 * Two fully automated Christmas Story samples on Contabo (no LIVE Stripe).
 * Writes artifacts/christmas-story-prod/e2e-report.json
 */
import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "node:crypto";
import { readFileSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { loadContaboEnv, requireSupabaseEnv } from "./loadEnv.mjs";

const root = resolve(process.cwd());
const PRICE = 3499;
const OUT = join(root, "artifacts/christmas-story-prod");
const REPORT = join(OUT, "e2e-report.json");
const EMAIL = "thedigitalgifter@gmail.com";
const SITE = (process.env.SITE_URL || "https://www.thedigitalgifter.com").replace(/\/$/, "");

function sha256(value) {
  return createHash("sha256").update(String(value), "utf8").digest("hex");
}
function token() {
  return randomBytes(32).toString("hex");
}

function runWorker(script, extraArgs = []) {
  const r = spawnSync(
    process.execPath,
    ["--experimental-strip-types", join(root, script), "--once", ...extraArgs],
    {
      cwd: root,
      encoding: "utf8",
      env: {
        ...process.env,
        CS_WORKER_ENV_FILE: process.env.CS_WORKER_ENV_FILE || "/opt/supabase/tdg/.env",
      },
      timeout: 600_000,
    },
  );
  return { status: r.status, stdout: r.stdout?.slice(-2000), stderr: r.stderr?.slice(-2000) };
}

loadContaboEnv();
const { url, key } = requireSupabaseEnv();
const service = createClient(url, key, { auth: { persistSession: false } });
mkdirSync(OUT, { recursive: true });

const started = Date.now();
const samples = [];

const stillsDir = join(root, "public/assets/christmas-story-demo/stills");
const manifest = JSON.parse(readFileSync(join(stillsDir, "MANIFEST.json"), "utf8"));
const photoPaths = (manifest.stills || manifest.items || [])
  .map((i) =>
    join(root, String(i.file || "").replace(/^\//, "").replace(/^assets\//, "public/assets/")),
  )
  .filter((p) => existsSync(p));

const recipients = [
  { name: "Moza", dedication: "For every quiet kindness this winter — sample A." },
  { name: "Emma", dedication: "Snow, cocoa, and kept promises — sample B." },
];

for (let i = 0; i < 2; i++) {
  const sampleStarted = Date.now();
  const buyerToken = token();
  const recipientToken = token();
  const buyerHash = sha256(buyerToken);
  const recipientHash = sha256(recipientToken);
  const idempotencyKey = `contabo-auto-${new Date().toISOString().slice(0, 10)}-${i}-${randomBytes(3).toString("hex")}`;
  const content = {
    dedication: recipients[i].dedication,
    memories: ["Tree lights", "Cocoa evenings", "Snowy walks", "Fireplace"],
    relationship: "partner",
    recipientName: recipients[i].name,
  };

  const { data: draft, error: draftErr } = await service
    .from("christmas_story_drafts")
    .insert({
      buyer_access_token_hash: buyerHash,
      buyer_email: EMAIL,
      payload: content,
      photo_count: Math.min(photoPaths.length, 8),
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
      buyer_email: EMAIL,
      buyer_access_token_hash: buyerHash,
      stripe_mode: "test",
      idempotency_key: idempotencyKey,
      recipient_name: recipients[i].name,
      from_name: "The Digital Gifter (Contabo auto)",
      content,
      digital_consent_at: new Date().toISOString(),
      metadata: { qa: true, contabo_automation: true, no_live_charge: true },
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

  const fakeEvent = `contabo_evt_${randomBytes(8).toString("hex")}`;
  const { data: fulfill, error: fulfillErr } = await service.rpc("christmas_story_fulfill_payment", {
    p_order_id: order.id,
    p_stripe_session_id: `cs_test_contabo_${randomBytes(6).toString("hex")}`,
    p_stripe_payment_intent_id: `pi_test_contabo_${randomBytes(6).toString("hex")}`,
    p_amount_cents: PRICE,
    p_currency: "usd",
    p_stripe_event_id: fakeEvent,
  });
  if (fulfillErr || !fulfill?.ok) throw fulfillErr || new Error("fulfill_rejected");

  for (const to of ["CONTENT_PENDING", "GENERATING"]) {
    const { error } = await service.rpc("christmas_story_transition_order", {
      p_order_id: order.id,
      p_to: to,
      p_actor: "contabo_e2e",
      p_metadata: { qa: true },
    });
    if (error) throw error;
  }

  const { error: jobsInsertErr } = await service.from("christmas_story_jobs").insert([
    { order_id: order.id, job_type: "story", provider: "mock", status: "ready", metadata: {} },
    {
      order_id: order.id,
      job_type: "song",
      provider: "licensed_fma",
      status: "queued",
      production_state: "awaiting_song_production",
      metadata: { automate: "licensed_cc0_instrumental", fmaSlug: i === 0 ? "silent-night-lofi" : "o-holy-night-lofi" },
    },
    { order_id: order.id, job_type: "film", provider: "ffmpeg", status: "queued", metadata: {} },
  ]);
  if (jobsInsertErr) throw jobsInsertErr;

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

  const songRun = runWorker("scripts/christmas-story-prod/prod-song-worker.mjs");
  let filmRun = { status: 2 };
  for (let attempt = 0; attempt < 8; attempt++) {
    filmRun = runWorker("scripts/christmas-story-prod/prod-film-worker.mjs");
    if (filmRun.status === 0) break;
    await new Promise((r) => setTimeout(r, 1500));
  }

  const { data: jobs, error: jobsReadErr } = await service
    .from("christmas_story_jobs")
    .select("job_type,status,metadata,output_checksum")
    .eq("order_id", order.id);
  if (jobsReadErr) throw jobsReadErr;
  if (!jobs?.some((j) => j.job_type === "song" && j.status === "ready")) {
    throw new Error(`song_not_ready:${order.id}`);
  }
  if (!jobs?.some((j) => j.job_type === "film" && j.status === "ready")) {
    throw new Error(`film_not_ready:${order.id}`);
  }

  await service.rpc("christmas_story_transition_order", {
    p_order_id: order.id,
    p_to: "REVIEW_REQUIRED",
    p_actor: "contabo_e2e",
    p_metadata: { media_ready: true },
  });

  for (const to of ["APPROVED", "READY_TO_SEND"]) {
    const { error } = await service.rpc("christmas_story_transition_order", {
      p_order_id: order.id,
      p_to: to,
      p_actor: "contabo_e2e",
      p_metadata: {},
    });
    if (error) throw error;
  }

  const markRes = await fetch(`${url.replace(/\/$/, "")}/functions/v1/christmas-story`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      apikey: key,
    },
    body: JSON.stringify({
      action: "markSent",
      order_id: order.id,
      buyer_access_token: buyerToken,
      recipient_token: recipientToken,
      delivery_email: EMAIL,
    }),
  });
  const markBody = await markRes.json();

  const recipientRes = await fetch(`${url.replace(/\/$/, "")}/functions/v1/christmas-story`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      apikey: key,
    },
    body: JSON.stringify({ action: "getRecipientGift", recipient_token: recipientToken }),
  });
  const recipientPayload = await recipientRes.json();

  const filmJob = (jobs || []).find((j) => j.job_type === "film");
  const songJob = (jobs || []).find((j) => j.job_type === "song");
  const filmCost = filmJob?.metadata?.cost || {};
  const renderMs = filmJob?.metadata?.renderMs || null;

  samples.push({
    label: `sample_${i + 1}`,
    order_id: order.id,
    recipient_gift_url: `${SITE}/gift/${recipientToken}`,
    recipient_api_ok: recipientPayload?.ok === true,
    jobs_ready: {
      song: songJob?.status === "ready",
      film: filmJob?.status === "ready",
    },
    worker_runs: { song: songRun.status, film: filmRun.status },
    delivery_email: markBody?.deliveryEmail || null,
    duration_seconds: Math.round((Date.now() - sampleStarted) / 1000),
    cost_breakdown_usd: {
      stripe_charge: 0,
      ai_generation: 0,
      image_generation: 0,
      video_ffmpeg_compute_estimate: renderMs ? Number(((renderMs / 1000) * 0.00002).toFixed(5)) : 0,
      music_licensed_cc0: 0,
      storage_estimate: 0,
      retry: 0,
      notes: "Measured renderMs from worker; dollar estimates are operational placeholders.",
      measured: { renderMs, filmCost },
    },
  });
}

const report = {
  generated_at: new Date().toISOString(),
  host: "tdg-contabo",
  duration_seconds: Math.round((Date.now() - started) / 1000),
  checkout_enabled: false,
  approved_price_usd_cents: PRICE,
  approved_price_ron_cents: 14900,
  samples,
  rights_notes: "Licensed CC0 instrumental (HoliznaCC0 / FMA manifest). Lyrics brief in metadata; instrumental_only.",
  worker_health: {
    song_worker_exit: samples.every((s) => s.worker_runs.song === 0) ? "PASS" : "FAIL",
    film_worker_exit: samples.every((s) => s.worker_runs.film === 0) ? "PASS" : "FAIL",
  },
};

writeFileSync(REPORT, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ ok: true, report_path: REPORT, samples: samples.map((s) => s.recipient_gift_url) }, null, 2));