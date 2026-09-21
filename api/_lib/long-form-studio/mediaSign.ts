import { createHmac, timingSafeEqual } from "node:crypto";

function secret(): string {
  const value = String(
    process.env.LONG_FORM_SIGNING_SECRET || process.env.CLIP_FACTORY_SIGNING_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  ).trim();
  if (value.length < 16) {
    throw new Error("Long-Form media signing secret is not configured.");
  }
  return value.slice(0, 80);
}

export function signLongFormMedia(id: string, exp: number): string {
  return createHmac("sha256", secret()).update(`${id}.${exp}`).digest("hex").slice(0, 40);
}

export function verifyLongFormSignature(id: string, exp: string | number, sig: string): boolean {
  const expires = Number(exp);
  if (!id || !sig || !Number.isFinite(expires) || expires < Date.now() / 1000) return false;
  let expected: string;
  try {
    expected = signLongFormMedia(id, expires);
  } catch {
    return false;
  }
  const a = Buffer.from(expected);
  const b = Buffer.from(String(sig));
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function signedLongFormPath(kind: "video" | "thumb" | "audio", id: string, ttlSec?: number): string {
  const ttl = ttlSec ?? (kind === "video" ? 60 * 60 * 3 : 60 * 60);
  const exp = Math.floor(Date.now() / 1000) + ttl;
  const sig = signLongFormMedia(`${kind}:${id}`, exp);
  return `/api/long-form-studio?action=media&kind=${kind}&id=${encodeURIComponent(id)}&exp=${exp}&sig=${sig}`;
}

export function stableMediaPath(kind: "video" | "thumb" | "audio", id: string): string {
  return `/api/long-form-studio?action=media&kind=${kind}&id=${encodeURIComponent(id)}`;
}
