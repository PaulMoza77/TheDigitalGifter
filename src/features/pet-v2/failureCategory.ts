/**
 * Normalized V2 generation failure categories for analytics.
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

/** Categories that mean analytics persistence itself failed (not product generation). */
export const PET_V2_PERSISTENCE_FAILURE_CATEGORIES = [
  "origin_denied",
  "invalid_event",
  "invalid_session",
  "malformed_json",
  "rpc_error",
  "missing_supabase_config",
  "write_failed",
] as const;

export type PetV2PersistenceFailureCategory = (typeof PET_V2_PERSISTENCE_FAILURE_CATEGORIES)[number];

export function isPetV2PersistenceFailureCategory(value: string): boolean {
  return (PET_V2_PERSISTENCE_FAILURE_CATEGORIES as readonly string[]).includes(value);
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
