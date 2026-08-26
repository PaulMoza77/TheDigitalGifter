-- V3 dashboard: checkout_viewed stage + isolated backend/recent/attribution context.

begin;

create or replace function public.admin_pet_v3_funnel_step_counts(
  p_from timestamptz,
  p_to timestamptz,
  p_funnel_version text default 'v3'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  version_filter text := lower(btrim(coalesce(p_funnel_version, 'v3')));
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if version_filter = 'all' then
    version_filter := null;
  elsif version_filter not in ('v3', 'unknown') then
    version_filter := 'v3';
  end if;

  return (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'event_name', event_name,
          'unique_sessions', unique_sessions,
          'event_count', event_count
        )
        order by event_name
      ),
      '[]'::jsonb
    )
    from (
      select
        event_name,
        count(distinct funnel_session_id)::int as unique_sessions,
        count(*)::int as event_count
      from public.pet_v3_funnel_events
      where created_at >= p_from
        and created_at < p_to
        and coalesce(is_test, false) = false
        and (version_filter is null or coalesce(funnel_version, 'v3') = version_filter)
        and event_name in (
          'v3_landing_view', 'v3_upload_started', 'v3_upload_completed',
          'v3_preview_generation_started', 'v3_preview_generation_completed', 'v3_preview_generation_failed',
          'v3_preview_viewed', 'v3_preview_regenerated', 'v3_offer_viewed', 'v3_unlock_clicked',
          'v3_checkout_viewed', 'v3_begin_checkout', 'v3_purchase'
        )
      group by event_name
    ) s
  );
end;
$$;

