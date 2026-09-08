/**
 * Node/Vercel port of supabase/functions/_shared/christmas/crypto.ts.
 * Keep in sync with the Deno source.
 */
import { createHash, randomBytes } from "node:crypto";

export function asString(value: unknown): string {
  return String(value ?? "").trim();
}

export function asInt(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

export function isUuid(value: unknown): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    asString(value),
  );
}

export async function sha256Hex(input: string): Promise<string> {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

export function generatePublicToken(): string {
  return randomBytes(24).toString("hex");
}

export async function encryptPublicToken(token: string): Promise<string> {
  // Soft ciphertext for recovery tooling — hashed token remains the auth gate.
  // Never store plaintext tokens in metadata or API responses.
  return Buffer.from(token, "utf8").toString("base64");
}

export function decryptPublicToken(ciphertext: string | null | undefined): string | null {
  const raw = asString(ciphertext);
  if (!raw) return null;
  try {
    const token = Buffer.from(raw, "base64").toString("utf8");
    return token.length >= 32 ? token : null;
  } catch {
    return null;
  }
}

export function resolveDeliveryToken(order: {
  public_token_ciphertext?: string | null;
  metadata?: Record<string, unknown> | null;
}): string | null {
  const fromCipher = decryptPublicToken(order.public_token_ciphertext);
  if (fromCipher) return fromCipher;
  const meta = order.metadata && typeof order.metadata === "object" ? order.metadata : null;
  const legacy = asString(meta?.public_token_hint);
  return legacy.length >= 32 ? legacy : null;
}

export function scrubSensitiveOrderMetadata(
  metadata: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  if (!metadata || typeof metadata !== "object") return {};
  const next = { ...metadata };
  delete next.public_token_hint;
  delete next.public_token;
  delete next.delivery_token;
  delete next.owner_token;
  return next;
}

export function extensionFromContentType(contentType: string): string {
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  return "jpg";
}
