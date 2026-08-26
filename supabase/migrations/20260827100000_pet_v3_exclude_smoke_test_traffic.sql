-- Exclude internal smoke tests and rentalcarsoradea sessions from V3 analytics.

begin;

with test_sessions as (
  select distinct funnel_session_id
  from public.pet_v3_funnel_events
  where coalesce(is_test, false) = false
    and (
      lower(coalesce(client_ip_hostname, '')) like '%rentalcarsoradea%'
      or lower(coalesce(utm_source, '')) = 'internal'
      or lower(coalesce(utm_campaign, '')) in ('cat-v3-live-smoke', 'checkout-proof')
    )
)
update public.pet_v3_funnel_events e
set is_test = true
from test_sessions t
where e.funnel_session_id = t.funnel_session_id
  and coalesce(e.is_test, false) = false;

commit;
