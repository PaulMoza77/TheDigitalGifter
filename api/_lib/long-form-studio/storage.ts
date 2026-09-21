import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { getServiceClient } from "../christmas/supabaseClient";

export const LONG_FORM_BUCKET = "long-form";

export function longFormLocalAllowed(): boolean {
  return process.env.LONG_FORM_ALLOW_LOCAL === "1" || process.env.VITEST === "true";
}

export async function hashFile(path: string): Promise<string> {
  const hash = createHash("sha256");
  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(path);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve());
  });
  return hash.digest("hex");
}

export async function uploadObjectStreaming(input: {
  localPath: string;
  objectPath: string;
  contentType: string;
}): Promise<{ bytes: number; sha256: string }> {
  const service = getServiceClient();
  const info = await stat(input.localPath);
  const sha256 = await hashFile(input.localPath);
  const { data, error } = await service.storage.from(LONG_FORM_BUCKET).createSignedUploadUrl(input.objectPath, {
    upsert: true,
  });
  if (error || !data?.signedUrl) {
    throw new Error(error?.message || "Could not create a storage upload URL.");
  }
  const body = createReadStream(input.localPath);
  const put = await fetch(data.signedUrl, {
    method: "PUT",
    body,
    duplex: "half",
    headers: {
      "Content-Type": input.contentType,
      "Content-Length": String(info.size),
    },
  } as RequestInit);
  if (!put.ok) {
    const text = await put.text().catch(() => "");
    throw new Error(`Storage upload failed (${put.status}). ${text.slice(0, 180)}`);
  }
  const verified = await verifyStoredObject(input.objectPath, info.size);
  if (!verified.ok) {
    throw new Error(verified.message);
  }
  return { bytes: info.size, sha256 };
}

export async function verifyStoredObject(
  objectPath: string,
  expectedBytes: number,
): Promise<{ ok: boolean; size: number; message: string }> {
  const service = getServiceClient();
  const folder = objectPath.includes("/") ? objectPath.slice(0, objectPath.lastIndexOf("/")) : "";
  const name = objectPath.split("/").pop() || objectPath;
  const { data, error } = await service.storage.from(LONG_FORM_BUCKET).list(folder || undefined, {
    search: name,
    limit: 20,
  });
  if (error) return { ok: false, size: 0, message: error.message };
  const row = (data || []).find((item) => item.name === name);
  const size = Number((row?.metadata as { size?: number } | undefined)?.size || row?.metadata?.size || 0);
  if (!row) return { ok: false, size: 0, message: "Uploaded file was not found in storage." };
  if (size && Math.abs(size - expectedBytes) > 64) {
    return { ok: false, size, message: `Stored size ${size} does not match local size ${expectedBytes}.` };
  }
  return { ok: true, size: size || expectedBytes, message: "ok" };
}

export async function signedStorageDownload(objectPath: string, expiresIn = 3600): Promise<string> {
  const service = getServiceClient();
  const { data, error } = await service.storage.from(LONG_FORM_BUCKET).createSignedUrl(objectPath, expiresIn);
  if (error || !data?.signedUrl) throw new Error(error?.message || "Could not create a playback link.");
  return data.signedUrl;
}

export async function bucketHeadroom(neededBytes: number): Promise<void> {
  const limit = 8589934592;
  if (neededBytes > limit) {
    throw new Error("This video would exceed the 8 GiB file size limit. Keep the 1 hour length for now.");
  }
  if (longFormLocalAllowed()) return;
  getServiceClient();
}

const SAFE_OBJECT = /^(productions|music)\/[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/;

export function assertSafeObjectPath(objectPath: string): string {
  const path = String(objectPath || "").replace(/^\/+/, "");
  if (!SAFE_OBJECT.test(path) || path.includes("..")) {
    throw Object.assign(new Error("Invalid storage path."), { status: 400 });
  }
  return path;
}

export async function createLongFormUploadUrl(objectPath: string): Promise<{ signedUrl: string; path: string; token: string }> {
  const service = getServiceClient();
  const path = assertSafeObjectPath(objectPath);
  const { data, error } = await service.storage.from(LONG_FORM_BUCKET).createSignedUploadUrl(path, { upsert: true });
  if (error || !data?.signedUrl) throw new Error(error?.message || "Could not start upload.");
  return { signedUrl: data.signedUrl, path: data.path || path, token: data.token };
}

export async function downloadObjectToFile(objectPath: string, dest: string): Promise<void> {
  const service = getServiceClient();
  const path = assertSafeObjectPath(objectPath);
  const { data, error } = await service.storage.from(LONG_FORM_BUCKET).download(path);
  if (error || !data) throw new Error(error?.message || "Could not download stored file.");
  const { writeFile } = await import("node:fs/promises");
  await writeFile(dest, Buffer.from(await data.arrayBuffer()));
}
