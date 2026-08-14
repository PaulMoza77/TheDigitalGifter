import { hmacSha256Hex, requireFulfillmentSecret } from "./stripe.ts";
import { requireAccessTokenSecret } from "./appOrigin.ts";

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };

export function accessTokenSecret(): string {
  return requireAccessTokenSecret(Deno.env.get("ACCESS_TOKEN_SECRET"));
}

export function tryAccessTokenSecret(): string {
  return String(Deno.env.get("ACCESS_TOKEN_SECRET") || "").trim();
}

export async function hashClientIp(req: Request): Promise<string> {
  const forwarded = (req.headers.get("x-forwarded-for") || "").split(",")[0]?.trim();
  const ip = forwarded || req.headers.get("cf-connecting-ip") || "unknown";
  const secret = tryAccessTokenSecret() || "ip";
  return hmacSha256Hex(secret, ip);
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function requireSchedulerAuth(req: Request): boolean {
  if (requireFulfillmentSecret(req)) return true;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const auth = req.headers.get("Authorization") || "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  return Boolean(service && bearer && bearer === service);
}

function invokeWorker(): Promise<unknown> {
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const secret = Deno.env.get("FULFILLMENT_SECRET") || "";
  if (!url || !anon) return Promise.resolve();
  return fetch(`${url}/functions/v1/process-fulfillment-jobs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anon,
      Authorization: `Bearer ${anon}`,
      "x-fulfillment-secret": secret,
    },
    body: JSON.stringify({ source: "waituntil-kick" }),
  }).catch(() => undefined);
}

/** Optimization only. Cron on process-fulfillment-jobs is the recovery mechanism. */
export function kickFulfillmentWorker(_source: string): void {
  const pending = invokeWorker();
  try {
    EdgeRuntime.waitUntil(pending);
  } catch {
    void pending;
  }
}
