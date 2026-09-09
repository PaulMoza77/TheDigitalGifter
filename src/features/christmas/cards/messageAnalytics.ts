/**
 * Message-generator analytics must never include free-text bodies.
 * Allowed dimensions: recipient / tone / length / language / provider / fallback.
 */

export const MESSAGE_ANALYTICS_EVENTS = [
  "christmas_message_page_view",
  "message_generator_started",
  "message_generator_completed",
  "message_generator_failed",
  "message_copied",
  "message_to_card",
  "message_regenerated",
] as const;

const BLOCKED_KEYS = new Set([
  "text",
  "message",
  "message_text",
  "custom_detail",
  "custom",
  "body",
  "prompt",
  "result",
  "messages",
  "handoff",
]);

const ALLOWED_KEYS = new Set([
  "recipient_key",
  "tone_key",
  "length_key",
  "language",
  "provider",
  "used_fallback",
  "fallback",
  "error_code",
  "style_key",
  "message_source",
]);

export type MessageAnalyticsDims = {
  recipientKey?: string | null;
  toneKey?: string | null;
  lengthKey?: string | null;
  language?: string | null;
  provider?: string | null;
  usedFallback?: boolean | null;
  errorCode?: string | null;
};

function shortKey(value: unknown, max = 40): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

/** Build a privacy-safe metadata object for Christmas message events. */
export function messageAnalyticsMeta(dims: MessageAnalyticsDims): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const recipient = shortKey(dims.recipientKey);
  const tone = shortKey(dims.toneKey);
  const length = shortKey(dims.lengthKey);
  const language = dims.language === "ro" ? "ro" : dims.language ? "en" : null;
  const provider = shortKey(dims.provider);
  const errorCode = shortKey(dims.errorCode, 48);
  if (recipient) out.recipient_key = recipient;
  if (tone) out.tone_key = tone;
  if (length) out.length_key = length;
  if (language) out.language = language;
  if (provider) out.provider = provider;
  if (dims.usedFallback != null) out.used_fallback = Boolean(dims.usedFallback);
  if (errorCode) out.error_code = errorCode;
  return out;
}

/** Drop free-text / oversize values from message-event metadata. */
export function sanitizeMessageAnalyticsMeta(
  eventName: string,
  metadata: Record<string, unknown>,
): Record<string, unknown> {
  if (!(MESSAGE_ANALYTICS_EVENTS as readonly string[]).includes(eventName)) {
    return metadata;
  }
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (BLOCKED_KEYS.has(key)) continue;
    if (!ALLOWED_KEYS.has(key)) continue;
    if (typeof value === "string" && value.length > 80) continue;
    out[key] = value;
  }
  return out;
}

export function isMessageFunnelEvent(eventName: string): boolean {
  return (MESSAGE_ANALYTICS_EVENTS as readonly string[]).includes(eventName);
}

export function messageLandingPath(pathname: string | null | undefined): string | null {
  if (!pathname) return null;
  return pathname.split("?")[0].slice(0, 120) || null;
}
