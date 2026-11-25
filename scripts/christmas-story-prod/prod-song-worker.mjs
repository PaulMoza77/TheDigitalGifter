#!/usr/bin/env node
/**
 * Contabo song worker — licensed CC0 instrumental + honest lyrics brief metadata.
 */
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { readFileSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { loadContaboEnv, requireSupabaseEnv } from "./loadEnv.mjs";
import { resolveLicensedInstrumental, buildLyricsBrief } from "./licensedInstrumental.mjs";
import { heartbeatJob, failJob, maybeAdvanceOrderReview } from "./supabaseJob.mjs";

const root = resolve(process.cwd());
const args = new Set(process.argv.slice(2));
const once = args.has("--once");
const workerId = process.env.CS_SONG_WORKER_ID || `song-${randomUUID().slice(0, 10)}`;
const cacheDir = resolve(root, process.env.CS_SONG_CACHE_DIR || "artifacts/christmas-story-prod/song-cache");
const envFile = loadContaboEnv();
const { url, key } = requireSupabaseEnv();
const service = createClient(url, key, { auth: { persistSession: false } });

async function processOne() {
  const { data: job, error } = await service.rpc("christmas_story_claim_job", {
    p_worker_id: workerId,
    p_job_type: "song",
    p_lease_seconds: 180,
  });
  if (error) throw error;
  if (!job?.id) return false;

  console.log(JSON.stringify({ event: "claimed", jobId: job.id, orderId: job.order_id, attempt: job.attempts }));
  const beat = setInterval(() => {
    heartbeatJob(service, job.id, workerId, 180).catch(() => {});
  }, 30_000);

  try {
    const { data: order, error: orderErr } = await service
      .from("christmas_story_orders")
      .select("id,recipient_name,content")
      .eq("id", job.order_id)
      .single();
    if (orderErr || !order) throw new Error("order_not_found");

    const slug = job.metadata?.fmaSlug || "silent-night-lofi";
    const track = await resolveLicensedInstrumental(root, cacheDir, String(slug));
    const lyricsBrief = buildLyricsBrief(order);
    const bytes = readFileSync(track.localPath);
    const remote = `${job.order_id}/song/${track.checksum.slice(0, 16)}-${track.meta.trackSlug}.mp3`;

    const { error: upErr } = await service.storage.from("christmas-story-generated").upload(remote, bytes, {
      contentType: "audio/mpeg",
      upsert: true,
    });
    if (upErr) throw new Error(`upload_failed:${upErr.message}`);

    const { data: asset, error: assetErr } = await service
      .from("christmas_story_assets")
      .insert({
        order_id: job.order_id,
        asset_kind: "song",
        storage_bucket: "christmas-story-generated",
        storage_path: remote,
        content_type: "audio/mpeg",
        byte_size: bytes.length,
        is_private: true,
        metadata: {
          ...track.meta,
          checksum: track.checksum,
          lyricsBrief,
          vocalStatus: "instrumental_only",
        },
      })
      .select("id")
      .single();
    if (assetErr) throw assetErr;

    await service
      .from("christmas_story_jobs")
      .update({
        status: "ready",
        provider: "licensed_fma",
        production_state: "ready_for_buyer_review",
        result_asset_id: asset.id,
        output_checksum: track.checksum,
        commercial_rights: track.meta.commercial_rights,
        finished_at: new Date().toISOString(),
        worker_id: workerId,
        leased_until: null,
        metadata: {
          ...(job.metadata || {}),
          automate: "licensed_cc0_instrumental",
          rightsDisclaimer: track.meta.disclaimer,
          lyricsBrief,
          fmaSlug: track.meta.trackSlug,
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id)
      .eq("worker_id", workerId);

    await service.from("christmas_story_worker_uploads").insert({
      order_id: job.order_id,
      job_id: job.id,
      asset_id: asset.id,
      storage_bucket: "christmas-story-generated",
      storage_path: remote,
      content_type: "audio/mpeg",
      byte_size: bytes.length,
      worker_id: workerId,
      checksum_sha256: track.checksum,
    });

    await maybeAdvanceOrderReview(service, job.order_id);
    console.log(JSON.stringify({ event: "completed", jobId: job.id, assetId: asset.id, remote }));
  } catch (err) {
    const code = err instanceof Error ? err.message.split(":")[0] : "song_failed";
    await failJob(service, job, workerId, code, "song");
    console.error(JSON.stringify({ event: "failed", jobId: job.id, code }));
  } finally {
    clearInterval(beat);
  }
  return true;
}

mkdirSync(cacheDir, { recursive: true });
console.log(JSON.stringify({ event: "worker_started", workerId, envFile, cacheDir }));

if (once) {
  const worked = await processOne();
  process.exit(worked ? 0 : 2);
}
for (;;) {
  const worked = await processOne();
  if (!worked) await new Promise((r) => setTimeout(r, 2000));
}