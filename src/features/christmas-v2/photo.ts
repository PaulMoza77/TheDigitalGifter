import { CHRISTMAS_PHOTO_MAX_BYTES, CHRISTMAS_UPLOAD_MAX_EDGE } from "./config";
import type { ChristmasPhotoMeta } from "./types";

const CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
type ContentType = (typeof CONTENT_TYPES)[number];

export type ChristmasPhotoValidation =
  | { ok: true; contentType: ContentType }
  | { ok: false; message: string };

function isHeic(file: File): boolean {
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  return type.includes("heic") || type.includes("heif") || name.endsWith(".heic") || name.endsWith(".heif");
}

export function normalizeChristmasContentType(mimeType: string, fileName: string): ContentType | null {
  const loweredMime = mimeType.toLowerCase();
  if ((CONTENT_TYPES as readonly string[]).includes(loweredMime)) return loweredMime as ContentType;
  const loweredName = fileName.toLowerCase();
  if (loweredName.endsWith(".jpg") || loweredName.endsWith(".jpeg")) return "image/jpeg";
  if (loweredName.endsWith(".png")) return "image/png";
  if (loweredName.endsWith(".webp")) return "image/webp";
  return null;
}

export function validateChristmasPhotoFile(file: File): ChristmasPhotoValidation {
  if (isHeic(file)) {
    return {
      ok: false,
      message: "HEIC from iPhone isn’t supported yet. Please export as JPEG and try again.",
    };
  }
  if (file.size <= 0) return { ok: false, message: "That file looks empty. Try another photo." };
  if (file.size > CHRISTMAS_PHOTO_MAX_BYTES) {
    return { ok: false, message: "Photos must be 15 MB or smaller. Try a slightly smaller file." };
  }
  const contentType = normalizeChristmasContentType(file.type, file.name);
  if (!contentType) {
    return { ok: false, message: "Use a JPEG, PNG, or WebP photo." };
  }
  return { ok: true, contentType };
}

export async function prepareChristmasUploadBlob(file: File): Promise<Blob> {
  if (typeof createImageBitmap !== "function") return file;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("That photo could not be decoded. Try exporting as JPEG and upload again.");
  }
  const scale = Math.min(1, CHRISTMAS_UPLOAD_MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return file;
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((next) => resolve(next), "image/jpeg", 0.88);
  });
  return blob ?? file;
}

export async function createChristmasLocalPreview(file: File): Promise<string> {
  const blob = await prepareChristmasUploadBlob(file);
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not preview that photo."));
    reader.readAsDataURL(blob);
  });
}

export async function prepareChristmasCheckoutUpload(file: File): Promise<{
  blob: Blob;
  meta: ChristmasPhotoMeta;
}> {
  const blob = await prepareChristmasUploadBlob(file);
  return {
    blob,
    meta: {
      fileName: file.name.replace(/\.[^.]+$/, "") + ".jpg",
      contentType: "image/jpeg",
      byteSize: blob.size,
    },
  };
}
