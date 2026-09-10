/**
 * Allowlisted Christmas control-center columns.
 * Keep this free of the Supabase client so unit tests can assert privacy
 * without loading env. Pages must never select these tables directly.
 */

export const CHRISTMAS_CONTROL_ORDER_SELECT =
  "id,product_key,package_key,payment_status,fulfillment_status,created_at";

export const CHRISTMAS_CONTROL_FUNNEL_SELECT =
  "event_name,funnel_session_id,product_key,created_at";

export const CHRISTMAS_CONTROL_PRODUCT_SELECT =
  "id,product_key,active,public_discoverable,route_path";

export const CHRISTMAS_CONTROL_PACKAGE_SELECT =
  "product_id,package_key,active,purchasable";

/** Columns that must never appear in control-center selects. */
export const CHRISTMAS_CONTROL_FORBIDDEN_SELECT_FIELDS = [
  "email",
  "email_normalized",
  "public_token",
  "public_token_hash",
  "public_token_ciphertext",
  "storage_path",
  "storage_bucket",
  "public_url",
  "result_video_path",
  "metadata",
  "user_id",
  "stripe_checkout_session_id",
  "stripe_payment_intent_id",
] as const;

export function assertChristmasControlSelectSafe(selectList: string): void {
  const fields = selectList
    .split(",")
    .map((f) => f.trim().toLowerCase())
    .filter(Boolean);
  for (const forbidden of CHRISTMAS_CONTROL_FORBIDDEN_SELECT_FIELDS) {
    if (fields.includes(forbidden)) {
      throw new Error(`Christmas control select includes forbidden field: ${forbidden}`);
    }
  }
}
