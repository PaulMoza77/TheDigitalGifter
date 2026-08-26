/**
 * V2 free-preview quotas (server truth in pet-v2-preview).
 *
 * Session: max 2 successful live generations per funnel_session_id in a rolling 24h window.
 * IP: max 5 successful live generations per hashed IP in a rolling 24h window.
 * Image hash: max 2 successful live generations per image hash in a rolling 24h window.
 *
 * Only rows with live_generation=true AND status=succeeded consume quota.
 * Failed validation, rate-limit rejects, live_disabled, and other pre-provider failures
 * do not insert a succeeded live row — they do not consume quota.
 * Resume/replay of the same idempotency key bypasses quota checks.
 *
 * Client sessionStorage previewCount is a UX hint only; server limits are authoritative.
 */
export const V2_PREVIEW_QUOTA_DOCS = {
  sessionMax: 2,
  ipDayMax: 5,
  imageHashMax: 2,
  windowHours: 24,
  consumesOn: "live_generation=true AND status=succeeded",
  resets: "Rolling 24 hours from each successful live generation timestamp",
} as const;

export function rateLimitRetryAfterSeconds(input: {
  kind: "session" | "ip" | "image" | "unknown";
}): number {
  // Rolling window — advise waiting until the oldest success ages out.
  if (input.kind === "session") return 60 * 60; // 1h soft hint; full reset within 24h
  if (input.kind === "image") return 60 * 60;
  return 60 * 60 * 6; // IP: longer backoff suggestion
}

export function rateLimitUserMessage(input: {
  kind: "session" | "ip" | "image" | "unknown";
  retryAfterSeconds?: number;
}): string {
  const hours = Math.max(1, Math.ceil((input.retryAfterSeconds ?? 3600) / 3600));
  if (input.kind === "session") {
    return `This browser session already used its free previews (2 per 24 hours). Unlock the collection, or try again in about ${hours} hour${hours === 1 ? "" : "s"}.`;
  }
  if (input.kind === "ip") {
    return `This network reached today’s free-preview limit (5 per 24 hours). Try again in about ${hours} hour${hours === 1 ? "" : "s"}, or unlock the collection.`;
  }
  if (input.kind === "image") {
    return `That photo already received a free preview today. Try a different photo, or unlock the collection.`;
  }
  return `Free preview limit reached. Try again in about ${hours} hour${hours === 1 ? "" : "s"}, or unlock the collection.`;
}
