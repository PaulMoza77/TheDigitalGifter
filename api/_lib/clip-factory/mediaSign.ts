import { createHmac, timingSafeEqual } from "node:crypto";

function secret(): string {
  return String(process.env.CLIP_FACTORY_SIGNING_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "tdg-clip-factory").slice(0, 80);
}

export function signMedia(id: string, exp: number): string {
  return createHmac("sha256", secret()).update(`${id}.${exp}`).digest("hex").slice(0, 40);
}

export function verifyMediaSignature(id: string, exp: string | number, sig: string): boolean {
  const expires = Number(exp);
  if (!id || !sig || !Number.isFinite(expires) || expires < Date.now() / 1000) return false;
  const expected = signMedia(id, expires);
  const a = Buffer.from(expected);
  const b = Buffer.from(String(sig));
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function signedPlaybackPath(kind: "source" | "render" | "thumb", id: string, ttlSec = 60 * 60 * 12): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSec;
  const sig = signMedia(`${kind}:${id}`, exp);
  return `/api/clip-factory?action=media&kind=${kind}&id=${encodeURIComponent(id)}&exp=${exp}&sig=${sig}`;
}
