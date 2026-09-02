-- Fix: RPC allow-list was expanded in 20260829190000 but the table CHECK
-- constraint was not. Inserts for checkout/teaser events fail with 23514 →
-- /api/pet-v2/funnel-event returns 500 write_failed, so checkout telemetry
-- (session_requested/created/failed/canceled) never lands.

begin;

alter table public.pet_v2_funnel_events
  drop constraint if exists pet_v2_funnel_events_name_chk;

alter table public.pet_v2_funnel_events
  add constraint pet_v2_funnel_events_name_chk check (
    event_name in (
      'v2_landing_view',
      'v2_upload_started',
      'v2_upload_completed',
      'v2_upload_failed',
      'v2_species_confirmed',
      'v2_teaser_generation_started',
      'v2_teaser_generation_completed',
      'v2_teaser_generation_failed',
      'v2_teaser_viewed',
      'v2_offer_viewed',
      'v2_checkout_session_requested',
      'v2_checkout_session_created',
      'v2_checkout_failed',
      'v2_begin_checkout',
      'v2_checkout_canceled',
      'v2_purchase',
      'v2_paid_generation_started',
      'v2_paid_generation_completed',
      'v2_paid_generation_failed',
      'v2_collection_viewed',
      'v2_provider_unavailable',
      'v2_preview_generation_started',
      'v2_preview_generation_completed',
      'v2_preview_generation_failed',
      'v2_preview_viewed',
      'v2_preview_regenerated',
      'v2_unlock_clicked'
    )
  );

commit;
