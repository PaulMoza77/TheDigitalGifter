export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

function bytesToB64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const byte of bytes) bin += String.fromCharCode(byte);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function b64UrlToBytes(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  const bin = atob(padded + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmacSha256Raw(secret: string, payload: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return new Uint8Array(sig);
}

export type AccessTokenKind = "order" | "upload";

export type AccessTokenPayload = {
  typ: AccessTokenKind;
  id: string;
  exp: number;
};

export async function signAccessToken(
  payload: AccessTokenPayload,
  secret: string,
): Promise<string> {
  if (!secret) throw new Error("Missing access token secret");
  const body = bytesToB64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const sig = bytesToB64Url(await hmacSha256Raw(secret, body));
  return `${body}.${sig}`;
}

export async function verifyAccessToken(
  token: string,
  secret: string,
  expected: { typ: AccessTokenKind; id?: string },
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<AccessTokenPayload | null> {
  if (!token || !secret) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  const expectedSig = bytesToB64Url(await hmacSha256Raw(secret, body));
  if (!timingSafeEqual(sig, expectedSig)) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(b64UrlToBytes(body))) as AccessTokenPayload;
    if (payload.typ !== expected.typ) return null;
    if (expected.id && payload.id !== expected.id) return null;
    if (!payload.id || payload.exp < nowSeconds) return null;
    return payload;
  } catch {
    return null;
  }
}

export function authorizeOrderAccess(args: {
  orderUserId: string | null;
  authUserId: string | null;
  tokenOk: boolean;
}): boolean {
  if (args.authUserId && args.orderUserId && args.authUserId === args.orderUserId) {
    return true;
  }
  return args.tokenOk;
}
