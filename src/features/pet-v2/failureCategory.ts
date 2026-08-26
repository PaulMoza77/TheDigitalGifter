/**
 * Normalized V2 generation/upload failure categories for analytics.
 * Never include raw exceptions, secrets, PII, or photo payloads.
 */

export const PET_V2_NORMALIZED_FAILURE_CATEGORIES = [
  "rate_limit",
  "validation",
  "heic_unsupported",
  "provider",
  "timeout",
  "pre_provider",
  "network",
  "unknown",
] as const;

export type PetV2NormalizedFailureCategory = (typeof PET_V2_NORMALIZED_FAILURE_CATEGORIES)[number];

/** Events that may persist failure_category on pet_v2_funnel_events. */
export const PET_V2_FAILURE_CATEGORY_EVENTS = [
  "v2_preview_generation_failed",
  "v2_upload_failed",
] as const;

/**
 * Actual analytics persistence / RPC failures — only these count as "Failed analytics writes".
 * Semantic generation-failure tokens (e.g. rate_limit) are never in this set.
 */
export const PET_V2_PERSISTENCE_FAILURE_CATEGORIES = [
  "rpc_error",
  "missing_supabase_config",
  "write_failed",
] as const;

export type PetV2PersistenceFailureCategory = (typeof PET_V2_PERSISTENCE_FAILURE_CATEGORIES)[number];

/**
 * Request rejected before a successful write (auth/validation).
 * Logged for ops visibility but NOT summed into failed-write health.
 */
export const PET_V2_REJECTED_REQUEST_CATEGORIES = [
  "origin_denied",
  "invalid_event",
  "invalid_session",
  "malformed_json",
] as const;

export type PetV2RejectedRequestCategory = (typeof PET_V2_REJECTED_REQUEST_CATEGORIES)[number];

export function isPetV2PersistenceFailureCategory(value: string): boolean {
  return (PET_V2_PERSISTENCE_FAILURE_CATEGORIES as readonly string[]).includes(value);
}

export function isPetV2RejectedRequestCategory(value: string): boolean {
  return (PET_V2_REJECTED_REQUEST_CATEGORIES as readonly string[]).includes(value);
}

export function eventAllowsFailureCategory(eventName: string): boolean {
  return (PET_V2_FAILURE_CATEGORY_EVENTS as readonly string[]).includes(eventName);
}

export type AnalyticsIngestFailureKind = "persistence" | "rejected" | "ignored";

/** Classify a pet_funnel_event_failures.error_category for health UI. */
export function classifyAnalyticsIngestFailure(category: string): AnalyticsIngestFailureKind {
  const token = String(category || "").trim();
  if (isPetV2PersistenceFailureCategory(token)) return "persistence";
  if (isPetV2RejectedRequestCategory(token)) return "rejected";
  // Historical semantic rows (rate_limit, etc.) stay in the table but are ignored by health KPIs.
  return "ignored";
}

/**
 * After a successful RPC write, never treat the event as a failed write —
 * even when the event describes a failed generation/upload.
 */
export function shouldIncrementFailedWriteHealth(input: {
  writeSucceeded: boolean;
  errorCategory?: string | null;
}): boolean {
  if (input.writeSucceeded) return false;
  return classifyAnalyticsIngestFailure(String(input.errorCategory || "")) === "persistence";
}

export function shouldIncrementRejectedRequestHealth(input: {
  writeSucceeded: boolean;
  errorCategory?: string | null;
}): boolean {
  if (input.writeSucceeded) return false;
  return classifyAnalyticsIngestFailure(String(input.errorCategory || "")) === "rejected";
}

/** Production health timestamps ignore is_test / QA rows. */
export function latestProductionEventAt(
  rows: Array<{ created_at: string; is_test?: boolean | null }>,
): string | null {
  let latest: string | null = null;
  for (const row of rows) {
    if (row.is_test === true) continue;
    if (!row.created_at) continue;
    if (!latest || row.created_at > latest) latest = row.created_at;
  }
  return latest;
}

/**
 * Map client/edge failure tokens into the canonical diagnostic set.
 */
export function normalizeV2FailureCategory(raw: unknown): PetV2NormalizedFailureCategory | null {
  const token = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 40);
  if (!token) return null;

  if (token === "rate_limit" || token === "ratelimited" || token === "rate_limited") return "rate_limit";
  if (token === "heic_unsupported" || token === "heic" || token === "heif") return "heic_unsupported";
  if (
    token === "invalid_image" ||
    token === "invalid_photo" ||
    token === "validation" ||
    token === "payload_too_large"
  ) {
    return "validation";
  }
  if (token === "timeout") return "timeout";
  if (
    token === "provider" ||
    token === "provider_error" ||
    token === "provider_auth" ||
    token === "generation_failed"
  ) {
    return "provider";
  }
  if (token === "endpoint_unreachable" || token === "network") return "network";
  if (token === "pre_provider" || token === "live_disabled") return "pre_provider";
  if (token === "server_error" || token === "unknown") return "unknown";
  if ((PET_V2_NORMALIZED_FAILURE_CATEGORIES as readonly string[]).includes(token)) {
    return token as PetV2NormalizedFailureCategory;
  }
  return "unknown";
}

/**
 * Persist only allowlisted categories for eligible events.
 * Never stores raw exception bodies.
 */
export function resolvePersistedFailureCategory(input: {
  eventName: string;
  rawCategory: unknown;
}): PetV2NormalizedFailureCategory | null {
  if (!eventAllowsFailureCategory(input.eventName)) return null;
  return normalizeV2FailureCategory(input.rawCategory) ?? "unknown";
}

/**
 * Initiate Checkout card uses Stripe customer-only backend truth.
 * First-party v2_begin_checkout is diagnostic-only and must not replace the KPI.
 */
export function resolveInitiateCheckoutDisplay(input: {
  customerCheckouts: number;
  internalCheckouts: number;
  testCheckouts: number;
  promoCheckouts?: number;
  firstPartyBeginCheckout: number;
}): {
  customerKpi: number;
  internalOrTest: number;
  firstPartyBeginCheckout: number;
  helper: string;
} {
  const customerKpi = Math.max(0, Math.round(input.customerCheckouts) || 0);
  const internalOrTest =
    Math.max(0, Math.round(input.internalCheckouts) || 0) +
    Math.max(0, Math.round(input.testCheckouts) || 0);
  return {
    customerKpi,
    internalOrTest,
    firstPartyBeginCheckout: Math.max(0, Math.round(input.firstPartyBeginCheckout) || 0),
    helper:
      "Business KPI = production customer Stripe Checkout only. Internal/admin and test opens are excluded.",
  };
}
