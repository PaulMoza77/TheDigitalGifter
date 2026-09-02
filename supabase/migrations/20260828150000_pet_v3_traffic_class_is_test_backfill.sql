-- Correct traffic_class backfill to honor historical is_test flags.
-- Prior hardening backfill used only the new internal-test registry, leaving
-- already-marked is_test rows with non-internal traffic_class values.

set lock_timeout = '5s';
set statement_timeout = '180s';

begin;

update public.pet_v3_funnel_events e
set traffic_class = public.classify_pet_v3_traffic(
  coalesce(e.is_test, false) or public.pet_v3_session_is_internal_test(e.funnel_session_id),
  e.utm_source, e.utm_medium, e.utm_campaign, e.campaign_id, e.adset_id, e.ad_id, e.creative_id,
  e.has_meta_click, e.fbc, e.fbp, e.referrer_host
);

commit;
