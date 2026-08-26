-- V2 analytics clarity:
-- 1) Persist normalized generation failure_category on pet_v2_funnel_events.
-- 2) Count only real analytics persistence failures in tracking health.
-- Does not delete or rewrite historical pet_funnel_event_failures rows.

begin;

alter table public.pet_v2_funnel_events
  add column if not exists failure_category text;

comment on column public.pet_v2_funnel_events.failure_category is
  'Normalized generation failure category (rate_limit, validation, heic_unsupported, provider, timeout, pre_provider, network, unknown). Never stores raw exceptions or PII.';

drop function if exists public.record_pet_v2_funnel_event(
  text, uuid, text, text, text, text, text, text, text, text, text, text, text, text, integer, boolean, text, uuid, boolean, text
);

create or replace function public.record_pet_v2_funnel_event(
  p_event_name text,
  p_funnel_session_id uuid,
  p_idempotency_key text,
  p_species text default null,
  p_utm_source text default null,
  p_utm_medium text default null,
  p_utm_campaign text default null,
  p_utm_content text default null,
  p_utm_term text default null,
  p_campaign_id text default null,
  p_adset_id text default null,
  p_ad_id text default null,
  p_device_type text default null,
  p_pathname text default null,
  p_amount_cents integer default null,
  p_has_meta_click boolean default false,
  p_referrer_host text default null,
  p_client_event_id uuid default null,
  p_is_test boolean default false,
  p_environment text default null,
  p_failure_category text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  allowed constant text[] := array[
    'v2_landing_view',
    'v2_upload_started',
    'v2_upload_completed',
    'v2_upload_failed',
    'v2_preview_generation_started',
    'v2_preview_generation_completed',
    'v2_preview_generation_failed',
    'v2_preview_viewed',
    'v2_preview_regenerated',
    'v2_offer_viewed',
    'v2_unlock_clicked',
    'v2_begin_checkout',
    'v2_purchase'
  ];
  allowed_failure constant text[] := array[
    'rate_limit',
    'validation',
    'heic_unsupported',
    'provider',
    'timeout',
    'pre_provider',
    'network',
    'unknown'
  ];
  new_id uuid;
  clean_path text;
  clean_failure text;
begin
  if p_funnel_session_id is null then
    return null;
  end if;
  if p_event_name is null or not (p_event_name = any (allowed)) then
    return null;
  end if;
  if p_idempotency_key is null or length(btrim(p_idempotency_key)) < 8 then
    return null;
  end if;

  clean_path := left(split_part(coalesce(p_pathname, ''), '?', 1), 64);
  if clean_path is not null
     and clean_path not in ('/pet/dog-v2', '/pet/cat-v2', '/pet/other-v2', '/pet-v2')
     and left(clean_path, 8) <> '/pet-v2/' then
    clean_path := null;
  end if;

  clean_failure := lower(nullif(btrim(coalesce(p_failure_category, '')), ''));
  if clean_failure is not null then
    clean_failure := left(regexp_replace(clean_failure, '[^a-z0-9_]', '', 'g'), 40);
    if clean_failure is null or clean_failure = '' or not (clean_failure = any (allowed_failure)) then
      clean_failure := 'unknown';
    end if;
  end if;

  insert into public.pet_v2_funnel_events (
    event_name,
    funnel_session_id,
    idempotency_key,
    species,
    utm_source,
    utm_medium,
    utm_campaign,
    utm_content,
    utm_term,
    campaign_id,
    adset_id,
    ad_id,
    device_type,
    pathname,
    amount_cents,
    has_meta_click,
    referrer_host,
    client_event_id,
    is_test,
    environment,
    failure_category
  )
  values (
    p_event_name,
    p_funnel_session_id,
    left(btrim(p_idempotency_key), 180),
    case when p_species in ('dog', 'cat', 'other') then p_species else null end,
    public.pet_funnel_safe_text(p_utm_source),
    public.pet_funnel_safe_text(p_utm_medium),
    public.pet_funnel_safe_text(p_utm_campaign),
    public.pet_funnel_safe_text(p_utm_content),
    public.pet_funnel_safe_text(p_utm_term),
    public.pet_funnel_safe_text(p_campaign_id),
    public.pet_funnel_safe_text(p_adset_id),
    public.pet_funnel_safe_text(p_ad_id),
    case when p_device_type in ('mobile', 'tablet', 'desktop') then p_device_type else null end,
    clean_path,
    case when p_amount_cents is not null and p_amount_cents >= 0 then p_amount_cents else null end,
    coalesce(p_has_meta_click, false),
    public.pet_funnel_safe_text(p_referrer_host, 120),
    p_client_event_id,
    coalesce(p_is_test, false),
    public.pet_funnel_safe_text(p_environment, 32),
    clean_failure
  )
  on conflict (idempotency_key) do nothing
  returning id into new_id;

  return new_id;
end;
$$;

revoke all on function public.record_pet_v2_funnel_event(
  text, uuid, text, text, text, text, text, text, text, text, text, text, text, text, integer, boolean, text, uuid, boolean, text, text
) from public, anon, authenticated;
grant execute on function public.record_pet_v2_funnel_event(
  text, uuid, text, text, text, text, text, text, text, text, text, text, text, text, integer, boolean, text, uuid, boolean, text, text
) to service_role;

-- Patch tracking_health counts inside admin_pet_funnel_analytics without rewriting the full RPC.
-- Recreate the function body is large; instead add a helper used by a thin wrapper update via
-- replacing only the tracking_health CTE through a dedicated count function.

create or replace function public.pet_funnel_persistence_failure_count(
  p_from timestamptz,
  p_to timestamptz,
  p_dataset text
)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int
  from public.pet_funnel_event_failures f
  where f.created_at >= p_from
    and f.created_at < p_to
    and coalesce(f.funnel_dataset, 'v1') = coalesce(nullif(btrim(p_dataset), ''), 'v1')
    and coalesce(f.error_category, '') in (
      'origin_denied',
      'invalid_event',
      'invalid_session',
      'malformed_json',
      'rpc_error',
      'missing_supabase_config',
      'write_failed'
    );
$$;

revoke all on function public.pet_funnel_persistence_failure_count(timestamptz, timestamptz, text)
  from public, anon;
grant execute on function public.pet_funnel_persistence_failure_count(timestamptz, timestamptz, text)
  to authenticated, service_role;

-- Use persistence-only failure counts in admin analytics health.
create or replace function public.admin_pet_funnel_analytics(
  p_from timestamptz,
  p_to timestamptz,
  p_prev_from timestamptz,
  p_prev_to timestamptz,
  p_campaign_id text default null,
  p_view_mode text default 'all',
  p_adset_id text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  report jsonb;
  view_mode text;
  campaign_filter text;
  adset_filter text;
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  view_mode := coalesce(nullif(btrim(p_view_mode), ''), 'all');
  if view_mode not in ('all', 'campaign', 'compare', 'unattributed') then
    view_mode := 'all';
  end if;
  campaign_filter := nullif(btrim(coalesce(p_campaign_id, '')), '');
  adset_filter := nullif(btrim(coalesce(p_adset_id, '')), '');
  if view_mode = 'campaign' and campaign_filter is null then
    view_mode := 'all';
  end if;

  with
  catalog as (
    select
      a.campaign_id,
      coalesce(
        nullif(a.label, ''),
        meta.campaign_name,
        a.campaign_id
      ) as display_name,
      a.funnel_variant,
      coalesce(a.utm_campaign_aliases, '{}'::text[]) as utm_campaign_aliases,
      a.measurement_reliable_from
    from public.pet_meta_campaign_allowlist a
    left join (
      select m.campaign_id, max(m.campaign_name) as campaign_name
      from public.pet_meta_daily_metrics m
      group by m.campaign_id
    ) meta on meta.campaign_id = a.campaign_id
    where a.enabled
  ),
  v1_sessions_in_range as (
    select distinct funnel_session_id
    from public.pet_funnel_events
    where created_at >= p_from
      and created_at < p_to
      and coalesce(is_test, false) = false
  ),
  v1_touch as (
    select
      e.funnel_session_id,
      (array_agg(e.campaign_id order by e.created_at) filter (where nullif(e.campaign_id, '') is not null))[1] as touch_campaign_id,
      (array_agg(e.utm_campaign order by e.created_at) filter (where nullif(e.utm_campaign, '') is not null))[1] as touch_utm_campaign,
      (array_agg(e.adset_id order by e.created_at) filter (where nullif(e.adset_id, '') is not null))[1] as touch_adset_id,
      (array_agg(e.ad_id order by e.created_at) filter (where nullif(e.ad_id, '') is not null))[1] as touch_ad_id
    from public.pet_funnel_events e
    where e.funnel_session_id in (select funnel_session_id from v1_sessions_in_range)
      and coalesce(e.is_test, false) = false
    group by e.funnel_session_id
  ),
  v1_resolved as (
    select
      t.*,
      public.pet_analytics_resolve_campaign_id(t.touch_campaign_id, t.touch_utm_campaign) as resolved_campaign_id
    from v1_touch t
  ),
  v1_sessions_prev as (
    select distinct funnel_session_id
    from public.pet_funnel_events
    where created_at >= p_prev_from
      and created_at < p_prev_to
      and coalesce(is_test, false) = false
  ),
  v1_touch_prev as (
    select
      e.funnel_session_id,
      (array_agg(e.campaign_id order by e.created_at) filter (where nullif(e.campaign_id, '') is not null))[1] as touch_campaign_id,
      (array_agg(e.utm_campaign order by e.created_at) filter (where nullif(e.utm_campaign, '') is not null))[1] as touch_utm_campaign,
      (array_agg(e.adset_id order by e.created_at) filter (where nullif(e.adset_id, '') is not null))[1] as touch_adset_id
    from public.pet_funnel_events e
    where e.funnel_session_id in (select funnel_session_id from v1_sessions_prev)
      and coalesce(e.is_test, false) = false
    group by e.funnel_session_id
  ),
  v1_resolved_prev as (
    select
      t.*,
      public.pet_analytics_resolve_campaign_id(t.touch_campaign_id, t.touch_utm_campaign) as resolved_campaign_id
    from v1_touch_prev t
  ),
  v2_sessions_in_range as (
    select distinct funnel_session_id
    from public.pet_v2_funnel_events
    where created_at >= p_from
      and created_at < p_to
  ),
  v2_touch as (
    select
      e.funnel_session_id,
      (array_agg(e.campaign_id order by e.created_at) filter (where nullif(e.campaign_id, '') is not null))[1] as touch_campaign_id,
      (array_agg(e.utm_campaign order by e.created_at) filter (where nullif(e.utm_campaign, '') is not null))[1] as touch_utm_campaign,
      (array_agg(e.adset_id order by e.created_at) filter (where nullif(e.adset_id, '') is not null))[1] as touch_adset_id,
      (array_agg(e.ad_id order by e.created_at) filter (where nullif(e.ad_id, '') is not null))[1] as touch_ad_id
    from public.pet_v2_funnel_events e
    where e.funnel_session_id in (select funnel_session_id from v2_sessions_in_range)
    group by e.funnel_session_id
  ),
  v2_resolved as (
    select
      t.*,
      public.pet_analytics_resolve_campaign_id(t.touch_campaign_id, t.touch_utm_campaign) as resolved_campaign_id
    from v2_touch t
  ),
  current_v1 as (
    select e.*
    from public.pet_funnel_events e
    inner join v1_resolved r on r.funnel_session_id = e.funnel_session_id
    where e.created_at >= p_from
      and e.created_at < p_to
      and coalesce(e.is_test, false) = false
      and (
        case
          when view_mode = 'unattributed' then r.resolved_campaign_id is null
          when view_mode = 'campaign' then coalesce(
            (select c.funnel_variant from catalog c where c.campaign_id = campaign_filter),
            'v1'
          ) = 'v1'
          else true
        end
      )
      and (adset_filter is null or r.touch_adset_id = adset_filter)
  ),
  previous_v1 as (
    select e.*
    from public.pet_funnel_events e
    inner join v1_resolved_prev r on r.funnel_session_id = e.funnel_session_id
    where e.created_at >= p_prev_from
      and e.created_at < p_prev_to
      and coalesce(e.is_test, false) = false
      and (
        case
          when view_mode = 'unattributed' then r.resolved_campaign_id is null
          when view_mode = 'campaign' then coalesce(
            (select c.funnel_variant from catalog c where c.campaign_id = campaign_filter),
            'v1'
          ) = 'v1'
          else true
        end
      )
      and (adset_filter is null or r.touch_adset_id = adset_filter)
  ),
  current_v2 as (
    select e.*
    from public.pet_v2_funnel_events e
    inner join v2_resolved r on r.funnel_session_id = e.funnel_session_id
    where e.created_at >= p_from
      and e.created_at < p_to
      and coalesce(e.is_test, false) = false
      and (
        case
          when view_mode = 'unattributed' then r.resolved_campaign_id is null
          when view_mode = 'campaign' then coalesce(
            (select c.funnel_variant from catalog c where c.campaign_id = campaign_filter),
            ''
          ) = 'v2_preview'
          else true
        end
      )
      and (adset_filter is null or r.touch_adset_id = adset_filter)
  ),
  tracking_health as (
    select
      (select count(distinct funnel_session_id)::int from current_v1 where event_name = 'landing_view') as v1_landings,
      (select count(distinct funnel_session_id)::int from current_v2 where event_name = 'v2_landing_view') as v2_landings,
      (select max(created_at) from public.pet_funnel_events where coalesce(is_test, false) = false) as latest_v1_at,
      (select max(created_at) from public.pet_v2_funnel_events) as latest_v2_at,
      (select public.pet_funnel_persistence_failure_count(p_from, p_to, 'v1')) as v1_failed_write_count,
      (select public.pet_funnel_persistence_failure_count(p_from, p_to, 'v2')) as v2_failed_write_count,
      (select public.pet_funnel_persistence_failure_count(p_from, p_to, 'v1')
            + public.pet_funnel_persistence_failure_count(p_from, p_to, 'v2')) as failed_write_count
  ),
  unattributed as (
    select
      (select count(*)::int from v1_resolved where resolved_campaign_id is null) as v1_sessions,
      (select count(*)::int from v2_resolved where resolved_campaign_id is null) as v2_sessions,
      (select count(*)::int from v1_resolved) as v1_total_sessions,
      (select count(*)::int from v2_resolved) as v2_total_sessions,
      (select count(distinct e.funnel_session_id)::int
         from public.pet_funnel_events e
         join v1_resolved r on r.funnel_session_id = e.funnel_session_id
        where e.event_name = 'landing_view'
          and e.created_at >= p_from and e.created_at < p_to
          and coalesce(e.is_test, false) = false
          and r.resolved_campaign_id is null) as v1_landings,
      (select count(distinct e.funnel_session_id)::int
         from public.pet_v2_funnel_events e
         join v2_resolved r on r.funnel_session_id = e.funnel_session_id
        where e.event_name = 'v2_landing_view'
          and e.created_at >= p_from and e.created_at < p_to
          and r.resolved_campaign_id is null) as v2_landings,
      (select count(distinct e.funnel_session_id)::int
         from public.pet_funnel_events e
        where e.event_name = 'landing_view'
          and e.created_at >= p_from and e.created_at < p_to
          and coalesce(e.is_test, false) = false) as v1_landings_total,
      (select count(distinct e.funnel_session_id)::int
         from public.pet_v2_funnel_events e
        where e.event_name = 'v2_landing_view'
          and e.created_at >= p_from and e.created_at < p_to) as v2_landings_total
  ),
  step_counts as (
    select event_name, count(distinct funnel_session_id)::int as unique_sessions, count(*)::int as event_count
    from current_v1
    where event_name in (
      'landing_view', 'pet_name_submitted', 'photo_upload_completed',
      'order_review_viewed', 'initiate_checkout', 'purchase'
    )
    group by event_name
  ),
  prev_step_counts as (
    select event_name, count(distinct funnel_session_id)::int as unique_sessions, count(*)::int as event_count
    from previous_v1
    where event_name in (
      'landing_view', 'pet_name_submitted', 'photo_upload_completed',
      'order_review_viewed', 'initiate_checkout', 'purchase'
    )
    group by event_name
  ),
  v2_step_counts as (
    select event_name, count(distinct funnel_session_id)::int as unique_sessions, count(*)::int as event_count
    from current_v2
    where event_name in (
      'v2_landing_view', 'v2_upload_started', 'v2_upload_completed',
      'v2_preview_generation_started', 'v2_preview_generation_completed', 'v2_preview_generation_failed',
      'v2_preview_viewed', 'v2_offer_viewed', 'v2_unlock_clicked',
      'v2_begin_checkout', 'v2_purchase'
    )
    group by event_name
  ),
  v2_latency as (
    select extract(epoch from (c.created_at - s.created_at)) * 1000.0 as ms
    from current_v2 s
    inner join lateral (
      select created_at
      from current_v2 x
      where x.funnel_session_id = s.funnel_session_id
        and x.event_name = 'v2_preview_generation_completed'
        and x.created_at >= s.created_at
      order by x.created_at
      limit 1
    ) c on true
    where s.event_name = 'v2_preview_generation_started'
  ),
  v2_latency_stats as (
    select
      percentile_cont(0.5) within group (order by ms) as median_ms,
      percentile_cont(0.9) within group (order by ms) as p90_ms
    from v2_latency
    where ms >= 0
  ),
  attributed_orders as (
    select distinct order_id
    from current_v1
    where order_id is not null
  ),
  classified_orders as (
    select
      o.*,
      public.pet_order_analytics_class(
        o.stripe_checkout_session_id,
        o.stripe_payment_intent_id,
        o.charged_amount_cents,
        o.amount_cents,
        o.discount_percent,
        o.stripe_payment_status
      ) as analytics_class
    from public.pet_orders o
    where o.paid_at is not null
      and coalesce(o.status, '') <> 'refunded'
  ),
  classified_checkouts as (
    select
      cs.order_id,
      cs.created_at,
      public.pet_checkout_analytics_class(
        cs.stripe_session_id,
        o.email_normalized,
        o.discount_percent,
        o.stripe_payment_status
      ) as analytics_class
    from public.pet_checkout_sessions cs
    inner join public.pet_orders o on o.id = cs.order_id
  ),
  backend_current as (
    select
      count(*) filter (
        where analytics_class = 'paid'
          and paid_at >= p_from and paid_at < p_to
          and (
            view_mode in ('all', 'compare')
            or (
              view_mode = 'campaign'
              and (
                (
                  coalesce((select c.funnel_variant from catalog c where c.campaign_id = campaign_filter), 'v1') = 'v1'
                  and coalesce(funnel_variant, 'v1') = 'v1'
                )
                or (
                  coalesce((select c.funnel_variant from catalog c where c.campaign_id = campaign_filter), '') = 'v2_preview'
                  and funnel_variant = 'v2'
                )
              )
            )
          )
      )::int as purchases,
      coalesce(sum(coalesce(charged_amount_cents, amount_cents)) filter (
        where analytics_class = 'paid'
          and paid_at >= p_from and paid_at < p_to
          and (
            view_mode in ('all', 'compare')
            or (
              view_mode = 'campaign'
              and (
                (
                  coalesce((select c.funnel_variant from catalog c where c.campaign_id = campaign_filter), 'v1') = 'v1'
                  and coalesce(funnel_variant, 'v1') = 'v1'
                )
                or (
                  coalesce((select c.funnel_variant from catalog c where c.campaign_id = campaign_filter), '') = 'v2_preview'
                  and funnel_variant = 'v2'
                )
              )
            )
          )
      ), 0)::int as revenue_cents,
      count(*) filter (
        where analytics_class = 'free'
          and paid_at >= p_from and paid_at < p_to
          and (
            view_mode in ('all', 'compare')
            or (
              view_mode = 'campaign'
              and (
                (
                  coalesce((select c.funnel_variant from catalog c where c.campaign_id = campaign_filter), 'v1') = 'v1'
                  and coalesce(funnel_variant, 'v1') = 'v1'
                )
                or (
                  coalesce((select c.funnel_variant from catalog c where c.campaign_id = campaign_filter), '') = 'v2_preview'
                  and funnel_variant = 'v2'
                )
              )
            )
          )
      )::int as free_orders,
      count(*) filter (
        where analytics_class = 'test' and paid_at >= p_from and paid_at < p_to
      )::int as test_orders,
      (
        select count(distinct cc.order_id)::int
        from classified_checkouts cc
        where cc.analytics_class = 'customer'
          and cc.created_at >= p_from
          and cc.created_at < p_to
          and (
            view_mode in ('all', 'compare')
            or (
              view_mode = 'campaign'
              and cc.order_id in (
                select o.id from public.pet_orders o
                where (
                  (
                    coalesce((select c.funnel_variant from catalog c where c.campaign_id = campaign_filter), 'v1') = 'v1'
                    and coalesce(o.funnel_variant, 'v1') = 'v1'
                  )
                  or (
                    coalesce((select c.funnel_variant from catalog c where c.campaign_id = campaign_filter), '') = 'v2_preview'
                    and o.funnel_variant = 'v2'
                  )
                )
              )
            )
          )
      ) as checkouts
    from classified_orders
  ),
  backend_previous as (
    select
      count(*) filter (
        where analytics_class = 'paid' and paid_at >= p_prev_from and paid_at < p_prev_to
      )::int as purchases,
      coalesce(sum(coalesce(charged_amount_cents, amount_cents)) filter (
        where analytics_class = 'paid' and paid_at >= p_prev_from and paid_at < p_prev_to
      ), 0)::int as revenue_cents,
      count(*) filter (
        where analytics_class = 'free' and paid_at >= p_prev_from and paid_at < p_prev_to
      )::int as free_orders,
      count(*) filter (
        where analytics_class = 'test' and paid_at >= p_prev_from and paid_at < p_prev_to
      )::int as test_orders,
      (
        select count(distinct cc.order_id)::int
        from classified_checkouts cc
        where cc.analytics_class = 'customer'
          and cc.created_at >= p_prev_from
          and cc.created_at < p_prev_to
      ) as checkouts
    from classified_orders
  ),
  meta_range as (
    select *
    from public.pet_meta_daily_metrics m
    where m.metric_date >= (p_from at time zone 'UTC')::date
      and m.metric_date < (p_to at time zone 'UTC')::date
      and exists (
        select 1
        from public.pet_meta_campaign_allowlist a
        where a.enabled
          and a.campaign_id = m.campaign_id
      )
      and (view_mode <> 'unattributed')
      and (campaign_filter is null or view_mode <> 'campaign' or m.campaign_id = p_campaign_id)
      and (adset_filter is null or m.adset_id = adset_filter)
  ),
  meta_totals as (
    select
      coalesce(sum(spend_cents), 0)::bigint as spend_cents,
      coalesce(sum(impressions), 0)::bigint as impressions,
      coalesce(sum(reach), 0)::bigint as reach,
      coalesce(sum(link_clicks), 0)::bigint as link_clicks,
      coalesce(sum(outbound_clicks), 0)::bigint as outbound_clicks,
      coalesce(sum(landing_page_views), 0)::bigint as landing_page_views,
      coalesce(sum(initiate_checkouts), 0)::bigint as initiate_checkouts,
      coalesce(sum(purchases), 0)::bigint as purchases,
      coalesce(sum(purchase_value_cents), 0)::bigint as purchase_value_cents,
      case when bool_or(pet_name_submitted is not null) then coalesce(sum(pet_name_submitted), 0) else null end as pet_name_submitted,
      case when bool_or(photo_upload_completed is not null) then coalesce(sum(photo_upload_completed), 0) else null end as photo_upload_completed,
      case when bool_or(order_review_viewed is not null) then coalesce(sum(order_review_viewed), 0) else null end as order_review_viewed,
      case when bool_or(pet_details_completed is not null) then coalesce(sum(pet_details_completed), 0) else null end as pet_details_completed,
      count(*)::int as row_count
    from meta_range
  ),
  meta_daily as (
    select
      metric_date,
      coalesce(sum(spend_cents), 0)::bigint as spend_cents,
      coalesce(sum(landing_page_views), 0)::bigint as landing_page_views,
      coalesce(sum(initiate_checkouts), 0)::bigint as initiate_checkouts,
      coalesce(sum(purchases), 0)::bigint as purchases,
      coalesce(sum(purchase_value_cents), 0)::bigint as purchase_value_cents
    from meta_range
    group by metric_date
    order by metric_date
  ),
  meta_campaigns as (
    select
      campaign_id,
      max(campaign_name) as campaign_name,
      max(adset_id) as adset_id,
      max(adset_name) as adset_name,
      max(ad_id) as ad_id,
      max(ad_name) as ad_name,
      coalesce(sum(spend_cents), 0)::bigint as spend_cents,
      coalesce(sum(impressions), 0)::bigint as impressions,
      coalesce(sum(reach), 0)::bigint as reach,
      coalesce(sum(link_clicks), 0)::bigint as link_clicks,
      coalesce(sum(landing_page_views), 0)::bigint as landing_page_views,
      coalesce(sum(initiate_checkouts), 0)::bigint as initiate_checkouts,
      coalesce(sum(purchases), 0)::bigint as purchases,
      coalesce(sum(purchase_value_cents), 0)::bigint as purchase_value_cents
    from meta_range
    group by campaign_id
    order by spend_cents desc
    limit 50
  ),
  meta_adsets as (
    select
      campaign_id,
      max(campaign_name) as campaign_name,
      adset_id,
      max(adset_name) as adset_name,
      coalesce(sum(spend_cents), 0)::bigint as spend_cents,
      coalesce(sum(impressions), 0)::bigint as impressions,
      coalesce(sum(link_clicks), 0)::bigint as link_clicks,
      coalesce(sum(landing_page_views), 0)::bigint as landing_page_views,
      coalesce(sum(initiate_checkouts), 0)::bigint as initiate_checkouts,
      coalesce(sum(purchases), 0)::bigint as purchases,
      coalesce(sum(purchase_value_cents), 0)::bigint as purchase_value_cents
    from meta_range
    group by campaign_id, adset_id
    order by spend_cents desc
    limit 100
  ),
  meta_ads as (
    select
      campaign_id,
      max(campaign_name) as campaign_name,
      adset_id,
      max(adset_name) as adset_name,
      ad_id,
      max(ad_name) as ad_name,
      coalesce(sum(spend_cents), 0)::bigint as spend_cents,
      coalesce(sum(impressions), 0)::bigint as impressions,
      coalesce(sum(link_clicks), 0)::bigint as link_clicks,
      coalesce(sum(landing_page_views), 0)::bigint as landing_page_views,
      coalesce(sum(initiate_checkouts), 0)::bigint as initiate_checkouts,
      coalesce(sum(purchases), 0)::bigint as purchases,
      coalesce(sum(purchase_value_cents), 0)::bigint as purchase_value_cents
    from meta_range
    group by campaign_id, adset_id, ad_id
    order by spend_cents desc
    limit 100
  ),
  ga4_range as (
    select *
    from public.pet_ga4_daily_metrics g
    where g.metric_date >= (p_from at time zone 'UTC')::date
      and g.metric_date < (p_to at time zone 'UTC')::date
      and view_mode in ('all', 'compare')
  ),
  ga4_totals as (
    select
      coalesce(sum(sessions), 0)::bigint as sessions,
      coalesce(sum(total_users), 0)::bigint as total_users,
      coalesce(sum(screen_page_views), 0)::bigint as screen_page_views,
      coalesce(sum(landing_views), 0)::bigint as landing_views,
      case when bool_or(pet_name_submitted is not null) then coalesce(sum(pet_name_submitted), 0) else null end as pet_name_submitted,
      case when bool_or(photo_upload_completed is not null) then coalesce(sum(photo_upload_completed), 0) else null end as photo_upload_completed,
      case when bool_or(order_review_viewed is not null) then coalesce(sum(order_review_viewed), 0) else null end as order_review_viewed,
      coalesce(sum(begin_checkouts), 0)::bigint as begin_checkouts,
      coalesce(sum(purchases), 0)::bigint as purchases,
      coalesce(sum(purchase_revenue_cents), 0)::bigint as purchase_revenue_cents,
      count(*)::int as row_count
    from ga4_range
  ),
  ga4_daily as (
    select
      metric_date,
      coalesce(sum(sessions), 0)::bigint as sessions,
      coalesce(sum(landing_views), 0)::bigint as landing_views,
      coalesce(sum(begin_checkouts), 0)::bigint as begin_checkouts,
      coalesce(sum(purchases), 0)::bigint as purchases,
      coalesce(sum(purchase_revenue_cents), 0)::bigint as purchase_revenue_cents
    from ga4_range
    group by metric_date
    order by metric_date
  ),
  labeled as (
    select
      e.*,
      r.resolved_campaign_id,
      r.touch_adset_id,
      r.touch_ad_id,
      case
        when r.resolved_campaign_id is not null then 'meta'
        when e.campaign_id is not null
          or lower(coalesce(e.utm_source, '')) in ('facebook', 'fb', 'instagram', 'ig', 'an', 'msg', 'meta', 'paid_social')
          then 'meta'
        when e.utm_source is not null then 'other'
        else 'unattributed'
      end as source_group,
      coalesce(nullif(e.utm_campaign, ''), nullif(e.campaign_id, ''), nullif(e.utm_source, ''), 'Direct / Organic / Unknown') as campaign_label,
      coalesce(nullif(e.utm_term, ''), nullif(e.adset_id, ''), '—') as adset_label,
      coalesce(nullif(e.utm_content, ''), nullif(e.ad_id, ''), '—') as ad_label
    from current_v1 e
    inner join v1_resolved r on r.funnel_session_id = e.funnel_session_id
  ),
  campaign_rollups as (
    select
      case when source_group = 'unattributed' then 'Direct / Organic / Unknown' else campaign_label end as campaign,
      case when source_group = 'unattributed' then '—' else max(adset_label) end as ad_set,
      case when source_group = 'unattributed' then '—' else max(ad_label) end as ad,
      source_group,
      max(resolved_campaign_id) as campaign_id,
      max(adset_id) as adset_id,
      max(ad_id) as ad_id,
      count(distinct funnel_session_id) filter (where event_name = 'landing_view')::int as lpv,
      count(distinct funnel_session_id) filter (where event_name = 'pet_name_submitted')::int as name_count,
      count(distinct funnel_session_id) filter (where event_name = 'photo_upload_completed')::int as upload_count,
      count(distinct funnel_session_id) filter (where event_name = 'order_review_viewed')::int as review_count,
      count(distinct funnel_session_id) filter (where event_name = 'initiate_checkout')::int as checkout_count,
      count(distinct funnel_session_id) filter (where event_name = 'purchase')::int as purchase_count,
      coalesce(sum(amount_cents) filter (where event_name = 'purchase'), 0)::int as revenue_cents
    from labeled
    group by 1, 4
    order by purchase_count desc, lpv desc
    limit 50
  ),
  ad_rollups as (
    select
      case when source_group = 'unattributed' then 'Direct / Organic / Unknown' else campaign_label end as campaign,
      case when source_group = 'unattributed' then '—' else adset_label end as ad_set,
      case when source_group = 'unattributed' then 'Direct / Organic / Unknown' else ad_label end as ad,
      source_group,
      max(resolved_campaign_id) as campaign_id,
      max(adset_id) as adset_id,
      max(ad_id) as ad_id,
      count(distinct funnel_session_id) filter (where event_name = 'landing_view')::int as lpv,
      count(distinct funnel_session_id) filter (where event_name = 'pet_name_submitted')::int as name_count,
      count(distinct funnel_session_id) filter (where event_name = 'photo_upload_completed')::int as upload_count,
      count(distinct funnel_session_id) filter (where event_name = 'order_review_viewed')::int as review_count,
      count(distinct funnel_session_id) filter (where event_name = 'initiate_checkout')::int as checkout_count,
      count(distinct funnel_session_id) filter (where event_name = 'purchase')::int as purchase_count,
      coalesce(sum(amount_cents) filter (where event_name = 'purchase'), 0)::int as revenue_cents
    from labeled
    group by 1, 2, 3, 4
    order by purchase_count desc, lpv desc
    limit 50
  ),
  fp_adset_rollups as (
    select
      r.resolved_campaign_id as campaign_id,
      r.touch_adset_id as adset_id,
      count(distinct e.funnel_session_id) filter (where e.event_name = 'landing_view')::int as v1_landing,
      count(distinct e.funnel_session_id) filter (where e.event_name = 'pet_name_submitted')::int as v1_name,
      count(distinct e.funnel_session_id) filter (where e.event_name = 'photo_upload_completed')::int as v1_upload,
      count(distinct e.funnel_session_id) filter (where e.event_name = 'order_review_viewed')::int as v1_review,
      count(distinct e.funnel_session_id) filter (where e.event_name = 'initiate_checkout')::int as v1_checkout,
      count(distinct e.funnel_session_id) filter (where e.event_name = 'purchase')::int as v1_purchase
    from public.pet_funnel_events e
    inner join v1_resolved r on r.funnel_session_id = e.funnel_session_id
    where e.created_at >= p_from and e.created_at < p_to
      and coalesce(e.is_test, false) = false
      and (view_mode <> 'campaign' or r.resolved_campaign_id = campaign_filter)
    group by 1, 2
  ),
  v2_fp_adset_rollups as (
    select
      r.resolved_campaign_id as campaign_id,
      r.touch_adset_id as adset_id,
      count(distinct e.funnel_session_id) filter (where e.event_name = 'v2_landing_view')::int as v2_landing,
      count(distinct e.funnel_session_id) filter (where e.event_name = 'v2_upload_completed')::int as v2_upload,
      count(distinct e.funnel_session_id) filter (where e.event_name = 'v2_preview_viewed')::int as v2_preview,
      count(distinct e.funnel_session_id) filter (where e.event_name = 'v2_unlock_clicked')::int as v2_unlock,
      count(distinct e.funnel_session_id) filter (where e.event_name = 'v2_begin_checkout')::int as v2_checkout,
      count(distinct e.funnel_session_id) filter (where e.event_name = 'v2_purchase')::int as v2_purchase
    from public.pet_v2_funnel_events e
    inner join v2_resolved r on r.funnel_session_id = e.funnel_session_id
    where e.created_at >= p_from and e.created_at < p_to
      and (view_mode <> 'campaign' or r.resolved_campaign_id = campaign_filter)
    group by 1, 2
  ),
  v2_fp_ad_rollups as (
    select
      r.resolved_campaign_id as campaign_id,
      r.touch_adset_id as adset_id,
      r.touch_ad_id as ad_id,
      count(distinct e.funnel_session_id) filter (where e.event_name = 'v2_landing_view')::int as v2_landing,
      count(distinct e.funnel_session_id) filter (where e.event_name = 'v2_upload_completed')::int as v2_upload,
      count(distinct e.funnel_session_id) filter (where e.event_name = 'v2_preview_viewed')::int as v2_preview,
      count(distinct e.funnel_session_id) filter (where e.event_name = 'v2_begin_checkout')::int as v2_checkout,
      count(distinct e.funnel_session_id) filter (where e.event_name = 'v2_purchase')::int as v2_purchase
    from public.pet_v2_funnel_events e
    inner join v2_resolved r on r.funnel_session_id = e.funnel_session_id
    where e.created_at >= p_from and e.created_at < p_to
      and (view_mode <> 'campaign' or r.resolved_campaign_id = campaign_filter)
    group by 1, 2, 3
  ),
  species_rollups as (
    select
      coalesce(species, 'dog') as species,
      count(distinct funnel_session_id) filter (where event_name in ('landing_view', 'v2_landing_view'))::int as lpv,
      count(distinct funnel_session_id) filter (where event_name in ('initiate_checkout', 'v2_begin_checkout'))::int as checkout_count,
      count(distinct funnel_session_id) filter (where event_name in ('purchase', 'v2_purchase'))::int as purchase_count,
      coalesce(sum(amount_cents) filter (where event_name in ('purchase', 'v2_purchase')), 0)::int as revenue_cents
    from (
      select species, funnel_session_id, event_name, amount_cents from current_v1
      union all
      select species, funnel_session_id, event_name, amount_cents from current_v2
    ) combined
    group by 1
  ),
  device_rollups as (
    select
      coalesce(device_type, 'unknown') as device_type,
      count(distinct funnel_session_id) filter (where event_name in ('landing_view', 'v2_landing_view'))::int as lpv,
      count(distinct funnel_session_id) filter (where event_name in ('initiate_checkout', 'v2_begin_checkout'))::int as checkout_count,
      count(distinct funnel_session_id) filter (where event_name in ('purchase', 'v2_purchase'))::int as purchase_count
    from (
      select device_type, funnel_session_id, event_name from current_v1
      union all
      select device_type, funnel_session_id, event_name from current_v2
    ) combined
    group by 1
  ),
  recent_rows as (
    select created_at, event_name, species, session_short, amount_cents, campaign_id
    from (
      select
        created_at,
        event_name,
        species,
        left(funnel_session_id::text, 8) as session_short,
        amount_cents,
        campaign_id
      from current_v1
      where event_name in (
        'landing_view', 'pet_name_submitted', 'photo_upload_completed',
        'order_review_viewed', 'initiate_checkout', 'purchase'
      )
      union all
      select
        created_at,
        event_name,
        species,
        left(funnel_session_id::text, 8) as session_short,
        amount_cents,
        campaign_id
      from current_v2
      where event_name in (
        'v2_landing_view', 'v2_upload_completed', 'v2_preview_viewed',
        'v2_unlock_clicked', 'v2_begin_checkout', 'v2_purchase'
      )
    ) combined
    order by created_at desc
    limit 25
  ),
  sync_meta as (
    select max(finished_at) as last_synced_at
    from public.pet_analytics_sync_runs
    where source = 'meta' and status = 'success'
  ),
  sync_ga4 as (
    select max(finished_at) as last_synced_at
    from public.pet_analytics_sync_runs
    where source = 'ga4' and status = 'success'
  ),
  backend_daily as (
    select
      (paid_at at time zone 'UTC')::date as metric_date,
      count(*)::int as purchases,
      coalesce(sum(coalesce(charged_amount_cents, amount_cents)), 0)::int as revenue_cents
    from classified_orders
    where analytics_class = 'paid'
      and paid_at >= p_from
      and paid_at < p_to
      and (
        view_mode in ('all', 'compare')
        or id in (select order_id from attributed_orders)
      )
    group by 1
    order by 1
  ),
  checkout_daily as (
    select
      (cc.created_at at time zone 'UTC')::date as metric_date,
      count(distinct cc.order_id)::int as checkouts
    from classified_checkouts cc
    where cc.analytics_class = 'customer'
      and cc.created_at >= p_from
      and cc.created_at < p_to
      and (
        view_mode in ('all', 'compare')
        or cc.order_id in (select order_id from attributed_orders)
      )
    group by 1
    order by 1
  ),
  v1_by_campaign as (
    select
      r.resolved_campaign_id as campaign_id,
      count(distinct e.funnel_session_id) filter (where e.event_name = 'landing_view')::int as landing,
      count(distinct e.funnel_session_id) filter (where e.event_name = 'pet_name_submitted')::int as name_submitted,
      count(distinct e.funnel_session_id) filter (where e.event_name = 'photo_upload_completed')::int as upload,
      count(distinct e.funnel_session_id) filter (where e.event_name = 'order_review_viewed')::int as review,
      count(distinct e.funnel_session_id) filter (where e.event_name = 'initiate_checkout')::int as checkout,
      count(distinct e.funnel_session_id) filter (where e.event_name = 'purchase')::int as purchase,
      coalesce(sum(e.amount_cents) filter (where e.event_name = 'purchase'), 0)::int as revenue_cents
    from public.pet_funnel_events e
    inner join v1_resolved r on r.funnel_session_id = e.funnel_session_id
    where e.created_at >= p_from and e.created_at < p_to
      and coalesce(e.is_test, false) = false
      and r.resolved_campaign_id is not null
    group by 1
  ),
  v2_by_campaign as (
    select
      r.resolved_campaign_id as campaign_id,
      count(distinct e.funnel_session_id) filter (where e.event_name = 'v2_landing_view')::int as landing,
      count(distinct e.funnel_session_id) filter (where e.event_name = 'v2_upload_started')::int as upload_started,
      count(distinct e.funnel_session_id) filter (where e.event_name = 'v2_upload_completed')::int as upload_completed,
      count(distinct e.funnel_session_id) filter (where e.event_name = 'v2_preview_generation_started')::int as preview_started,
      count(distinct e.funnel_session_id) filter (where e.event_name = 'v2_preview_generation_completed')::int as preview_completed,
      count(distinct e.funnel_session_id) filter (where e.event_name = 'v2_preview_generation_failed')::int as preview_failed,
      count(distinct e.funnel_session_id) filter (where e.event_name = 'v2_preview_viewed')::int as preview_viewed,
      count(distinct e.funnel_session_id) filter (where e.event_name = 'v2_offer_viewed')::int as offer_viewed,
      count(distinct e.funnel_session_id) filter (where e.event_name = 'v2_unlock_clicked')::int as unlock_clicked,
      count(distinct e.funnel_session_id) filter (where e.event_name = 'v2_begin_checkout')::int as checkout,
      count(distinct e.funnel_session_id) filter (where e.event_name = 'v2_purchase')::int as purchase,
      coalesce(sum(e.amount_cents) filter (where e.event_name = 'v2_purchase'), 0)::int as revenue_cents
    from public.pet_v2_funnel_events e
    inner join v2_resolved r on r.funnel_session_id = e.funnel_session_id
    where e.created_at >= p_from and e.created_at < p_to
      and r.resolved_campaign_id is not null
    group by 1
  ),
  stripe_by_campaign as (
    select
      r.resolved_campaign_id as campaign_id,
      count(distinct o.id) filter (
        where o.analytics_class = 'paid' and o.paid_at >= p_from and o.paid_at < p_to
      )::int as purchases,
      coalesce(sum(coalesce(o.charged_amount_cents, o.amount_cents)) filter (
        where o.analytics_class = 'paid' and o.paid_at >= p_from and o.paid_at < p_to
      ), 0)::int as revenue_cents,
      (
        select count(distinct cc.order_id)::int
        from classified_checkouts cc
        where cc.analytics_class = 'customer'
          and cc.created_at >= p_from and cc.created_at < p_to
          and cc.order_id in (
            select e2.order_id
            from public.pet_funnel_events e2
            join v1_resolved r2 on r2.funnel_session_id = e2.funnel_session_id
            where e2.order_id is not null
              and r2.resolved_campaign_id = r.resolved_campaign_id
          )
      ) as checkouts
    from classified_orders o
    inner join public.pet_funnel_events e on e.order_id = o.id
    inner join v1_resolved r on r.funnel_session_id = e.funnel_session_id
    where r.resolved_campaign_id is not null
    group by r.resolved_campaign_id
  ),
  campaign_summaries as (
    select
      c.campaign_id,
      c.display_name,
      c.funnel_variant,
      c.utm_campaign_aliases,
      c.measurement_reliable_from,
      coalesce(mc.spend_cents, 0)::bigint as spend_cents,
      coalesce(mc.impressions, 0)::bigint as impressions,
      coalesce(mc.reach, 0)::bigint as reach,
      coalesce(mc.link_clicks, 0)::bigint as link_clicks,
      coalesce(mc.landing_page_views, 0)::bigint as meta_lpv,
      coalesce(v1.landing, 0)::int as v1_landing,
      coalesce(v1.name_submitted, 0)::int as v1_name,
      coalesce(v1.upload, 0)::int as v1_upload,
      coalesce(v1.review, 0)::int as v1_review,
      coalesce(v1.checkout, 0)::int as v1_checkout,
      coalesce(v1.purchase, 0)::int as v1_purchase,
      coalesce(v1.revenue_cents, 0)::int as v1_revenue_cents,
      coalesce(v2.landing, 0)::int as v2_landing,
      coalesce(v2.upload_started, 0)::int as v2_upload_started,
      coalesce(v2.upload_completed, 0)::int as v2_upload_completed,
      coalesce(v2.preview_started, 0)::int as v2_preview_started,
      coalesce(v2.preview_completed, 0)::int as v2_preview_completed,
      coalesce(v2.preview_failed, 0)::int as v2_preview_failed,
      coalesce(v2.preview_viewed, 0)::int as v2_preview_viewed,
      coalesce(v2.offer_viewed, 0)::int as v2_offer_viewed,
      coalesce(v2.unlock_clicked, 0)::int as v2_unlock_clicked,
      coalesce(v2.checkout, 0)::int as v2_checkout,
      coalesce(v2.purchase, 0)::int as v2_purchase,
      coalesce(v2.revenue_cents, 0)::int as v2_revenue_cents,
      coalesce(st.purchases, 0)::int as stripe_purchases,
      coalesce(st.revenue_cents, 0)::int as stripe_revenue_cents,
      coalesce(st.checkouts, 0)::int as stripe_checkouts
    from catalog c
    left join meta_campaigns mc on mc.campaign_id = c.campaign_id
    left join v1_by_campaign v1 on v1.campaign_id = c.campaign_id
    left join v2_by_campaign v2 on v2.campaign_id = c.campaign_id
    left join stripe_by_campaign st on st.campaign_id = c.campaign_id
  )
  select jsonb_build_object(
    'view_mode', view_mode,
    'selected_campaign_id', campaign_filter,
    'selected_adset_id', adset_filter,
    'timezone', 'UTC',
    'date_filter_note', 'Meta daily metrics use UTC calendar dates. First-party V1/V2 events and Stripe timestamps use the same UTC interval [from, to).',
    'catalog', coalesce((select jsonb_agg(catalog) from catalog), '[]'::jsonb),
    'first_event_at', (
      select min(created_at)
      from (
        select created_at from public.pet_funnel_events where coalesce(is_test, false) = false
        union all
        select created_at from public.pet_v2_funnel_events
      ) first_events
    ),
    'first_party_tracking_started_at', (select min(created_at) from public.pet_funnel_events where coalesce(is_test, false) = false),
    'measurement_reliable_from', coalesce(
      (select measurement_reliable_from from catalog where campaign_id = campaign_filter),
      (select reliable_from from public.pet_funnel_measurement_settings where id = 1)
    ),
    'steps', coalesce((select jsonb_agg(step_counts) from step_counts), '[]'::jsonb),
    'previous_steps', coalesce((select jsonb_agg(prev_step_counts) from prev_step_counts), '[]'::jsonb),
    'v2_steps', coalesce((select jsonb_agg(v2_step_counts) from v2_step_counts), '[]'::jsonb),
    'v2_latency', jsonb_build_object(
      'median_ms', (select median_ms from v2_latency_stats),
      'p90_ms', (select p90_ms from v2_latency_stats)
    ),
    'unattributed', (select to_jsonb(unattributed) from unattributed),
    'campaign_summaries', coalesce((select jsonb_agg(campaign_summaries) from campaign_summaries), '[]'::jsonb),
    'revenue_cents', (select revenue_cents from backend_current),
    'previous_revenue_cents', (select revenue_cents from backend_previous),
    'campaigns', coalesce((select jsonb_agg(campaign_rollups) from campaign_rollups), '[]'::jsonb),
    'ads', coalesce((select jsonb_agg(ad_rollups) from ad_rollups), '[]'::jsonb),
    'fp_adsets', coalesce((select jsonb_agg(fp_adset_rollups) from fp_adset_rollups), '[]'::jsonb),
    'v2_fp_adsets', coalesce((select jsonb_agg(v2_fp_adset_rollups) from v2_fp_adset_rollups), '[]'::jsonb),
    'v2_fp_ads', coalesce((select jsonb_agg(v2_fp_ad_rollups) from v2_fp_ad_rollups), '[]'::jsonb),
    'species', coalesce((select jsonb_agg(species_rollups) from species_rollups), '[]'::jsonb),
    'devices', coalesce((select jsonb_agg(device_rollups) from device_rollups), '[]'::jsonb),
    'recent', coalesce((select jsonb_agg(recent_rows) from recent_rows), '[]'::jsonb),
    'backend', jsonb_build_object(
      'purchases', (select purchases from backend_current),
      'revenue_cents', (select revenue_cents from backend_current),
      'free_orders', (select free_orders from backend_current),
      'test_orders', (select test_orders from backend_current),
      'checkouts', (select checkouts from backend_current),
      'promo_checkouts', (
        select count(distinct cc.order_id)::int
        from classified_checkouts cc
        where cc.analytics_class = 'promo'
          and cc.created_at >= p_from
          and cc.created_at < p_to
      ),
      'test_checkouts', (
        select count(distinct cc.order_id)::int
        from classified_checkouts cc
        where cc.analytics_class = 'test'
          and cc.created_at >= p_from
          and cc.created_at < p_to
      ),
      'internal_checkouts', (
        select count(distinct cc.order_id)::int
        from classified_checkouts cc
        where cc.analytics_class = 'internal'
          and cc.created_at >= p_from
          and cc.created_at < p_to
      ),
      'previous_purchases', (select purchases from backend_previous),
      'previous_revenue_cents', (select revenue_cents from backend_previous),
      'previous_free_orders', (select free_orders from backend_previous),
      'previous_checkouts', (select checkouts from backend_previous),
      'daily', coalesce((select jsonb_agg(backend_daily) from backend_daily), '[]'::jsonb),
      'checkout_daily', coalesce((select jsonb_agg(checkout_daily) from checkout_daily), '[]'::jsonb)
    ),
    'meta', jsonb_build_object(
      'row_count', (select row_count from meta_totals),
      'last_synced_at', (select last_synced_at from sync_meta),
      'totals', (select to_jsonb(meta_totals) - 'row_count' from meta_totals),
      'daily', coalesce((select jsonb_agg(meta_daily) from meta_daily), '[]'::jsonb),
      'campaigns', coalesce((select jsonb_agg(meta_campaigns) from meta_campaigns), '[]'::jsonb),
      'adsets', coalesce((select jsonb_agg(meta_adsets) from meta_adsets), '[]'::jsonb),
      'ads', coalesce((select jsonb_agg(meta_ads) from meta_ads), '[]'::jsonb)
    ),
    'tracking_health', jsonb_build_object(
      'first_party_landing_sessions', (
        case
          when view_mode = 'campaign' and coalesce((select c.funnel_variant from catalog c where c.campaign_id = campaign_filter), 'v1') = 'v2_preview'
            then (select v2_landings from tracking_health)
          else (select v1_landings from tracking_health)
        end
      ),
      'v1_landing_sessions', (select v1_landings from tracking_health),
      'v2_landing_sessions', (select v2_landings from tracking_health),
      'latest_first_party_event_at', (
        case
          when view_mode = 'campaign' and coalesce((select c.funnel_variant from catalog c where c.campaign_id = campaign_filter), 'v1') = 'v2_preview'
            then (select latest_v2_at from tracking_health)
          else (select latest_v1_at from tracking_health)
        end
      ),
      'latest_v1_event_at', (select latest_v1_at from tracking_health),
      'latest_v2_event_at', (select latest_v2_at from tracking_health),
      'failed_write_count', (
        case
          when view_mode = 'campaign' and coalesce((select c.funnel_variant from catalog c where c.campaign_id = campaign_filter), 'v1') = 'v2_preview'
            then (select v2_failed_write_count from tracking_health)
          else (select v1_failed_write_count from tracking_health)
        end
      ),
      'v1_failed_write_count', (select v1_failed_write_count from tracking_health),
      'v2_failed_write_count', (select v2_failed_write_count from tracking_health)
    ),
    'ga4', jsonb_build_object(
      'row_count', (select row_count from ga4_totals),
      'last_synced_at', (select last_synced_at from sync_ga4),
      'totals', (select to_jsonb(ga4_totals) - 'row_count' from ga4_totals),
      'daily', coalesce((select jsonb_agg(ga4_daily) from ga4_daily), '[]'::jsonb)
    )
  )
  into report;

  return report;
end;
$$;

revoke all on function public.admin_pet_funnel_analytics(timestamptz, timestamptz, timestamptz, timestamptz, text, text, text)
  from public, anon;
grant execute on function public.admin_pet_funnel_analytics(timestamptz, timestamptz, timestamptz, timestamptz, text, text, text)
  to authenticated, service_role;

commit;
