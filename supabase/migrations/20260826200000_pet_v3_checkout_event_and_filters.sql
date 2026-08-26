-- V3: allow checkout_viewed event + combined attribution filters on dashboard RPCs.
-- Backward compatible: new params default null (no filter).

begin;

alter table public.pet_v3_funnel_events drop constraint if exists pet_v3_funnel_events_name_chk;
alter table public.pet_v3_funnel_events
  add constraint pet_v3_funnel_events_name_chk check (
    event_name in (
      'v3_landing_view',
      'v3_upload_started',
      'v3_upload_completed',
      'v3_upload_failed',
      'v3_preview_generation_started',
      'v3_preview_generation_completed',
      'v3_preview_generation_failed',
      'v3_preview_viewed',
      'v3_preview_regenerated',
      'v3_offer_viewed',
      'v3_unlock_clicked',
      'v3_checkout_viewed',
      'v3_begin_checkout',
      'v3_purchase'
    )
  );

create or replace function public.admin_pet_v3_funnel_step_counts(
  p_from timestamptz,
  p_to timestamptz,
  p_funnel_version text default 'v3',
  p_campaign_id text default null,
  p_adset_id text default null,
  p_ad_id text default null,
  p_creative_id text default null,
  p_utm_source text default null,
  p_utm_medium text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  version_filter text := lower(btrim(coalesce(p_funnel_version, 'v3')));
  campaign_filter text := nullif(btrim(coalesce(p_campaign_id, '')), '');
  adset_filter text := nullif(btrim(coalesce(p_adset_id, '')), '');
  ad_filter text := nullif(btrim(coalesce(p_ad_id, '')), '');
  creative_filter text := nullif(btrim(coalesce(p_creative_id, '')), '');
  source_filter text := nullif(btrim(coalesce(p_utm_source, '')), '');
  medium_filter text := nullif(btrim(coalesce(p_utm_medium, '')), '');
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
      from public.pet_v3_funnel_events e
      where e.created_at >= p_from
        and e.created_at < p_to
        and coalesce(e.is_test, false) = false
        and (version_filter is null or coalesce(e.funnel_version, 'v3') = version_filter)
        and (campaign_filter is null or e.campaign_id = campaign_filter)
        and (adset_filter is null or e.adset_id = adset_filter)
        and (ad_filter is null or e.ad_id = ad_filter)
        and (
          creative_filter is null
          or e.creative_id = creative_filter
          or e.utm_content = creative_filter
        )
        and (source_filter is null or e.utm_source = source_filter)
        and (medium_filter is null or e.utm_medium = medium_filter)
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
  p_to timestamptz,
  p_funnel_version text default 'v3',
  p_campaign_id text default null,
  p_adset_id text default null,
  p_ad_id text default null,
  p_creative_id text default null,
  p_utm_source text default null,
  p_utm_medium text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  version_filter text := lower(btrim(coalesce(p_funnel_version, 'v3')));
  campaign_filter text := nullif(btrim(coalesce(p_campaign_id, '')), '');
  adset_filter text := nullif(btrim(coalesce(p_adset_id, '')), '');
  ad_filter text := nullif(btrim(coalesce(p_ad_id, '')), '');
  creative_filter text := nullif(btrim(coalesce(p_creative_id, '')), '');
  source_filter text := nullif(btrim(coalesce(p_utm_source, '')), '');
  medium_filter text := nullif(btrim(coalesce(p_utm_medium, '')), '');
  has_attr_filter boolean := false;
  result jsonb;
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if version_filter = 'all' then
    version_filter := null;
  elsif version_filter not in ('v3', 'unknown') then
    version_filter := 'v3';
  end if;
  has_attr_filter := campaign_filter is not null
    or adset_filter is not null
    or ad_filter is not null
    or creative_filter is not null
    or source_filter is not null
    or medium_filter is not null;

  select jsonb_build_object(
    'backend', (
      select jsonb_build_object(
        'purchases', case
          when has_attr_filter then (
            select count(distinct e.funnel_session_id)::int
            from public.pet_v3_funnel_events e
            where e.event_name = 'v3_purchase'
              and e.created_at >= p_from and e.created_at < p_to
              and coalesce(e.is_test, false) = false
              and (version_filter is null or coalesce(e.funnel_version, 'v3') = version_filter)
              and (campaign_filter is null or e.campaign_id = campaign_filter)
              and (adset_filter is null or e.adset_id = adset_filter)
              and (ad_filter is null or e.ad_id = ad_filter)
              and (creative_filter is null or e.creative_id = creative_filter or e.utm_content = creative_filter)
              and (source_filter is null or e.utm_source = source_filter)
              and (medium_filter is null or e.utm_medium = medium_filter)
          )
          else (
            select count(*)::int
            from public.pet_orders o
            where coalesce(o.funnel_variant, 'v1') = 'v3'
              and o.paid_at >= p_from and o.paid_at < p_to
              and coalesce(o.status, '') <> 'refunded'
              and public.pet_order_analytics_class(
                o.stripe_checkout_session_id,
                o.stripe_payment_intent_id,
                o.charged_amount_cents,
                o.amount_cents,
                o.discount_percent,
                o.stripe_payment_status
              ) = 'paid'
          )
        end,
        'revenue_cents', case
          when has_attr_filter then (
            select coalesce(sum(e.amount_cents), 0)::int
            from public.pet_v3_funnel_events e
            where e.event_name = 'v3_purchase'
              and e.created_at >= p_from and e.created_at < p_to
              and coalesce(e.is_test, false) = false
              and (version_filter is null or coalesce(e.funnel_version, 'v3') = version_filter)
              and (campaign_filter is null or e.campaign_id = campaign_filter)
              and (adset_filter is null or e.adset_id = adset_filter)
              and (ad_filter is null or e.ad_id = ad_filter)
              and (creative_filter is null or e.creative_id = creative_filter or e.utm_content = creative_filter)
              and (source_filter is null or e.utm_source = source_filter)
              and (medium_filter is null or e.utm_medium = medium_filter)
          )
          else (
            select coalesce(sum(coalesce(o.charged_amount_cents, o.amount_cents)), 0)::int
            from public.pet_orders o
            where coalesce(o.funnel_variant, 'v1') = 'v3'
              and o.paid_at >= p_from and o.paid_at < p_to
              and coalesce(o.status, '') <> 'refunded'
              and public.pet_order_analytics_class(
                o.stripe_checkout_session_id,
                o.stripe_payment_intent_id,
                o.charged_amount_cents,
                o.amount_cents,
                o.discount_percent,
                o.stripe_payment_status
              ) = 'paid'
          )
        end,
        'checkouts', (
          select count(distinct e.funnel_session_id)::int
          from public.pet_v3_funnel_events e
          where e.event_name = 'v3_begin_checkout'
            and e.created_at >= p_from and e.created_at < p_to
            and coalesce(e.is_test, false) = false
            and (version_filter is null or coalesce(e.funnel_version, 'v3') = version_filter)
            and (campaign_filter is null or e.campaign_id = campaign_filter)
            and (adset_filter is null or e.adset_id = adset_filter)
            and (ad_filter is null or e.ad_id = ad_filter)
            and (creative_filter is null or e.creative_id = creative_filter or e.utm_content = creative_filter)
            and (source_filter is null or e.utm_source = source_filter)
            and (medium_filter is null or e.utm_medium = medium_filter)
        )
      )
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
          amount_cents,
          campaign_id,
          adset_id,
          ad_id,
          creative_id,
          utm_source,
          utm_medium
        from public.pet_v3_funnel_events e
        where e.created_at >= p_from and e.created_at < p_to
          and coalesce(e.is_test, false) = false
          and (version_filter is null or coalesce(e.funnel_version, 'v3') = version_filter)
          and (campaign_filter is null or e.campaign_id = campaign_filter)
          and (adset_filter is null or e.adset_id = adset_filter)
          and (ad_filter is null or e.ad_id = ad_filter)
          and (creative_filter is null or e.creative_id = creative_filter or e.utm_content = creative_filter)
          and (source_filter is null or e.utm_source = source_filter)
          and (medium_filter is null or e.utm_medium = medium_filter)
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
          count(distinct funnel_session_id) filter (where event_name = 'v3_offer_viewed')::int as offer_viewed_count,
          count(distinct funnel_session_id) filter (where event_name = 'v3_checkout_viewed')::int as checkout_viewed_count,
          count(distinct funnel_session_id) filter (where event_name = 'v3_begin_checkout')::int as checkout_count,
          count(distinct funnel_session_id) filter (where event_name = 'v3_purchase')::int as purchase_count,
          coalesce(sum(amount_cents) filter (where event_name = 'v3_purchase'), 0)::int as revenue_cents
        from public.pet_v3_funnel_events e
        where e.created_at >= p_from and e.created_at < p_to
          and coalesce(e.is_test, false) = false
          and (version_filter is null or coalesce(e.funnel_version, 'v3') = version_filter)
          and (campaign_filter is null or e.campaign_id = campaign_filter)
          and (adset_filter is null or e.adset_id = adset_filter)
          and (ad_filter is null or e.ad_id = ad_filter)
          and (creative_filter is null or e.creative_id = creative_filter or e.utm_content = creative_filter)
          and (source_filter is null or e.utm_source = source_filter)
          and (medium_filter is null or e.utm_medium = medium_filter)
        group by 1, 2
        order by lpv desc, campaign asc
        limit 50
      ) c
    ), '[]'::jsonb),
    'adsets', coalesce((
      select jsonb_agg(row_to_json(a))
      from (
        select
          coalesce(nullif(btrim(adset_id), ''), 'unattributed') as adset_id,
          count(distinct funnel_session_id) filter (where event_name = 'v3_landing_view')::int as lpv,
          count(distinct funnel_session_id) filter (where event_name = 'v3_begin_checkout')::int as checkout_count,
          count(distinct funnel_session_id) filter (where event_name = 'v3_purchase')::int as purchase_count
        from public.pet_v3_funnel_events e
        where e.created_at >= p_from and e.created_at < p_to
          and coalesce(e.is_test, false) = false
          and (version_filter is null or coalesce(e.funnel_version, 'v3') = version_filter)
          and (campaign_filter is null or e.campaign_id = campaign_filter)
          and (adset_filter is null or e.adset_id = adset_filter)
          and (ad_filter is null or e.ad_id = ad_filter)
          and (creative_filter is null or e.creative_id = creative_filter or e.utm_content = creative_filter)
          and (source_filter is null or e.utm_source = source_filter)
          and (medium_filter is null or e.utm_medium = medium_filter)
        group by 1
        order by lpv desc
        limit 50
      ) a
    ), '[]'::jsonb),
    'ads', coalesce((
      select jsonb_agg(row_to_json(ad))
      from (
        select
          coalesce(nullif(btrim(ad_id), ''), 'unattributed') as ad_id,
          count(distinct funnel_session_id) filter (where event_name = 'v3_landing_view')::int as lpv,
          count(distinct funnel_session_id) filter (where event_name = 'v3_begin_checkout')::int as checkout_count,
          count(distinct funnel_session_id) filter (where event_name = 'v3_purchase')::int as purchase_count
        from public.pet_v3_funnel_events e
        where e.created_at >= p_from and e.created_at < p_to
          and coalesce(e.is_test, false) = false
          and (version_filter is null or coalesce(e.funnel_version, 'v3') = version_filter)
          and (campaign_filter is null or e.campaign_id = campaign_filter)
          and (adset_filter is null or e.adset_id = adset_filter)
          and (ad_filter is null or e.ad_id = ad_filter)
          and (creative_filter is null or e.creative_id = creative_filter or e.utm_content = creative_filter)
          and (source_filter is null or e.utm_source = source_filter)
          and (medium_filter is null or e.utm_medium = medium_filter)
        group by 1
        order by lpv desc
        limit 50
      ) ad
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
        from public.pet_v3_funnel_events e
        where e.created_at >= p_from and e.created_at < p_to
          and coalesce(e.is_test, false) = false
          and (version_filter is null or coalesce(e.funnel_version, 'v3') = version_filter)
          and (campaign_filter is null or e.campaign_id = campaign_filter)
          and (adset_filter is null or e.adset_id = adset_filter)
          and (ad_filter is null or e.ad_id = ad_filter)
          and (creative_filter is null or e.creative_id = creative_filter or e.utm_content = creative_filter)
          and (source_filter is null or e.utm_source = source_filter)
          and (medium_filter is null or e.utm_medium = medium_filter)
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
        from public.pet_v3_funnel_events e
        where e.created_at >= p_from and e.created_at < p_to
          and coalesce(e.is_test, false) = false
          and (version_filter is null or coalesce(e.funnel_version, 'v3') = version_filter)
          and (campaign_filter is null or e.campaign_id = campaign_filter)
          and (adset_filter is null or e.adset_id = adset_filter)
          and (ad_filter is null or e.ad_id = ad_filter)
          and (creative_filter is null or e.creative_id = creative_filter or e.utm_content = creative_filter)
          and (source_filter is null or e.utm_source = source_filter)
          and (medium_filter is null or e.utm_medium = medium_filter)
        group by 1
        order by lpv desc
      ) d
    ), '[]'::jsonb)
  )
  into result;

  return result;
end;
$$;

revoke all on function public.admin_pet_v3_funnel_step_counts(
  timestamptz, timestamptz, text, text, text, text, text, text, text
) from public, anon;
grant execute on function public.admin_pet_v3_funnel_step_counts(
  timestamptz, timestamptz, text, text, text, text, text, text, text
) to authenticated, service_role;

revoke all on function public.admin_pet_v3_dashboard_context(
  timestamptz, timestamptz, text, text, text, text, text, text, text
) from public, anon;
grant execute on function public.admin_pet_v3_dashboard_context(
  timestamptz, timestamptz, text, text, text, text, text, text, text
) to authenticated, service_role;

commit;

-- Rollback (manual): restore prior function signatures from 20260826180000 migration if needed.
-- Do not drop v3_checkout_viewed from constraint without archiving rows first.
