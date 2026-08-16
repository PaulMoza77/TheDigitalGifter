import { petImageModel, petImageModelVersion, siteOrigin } from "./constants.ts";
import { hmacSha256Base64, timingSafeEqual } from "./crypto.ts";

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

export function webhookCallbackUrl(orderId: string, sceneKey: string): string {
  const base = (Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "");
  const url = new URL(`${base}/functions/v1/pet-replicate-webhook`);
  url.searchParams.set("order_id", orderId);
  url.searchParams.set("scene_key", sceneKey);
  return url.toString();
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
    input: {
      prompt: input.prompt,
      input_image: input.imageUrl,
      image: input.imageUrl,
      output_format: "jpg",
      aspect_ratio: "4:5",
    },
    webhook: webhookCallbackUrl(input.orderId, input.sceneKey),
    webhook_events_filter: ["completed"],
  };

  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  if (version) {
    const res = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers,
      body: JSON.stringify({ ...body, version }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.detail || json?.error || "Replicate prediction failed");
    return json as ReplicatePrediction;
  }

  const res = await fetch(`https://api.replicate.com/v1/models/${model}/predictions`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.detail || json?.error || "Replicate prediction failed");
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
