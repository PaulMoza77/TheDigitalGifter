import { createHash } from "node:crypto";
import { createReadStream, createWriteStream, promises as fs } from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { statfs } from "node:fs/promises";
import { dirname } from "node:path";
import { getServiceClient } from "../christmas/supabaseClient";
import { IngestError } from "./ingest";

const BUCKET = "clip-factory";

export async function hashFileStreaming(path: string): Promise<string> {
  const hash = createHash("sha256");
  await pipeline(createReadStream(path), hash);
  return hash.digest("hex");
}

export async function assertEnoughDisk(path: string, neededBytes: number): Promise<void> {
  const dir = dirname(path);
  try {
    const info = await statfs(dir);
    const free = Number(info.bavail) * Number(info.bsize);
    const floor = neededBytes + 512 * 1024 * 1024;
    if (Number.isFinite(free) && free < floor) {
      throw new IngestError("huge_file", "Not enough disk space to import this video.");
    }
  } catch (error) {
    if (error instanceof IngestError) throw error;
  }
}

export async function uploadFileStreaming(localPath: string, dest: string, contentType: string): Promise<number> {
  const service = getServiceClient();
  const stat = await fs.stat(localPath);
  const { data, error } = await service.storage.from(BUCKET).createSignedUploadUrl(dest);
  if (error || !data?.signedUrl) {
    const bytes = await fs.readFile(localPath);
    const uploaded = await service.storage.from(BUCKET).upload(dest, bytes, { contentType, upsert: true });
    if (uploaded.error) throw uploaded.error;
    return bytes.length;
  }
  const body = createReadStream(localPath);
  const res = await fetch(data.signedUrl, {
    method: "PUT",
    headers: { "content-type": contentType, "content-length": String(stat.size) },
    // @ts-expect-error Node fetch duplex for streaming request bodies
    duplex: "half",
    body: Readable.toWeb(body) as unknown as BodyInit,
  });
  if (!res.ok) {
    const bytes = await fs.readFile(localPath);
    const uploaded = await service.storage.from(BUCKET).upload(dest, bytes, { contentType, upsert: true });
    if (uploaded.error) throw uploaded.error;
    return bytes.length;
  }
  return stat.size;
}

export async function downloadStorageStreaming(storagePath: string, dest: string): Promise<void> {
  const service = getServiceClient();
  const { data, error } = await service.storage.from(BUCKET).download(storagePath);
  if (error || !data) throw error || new Error("storage_download_failed");
  const stream = typeof data.stream === "function" ? data.stream() : null;
  if (stream) {
    await pipeline(Readable.fromWeb(stream as import("node:stream/web").ReadableStream), createWriteStream(dest));
    return;
  }
  await fs.writeFile(dest, Buffer.from(await data.arrayBuffer()));
}

export function sourceDomain(url: string | null | undefined): string | null {
  try {
    if (!url) return null;
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function unknownErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const rec = err as { message?: unknown; error?: unknown };
    if (typeof rec.message === "string") return rec.message;
    if (typeof rec.error === "string") return rec.error;
    try {
      return JSON.stringify(err).slice(0, 400);
    } catch {
      return "Unknown error";
    }
  }
  return String(err);
}
