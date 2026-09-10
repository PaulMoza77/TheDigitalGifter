/**
 * Allowlisted Christmas KPI columns. Keep this free of the Supabase client
 * so unit tests can assert privacy without loading env.
 */

export const CHRISTMAS_KPI_FUNNEL_SELECT =
  "event_name,funnel_session_id,order_id,product_key,package_key,amount_cents,utm_source,utm_campaign,device_type,is_test,created_at,idempotency_key";

export const CHRISTMAS_KPI_ORDER_SELECT =
  "id,product_key,package_key,amount_cents,currency,payment_status,fulfillment_status,stripe_checkout_session_id,utm_source,utm_campaign,created_at,paid_at,refunded_at";

/** Columns that must never appear in KPI selects. */
export const CHRISTMAS_KPI_FORBIDDEN_SELECT_FIELDS = [
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
] as const;

export function assertChristmasKpiSelectSafe(selectList: string): void {
  const fields = selectList
    .split(",")
    .map((f) => f.trim().toLowerCase())
    .filter(Boolean);
  for (const forbidden of CHRISTMAS_KPI_FORBIDDEN_SELECT_FIELDS) {
    if (fields.includes(forbidden)) {
      throw new Error(`Christmas KPI select includes forbidden field: ${forbidden}`);
    }
  }
}
