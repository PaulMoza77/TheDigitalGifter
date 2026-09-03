/**
 * Server-side Santa still + TTS mux → one MP4 (ffmpeg).
 * Called by christmas-santa-generate when lipsync models are unavailable.
 * Auth: service role bearer.
 */
import { spawn } from "node:child_process";
import { createWriteStream, promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { asString, isUuid } from "./_lib/christmas/crypto";
import { getServiceClient, isServiceRoleRequest } from "./_lib/christmas/supabaseClient";

const RESULT_BUCKET = "christmas-generated";

async function downloadToFile(url: string, dest: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`download_failed:${res.status}`);
  const nodeStream = Readable.fromWeb(res.body as import("node:stream/web").ReadableStream);
  await pipeline(nodeStream, createWriteStream(dest));
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
      if (stderr.length > 4000) stderr = stderr.slice(-4000);
    });
    child.on("error", (err) => reject(err));
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg_exit_${code}:${stderr.slice(0, 500)}`));
    });
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  const auth = req.headers.authorization;
  const composeSecret = asString(process.env.CHRISTMAS_SANTA_COMPOSE_SECRET);
  const bearer = asString(auth).replace(/^Bearer\s+/i, "");
  const headerSecret = asString(
    req.headers["x-tdg-compose-secret"] || req.headers["x-christmas-santa-compose-secret"],
  );
  const authorized =
    isServiceRoleRequest(auth) ||
    (composeSecret.length > 0 && (bearer === composeSecret || headerSecret === composeSecret));
  if (!authorized) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const body = (typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {}) as {
    image_url?: string;
    audio_url?: string;
    order_id?: string;
  };
  const imageUrl = asString(body.image_url);
  const audioUrl = asString(body.audio_url);
  const orderId = asString(body.order_id);
  if (!imageUrl || !audioUrl || !isUuid(orderId)) {
    res.status(400).json({ error: "image_url, audio_url, and order_id required" });
    return;
  }

  const workDir = join(tmpdir(), `tdg-santa-compose-${orderId}`);
  const imagePath = join(workDir, "still.jpg");
  const audioPath = join(workDir, "speech.mp3");
  const outPath = join(workDir, "out.mp4");

  try {
    await fs.mkdir(workDir, { recursive: true });
    await downloadToFile(imageUrl, imagePath);
    await downloadToFile(audioUrl, audioPath);
    await runFfmpeg([
      "-y",
      "-loop",
      "1",
      "-i",
      imagePath,
      "-i",
      audioPath,
      "-c:v",
      "libx264",
      "-tune",
      "stillimage",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      "-shortest",
      "-movflags",
      "+faststart",
      outPath,
    ]);

    const bytes = await fs.readFile(outPath);
    const storagePath = `santa/${orderId}/composed.mp4`;
    const service = getServiceClient();
    const { error: upErr } = await service.storage.from(RESULT_BUCKET).upload(storagePath, bytes, {
      contentType: "video/mp4",
      upsert: true,
    });
    if (upErr) throw upErr;

    const signed = await service.storage.from(RESULT_BUCKET).createSignedUrl(storagePath, 60 * 30);
    if (!signed.data?.signedUrl) throw new Error("signed_url_failed");

    res.status(200).json({
      ok: true,
      output_url: signed.data.signedUrl,
      storage_bucket: RESULT_BUCKET,
      storage_path: storagePath,
      mode: "still_audio_mux",
      bytes: bytes.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(502).json({ error: message.slice(0, 400) });
  } finally {
    try {
      await fs.rm(workDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}
