const UUID_EXT = /^uploads\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp)$/i;

export const UPLOAD_BUCKET = "customer-uploads";
export const RESULT_BUCKET = "generated-results";
export const MAX_UPLOADS_PER_HOUR = 10;

export function serverUploadPath(uploadId: string, ext: "jpg" | "png" | "webp"): string {
  return `uploads/${uploadId}.${ext}`;
}

export function isServerManagedUploadPath(path: string): boolean {
  return UUID_EXT.test(String(path || ""));
}

export function extensionFromMime(mime: string): "jpg" | "png" | "webp" | null {
  const normalized = String(mime || "").toLowerCase();
  if (normalized === "image/jpeg" || normalized === "image/jpg") return "jpg";
  if (normalized === "image/png") return "png";
  if (normalized === "image/webp") return "webp";
  return null;
}

export function allowRateLimit(countInWindow: number, max = MAX_UPLOADS_PER_HOUR): boolean {
  return countInWindow < max;
}

export function resultObjectPath(orderId: string, generationId: string): string {
  return `orders/${orderId}/${generationId}.jpg`;
}
