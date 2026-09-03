/**
 * Shared V2 funnel event allow-list (ingest + RPC).
 * Legacy preview/unlock names stay for historical rows; new teaser/checkout names are canonical.
 */
export const PET_V2_EVENT_NAMES = [
  "v2_landing_view",
  "v2_upload_started",
  "v2_upload_completed",
  "v2_upload_failed",
  "v2_species_confirmed",
  "v2_teaser_generation_started",
  "v2_teaser_generation_completed",
  "v2_teaser_generation_failed",
  "v2_teaser_viewed",
  "v2_offer_viewed",
  "v2_checkout_session_requested",
  "v2_checkout_session_created",
  "v2_checkout_failed",
  "v2_begin_checkout",
  "v2_checkout_canceled",
  "v2_payment_ui_visible",
  "v2_payment_attempt_started",
  "v2_payment_requires_action",
  "v2_payment_failed",
  "v2_checkout_abandoned",
  "v2_purchase",
  "v2_paid_generation_started",
  "v2_paid_generation_completed",
  "v2_paid_generation_failed",
  "v2_collection_viewed",
  "v2_provider_unavailable",
  // Legacy
  "v2_preview_generation_started",
  "v2_preview_generation_completed",
  "v2_preview_generation_failed",
  "v2_preview_viewed",
  "v2_preview_regenerated",
  "v2_unlock_clicked",
] as const;

export type PetV2IngestEventName = (typeof PET_V2_EVENT_NAMES)[number];

export function isV2EventName(value: string): value is PetV2IngestEventName {
  return (PET_V2_EVENT_NAMES as readonly string[]).includes(value as PetV2IngestEventName);
}
