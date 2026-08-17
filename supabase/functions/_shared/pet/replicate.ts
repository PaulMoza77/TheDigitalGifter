import { petImageModel, petImageModelVersion, petVideoModel, petVideoDurationSeconds, petVideoResolution, siteOrigin } from "./constants.ts";
import { hmacSha256Base64, timingSafeEqual } from "./crypto.ts";
import { parseRetryAfterMs, ReplicateHttpError } from "./replicateRateLimit.ts";

export { ReplicateHttpError } from "./replicateRateLimit.ts";

export type ReplicatePrediction = {
  id?: string;
  status?: string;
  error?: string;
  output?: unknown;
  metrics?: { predict_time?: number };
  model?: string;
  version?: string;
  created_at?: string;
};

function asString(value: unknown): string {
  return String(value ?? "").trim();
}

export function replicateOutputUrl(output: unknown): string | null {
  if (typeof output === "string" && output.startsWith("http")) return output;
  if (Array.isArray(output)) {
    const first = output.find((item) => typeof item === "string" && item.startsWith("http"));
    if (typeof first === "string") return first;
  }
  if (output && typeof output === "object") {
    const rec = output as Record<string, unknown>;
    if (typeof rec.url === "string") return rec.url;
  }
  return null;
}

export function webhookCallbackUrl(orderId: string, sceneKey: string, extra?: Record<string, string>): string {
  const base = (Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "");
  const url = new URL(`${base}/functions/v1/pet-replicate-webhook`);
  url.searchParams.set("order_id", orderId);
  url.searchParams.set("scene_key", sceneKey);
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      url.searchParams.set(key, value);
    }
  }
  return url.toString();
}

export function kontextProInput(prompt: string, inputImage: string) {
  return {
    prompt,
    input_image: inputImage,
    aspect_ratio: "match_input_image",
    output_format: "jpg",
    prompt_upsampling: false,
    safety_tolerance: 2,
  };
}

export function seedanceInput(prompt: string, imageUrl: string) {
  return {
    prompt,
    image: imageUrl,
    duration: petVideoDurationSeconds(),
    resolution: petVideoResolution(),
    camera_fixed: false,
  };
}

export async function createReplicateVideoPrediction(input: {
  prompt: string;
  imageUrl: string;
  orderId: string;
  clipId: string;
  slot: number;
}): Promise<ReplicatePrediction> {
  const token = asString(Deno.env.get("REPLICATE_API_TOKEN"));
  if (!token) throw new Error("REPLICATE_API_TOKEN is not configured");

  const model = petVideoModel();
  const body: Record<string, unknown> = {
    input: seedanceInput(input.prompt, input.imageUrl),
    webhook: webhookCallbackUrl(input.orderId, `video-slot-${input.slot}`, {
      media_type: "video",
      clip_id: input.clipId,
    }),
    webhook_events_filter: ["completed"],
  };

  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  return postReplicatePrediction(`https://api.replicate.com/v1/models/${model}/predictions`, headers, body);
}

export async function createReplicatePrediction(input: {
  prompt: string;
  imageUrl: string;
  orderId: string;
  sceneKey: string;
}): Promise<ReplicatePrediction> {
  const token = asString(Deno.env.get("REPLICATE_API_TOKEN"));
  if (!token) throw new Error("REPLICATE_API_TOKEN is not configured");

  const model = petImageModel();
  const version = petImageModelVersion();
  const body: Record<string, unknown> = {
    input: kontextProInput(input.prompt, input.imageUrl),
    webhook: webhookCallbackUrl(input.orderId, input.sceneKey),
    webhook_events_filter: ["completed"],
  };

  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  if (version) {
    return postReplicatePrediction("https://api.replicate.com/v1/predictions", headers, { ...body, version });
  }

  return postReplicatePrediction(`https://api.replicate.com/v1/models/${model}/predictions`, headers, body);
}

async function postReplicatePrediction(
  url: string,
  headers: Record<string, string>,
  body: Record<string, unknown>,
): Promise<ReplicatePrediction> {
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = text ? JSON.parse(text) as Record<string, unknown> : {};
  } catch {
    json = {};
  }
  if (!res.ok) {
    const retryAfterMs = parseRetryAfterMs({
      retryAfterHeader: res.headers.get("retry-after"),
      resetHeader: res.headers.get("ratelimit-reset") || res.headers.get("x-ratelimit-reset"),
      body: text,
    });
    const message = String(json.detail || json.error || text || "Replicate prediction failed").slice(0, 500);
    throw new ReplicateHttpError(message, res.status, retryAfterMs);
  }
  return json as ReplicatePrediction;
}

export async function verifyReplicateWebhook(req: Request, rawBody: string): Promise<boolean> {
  const secret = asString(Deno.env.get("REPLICATE_WEBHOOK_SECRET"));
  if (!secret) return false;

  const id = req.headers.get("webhook-id") || "";
  const timestamp = req.headers.get("webhook-timestamp") || "";
  const signature = req.headers.get("webhook-signature") || "";
  if (!id || !timestamp || !signature) return false;

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  if (Math.abs(Date.now() / 1000 - ts) > 60 * 5) return false;

  const encoded = secret.startsWith("whsec_") ? secret.slice("whsec_".length) : secret;
  const binary = atob(encoded);
  const secretBytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) secretBytes[i] = binary.charCodeAt(i);

  const signedContent = `${id}.${timestamp}.${rawBody}`;
  const expected = await hmacSha256Base64(secretBytes, signedContent);
  return signature.split(" ").some((part) => {
    const sig = part.trim().split(",")[1] || "";
    return sig && timingSafeEqual(sig, expected);
  });
}

export function publicAppOrigin(): string {
  return siteOrigin();
}
