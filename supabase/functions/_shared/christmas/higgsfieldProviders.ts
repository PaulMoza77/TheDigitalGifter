/**
 * Christmas V2 paid generation providers (Higgsfield only).
 * Official contracts (open.higgsfield.ai):
 *  - Soul v2 I2I: POST /higgsfield-ai/soul/v2/image-to-image → request_id + status_url
 *  - Kling 3 Pro I2V: POST /kling-video/v3.0/pro/image-to-video → request_id + status_url
 *  - Poll GET status_url (or /requests/{id}/status) until completed|failed|nsfw|canceled
 * No Replicate fallback — fail closed when credentials are missing (unless mock).
 */

import {
  extractHiggsfieldImageUrl,
  isSuccessfulHiggsfieldStatus,
  isTerminalHiggsfieldStatus,
  readHiggsfieldAuthorization,
  HIGGSFIELD_API_BASE,
} from "../higgsfieldImage.ts";
import {
  CHRISTMAS_KLING_3_PRO_VIDEO_MODEL,
  CHRISTMAS_SOUL_V2_IMAGE_MODEL,
  christmasImageModel,
  christmasVideoModel,
} from "./constants.ts";

type FetchImpl = typeof fetch;

export type HiggsfieldSubmitResult = {
  requestId: string;
  statusUrl: string;
  model: string;
};

function authHeaders(authorization: string, hasBody: boolean): HeadersInit {
  const headers: Record<string, string> = {
    Authorization: authorization,
    Accept: "application/json",
    "User-Agent": "tdg-christmas-v2/higgsfield",
  };
  if (hasBody) headers["Content-Type"] = "application/json";
  return headers;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolveStatusUrl(requestId: string, submitted: Record<string, unknown>): string {
  const fromBody = String(submitted.status_url || "").trim();
  if (fromBody.startsWith("https://api.higgsfield.ai/")) return fromBody;
  return `${HIGGSFIELD_API_BASE}/requests/${requestId}/status`;
}

async function higgsfieldJson(
  authorization: string,
  method: string,
  path: string,
  body?: unknown,
  fetchImpl: FetchImpl = fetch,
): Promise<{ status: number; body: Record<string, unknown> }> {
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
  return { status: response.status, body: parsed };
}

async function higgsfieldJsonOk(
  authorization: string,
  method: string,
  path: string,
  body?: unknown,
  fetchImpl: FetchImpl = fetch,
  options?: { maxRetries?: number },
): Promise<Record<string, unknown>> {
  const maxRetries = options?.maxRetries ?? 4;
  let delayMs = 1000;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const { status, body: parsed } = await higgsfieldJson(
      authorization,
      method,
      path,
      body,
      fetchImpl,
    );
    if (status >= 200 && status < 300) return parsed;
    const retryable = status === 429 || status >= 500;
    if (!retryable || attempt === maxRetries) {
      const detail = String(parsed.detail || parsed.error || parsed.message || "").slice(0, 200);
      throw new Error(detail || `Higgsfield HTTP ${status}`);
    }
    await sleep(delayMs + Math.floor(Math.random() * 400));
    delayMs = Math.min(delayMs * 2, 16_000);
  }
  throw new Error("Higgsfield request failed");
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

export function soulV2ImageRequest(input: {
  prompt: string;
  imageUrl: string;
  aspectRatio?: string;
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
      // Product does not promise audio · keep sound off (HF default is "on").
      sound: "off",
      multi_shots: false,
    },
  };
}

/** Submit only · caller MUST persist requestId before polling (anti double-charge). */
export async function submitSoulV2Image(input: {
  authorization: string;
  prompt: string;
  imageUrl: string;
  aspectRatio?: string;
  fetchImpl?: FetchImpl;
}): Promise<HiggsfieldSubmitResult> {
  const request = soulV2ImageRequest({
    ...input,
    model: christmasImageModel(),
  });
  const submitted = await higgsfieldJsonOk(
    input.authorization,
    "POST",
    request.path,
    request.body,
    input.fetchImpl,
  );
  const requestId = String(submitted.request_id || "").trim();
  if (!requestId) throw new Error("Higgsfield Soul v2 returned no request_id");
  return {
    requestId,
    statusUrl: resolveStatusUrl(requestId, submitted),
    model: request.model,
  };
}

