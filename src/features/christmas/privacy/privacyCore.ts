/**
 * Christmas private-media privacy helpers (pure — no I/O).
 * Secondary gap loop: TDG-CHRISTMAS-GAP-KIDS-PRIVACY-HARDEN-007
 */

/** Keys that must never appear in Christmas funnel analytics metadata. */
export const CHRISTMAS_ANALYTICS_SENSITIVE_KEY_RE =
  /^(email|child_?name|recipient|message|prompt|token|public_token|delivery_token|share_token|owner_token|storage_path|storage_key|source_path|result_url|image_url|photo_url|signed_url|authorization|password|secret|api_key)$/i;

const SENSITIVE_VALUE_RE =
  /(supabase\.co\/storage|storage\.googleapis|\/object\/public\/|sk_live|sk_test|Bearer\s+)/i;

export function isSensitiveAnalyticsKey(key: string): boolean {
  return CHRISTMAS_ANALYTICS_SENSITIVE_KEY_RE.test(key.trim());
}

export function sanitizeChristmasAnalyticsMetadata(
  input: unknown,
): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const out: Record<string, unknown> = {};
  for (const [rawKey, value] of Object.entries(input as Record<string, unknown>)) {
    const key = rawKey.trim().slice(0, 64);
    if (!key || isSensitiveAnalyticsKey(key)) continue;
    if (typeof value === "string") {
      const trimmed = value.trim().slice(0, 120);
      if (!trimmed || SENSITIVE_VALUE_RE.test(trimmed)) continue;
      if (/[<>\u0000-\u001f]/.test(trimmed)) continue;
      out[key] = trimmed;
      continue;
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      out[key] = value;
      continue;
    }
    if (typeof value === "boolean") {
      out[key] = value;
    }
  }
  return out;
}

/** Delivery emails must use app routes, never raw private storage URLs. */
export function isUnsafePrivateMediaUrl(url: string | null | undefined): boolean {
  const raw = String(url || "").trim();
  if (!raw) return false;
  return (
    /\/storage\/v1\/object\/public\//i.test(raw) ||
    /storage\.googleapis\.com/i.test(raw) ||
    /\/object\/public\/christmas-(source|generated)/i.test(raw)
  );
}

export function assertSafeDeliveryEmailUrl(url: string): {
  ok: boolean;
  reason: string;
} {
  if (!url || !/^https?:\/\//i.test(url)) {
    return { ok: false, reason: "missing_or_non_http" };
  }
  if (isUnsafePrivateMediaUrl(url)) {
    return { ok: false, reason: "raw_storage_url" };
  }
  try {
    const parsed = new URL(url);
    if (/token|public_token/i.test(parsed.search) && parsed.searchParams.get("token")) {
      // Token in query is expected for app recovery routes — not a storage URL.
      return { ok: true, reason: "app_token_route" };
    }
  } catch {
    return { ok: false, reason: "invalid_url" };
  }
  return { ok: true, reason: "ok" };
}

/** Scrub capability tokens from order metadata before persistence/response. */
export function scrubOrderMetadataForPersistence(
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

export function isDeliveryRevoked(
  metadata: Record<string, unknown> | null | undefined,
): boolean {
  if (!metadata) return false;
  return metadata.delivery_revoked === true || Boolean(metadata.delivery_revoked_at);
}

/** Minimum entropy for Christmas public delivery tokens (hex chars). */
export const MIN_DELIVERY_TOKEN_HEX_LENGTH = 32;

export function isHighEntropyDeliveryToken(token: string | null | undefined): boolean {
  const raw = String(token || "").trim();
  if (raw.length < MIN_DELIVERY_TOKEN_HEX_LENGTH) return false;
  return /^[a-f0-9]+$/i.test(raw);
}

export type ChristmasSafeOrderProjection = {
  id: string;
  product_key: string;
  package_key: string | null;
  style_key: string | null;
  payment_status: string;
  fulfillment_status: string;
  amount_cents: number;
  currency: string;
  last_error: string | null;
  portrait_type?: string | null;
  species?: string | null;
  source_route?: string | null;
  resultUrl: string | null;
};

/** Retention policy placeholder — founder/legal must set duration before auto-purge. */
export const CHRISTMAS_MEDIA_RETENTION = {
  policy: "policy_pending_founder_legal" as const,
  santaDefaultDaysEnv: "CHRISTMAS_SANTA_RETENTION_DAYS",
  unpaidUploadPrefix: "uploads/",
  note: "Do not auto-delete paid outputs without product promise + legal clearance.",
};
