import { hmacSha256Hex } from "./stripe.ts";

export function accessTokenSecret(): string {
  return Deno.env.get("ACCESS_TOKEN_SECRET") || Deno.env.get("FULFILLMENT_SECRET") || "";
}

export async function hashClientIp(req: Request): Promise<string> {
  const forwarded = (req.headers.get("x-forwarded-for") || "").split(",")[0]?.trim();
  const ip = forwarded || req.headers.get("cf-connecting-ip") || "unknown";
  return hmacSha256Hex(accessTokenSecret() || "ip", ip);
}

export function kickFulfillmentWorker(source: string): void {
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const secret = Deno.env.get("FULFILLMENT_SECRET") || "";
  if (!url || !anon) return;
  fetch(`${url}/functions/v1/process-fulfillment-jobs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anon,
      Authorization: `Bearer ${anon}`,
      "x-fulfillment-secret": secret,
    },
    body: JSON.stringify({ source }),
  }).catch(() => undefined);
}
