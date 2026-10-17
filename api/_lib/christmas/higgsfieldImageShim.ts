/**
 * Node-side subset of supabase/functions/_shared/higgsfieldImage.ts for Christmas V2.
 * Keep behavior aligned with the Deno shared module.
 */

export const HIGGSFIELD_API_BASE = "https://api.higgsfield.ai" as const;

export function readHiggsfieldAuthorization(env: {
  get(name: string): string | undefined;
}): string | null {
  const combined = String(env.get("HF_CREDENTIALS") || env.get("HF_KEY") || "").trim();
  const splitAt = combined.indexOf(":");
  if (splitAt > 0) {
    const keyId = combined.slice(0, splitAt).trim();
    const secret = combined.slice(splitAt + 1).trim();
    if (keyId && secret) return `Key ${keyId}:${secret}`;
  }
  const keyId = String(env.get("HF_API_KEY_ID") || env.get("HF_API_KEY") || "").trim();
  const secret = String(
    env.get("HF_API_KEY_SECRET") || env.get("HF_SECRET") || env.get("HF_API_SECRET") || "",
  ).trim();
  if (keyId && secret) return `Key ${keyId}:${secret}`;
  return null;
}

export function isTerminalHiggsfieldStatus(status: string): boolean {
  return ["completed", "succeeded", "failed", "nsfw", "canceled", "cancelled", "error"].includes(
    status.toLowerCase(),
  );
}

export function isSuccessfulHiggsfieldStatus(status: string): boolean {
  return ["completed", "succeeded"].includes(status.toLowerCase());
}

export function extractHiggsfieldImageUrl(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  const images = record.images;
  if (Array.isArray(images)) {
    for (const image of images) {
      if (image && typeof image === "object" && typeof (image as { url?: unknown }).url === "string") {
        return (image as { url: string }).url;
      }
      if (typeof image === "string" && /^https?:\/\//i.test(image)) return image;
    }
  }
  if (typeof record.image_url === "string") return record.image_url;
  const image = record.image;
  if (image && typeof image === "object" && typeof (image as { url?: unknown }).url === "string") {
    return (image as { url: string }).url;
  }
  const output = record.output;
  if (typeof output === "string" && /^https?:\/\//i.test(output)) return output;
  if (Array.isArray(output) && typeof output[0] === "string") return output[0];
  return null;
}