create or replace function public.admin_pet_v3_dashboard_context(
  p_from timestamptz,
  p_to timestamptz
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'backend', (
      select jsonb_build_object(
        'purchases', count(*) filter (
          where public.pet_order_analytics_class(
            o.stripe_checkout_session_id,
            o.stripe_payment_intent_id,
            o.charged_amount_cents,
            o.amount_cents,
            o.discount_percent,
            o.stripe_payment_status
          ) = 'paid'
            and o.paid_at >= p_from and o.paid_at < p_to
        )::int,
        'revenue_cents', coalesce(sum(coalesce(o.charged_amount_cents, o.amount_cents)) filter (
          where public.pet_order_analytics_class(
            o.stripe_checkout_session_id,
            o.stripe_payment_intent_id,
            o.charged_amount_cents,
            o.amount_cents,
            o.discount_percent,
            o.stripe_payment_status
          ) = 'paid'
            and o.paid_at >= p_from and o.paid_at < p_to
        ), 0)::int,
        'free_orders', count(*) filter (
          where public.pet_order_analytics_class(
            o.stripe_checkout_session_id,
            o.stripe_payment_intent_id,
            o.charged_amount_cents,
            o.amount_cents,
            o.discount_percent,
            o.stripe_payment_status
          ) = 'free'
            and o.paid_at >= p_from and o.paid_at < p_to
        )::int,
        'test_orders', count(*) filter (
          where public.pet_order_analytics_class(
            o.stripe_checkout_session_id,
            o.stripe_payment_intent_id,
            o.charged_amount_cents,
            o.amount_cents,
            o.discount_percent,
            o.stripe_payment_status
          ) = 'test'
            and o.paid_at >= p_from and o.paid_at < p_to
        )::int,
        'checkouts', (
          select count(distinct e.funnel_session_id)::int
          from public.pet_v3_funnel_events e
          where e.event_name = 'v3_begin_checkout'
            and e.created_at >= p_from and e.created_at < p_to
            and coalesce(e.is_test, false) = false
        )
      )
      from public.pet_orders o
      where coalesce(o.funnel_variant, 'v1') = 'v3'
        and o.paid_at is not null
        and coalesce(o.status, '') <> 'refunded'
    ),
    'latest_event_at', (
      select max(created_at)
      from public.pet_v3_funnel_events
      where coalesce(is_test, false) = false
    ),
    'failed_writes', (
      select count(*)::int
      from public.pet_funnel_event_failures
      where funnel_dataset = 'v3'
        and created_at >= p_from and created_at < p_to
    ),
    'recent', coalesce((
      select jsonb_agg(row_to_json(r))
      from (
        select
          created_at,
          event_name,
          species,
          left(funnel_session_id::text, 8) as session_short,
          amount_cents
        from public.pet_v3_funnel_events
        where created_at >= p_from and created_at < p_to
          and coalesce(is_test, false) = false
        order by created_at desc
        limit 40
      ) r
    ), '[]'::jsonb),
    'campaigns', coalesce((
      select jsonb_agg(row_to_json(c))
      from (
        select
          coalesce(nullif(btrim(campaign_id), ''), 'unattributed') as campaign_id,
          coalesce(nullif(btrim(utm_campaign), ''), nullif(btrim(campaign_id), ''), 'Unattributed') as campaign,
          count(distinct funnel_session_id) filter (where event_name = 'v3_landing_view')::int as lpv,
          count(distinct funnel_session_id) filter (where event_name = 'v3_upload_completed')::int as upload_count,
          count(distinct funnel_session_id) filter (where event_name = 'v3_preview_viewed')::int as review_count,
          count(distinct funnel_session_id) filter (where event_name = 'v3_checkout_viewed')::int as checkout_viewed_count,
          count(distinct funnel_session_id) filter (where event_name = 'v3_begin_checkout')::int as checkout_count,
          count(distinct funnel_session_id) filter (where event_name = 'v3_purchase')::int as purchase_count,
          coalesce(sum(amount_cents) filter (where event_name = 'v3_purchase'), 0)::int as revenue_cents
        from public.pet_v3_funnel_events
        where created_at >= p_from and created_at < p_to
          and coalesce(is_test, false) = false
        group by 1, 2
        order by lpv desc, campaign asc
        limit 50
      ) c
    ), '[]'::jsonb),
    'creatives', coalesce((
      select jsonb_agg(row_to_json(cr))
      from (
        select
          coalesce(nullif(btrim(creative_id), ''), nullif(btrim(utm_content), ''), 'unattributed') as creative_id,
          count(distinct funnel_session_id) filter (where event_name = 'v3_landing_view')::int as lpv,
          count(distinct funnel_session_id) filter (where event_name = 'v3_checkout_viewed')::int as checkout_viewed_count,
          count(distinct funnel_session_id) filter (where event_name = 'v3_begin_checkout')::int as checkout_count,
          count(distinct funnel_session_id) filter (where event_name = 'v3_purchase')::int as purchase_count,
          coalesce(sum(amount_cents) filter (where event_name = 'v3_purchase'), 0)::int as revenue_cents
        from public.pet_v3_funnel_events
        where created_at >= p_from and created_at < p_to
          and coalesce(is_test, false) = false
        group by 1
        order by lpv desc
        limit 50
      ) cr
    ), '[]'::jsonb),
    'devices', coalesce((
      select jsonb_agg(row_to_json(d))
      from (
        select
          coalesce(nullif(btrim(device_type), ''), 'unknown') as device_type,
          count(distinct funnel_session_id) filter (where event_name = 'v3_landing_view')::int as lpv,
          count(distinct funnel_session_id) filter (where event_name = 'v3_begin_checkout')::int as checkout_count,
          count(distinct funnel_session_id) filter (where event_name = 'v3_purchase')::int as purchase_count
        from public.pet_v3_funnel_events
        where created_at >= p_from and created_at < p_to
          and coalesce(is_test, false) = false
        group by 1
        order by lpv desc
      ) d
    ), '[]'::jsonb)
  )
  into result;

  return result;
end;
$$;

revoke all on function public.admin_pet_v3_dashboard_context(timestamptz, timestamptz)
  from public, anon;
grant execute on function public.admin_pet_v3_dashboard_context(timestamptz, timestamptz)
  to authenticated, service_role;

commit;
