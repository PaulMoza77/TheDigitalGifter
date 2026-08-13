export async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export async function verifyStripeSignature(args: {
  payload: string;
  header: string;
  secret: string;
  toleranceSeconds?: number;
}): Promise<{ ok: true; timestamp: number } | { ok: false; error: string }> {
  const tolerance = args.toleranceSeconds ?? 300;
  const parts = args.header.split(",").map((part) => part.trim());
  let timestamp = "";
  const signatures: string[] = [];

  for (const part of parts) {
    const [key, value] = part.split("=");
    if (key === "t") timestamp = value || "";
    if (key === "v1" && value) signatures.push(value);
  }

  if (!timestamp || signatures.length === 0) {
    return { ok: false, error: "Malformed Stripe-Signature header" };
  }

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) {
    return { ok: false, error: "Invalid Stripe signature timestamp" };
  }

  const age = Math.abs(Math.floor(Date.now() / 1000) - ts);
  if (age > tolerance) {
    return { ok: false, error: "Stripe signature timestamp outside tolerance" };
  }

  const expected = await hmacSha256Hex(args.secret, `${timestamp}.${args.payload}`);
  const matched = signatures.some((signature) => timingSafeEqual(signature, expected));
  if (!matched) {
    return { ok: false, error: "Stripe signature mismatch" };
  }

  return { ok: true, timestamp: ts };
}

export function requireFulfillmentSecret(req: Request): boolean {
  const expected = Deno.env.get("FULFILLMENT_SECRET") || "";
  if (!expected) return false;
  const provided = req.headers.get("x-fulfillment-secret") || "";
  return timingSafeEqual(provided, expected);
}
