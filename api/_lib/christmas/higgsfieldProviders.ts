/**
 * Christmas V2 paid generation providers (Higgsfield only).
 * Official model IDs verified from Higgsfield docs + existing TDG content-autopilot usage.
 * No Replicate fallback — fail closed when credentials are missing (unless mock).
 */

import {
  HIGGSFIELD_API_BASE,
  extractHiggsfieldImageUrl,
  isSuccessfulHiggsfieldStatus,
  isTerminalHiggsfieldStatus,
  readHiggsfieldAuthorization,
} from "./higgsfieldImageShim";
import {
  CHRISTMAS_KLING_3_PRO_VIDEO_MODEL,
  CHRISTMAS_SOUL_V2_IMAGE_MODEL,
  christmasImageModel,
  christmasVideoModel,
} from "./constants";

type FetchImpl = typeof fetch;

function authHeaders(authorization: string, hasBody: boolean): HeadersInit {
  const headers: Record<string, string> = {
    Authorization: authorization,
    Accept: "application/json",
    "User-Agent": "tdg-christmas-v2/higgsfield",
  };
  if (hasBody) headers["Content-Type"] = "application/json";
  return headers;
}

async function higgsfieldJson(
  authorization: string,
  method: string,
  path: string,
  body?: unknown,
  fetchImpl: FetchImpl = fetch,
): Promise<Record<string, unknown>> {
  const url = path.startsWith("http") ? path : `${HIGGSFIELD_API_BASE}${path.startsWith("/") ? "" : "/"}${path}`;
  let response: Response;
  try {
    response = await fetchImpl(url, {
      method,
      headers: authHeaders(authorization, body !== undefined),
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error("Higgsfield request failed (network).");
  }
  const text = await response.text();
  let parsed: Record<string, unknown> = {};
  if (text) {
    try {
      const json = JSON.parse(text) as unknown;
      if (json && typeof json === "object") parsed = json as Record<string, unknown>;
    } catch {
      parsed = {};
    }
  }
  if (!response.ok) {
    const detail = String(parsed.detail || parsed.error || parsed.message || "").slice(0, 200);
    throw new Error(detail || `Higgsfield HTTP ${response.status}`);
  }
  return parsed;
}

export function requireChristmasHiggsfieldAuth(env: {
  get(name: string): string | undefined;
}): string {
  const auth = readHiggsfieldAuthorization(env);
  if (!auth) {
    throw new Error(
      "Higgsfield credentials missing (HF_CREDENTIALS or HF_API_KEY_ID + HF_API_KEY_SECRET). Christmas V2 does not fall back to Replicate.",
    );
  }
  return auth;
}

export async function pollHiggsfieldRequest(
  authorization: string,
  requestId: string,
  options?: { maxAttempts?: number; sleepMs?: number; fetchImpl?: FetchImpl },
): Promise<{ done: boolean; failed: boolean; body: Record<string, unknown> | null }> {
  const maxAttempts = options?.maxAttempts ?? 60;
  const sleepMs = options?.sleepMs ?? 2500;
  const fetchImpl = options?.fetchImpl ?? fetch;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const current = await higgsfieldJson(
      authorization,
      "GET",
      `/requests/${requestId}/status`,
      undefined,
      fetchImpl,
    );
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

export function soulV2ImageRequest(input: {
  prompt: string;
  imageUrl: string;
  aspectRatio?: string;
  /** Optional override · defaults to official Soul v2 I2I id. */
  model?: string;
}): { path: string; body: Record<string, unknown>; model: string } {
  const model = String(input.model || CHRISTMAS_SOUL_V2_IMAGE_MODEL).replace(/^\/+/, "");
  return {
    model,
    path: `/${model}`,
    body: {
      prompt: input.prompt,
      image_url: input.imageUrl,
      aspect_ratio: input.aspectRatio || "3:4",
      resolution: "1080p",
      batch_size: 1,
      enhance_prompt: true,
    },
  };
}

export function kling3ProVideoRequest(input: {
  prompt: string;
  imageUrl: string;
  duration?: number;
  /** Optional override · defaults to official Kling 3 Pro I2V id. */
  model?: string;
}): { path: string; body: Record<string, unknown>; model: string } {
  const model = String(input.model || CHRISTMAS_KLING_3_PRO_VIDEO_MODEL).replace(/^\/+/, "");
  return {
    model,
    path: `/${model}`,
    body: {
      image_url: input.imageUrl,
      prompt: input.prompt,
      duration: input.duration ?? 5,
      sound: "off",
    },
  };
}

export async function generateSoulV2Image(input: {
  authorization: string;
  prompt: string;
  imageUrl: string;
  aspectRatio?: string;
  fetchImpl?: FetchImpl;
}): Promise<{ requestId: string; outputUrl: string; model: string }> {
  const request = soulV2ImageRequest({
    ...input,
    model: christmasImageModel(),
  });
  const submitted = await higgsfieldJson(
    input.authorization,
    "POST",
    request.path,
    request.body,
    input.fetchImpl,
  );
  const requestId = String(submitted.request_id || "").trim();
  if (!requestId) throw new Error("Higgsfield Soul v2 returned no request_id");

  const polled = await pollHiggsfieldRequest(input.authorization, requestId, {
    maxAttempts: 48,
    sleepMs: 2500,
    fetchImpl: input.fetchImpl,
  });
  if (!polled.done) throw new Error("Higgsfield Soul v2 timed out");
  if (polled.failed || !polled.body) throw new Error("Higgsfield Soul v2 generation failed");
  const outputUrl = extractHiggsfieldImageUrl(polled.body);
  if (!outputUrl) throw new Error("Higgsfield Soul v2 returned no image URL");
  return { requestId, outputUrl, model: request.model };
}

function extractVideoUrl(body: Record<string, unknown>): string | null {
  const video = body.video;
  if (video && typeof video === "object" && typeof (video as { url?: unknown }).url === "string") {
    return (video as { url: string }).url;
  }
  if (typeof body.video_url === "string") return body.video_url;
  const output = body.output;
  if (typeof output === "string" && /^https?:\/\//i.test(output)) return output;
  return null;
}

export async function generateKling3ProVideo(input: {
  authorization: string;
  prompt: string;
  imageUrl: string;
  duration?: number;
  fetchImpl?: FetchImpl;
}): Promise<{ requestId: string; outputUrl: string; model: string }> {
  const request = kling3ProVideoRequest({
    ...input,
    model: christmasVideoModel(),
  });
  const submitted = await higgsfieldJson(
    input.authorization,
    "POST",
    request.path,
    request.body,
    input.fetchImpl,
  );
  const requestId = String(submitted.request_id || "").trim();
  if (!requestId) throw new Error("Higgsfield Kling 3 Pro returned no request_id");

  const polled = await pollHiggsfieldRequest(input.authorization, requestId, {
    maxAttempts: 90,
    sleepMs: 3000,
    fetchImpl: input.fetchImpl,
  });
  if (!polled.done) throw new Error("Higgsfield Kling 3 Pro timed out");
  if (polled.failed || !polled.body) throw new Error("Higgsfield Kling 3 Pro generation failed");
  const outputUrl = extractVideoUrl(polled.body);
  if (!outputUrl) throw new Error("Higgsfield Kling 3 Pro returned no video URL");
  return { requestId, outputUrl, model: request.model };
}
