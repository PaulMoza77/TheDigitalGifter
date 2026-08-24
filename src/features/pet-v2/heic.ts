const HEIC_MIME = new Set([
  "image/heic",
  "image/heif",
  "image/heic-sequence",
  "image/heif-sequence",
]);

const HEIC_EXT = [".heic", ".heif"];

export const HEIC_USER_MESSAGE =
  "iPhone HEIC photos aren’t supported yet. On iPhone: Settings → Camera → Formats → Most Compatible, or export the photo as JPEG and try again.";

export function isHeicPhoto(file: Pick<File, "name" | "type">): boolean {
  const mime = String(file.type || "").toLowerCase();
  if (HEIC_MIME.has(mime)) return true;
  const name = String(file.name || "").toLowerCase();
  return HEIC_EXT.some((ext) => name.endsWith(ext));
}

/**
 * iOS Safari often converts HEIC → JPEG in the file picker when accept includes
 * image/jpeg. If the browser still hands us HEIC, we must fail visibly.
 */
export function heicPickerAccept(): string {
  return "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp,image/heic,image/heif";
}
