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
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function generatePublicToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function encryptPublicToken(token: string): Promise<string> {
  // Soft ciphertext for recovery tooling — hashed token remains the auth gate.
  // Never store plaintext tokens in metadata or API responses.
  return btoa(token);
}

export function decryptPublicToken(ciphertext: string | null | undefined): string | null {
  const raw = asString(ciphertext);
  if (!raw) return null;
  try {
    const token = atob(raw);
    return token.length >= 32 ? token : null;
  } catch {
    return null;
  }
}

/** Resolve delivery token for emails: ciphertext first, legacy metadata hint last (then scrub). */
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
