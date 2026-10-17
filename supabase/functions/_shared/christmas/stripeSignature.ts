/**
 * Stripe webhook signature verification (Deno Edge).
 * Keep algorithm aligned with api/_lib/christmas/stripeSignature.ts.
 */

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const left = enc.encode(a);
  const right = enc.encode(b);
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i++) diff |= left[i] ^ right[i];
  return diff === 0;
}

/** Verify Stripe-Signature header. Rejects missing/expired/forged signatures. */
export async function verifyStripeSignature(
  rawBody: string,
  header: string,
  secret: string,
  options?: { nowSeconds?: number; toleranceSeconds?: number },
): Promise<boolean> {
  if (!secret || !header || rawBody == null) return false;
  const parts = Object.fromEntries(
    header.split(",").map((item) => {
      const [k, ...rest] = item.split("=");
      return [k.trim(), rest.join("=").trim()];
    }),
  );
  const timestamp = parts.t;
  const signatures = header
    .split(",")
    .filter((item) => item.trim().startsWith("v1="))
    .map((item) => item.trim().slice(3));
  if (!timestamp || signatures.length === 0) return false;

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  const now = options?.nowSeconds ?? Date.now() / 1000;
  const tolerance = options?.toleranceSeconds ?? 60 * 5;
  if (Math.abs(now - ts) > tolerance) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${timestamp}.${rawBody}`),
  );
  const digest = toHex(signed);
  return signatures.some((signature) => timingSafeEqual(digest, signature));
}
