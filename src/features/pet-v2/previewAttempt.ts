/** Stable identity for one logical V2 free-preview attempt. */

export function buildV2PreviewAttemptId(input: {
  sessionId: string;
  uploadId: string;
  regenerate?: boolean;
  regenNonce?: string;
}): string {
  const sessionId = String(input.sessionId || "anon").slice(0, 64);
  const uploadId = String(input.uploadId || "upload").slice(0, 64);
  if (input.regenerate) {
    const nonce = String(input.regenNonce || cryptoRandomId()).slice(0, 64);
    return `preview:${sessionId}:${uploadId}:regen:${nonce}`.slice(0, 180);
  }
  return `preview:${sessionId}:${uploadId}`.slice(0, 180);
}

export function cryptoRandomId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
