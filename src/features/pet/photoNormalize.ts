import { PET_PHOTO_MAX_BYTES } from "./types";

const HEIC_MIME = new Set(["image/heic", "image/heif", "image/heic-sequence", "image/heif-sequence"]);

export function isHeicLikePhoto(file: File): boolean {
  const mime = String(file.type || "").toLowerCase();
  if (HEIC_MIME.has(mime)) return true;
  const name = String(file.name || "").toLowerCase();
  return name.endsWith(".heic") || name.endsWith(".heif");
}

export const HEIC_UNSUPPORTED_MESSAGE =
  "This iPhone photo (HEIC) couldn’t be read here. In Photos, choose Share → Save as JPEG, or pick a JPEG/PNG.";

/**
 * Convert HEIC/HEIF to JPEG when the browser can decode it (typically Safari/iOS).
 * No third-party dependency — fails closed with a clear message elsewhere.
 */
export async function convertHeicLikeToJpeg(file: File): Promise<File> {
  if (typeof createImageBitmap !== "function") {
    throw new Error(HEIC_UNSUPPORTED_MESSAGE);
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error(HEIC_UNSUPPORTED_MESSAGE);
  }

  try {
    const maxEdge = 2400;
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error(HEIC_UNSUPPORTED_MESSAGE);
    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((next) => resolve(next), "image/jpeg", 0.92);
    });
    if (!blob || blob.size <= 0) throw new Error(HEIC_UNSUPPORTED_MESSAGE);
    if (blob.size > PET_PHOTO_MAX_BYTES) {
      throw new Error("Photos must be 15 MB or smaller. Try a slightly smaller file.");
    }

    const base = file.name.replace(/\.(heic|heif)$/i, "") || "pet-photo";
    return new File([blob], `${base}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
  } finally {
    bitmap.close();
  }
}

export async function normalizePetPhotoFile(file: File): Promise<
  { ok: true; file: File } | { ok: false; message: string }
> {
  if (!isHeicLikePhoto(file)) {
    return { ok: true, file };
  }
  try {
    const converted = await convertHeicLikeToJpeg(file);
    return { ok: true, file: converted };
  } catch (error) {
    const message =
      error instanceof Error && error.message ? error.message : HEIC_UNSUPPORTED_MESSAGE;
    return { ok: false, message };
  }
}
