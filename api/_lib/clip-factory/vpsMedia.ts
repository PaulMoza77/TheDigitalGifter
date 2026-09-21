import { createHash } from "node:crypto";
import { createReadStream, existsSync, statSync, type Stats } from "node:fs";
import { mkdir, open, rename, rm, stat, truncate } from "node:fs/promises";
import { statfs } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { dirname, resolve, sep } from "node:path";
import { pipeline } from "node:stream/promises";
import { ffprobeFile, runCommand } from "./ffmpeg";
import { isSafeRelpath, VPS_FREE_HEADROOM_BYTES } from "../../../src/features/clip-factory/vpsTransfer";

export function mediaRoot(): string {
  return process.env.CLIP_FACTORY_MEDIA_ROOT || "/var/lib/tdg/clip-factory";
}

export function resolveMediaPath(rel: string): string {
  if (!isSafeRelpath(rel)) throw new Error("unsafe media path");
  const root = resolve(mediaRoot());
  const abs = resolve(root, rel);
  if (abs !== root && !abs.startsWith(`${root}${sep}`)) throw new Error("unsafe media path");
  return abs;
}

export async function fileSize(abs: string): Promise<number> {
  try {
    const info = await stat(abs);
    return info.size;
  } catch {
    return 0;
  }
}

export async function freeBytes(absDir: string): Promise<number | null> {
  try {
    const info = await statfs(absDir);
    return Number(info.bavail) * Number(info.bsize);
  } catch {
    return null;
  }
}

export async function assertRoom(rel: string, stillNeeded: number): Promise<void> {
  const abs = resolveMediaPath(rel);
  await mkdir(dirname(abs), { recursive: true });
  const free = await freeBytes(dirname(abs));
  if (free != null && free < stillNeeded + VPS_FREE_HEADROOM_BYTES) {
    const error = new Error("low disk");
    (error as Error & { code: string }).code = "huge_file";
    throw error;
  }
}

export async function writeChunk(rel: string, offset: number, body: Buffer): Promise<number> {
  const abs = resolveMediaPath(rel);
  await mkdir(dirname(abs), { recursive: true });
  const current = await fileSize(abs);
  if (offset > current) {
    const error = new Error("offset");
    (error as Error & { code: string; receivedBytes: number }).code = "offset_mismatch";
    (error as Error & { receivedBytes: number }).receivedBytes = current;
    throw error;
  }
  if (offset < current) await truncate(abs, offset);
  const handle = await open(abs, existsSync(abs) ? "r+" : "w+");
  try {
    await handle.write(body, 0, body.length, offset);
  } finally {
    await handle.close();
  }
  return offset + body.length;
}

export async function sha256File(abs: string): Promise<string> {
  const hash = createHash("sha256");
  await pipeline(createReadStream(abs), hash);
  return hash.digest("hex");
}

export async function decodeSample(abs: string, hasAudio: boolean): Promise<void> {
  await runCommand("ffmpeg", ["-hide_banner", "-nostdin", "-v", "error", "-xerror", "-ss", "1", "-t", "2", "-i", abs, "-map", "0:v:0", "-f", "null", "-"], 120_000);
  if (hasAudio) {
    await runCommand("ffmpeg", ["-hide_banner", "-nostdin", "-v", "error", "-xerror", "-ss", "1", "-t", "2", "-i", abs, "-map", "0:a:0", "-f", "null", "-"], 120_000);
  }
}

export async function probeLocal(abs: string) {
  return ffprobeFile(abs);
}

export async function publishPartial(partialRel: string, finalRel: string): Promise<void> {
  const partialAbs = resolveMediaPath(partialRel);
  const finalAbs = resolveMediaPath(finalRel);
  await mkdir(dirname(finalAbs), { recursive: true });
  if (existsSync(finalAbs)) {
    await rm(partialAbs, { force: true });
    return;
  }
  await rename(partialAbs, finalAbs);
}

export async function dropPartial(rel: string): Promise<void> {
  await rm(resolveMediaPath(rel), { force: true });
}

export function streamLocalFile(req: IncomingMessage, res: ServerResponse, rel: string, contentType: string, method: string): void {
  const abs = resolveMediaPath(rel);
  const info: Stats = statSync(abs);
  const size = info.size;
  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader("Content-Type", contentType);
  res.setHeader("Cache-Control", "private, max-age=300");
  if (method === "HEAD") {
    res.statusCode = 200;
    res.setHeader("Content-Length", String(size));
    res.end();
    return;
  }
  const header = String(req.headers.range || "");
  if (header) {
    const match = /^bytes=(\d+)-(\d*)$/.exec(header);
    if (!match) {
      res.statusCode = 416;
      res.setHeader("Content-Range", `bytes */${size}`);
      res.end();
      return;
    }
    const start = Number(match[1]);
    const end = match[2] ? Number(match[2]) : size - 1;
    if (!Number.isInteger(start) || start < 0 || start >= size || end < start) {
      res.statusCode = 416;
      res.setHeader("Content-Range", `bytes */${size}`);
      res.end();
      return;
    }
    const last = Math.min(end, size - 1);
    res.statusCode = 206;
    res.setHeader("Content-Range", `bytes ${start}-${last}/${size}`);
    res.setHeader("Content-Length", String(last - start + 1));
    createReadStream(abs, { start, end: last }).pipe(res);
    return;
  }
  res.statusCode = 200;
  res.setHeader("Content-Length", String(size));
  createReadStream(abs).pipe(res);
}

export async function truncatePartial(rel: string): Promise<void> {
  const abs = resolveMediaPath(rel);
  if (existsSync(abs)) await truncate(abs, 0);
}
