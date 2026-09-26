import {
  HIGGSFIELD_API_BASE,
  HIGGSFIELD_IMAGE_MODEL,
  HIGGSFIELD_IMAGE_RESOLUTION,
  isSuccessfulHiggsfieldStatus,
  isTerminalHiggsfieldStatus,
} from "../../../supabase/functions/_shared/higgsfieldImage.ts";

export const KLING_I2V_PATH = "/kling-video/v3.0/pro/image-to-video";
export const KLING_I2V_ESTIMATE_PATH = "/estimate/kling-video/v3.0/pro/image-to-video";
export const KLING_DURATION_SECONDS = 5;

function readHiggsfieldAuthorizationFromProcessEnv(): string | null {
  const combined = String(process.env.HF_CREDENTIALS || process.env.HF_KEY || "").trim();
  const splitAt = combined.indexOf(":");
  if (splitAt > 0) {
    const keyId = combined.slice(0, splitAt).trim();
    const secret = combined.slice(splitAt + 1).trim();
    if (keyId && secret) return `Key ${keyId}:${secret}`;
  }
  const keyId = String(process.env.HF_API_KEY_ID || process.env.HF_API_KEY || "").trim();
  const secret = String(
    process.env.HF_API_KEY_SECRET || process.env.HF_SECRET || process.env.HF_API_SECRET || "",
  ).trim();
  if (keyId && secret) return `Key ${keyId}:${secret}`;
  return null;
}

export function higgsfieldConfigured(): boolean {
  return readHiggsfieldAuthorizationFromProcessEnv() !== null;
}

async function higgsfieldJson(
  authorization: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<Record<string, unknown>> {
  const url = path.startsWith("http") ? path : `${HIGGSFIELD_API_BASE}${path}`;
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: authorization,
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": "tdg-content-autopilot/higgsfield",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let parsed: Record<string, unknown> = {};
  if (text) {
    try {
      parsed = JSON.parse(text) as Record<string, unknown>;
    } catch {
      parsed = {};
    }
  }
  if (!response.ok) {
    throw new Error(`higgsfield_http_${response.status}`);
  }
  return parsed;
}

export async function uploadBytesToHiggsfield(
  authorization: string,
  bytes: Uint8Array,
  contentType: string,
): Promise<string> {
  const meta = await higgsfieldJson(authorization, "POST", "/files/generate-upload-url", {
    content_type: contentType,
  });
  const uploadUrl = String(meta.upload_url || "");
  const publicUrl = String(meta.public_url || "");
  if (!uploadUrl || !publicUrl) throw new Error("higgsfield_upload_meta_missing");
  const uploadHeaders = new Headers();
  const rawHeaders = meta.upload_headers;
  if (rawHeaders && typeof rawHeaders === "object") {
    for (const [key, value] of Object.entries(rawHeaders as Record<string, unknown>)) {
      if (typeof value === "string") uploadHeaders.set(key, value);
    }
  }
  if (!uploadHeaders.has("Content-Type")) uploadHeaders.set("Content-Type", contentType);
  const putBody = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const uploaded = await fetch(uploadUrl, { method: "PUT", headers: uploadHeaders, body: putBody });
  if (!uploaded.ok) throw new Error("higgsfield_upload_failed");
  return publicUrl;
}

export async function submitContentImage(
  authorization: string,
  prompt: string,
): Promise<string> {
  const submitted = await higgsfieldJson(authorization, "POST", `/${HIGGSFIELD_IMAGE_MODEL}`, {
    prompt,
    aspect_ratio: "9:16",
    resolution: HIGGSFIELD_IMAGE_RESOLUTION,
  });
  const requestId = String(submitted.request_id || "").trim();
  if (!requestId) throw new Error("higgsfield_image_request_missing");
  return requestId;
}

export function extractHiggsfieldImageUrl(body: Record<string, unknown>): string | null {
  const images = body.images;
  if (Array.isArray(images)) {
    for (const image of images) {
      if (image && typeof image === "object" && typeof (image as { url?: unknown }).url === "string") {
        return (image as { url: string }).url;
      }
      if (typeof image === "string" && /^https?:\/\//i.test(image)) return image;
    }
  }
  if (typeof body.image_url === "string") return body.image_url;
  return null;
}

export function extractHiggsfieldVideoUrl(body: Record<string, unknown>): string | null {
  const video = body.video;
  if (video && typeof video === "object" && typeof (video as { url?: unknown }).url === "string") {
    return (video as { url: string }).url;
  }
  if (typeof body.video_url === "string") return body.video_url;
  return null;
}

export async function pollHiggsfieldRequest(
  authorization: string,
  requestId: string,
  options?: { maxAttempts?: number; sleepMs?: number },
): Promise<{ done: boolean; failed: boolean; body: Record<string, unknown> | null }> {
  const maxAttempts = options?.maxAttempts ?? 60;
  const sleepMs = options?.sleepMs ?? 3000;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const current = await higgsfieldJson(authorization, "GET", `/requests/${requestId}/status`);
    const status = String(current.status || "");
    if (isTerminalHiggsfieldStatus(status)) {
      return {
        done: true,
        failed: !isSuccessfulHiggsfieldStatus(status),
        body: current,
      };
    }
    if (attempt < maxAttempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, sleepMs));
    }
  }
  return { done: false, failed: false, body: null };
}

export async function estimateKlingVideoUsd(authorization: string, imageUrl: string, prompt: string): Promise<number> {
  const estimate = await higgsfieldJson(authorization, "POST", KLING_I2V_ESTIMATE_PATH, {
    image_url: imageUrl,
    prompt,
    duration: KLING_DURATION_SECONDS,
    sound: "off",
  });
  const usd = Number(estimate.usd);
  if (!Number.isFinite(usd) || usd < 0) throw new Error("higgsfield_estimate_missing");
  return usd;
}

export async function submitKlingVideo(
  authorization: string,
  imageUrl: string,
  prompt: string,
): Promise<string> {
  const submitted = await higgsfieldJson(authorization, "POST", KLING_I2V_PATH, {
    image_url: imageUrl,
    prompt,
    duration: KLING_DURATION_SECONDS,
    sound: "off",
  });
  const requestId = String(submitted.request_id || "").trim();
  if (!requestId) throw new Error("higgsfield_video_request_missing");
  return requestId;
}

export function getHiggsfieldAuthorization(): string {
  const auth = readHiggsfieldAuthorizationFromProcessEnv();
  if (!auth) throw new Error("higgsfield_credentials_missing");
  return auth;
}
