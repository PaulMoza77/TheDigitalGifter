import { MEMORIES_PHOTO_MAX_BYTES } from "./config";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

export function validateMemoriesPhotoFile(file: File): {
  ok: boolean;
  message?: string;
  contentType?: string;
} {
  const type = (file.type || "").toLowerCase();
  if (!ALLOWED.has(type)) {
    return { ok: false, message: "Please upload a JPEG, PNG, or WebP image." };
  }
  if (file.size <= 0 || file.size > MEMORIES_PHOTO_MAX_BYTES) {
    return { ok: false, message: "Images must be under 15MB." };
  }
  return { ok: true, contentType: type };
}

export function createLocalPreview(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read that photo."));
    reader.readAsDataURL(file);
  });
}
