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
  return Buffer.from(token, "utf8").toString("base64");
}

export function extensionFromContentType(contentType: string): string {
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  return "jpg";
}
