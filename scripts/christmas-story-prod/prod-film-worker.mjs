#!/usr/bin/env node
/**
 * Contabo film worker — claims DB jobs, FFmpeg render, private bucket upload.
 */
import { createClient } from "@supabase/supabase-js";
import { randomUUID, createHash } from "node:crypto";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join, resolve, basename } from "node:path";
import { loadContaboEnv, requireSupabaseEnv } from "./loadEnv.mjs";
import { heartbeatJob, failJob, maybeAdvanceOrderReview } from "./supabaseJob.mjs";
import { renderMemoryFilm } from "../../server/christmas-story-media/ffmpegFilm.ts";
import { buildMediaCostModel } from "../../server/christmas-story-media/costModel.ts";

const root = resolve(process.cwd());
const args = new Set(process.argv.slice(2));
const once = args.has("--once");
const workerId = process.env.CS_FILM_WORKER_ID || `film-${randomUUID().slice(0, 10)}`;
const workRoot = resolve(root, process.env.CS_MEDIA_WORK_DIR || "artifacts/christmas-story-prod/work");
loadContaboEnv();
const { url, key } = requireSupabaseEnv();
const service = createClient(url, key, { auth: { persistSession: false } });

mkdirSync(workRoot, { recursive: true });

async function downloadBucketObject(bucket, path, dest) {
  const { data, error } = await service.storage.from(bucket).download(path);
  if (error || !data) throw new Error(`download_failed:${bucket}/${path}`);
  const buf = Buffer.from(await data.arrayBuffer());
  mkdirSync(join(dest, ".."), { recursive: true });
  writeFileSync(dest, buf);
  return dest;
}

async function resolvePhotoPaths(orderId, workDir) {
  const { data: assets } = await service
    .from("christmas_story_assets")
    .select("storage_bucket,storage_path,asset_kind")
    .eq("order_id", orderId)
    .eq("asset_kind", "photo")
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  const paths = [];
  for (const a of assets || []) {
    const dest = join(workDir, "photos", basename(a.storage_path));
    await downloadBucketObject(a.storage_bucket, a.storage_path, dest);
    paths.push(dest);
  }
  if (paths.length >= 4) return paths;

  const { data: listed } = await service.storage.from("christmas-story-source").list(`${orderId}/source`, { limit: 20 });
  for (const item of listed || []) {
    if (!item.name || item.name.endsWith("/")) continue;
    const remote = `${orderId}/source/${item.name}`;
    const dest = join(workDir, "photos", item.name);
    await downloadBucketObject("christmas-story-source", remote, dest);
    paths.push(dest);
  }
  return paths;
}

async function resolveSongAudio(orderId, workDir) {
  const { data: songJob } = await service
    .from("christmas_story_jobs")
    .select("status,result_asset_id")
    .eq("order_id", orderId)
    .eq("job_type", "song")
    .maybeSingle();
  if (!songJob || songJob.status !== "ready") return null;

  const { data: asset } = songJob.result_asset_id
    ? await service
        .from("christmas_story_assets")
        .select("storage_bucket,storage_path")
        .eq("id", songJob.result_asset_id)
        .maybeSingle()
    : await service
        .from("christmas_story_assets")
        .select("storage_bucket,storage_path")
        .eq("order_id", orderId)
        .eq("asset_kind", "song")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
  if (!asset) return null;
  const dest = join(workDir, basename(asset.storage_path));
  await downloadBucketObject(asset.storage_bucket, asset.storage_path, dest);
  return dest;
}

