import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import type { LibraryVideo } from "../../../src/features/admin-library/catalog";
import { findLibraryPhoto } from "../../../src/features/admin-library/libraryMerge";
import type { HiggsfieldTransport } from "./client";

const IMAGE_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

export function contentTypeForFilename(filename: string): string {
  const lower = filename.toLowerCase();
  const ext = lower.slice(lower.lastIndexOf("."));
  return IMAGE_TYPES[ext] || "image/jpeg";
}

export async function readLibraryPhotoBytes(photo: LibraryVideo): Promise<{ bytes: Uint8Array; contentType: string }> {
  const relative = photo.src.replace(/^\//, "");
  const candidates = [
    join(process.cwd(), "public", relative),
    join(process.cwd(), "dist", relative),
  ];
  for (const path of candidates) {
    try {
      const bytes = await fs.readFile(path);
      return { bytes, contentType: contentTypeForFilename(photo.filename) };
    } catch {
      /* try next */
    }
  }
  const origin = String(process.env.TDG_PUBLIC_ORIGIN || process.env.VITE_APP_URL || "https://www.thedigitalgifter.com").replace(
    /\/$/,
    "",
  );
  const url = `${origin}${photo.src}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not load library photo ${photo.id} (${res.status})`);
  const buf = new Uint8Array(await res.arrayBuffer());
  return { bytes: buf, contentType: contentTypeForFilename(photo.filename) };
}

export async function uploadLibraryPhoto(
  transport: HiggsfieldTransport,
  photoId: string,
): Promise<{ photo: LibraryVideo; imageUrl: string }> {
  const photo = findLibraryPhoto(photoId);
  if (!photo) throw new Error(`Unknown TDG Library photo: ${photoId}`);
  const origin = String(process.env.TDG_PUBLIC_ORIGIN || process.env.VITE_APP_URL || "").replace(/\/$/, "");
  if (/^https:\/\//i.test(origin) && !/localhost|127\.0\.0\.1/i.test(origin)) {
    return { photo, imageUrl: `${origin}${photo.src}` };
  }
  const { bytes, contentType } = await readLibraryPhotoBytes(photo);
  const upload = await transport.createUploadUrl(contentType);
  await transport.putUpload(upload.upload_url, bytes, upload.upload_headers);
  return { photo, imageUrl: upload.public_url };
}

export function commandKey(input: {
  photoId: string;
  prompt: string;
  modelKey: string;
  durationSeconds: number;
  resolution: string;
  audio: boolean;
  clientKey?: string | null;
}): string {
  if (input.clientKey && input.clientKey.trim()) return input.clientKey.trim();
  const material = [
    input.photoId,
    input.prompt.trim(),
    input.modelKey,
    String(input.durationSeconds),
    input.resolution,
    input.audio ? "audio" : "silent",
  ].join("\n");
  return createHash("sha256").update(material).digest("hex");
}
