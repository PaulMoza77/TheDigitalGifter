/**
 * Pre-payment Christmas preview: heavily blur the ORIGINAL upload.
 * Must never call Replicate / paid AI.
 */

export const CHRISTMAS_PHOTO_MAX_BYTES = 15 * 1024 * 1024;
export const CHRISTMAS_PHOTO_MIN_EDGE = 256;
export const CHRISTMAS_PHOTO_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type ChristmasPhotoContentType = (typeof CHRISTMAS_PHOTO_CONTENT_TYPES)[number];

export type ChristmasPhotoValidation =
  | {
      ok: true;
      contentType: ChristmasPhotoContentType;
      width: number;
      height: number;
    }
  | { ok: false; code: "heic_unsupported" | "invalid_photo" | "too_small"; message: string };

function isHeic(file: File): boolean {
  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  return (
    type.includes("heic") ||
    type.includes("heif") ||
    name.endsWith(".heic") ||
    name.endsWith(".heif")
  );
}

function normalizeContentType(mime: string, name: string): ChristmasPhotoContentType | null {
  const lowered = mime.toLowerCase();
  if ((CHRISTMAS_PHOTO_CONTENT_TYPES as readonly string[]).includes(lowered)) {
    return lowered as ChristmasPhotoContentType;
  }
  const n = name.toLowerCase();
  if (n.endsWith(".jpg") || n.endsWith(".jpeg")) return "image/jpeg";
  if (n.endsWith(".png")) return "image/png";
  if (n.endsWith(".webp")) return "image/webp";
  return null;
}

export async function validateChristmasPhotoFile(file: File): Promise<ChristmasPhotoValidation> {
  if (isHeic(file)) {
    return {
      ok: false,
      code: "heic_unsupported",
      message:
        "iPhone HEIC photos aren’t supported yet. Set Camera Formats to Most Compatible, or export as JPEG.",
    };
  }
  if (file.size <= 0 || file.size > CHRISTMAS_PHOTO_MAX_BYTES) {
    return {
      ok: false,
      code: "invalid_photo",
      message: "Use a JPEG, PNG, or WebP photo under 15 MB.",
    };
  }
  const contentType = normalizeContentType(file.type, file.name);
  if (!contentType) {
    return {
      ok: false,
      code: "invalid_photo",
      message: "Use a JPEG, PNG, or WebP photo. HEIC is not supported yet.",
    };
  }

  try {
    const bitmap = await createImageBitmap(file);
    const width = bitmap.width;
    const height = bitmap.height;
    bitmap.close();
    if (Math.min(width, height) < CHRISTMAS_PHOTO_MIN_EDGE) {
      return {
        ok: false,
        code: "too_small",
        message: "That photo is too small. Try a clearer, higher-resolution photo.",
      };
    }
    return { ok: true, contentType, width, height };
  } catch {
    return {
      ok: false,
      code: "invalid_photo",
      message: "That file could not be read as an image. Try another photo.",
    };
  }
}

/**
 * Aggressive local blur of the original image — zero AI provider calls.
 * Returns a data URL suitable for private in-memory preview only.
 */
export async function createBlurredOriginalPreview(
  source: Blob | File,
  options?: { maxEdge?: number; blurPx?: number },
): Promise<{ dataUrl: string; width: number; height: number; replicateCalls: 0 }> {
  const maxEdge = options?.maxEdge ?? 720;
  const blurPx = options?.blurPx ?? 28;
  const bitmap = await createImageBitmap(source);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("Could not prepare preview");
  }

  ctx.filter = `blur(${blurPx}px)`;
  ctx.drawImage(bitmap, 0, 0, width, height);
  ctx.filter = "none";

  // Extra obscuring veil so preview never looks like a finished AI result.
  ctx.fillStyle = "rgba(15, 23, 42, 0.28)";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "rgba(255, 255, 255, 0.14)";
  ctx.font = `600 ${Math.max(16, Math.round(width * 0.045))}px Georgia, serif`;
  ctx.textAlign = "center";
  ctx.fillText("Preview · your photo", width / 2, height - Math.round(height * 0.06));

  bitmap.close();
  const dataUrl = canvas.toDataURL("image/jpeg", 0.72);
  return { dataUrl, width, height, replicateCalls: 0 };
}

/** Explicit audit helper: preview path must never invoke Replicate. */
export function christmasPreviewUsesReplicate(): false {
  return false;
}
