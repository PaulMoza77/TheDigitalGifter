import { retryAfterSecondsFromOldest } from "./acquirePreviewCreate";

/**
 * V2 free-preview quotas (server truth in begin_pet_v2_preview_create).
 *
 * Session: max 2 successful live gens + active processing reservations / session / rolling 24h.
 * IP: max 5 / day.
 * Image hash: max 2 / day.
 *
 * Consumed permanently: live_generation=true AND status=succeeded.
 * Reserved while status=processing (released when marked failed without success).
 * Failed validation / pre-provider / rate-limit rejects do not consume succeeded quota.
 * Same idempotency key resumes without a second create.
 *
 * retryAfterSeconds is derived from the oldest counted row in the rolling window
 * (oldest.created_at + 24h - now), not a hardcoded 1h/6h hint.
 *
 * Client sessionStorage previewCount is a UX hint only.
 * Deploy order: migration first, then pet-v2-preview edge.
 */
export const V2_PREVIEW_QUOTA_DOCS = {
  sessionMax: 2,
  ipDayMax: 5,
  imageHashMax: 2,
  windowHours: 24,
  consumesOn: "live_generation=true AND status=succeeded",
  reservesOn: "status=processing",
  resets: "Rolling 24 hours from the oldest counted succeeded/processing row",
  deployOrder: "migration begin_pet_v2_preview_create first, then pet-v2-preview edge",
} as const;

export function rateLimitRetryAfterSeconds(input: {
  kind: "session" | "ip" | "image" | "unknown";
  oldestCreatedAt?: string | null;
}): number {
  if (input.oldestCreatedAt) {
    return retryAfterSecondsFromOldest(input.oldestCreatedAt);
  }
  return 1;
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
