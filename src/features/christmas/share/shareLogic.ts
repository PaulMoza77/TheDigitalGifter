/** Pure helpers for durable Christmas result share — unit-testable without DOM. */

export const RESULT_SHARE_ROUTE_PREFIX = "/share";
export const MIN_SHARE_TOKEN_LENGTH = 32;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const BLOCKED_ANALYTICS_KEYS = new Set([
  "resulturl",
  "result_url",
  "imageurl",
  "image_url",
  "media_url",
  "mediaurl",
  "signedurl",
  "signed_url",
  "public_url",
  "publicurl",
  "storage_path",
  "storagepath",
  "storage_bucket",
  "storagebucket",
  "source_url",
  "sourceurl",
  "preview_url",
  "previewurl",
  "download_url",
  "downloadurl",
  "file_url",
  "fileurl",
  "token",
  "share_token",
  "sharetoken",
  "public_token",
  "publictoken",
  "owner_token",
  "ownertoken",
  "ciphertext",
]);

export type ResultShareCta = { to: string; label: string };

const PRODUCT_SHARE_CTA: Record<string, ResultShareCta> = {
  christmas_photo: { to: "/christmas/photo-generator", label: "Create your Christmas portrait" },
  christmas_family: { to: "/christmas/family", label: "Create a family Christmas portrait" },
  christmas_couple: { to: "/christmas/couples", label: "Create a couples Christmas portrait" },
  christmas_pet: { to: "/christmas/pets", label: "Create a pet Christmas portrait" },
  christmas_santa_video: { to: "/christmas/santa-video", label: "Create a Santa video" },
};

export function isGenerationId(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value.trim());
}

export function isShareToken(value: unknown): value is string {
  return typeof value === "string" && value.trim().length >= MIN_SHARE_TOKEN_LENGTH;
}

export function looksLikeMediaUrl(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const v = value.trim();
  if (!v) return false;
  if (/^https?:\/\//i.test(v)) return true;
  if (/^data:image\//i.test(v)) return true;
  if (v.includes("/storage/v1/object")) return true;
  if (v.includes("supabase.co/storage")) return true;
  return false;
}

/** Analytics metadata must never persist media URLs or capability tokens. */
export function sanitizeResultShareAnalyticsMeta(
  meta: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(meta)) {
    if (BLOCKED_ANALYTICS_KEYS.has(key.toLowerCase())) continue;
    if (looksLikeMediaUrl(value)) continue;
    if (typeof value === "string" && value.length > 80) continue;
    out[key] = value;
  }
  return out;
}

export function buildResultSharePath(generationId: string, token: string): string {
  const id = generationId.trim();
  const t = token.trim();
  return `${RESULT_SHARE_ROUTE_PREFIX}/${encodeURIComponent(id)}?token=${encodeURIComponent(t)}`;
}

export function parseShareTokenFromSearch(search: string): string | null {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const token = (params.get("token") || params.get("t") || "").trim();
  return isShareToken(token) ? token : null;
}

export function productCtaForShare(productKey: string | null | undefined): ResultShareCta {
  if (productKey && PRODUCT_SHARE_CTA[productKey]) return PRODUCT_SHARE_CTA[productKey];
  return PRODUCT_SHARE_CTA.christmas_photo;
}
