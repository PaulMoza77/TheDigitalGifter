import { createReadStream } from "node:fs";
import { open, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { getServiceClient, requiredEnv } from "../christmas/supabaseClient";

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
  const info = await stat(input.localPath);
  const sha256 = await hashFile(input.localPath);
  if (info.size > 5_000_000) {
    await uploadObjectResumable(input.objectPath, input.localPath, input.contentType, info.size);
  } else {
    await uploadObjectSignedPut(input.objectPath, input.localPath, input.contentType, info.size);
  }
  const verified = await verifyStoredObject(input.objectPath, info.size);
  if (!verified.ok) throw new Error(verified.message);
  return { bytes: info.size, sha256 };
}

async function uploadObjectSignedPut(objectPath: string, localPath: string, contentType: string, size: number) {
  const service = getServiceClient();
  const { data, error } = await service.storage.from(LONG_FORM_BUCKET).createSignedUploadUrl(objectPath, {
    upsert: true,
  });
  if (error || !data?.signedUrl) {
    throw new Error(error?.message || "Could not create a storage upload URL.");
  }
  const body = createReadStream(localPath);
  const put = await fetch(data.signedUrl, {
    method: "PUT",
    body,
    duplex: "half",
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(size),
    },
  } as RequestInit);
  if (!put.ok) {
    const text = await put.text().catch(() => "");
    throw new Error(`Storage upload failed (${put.status}). ${text.slice(0, 180)}`);
  }
}

function b64(value: string): string {
  return Buffer.from(value).toString("base64");
}

async function uploadObjectResumable(objectPath: string, localPath: string, contentType: string, size: number) {
  const supabaseUrl = requiredEnv("SUPABASE_URL").replace(/\/$/, "");
  const key = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const metadata = [
    `bucketName ${b64(LONG_FORM_BUCKET)}`,
    `objectName ${b64(objectPath)}`,
    `contentType ${b64(contentType)}`,
    `cacheControl ${b64("3600")}`,
  ].join(",");
  const create = await fetch(`${supabaseUrl}/storage/v1/upload/resumable`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      apikey: key,
      "x-upsert": "true",
      "Tus-Resumable": "1.0.0",
      "Upload-Length": String(size),
      "Upload-Metadata": metadata,
    },
  });
  if (create.status !== 201 && create.status !== 200) {
    const text = await create.text().catch(() => "");
    throw new Error(`Storage upload failed (${create.status}). ${text.slice(0, 180)}`);
  }
  let location = create.headers.get("location") || create.headers.get("Location") || "";
  if (!location) throw new Error("Storage did not return a resumable upload URL.");
  if (location.startsWith("/")) location = `${supabaseUrl}${location}`;
  const chunkSize = 6 * 1024 * 1024;
  const handle = await open(localPath, "r");
  try {
    let offset = 0;
    while (offset < size) {
      const length = Math.min(chunkSize, size - offset);
      const buf = Buffer.alloc(length);
      const read = await handle.read(buf, 0, length, offset);
      const patch = await fetch(location, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${key}`,
          apikey: key,
          "Tus-Resumable": "1.0.0",
          "Upload-Offset": String(offset),
          "Content-Type": "application/offset+octet-stream",
        },
        body: buf.subarray(0, read.bytesRead),
      });
      if (patch.status !== 204 && patch.status !== 200) {
        const text = await patch.text().catch(() => "");
        throw new Error(`Storage upload failed (${patch.status}). ${text.slice(0, 180)}`);
      }
      const next = Number(patch.headers.get("Upload-Offset") || offset + read.bytesRead);
      offset = Number.isFinite(next) ? next : offset + read.bytesRead;
    }
  } finally {
    await handle.close();
  }
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
