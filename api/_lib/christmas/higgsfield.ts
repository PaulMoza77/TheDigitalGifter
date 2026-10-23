/**
 * Node origin port of supabase/functions/_shared/christmas/higgsfield.ts (video path).
 * Christmas pack videos must use Higgsfield Kling — never silently fall back to Replicate.
 */

const HIGGSFIELD_API_BASE = "https://api.higgsfield.ai";
export const CHRISTMAS_HIGGSFIELD_VIDEO_MODEL = "kling-video/v3.0/pro/image-to-video";

export class HiggsfieldTerminalFailure extends Error {}

type EnvLike = { get?(name: string): string | undefined } | NodeJS.ProcessEnv;

function envGet(env: EnvLike, name: string): string {
  if (typeof (env as { get?: (n: string) => string | undefined }).get === "function") {
    return String((env as { get: (n: string) => string | undefined }).get(name) || "").trim();
  }
  return String((env as NodeJS.ProcessEnv)[name] || "").trim();
}

export function readHiggsfieldAuthorization(env: EnvLike = process.env): string | null {
  const combined = envGet(env, "HF_CREDENTIALS") || envGet(env, "HF_KEY");
  const splitAt = combined.indexOf(":");
  if (splitAt > 0) {
    const keyId = combined.slice(0, splitAt).trim();
    const secret = combined.slice(splitAt + 1).trim();
    if (keyId && secret) return `Key ${keyId}:${secret}`;
  }
  const keyId = envGet(env, "HF_API_KEY_ID") || envGet(env, "HF_API_KEY");
  const secret =
    envGet(env, "HF_API_KEY_SECRET") || envGet(env, "HF_SECRET") || envGet(env, "HF_API_SECRET");
  if (keyId && secret) return `Key ${keyId}:${secret}`;
  return null;
}

function isTerminal(status: string): boolean {
  return ["completed", "succeeded", "failed", "nsfw", "canceled", "cancelled", "error"].includes(
    status.toLowerCase(),
  );
}

function isSuccess(status: string): boolean {
  return ["completed", "succeeded"].includes(status.toLowerCase());
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
      "User-Agent": "tdg-generator/higgsfield",
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
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
    throw new Error(`Higgsfield request failed (HTTP ${response.status})`);
  }
  return parsed;
}

function higgsfieldVideoUrl(current: Record<string, unknown>): string {
  const direct = [current.video_url, current.url, current.output_url];
  for (const value of direct) {
    if (typeof value === "string" && value.startsWith("https://")) return value;
  }
  for (const key of ["video", "output"]) {
    const nested = current[key];
    if (typeof nested === "string" && nested.startsWith("https://")) return nested;
    if (nested && typeof nested === "object" && typeof (nested as { url?: unknown }).url === "string") {
      const url = String((nested as { url: string }).url);
      if (url.startsWith("https://")) return url;
    }
  }
  for (const key of ["videos", "images"]) {
    const list = current[key];
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      if (typeof item === "string" && item.startsWith("https://")) return item;
      if (item && typeof item === "object" && typeof (item as { url?: unknown }).url === "string") {
        const url = String((item as { url: string }).url);
        if (url.startsWith("https://")) return url;
      }
    }
  }
  return "";
}

export async function generateChristmasHiggsfieldVideo(
  env: EnvLike,
  imageUrl: string,
  prompt: string,
  recovery: {
    requestId?: string | null;
    onSubmitted?: (id: string, model: string) => Promise<void>;
  } = {},
): Promise<{ predictionId: string; outputUrl: string; model: string }> {
  const auth = readHiggsfieldAuthorization(env);
  if (!auth) throw new Error("TDG Higgsfield credentials are not configured (HF_CREDENTIALS or HF_API_KEY_ID/HF_API_KEY_SECRET)");

  let id = String(recovery.requestId || "");
  if (!id) {
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const submitted = await higgsfieldJson(auth, "POST", `/${CHRISTMAS_HIGGSFIELD_VIDEO_MODEL}`, {
          image_url: imageUrl,
          prompt,
          duration: 5,
          sound: "off",
        });
        id = String(submitted.request_id || "");
        if (!id) throw new Error("Higgsfield returned no video request identity");
        break;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        id = "";
        if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 2000 * (attempt + 1)));
      }
    }
    if (!id) throw lastError || new Error("Higgsfield returned no video request identity");
    await recovery.onSubmitted?.(id, CHRISTMAS_HIGGSFIELD_VIDEO_MODEL);
  }

  for (let attempt = 0; attempt < 90; attempt += 1) {
    const current = await higgsfieldJson(auth, "GET", `/requests/${encodeURIComponent(id)}/status`);
    if (isTerminal(String(current.status || ""))) {
      if (!isSuccess(String(current.status))) {
        throw new HiggsfieldTerminalFailure("Higgsfield video generation failed");
      }
      const outputUrl = higgsfieldVideoUrl(current);
      if (!/^https:\/\//.test(outputUrl)) throw new Error("Higgsfield returned no video output");
      return {
        predictionId: id,
        outputUrl,
        model: CHRISTMAS_HIGGSFIELD_VIDEO_MODEL,
      };
    }
    if (attempt < 89) await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  throw new Error("Higgsfield video timed out");
}
