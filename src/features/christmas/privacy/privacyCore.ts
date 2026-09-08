/**
 * Christmas private-media privacy helpers (pure — no I/O).
 * GAP: TDG-CHRISTMAS-GAP-KIDS-PRIVACY-HARDEN-007
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

export function buildCheckoutOrderMetadata(input: {
  portraitType?: string | null;
  species?: string | null;
  sourceRoute?: string | null;
}): Record<string, unknown> {
  return scrubOrderMetadataForPersistence({
    source: "christmas-checkout",
    portrait_type: input.portraitType ?? null,
    species: input.species ?? null,
    source_route: input.sourceRoute ?? null,
  });
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

/**
 * Updating an existing unpaid order requires the capability token.
 * Prevents IDOR via guessed `existing_order_id`.
 */
export function requireTokenProofForExistingOrder(input: {
  existingOrderId?: string | null;
  publicToken?: string | null;
}): { ok: true; token: string | null } | { ok: false; code: "token_required" } {
  const orderId = String(input.existingOrderId || "").trim();
  if (!orderId) return { ok: true, token: null };
  const token = String(input.publicToken || "").trim();
  if (!isHighEntropyDeliveryToken(token)) {
    return { ok: false, code: "token_required" };
  }
  return { ok: true, token };
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
  created_at?: string | null;
  paid_at?: string | null;
  generation_started_at?: string | null;
  generation_finished_at?: string | null;
  model_name?: string | null;
  portrait_type?: string | null;
  species?: string | null;
  source_route?: string | null;
  resultUrl: string | null;
};

const LEAKED_ORDER_KEYS = [
  "metadata",
  "public_token_hash",
  "public_token_ciphertext",
  "public_token_hint",
  "email",
  "email_normalized",
  "source_path",
  "source_bucket",
  "result_asset_id",
] as const;

export function projectSafeChristmasOrder(
  order: Record<string, unknown>,
  resultUrl: string | null,
): ChristmasSafeOrderProjection {
  return {
    id: String(order.id || ""),
    product_key: String(order.product_key || ""),
    package_key: order.package_key == null ? null : String(order.package_key),
    style_key: order.style_key == null ? null : String(order.style_key),
    payment_status: String(order.payment_status || ""),
    fulfillment_status: String(order.fulfillment_status || ""),
    amount_cents: Number(order.amount_cents) || 0,
    currency: String(order.currency || "eur"),
    last_error: order.last_error == null ? null : String(order.last_error),
    created_at: order.created_at == null ? null : String(order.created_at),
    paid_at: order.paid_at == null ? null : String(order.paid_at),
    generation_started_at:
      order.generation_started_at == null ? null : String(order.generation_started_at),
    generation_finished_at:
      order.generation_finished_at == null ? null : String(order.generation_finished_at),
    model_name: order.model_name == null ? null : String(order.model_name),
    portrait_type: order.portrait_type == null ? null : String(order.portrait_type),
    species: order.species == null ? null : String(order.species),
    source_route: order.source_route == null ? null : String(order.source_route),
    resultUrl,
  };
}

export function getOrderProjectionLeaksSecrets(
  projection: Record<string, unknown>,
): boolean {
  return LEAKED_ORDER_KEYS.some((key) => key in projection);
}

/** Retention policy placeholder — founder/legal must set duration before auto-purge. */
export const CHRISTMAS_MEDIA_RETENTION = {
  policy: "policy_pending_founder_legal" as const,
  santaDefaultDaysEnv: "CHRISTMAS_SANTA_RETENTION_DAYS",
  unpaidUploadPrefix: "uploads/",
  note: "Do not auto-delete paid outputs without product promise + legal clearance.",
};