/** Submit only · caller MUST persist requestId before polling. */
export async function submitKling3ProVideo(input: {
  authorization: string;
  prompt: string;
  imageUrl: string;
  duration?: number;
  fetchImpl?: FetchImpl;
}): Promise<HiggsfieldSubmitResult> {
  const request = kling3ProVideoRequest({
    ...input,
    model: christmasVideoModel(),
  });
  const submitted = await higgsfieldJsonOk(
    input.authorization,
    "POST",
    request.path,
    request.body,
    input.fetchImpl,
  );
  const requestId = String(submitted.request_id || "").trim();
  if (!requestId) throw new Error("Higgsfield Kling 3 Pro returned no request_id");
  return {
    requestId,
    statusUrl: resolveStatusUrl(requestId, submitted),
    model: request.model,
  };
}

/**
 * Poll with official backoff guidance: start ~2s, grow toward ~10s + jitter.
 * Prefer statusUrl from submit response when available.
 */
export async function pollHiggsfieldRequest(
  authorization: string,
  requestId: string,
  options?: {
    maxAttempts?: number;
    initialSleepMs?: number;
    statusUrl?: string | null;
    fetchImpl?: FetchImpl;
  },
): Promise<{ done: boolean; failed: boolean; body: Record<string, unknown> | null; status?: string }> {
  const maxAttempts = options?.maxAttempts ?? 60;
  const fetchImpl = options?.fetchImpl ?? fetch;
  const statusPath =
    options?.statusUrl && options.statusUrl.startsWith("https://api.higgsfield.ai/")
      ? options.statusUrl
      : `/requests/${requestId}/status`;
  let delayMs = options?.initialSleepMs ?? 2000;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const current = await higgsfieldJsonOk(
        authorization,
        "GET",
        statusPath,
        undefined,
        fetchImpl,
        { maxRetries: 2 },
      );
      const status = String(current.status || "");
      if (isTerminalHiggsfieldStatus(status)) {
        return {
          done: true,
          failed: !isSuccessfulHiggsfieldStatus(status),
          body: current,
          status,
        };
      }
    } catch (err) {
      // Transient poll errors: continue with backoff unless out of attempts.
      if (attempt >= maxAttempts - 1) throw err;
    }
    if (attempt < maxAttempts - 1) {
      await sleep(delayMs + Math.floor(Math.random() * 500));
      delayMs = Math.min(Math.floor(delayMs * 1.5), 10_000);
    }
  }
  return { done: false, failed: false, body: null };
}

export function extractVideoUrl(body: Record<string, unknown>): string | null {
  const video = body.video;
  if (video && typeof video === "object" && typeof (video as { url?: unknown }).url === "string") {
    return (video as { url: string }).url;
  }
  if (typeof body.video_url === "string") return body.video_url;
  return null;
}

/** Convenience: submit+poll in-process (tests / short paths). Prefer split for workers. */
export async function generateSoulV2Image(input: {
  authorization: string;
  prompt: string;
  imageUrl: string;
  aspectRatio?: string;
  fetchImpl?: FetchImpl;
}): Promise<{ requestId: string; outputUrl: string; model: string }> {
  const submitted = await submitSoulV2Image(input);
  const polled = await pollHiggsfieldRequest(input.authorization, submitted.requestId, {
    maxAttempts: 48,
    statusUrl: submitted.statusUrl,
    fetchImpl: input.fetchImpl,
  });
  if (!polled.done) throw new Error("Higgsfield Soul v2 timed out");
  if (polled.failed || !polled.body) throw new Error("Higgsfield Soul v2 generation failed");
  const outputUrl = extractHiggsfieldImageUrl(polled.body);
  if (!outputUrl) throw new Error("Higgsfield Soul v2 returned no image URL");
  return { requestId: submitted.requestId, outputUrl, model: submitted.model };
}

export async function generateKling3ProVideo(input: {
  authorization: string;
  prompt: string;
  imageUrl: string;
  duration?: number;
  fetchImpl?: FetchImpl;
}): Promise<{ requestId: string; outputUrl: string; model: string }> {
  const submitted = await submitKling3ProVideo(input);
  const polled = await pollHiggsfieldRequest(input.authorization, submitted.requestId, {
    maxAttempts: 90,
    statusUrl: submitted.statusUrl,
    fetchImpl: input.fetchImpl,
  });
  if (!polled.done) throw new Error("Higgsfield Kling 3 Pro timed out");
  if (polled.failed || !polled.body) throw new Error("Higgsfield Kling 3 Pro generation failed");
  const outputUrl = extractVideoUrl(polled.body);
  if (!outputUrl) throw new Error("Higgsfield Kling 3 Pro returned no video URL");
  return { requestId: submitted.requestId, outputUrl, model: submitted.model };
}
