const HEIC_MIME = new Set([
  "image/heic",
  "image/heif",
  "image/heic-sequence",
  "image/heif-sequence",
]);

const HEIC_EXT = [".heic", ".heif"];

export const HEIC_USER_MESSAGE =
  "We couldn’t convert that iPhone HEIC photo. On iPhone: Settings → Camera → Formats → Most Compatible, or export as JPEG/PNG and try again.";

export const HEIC_CONVERTING_MESSAGE = "Converting iPhone photo…";

/** Max bytes accepted before loading heic2any (same as general photo cap). */
export const HEIC_MAX_BYTES_BEFORE_CONVERT = 15 * 1024 * 1024;

export function isHeicPhoto(file: Pick<File, "name" | "type">): boolean {
  const mime = String(file.type || "").toLowerCase();
  if (HEIC_MIME.has(mime)) return true;
  const name = String(file.name || "").toLowerCase();
  return HEIC_EXT.some((ext) => name.endsWith(ext));
}

/**
 * iOS Safari often converts HEIC → JPEG in the file picker when accept includes
 * image/jpeg. Keep HEIC in accept so users can select Photos library images.
 */
export function heicPickerAccept(): string {
  return "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp,image/heic,image/heif";
}

/**
 * Convert HEIC/HEIF to a JPEG File (orientation preserved by decoder).
 * Dynamically loads heic2any so the main bundle stays lighter.
 * Rejects oversized files before decode. Does not upload or log the photo.
 */
export async function convertHeicToJpegFile(file: File): Promise<File> {
  if (file.size > HEIC_MAX_BYTES_BEFORE_CONVERT) {
    throw new Error("heic_too_large");
  }
  const heic2any = (await import("heic2any")).default;
  const result = await heic2any({
    blob: file,
    toType: "image/jpeg",
    quality: 0.9,
  });
  const blob = Array.isArray(result) ? result[0] : result;
  if (!(blob instanceof Blob) || blob.size <= 0) {
    throw new Error("heic_convert_failed");
  }
  const base = String(file.name || "photo")
    .replace(/\.(heic|heif)$/i, "")
    .slice(0, 80);
  return new File([blob], `${base || "photo"}.jpg`, {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}
