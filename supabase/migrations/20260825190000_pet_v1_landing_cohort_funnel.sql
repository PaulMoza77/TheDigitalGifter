-- V1 landing-cohort sequential funnel counts for admin analytics.
-- Does not delete raw historical events. Independent raw totals remain on admin_pet_funnel_analytics.steps.

begin;

create or replace function public.admin_pet_v1_landing_cohort_funnel(
  p_from timestamptz,
  p_to timestamptz,
  p_campaign_id text default null,
  p_view_mode text default 'campaign',
  p_measurement_reliable_from timestamptz default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  view_mode text;
  campaign_filter text;
  reliable_from timestamptz;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  view_mode := coalesce(nullif(btrim(p_view_mode), ''), 'all');
  if view_mode not in ('all', 'campaign', 'compare', 'unattributed') then
    view_mode := 'all';
  end if;
  campaign_filter := nullif(btrim(coalesce(p_campaign_id, '')), '');
  if view_mode = 'campaign' and campaign_filter is null then
    view_mode := 'all';
  end if;

  reliable_from := coalesce(
    p_measurement_reliable_from,
    (
      select a.measurement_reliable_from
      from public.pet_meta_campaign_allowlist a
      where a.campaign_id = campaign_filter
      limit 1
    )
  );

  return (
    with
    sessions_in_range as (
      select distinct funnel_session_id
      from public.pet_funnel_events
      where created_at >= p_from
        and created_at < p_to
        and coalesce(is_test, false) = false
    ),
    touch as (
      select
        e.funnel_session_id,
        (array_agg(e.campaign_id order by e.created_at)
          filter (where nullif(e.campaign_id, '') is not null))[1] as touch_campaign_id,
        (array_agg(e.utm_campaign order by e.created_at)
          filter (where nullif(e.utm_campaign, '') is not null))[1] as touch_utm_campaign
      from public.pet_funnel_events e
      where e.funnel_session_id in (select funnel_session_id from sessions_in_range)
        and coalesce(e.is_test, false) = false
      group by e.funnel_session_id
    ),
    resolved as (
      select
        t.*,
        public.pet_analytics_resolve_campaign_id(t.touch_campaign_id, t.touch_utm_campaign) as resolved_campaign_id
      from touch t
    ),
    scoped_events as (
      select e.*
      from public.pet_funnel_events e
      inner join resolved r on r.funnel_session_id = e.funnel_session_id
      where e.created_at >= p_from
        and e.created_at < p_to
        and coalesce(e.is_test, false) = false
        and (
          case
            when view_mode = 'unattributed' then r.resolved_campaign_id is null
            when view_mode = 'campaign' then (
              coalesce(
                (select a.funnel_variant from public.pet_meta_campaign_allowlist a where a.campaign_id = campaign_filter),
                'v1'
              ) = 'v1'
              and (
                -- Prefer exact Campaign 1 match when the session is attributed;
                -- keep unattributed V1 landings in the same dataset (matches existing FP cards).
                r.resolved_campaign_id is null
                or r.resolved_campaign_id = campaign_filter
              )
            )
            else true
          end
        )
    ),
    landing_cohort as (
      select distinct e.funnel_session_id
      from scoped_events e
      where e.event_name = 'landing_view'
        and (reliable_from is null or e.created_at >= reliable_from)
    ),
    flags as (
      select
        s.funnel_session_id,
        bool_or(e.event_name = 'pet_name_submitted') as has_name,
        bool_or(e.event_name = 'photo_step_viewed') as has_photo_step,
        bool_or(e.event_name = 'photo_upload_started') as has_photo_started,
        bool_or(e.event_name = 'photo_upload_completed') as has_photo,
        bool_or(e.event_name = 'pet_details_completed') as has_details,
        bool_or(e.event_name = 'order_review_viewed') as has_review,
        bool_or(e.event_name = 'initiate_checkout') as has_checkout,
        bool_or(e.event_name = 'purchase') as has_purchase
      from landing_cohort s
      left join scoped_events e on e.funnel_session_id = s.funnel_session_id
      group by s.funnel_session_id
    ),
    chained as (
      select
        funnel_session_id,
        true as has_landing,
        has_name,
        (has_name and has_photo_step) as has_photo_step_chain,
        (has_name and has_photo_step and has_photo_started) as has_photo_started_chain,
        (has_name and has_photo) as has_photo_chain,
        (has_name and has_photo and has_review) as has_review_chain,
        (has_name and has_photo and has_review and has_checkout) as has_checkout_chain,
        (has_name and has_photo and has_review and has_checkout and has_purchase) as has_purchase_chain,
        has_photo_step,
        has_photo_started,
        has_photo,
        has_review
      from flags
    ),
    cohort_steps as (
      select * from (values
        ('landing_view', (select count(*)::int from chained)),
        ('pet_name_submitted', (select count(*)::int from chained where has_name)),
        ('photo_upload_completed', (select count(*)::int from chained where has_photo_chain)),
        ('order_review_viewed', (select count(*)::int from chained where has_review_chain)),
        ('initiate_checkout', (select count(*)::int from chained where has_checkout_chain)),
        ('purchase', (select count(*)::int from chained where has_purchase_chain))
      ) as t(event_name, unique_sessions)
    ),
    raw_steps as (
      select event_name, count(distinct funnel_session_id)::int as unique_sessions
      from scoped_events
      where event_name in (
        'landing_view', 'pet_name_submitted', 'photo_upload_completed',
        'order_review_viewed', 'initiate_checkout', 'purchase'
      )
      group by event_name
    ),
    photo_path as (
      select * from (values
        ('pet_name_submitted', (select count(*)::int from chained where has_name)),
        ('photo_step_viewed', (select count(*)::int from chained where has_photo_step_chain)),
        ('photo_upload_started', (select count(*)::int from chained where has_photo_started_chain)),
        ('photo_upload_completed', (select count(*)::int from chained where has_name and has_photo_step and has_photo_started and has_photo))
      ) as t(event_name, unique_sessions)
    )
    select jsonb_build_object(
      'measurement_reliable_from', reliable_from,
      'landing_cohort_sessions', (select count(*)::int from landing_cohort),
      'cohort_steps', coalesce(
        (select jsonb_agg(jsonb_build_object(
          'event_name', event_name,
          'unique_sessions', unique_sessions
        ) order by event_name) from cohort_steps),
        '[]'::jsonb
      ),
      'raw_steps', coalesce(
        (select jsonb_agg(jsonb_build_object(
          'event_name', event_name,
          'unique_sessions', unique_sessions
        )) from raw_steps),
        '[]'::jsonb
      ),
      'photo_path_steps', coalesce(
        (select jsonb_agg(jsonb_build_object(
          'event_name', event_name,
          'unique_sessions', unique_sessions
        ) order by event_name) from photo_path),
        '[]'::jsonb
      )
    )
  );
end;
$$;

revoke all on function public.admin_pet_v1_landing_cohort_funnel(timestamptz, timestamptz, text, text, timestamptz)
  from public, anon;
grant execute on function public.admin_pet_v1_landing_cohort_funnel(timestamptz, timestamptz, text, text, timestamptz)
  to authenticated, service_role;

commit;