async function processOne() {
  const { data: job, error } = await service.rpc("christmas_story_claim_job", {
    p_worker_id: workerId,
    p_job_type: "film",
    p_lease_seconds: 240,
  });
  if (error) throw error;
  if (!job?.id) return false;

  console.log(JSON.stringify({ event: "claimed", jobId: job.id, orderId: job.order_id, attempt: job.attempts }));
  const workDir = join(workRoot, String(job.order_id), String(job.id));
  mkdirSync(workDir, { recursive: true });
  const beat = setInterval(() => {
    heartbeatJob(service, job.id, workerId, 240).catch(() => {});
  }, 30_000);

  try {
    const { data: order, error: orderErr } = await service
      .from("christmas_story_orders")
      .select("id,recipient_name,content")
      .eq("id", job.order_id)
      .single();
    if (orderErr || !order) throw new Error("order_not_found");

    const photos = await resolvePhotoPaths(job.order_id, workDir);
    if (photos.length < 4) throw new Error("photo_count_invalid");

    const audioPath = await resolveSongAudio(job.order_id, workDir);
    if (!audioPath) throw new Error("song_pending");

    const meta = job.metadata || {};
    const content = order.content || {};
    const captions = Array.isArray(meta.captions)
      ? meta.captions.map(String)
      : Array.isArray(content.memories)
        ? content.memories.map((m) => String(m).slice(0, 80)).slice(0, photos.length)
        : [];

    const renderStarted = Date.now();
    const result = await renderMemoryFilm(
      {
        photos,
        recipientName: String(order.recipient_name || meta.recipientName || "you"),
        dedication: String(content.dedication || meta.dedication || ""),
        captions,
        audioPath,
        aspect: meta.aspect === "portrait" ? "portrait" : "landscape",
        outDir: workDir,
        jobId: job.id,
        template: "warm_cinematic_v2",
      },
      root,
    );
    const renderMs = Date.now() - renderStarted;
    const cost = buildMediaCostModel(result);

    const filmBytes = readFileSync(result.mp4Path);
    const remote = `${job.order_id}/film/${createHash("sha256").update(filmBytes).digest("hex").slice(0, 20)}.mp4`;
    const { error: upErr } = await service.storage.from("christmas-story-generated").upload(remote, filmBytes, {
      contentType: "video/mp4",
      upsert: true,
    });
    if (upErr) throw new Error(`upload_failed:${upErr.message}`);

    const { data: asset, error: assetErr } = await service
      .from("christmas_story_assets")
      .insert({
        order_id: job.order_id,
        asset_kind: "film",
        storage_bucket: "christmas-story-generated",
        storage_path: remote,
        content_type: "video/mp4",
        byte_size: filmBytes.length,
        is_private: true,
        metadata: { checksum: result.checksumSha256, durationSec: result.durationSec, cost, renderMs, workerId },
      })
      .select("id")
      .single();
    if (assetErr) throw assetErr;

    await service
      .from("christmas_story_jobs")
      .update({
        status: "ready",
        result_asset_id: asset.id,
        output_checksum: result.checksumSha256,
        finished_at: new Date().toISOString(),
        worker_id: workerId,
        leased_until: null,
        error_code: null,
        metadata: {
          ...(job.metadata || {}),
          durationSec: result.durationSec,
          renderMs,
          cost,
          storagePath: remote,
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
      content_type: "video/mp4",
      byte_size: filmBytes.length,
      worker_id: workerId,
      checksum_sha256: result.checksumSha256,
    });

    await maybeAdvanceOrderReview(service, job.order_id);
    console.log(
      JSON.stringify({
        event: "completed",
        jobId: job.id,
        assetId: asset.id,
        remote,
        renderMs,
        durationSec: result.durationSec,
      }),
    );
  } catch (err) {
    const code = err instanceof Error ? err.message.split(":")[0] : "render_failed";
    await failJob(service, job, workerId, code, "render");
    console.error(JSON.stringify({ event: "failed", jobId: job.id, code }));
  } finally {
    clearInterval(beat);
  }
  return true;
}

console.log(JSON.stringify({ event: "worker_started", workerId, workRoot }));

if (once) {
  const worked = await processOne();
  process.exit(worked ? 0 : 2);
}
for (;;) {
  const worked = await processOne();
  if (!worked) await new Promise((r) => setTimeout(r, 2000));
}