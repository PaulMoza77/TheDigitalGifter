import { PET_PHOTO_CONTENT_TYPES, PET_PHOTO_MAX_BYTES, type PetPhotoContentType } from "../pet/types";
import { HEIC_USER_MESSAGE, isHeicPhoto } from "./heic";
import { PET_V2_UPLOAD_MAX_EDGE } from "./types";

export type V2PhotoValidation =
  | { ok: true; contentType: PetPhotoContentType }
  | { ok: false; message: string; code: "heic_unsupported" | "invalid_photo" };

export function validateV2PhotoFile(file: File): V2PhotoValidation {
  if (isHeicPhoto(file)) {
    return { ok: false, message: HEIC_USER_MESSAGE, code: "heic_unsupported" };
  }
  if (file.size <= 0) {
    return { ok: false, message: "That file looks empty. Try another photo.", code: "invalid_photo" };
  }
  if (file.size > PET_PHOTO_MAX_BYTES) {
    return {
      ok: false,
      message: "Photos must be 15 MB or smaller. Try a slightly smaller file.",
      code: "invalid_photo",
    };
  }
  const contentType = normalizeV2ContentType(file.type, file.name);
  if (!contentType) {
    return {
      ok: false,
      message: "Use a JPEG, PNG, or WebP photo. HEIC from iPhone is not supported yet.",
      code: "invalid_photo",
    };
  }
  return { ok: true, contentType };
}

export function normalizeV2ContentType(mimeType: string, fileName: string): PetPhotoContentType | null {
  const loweredMime = mimeType.toLowerCase();
  if ((PET_PHOTO_CONTENT_TYPES as readonly string[]).includes(loweredMime)) {
    return loweredMime as PetPhotoContentType;
  }
  const loweredName = fileName.toLowerCase();
  if (loweredName.endsWith(".jpg") || loweredName.endsWith(".jpeg")) return "image/jpeg";
  if (loweredName.endsWith(".png")) return "image/png";
  if (loweredName.endsWith(".webp")) return "image/webp";
  return null;
}

/** Resize on-device so the preview API stays small and cheaper. */
export async function prepareV2UploadBlob(file: File): Promise<Blob> {
  if (typeof createImageBitmap !== "function") return file;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, PET_V2_UPLOAD_MAX_EDGE / Math.max(bitmap.width, bitmap.height));
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
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((next) => resolve(next), "image/jpeg", 0.82);
  });
  return blob ?? file;
}

export async function createV2LocalPreview(file: File): Promise<string | null> {
  if (typeof createImageBitmap !== "function") return null;
  try {
    const bitmap = await createImageBitmap(file);
    const maxEdge = 720;
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return null;
    }
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    return canvas.toDataURL("image/jpeg", 0.72);
  } catch {
    return null;
  }
}
