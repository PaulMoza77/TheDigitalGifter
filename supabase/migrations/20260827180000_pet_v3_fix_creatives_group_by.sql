-- Fix admin_pet_v3_dashboard_context creatives aggregation.
-- Correlated subqueries referenced ungrouped e.creative_id / e.utm_content and failed with:
--   subquery uses ungrouped column "e.creative_id" from outer query
-- Use the same event_rollups + purchase_rollups join pattern as campaigns.

begin;

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

  select jsonb_build_object(
    'backend', (
      with confirmed as (
        select
          o.id as order_id,
          o.paid_at,
          coalesce(o.charged_amount_cents, o.amount_cents, 0)::int as revenue_cents,
          coalesce(o.currency, 'usd') as currency,
          e.funnel_session_id,
          e.campaign_id,
          e.adset_id,
          e.ad_id,
          e.creative_id,
          e.utm_content,
          e.utm_source,
          e.utm_medium,
          coalesce(e.funnel_version, 'v3') as funnel_version
        from public.pet_orders o
        inner join public.pet_v3_funnel_events e
          on e.event_name = 'v3_purchase'
         and e.idempotency_key = ('v3_purchase:' || o.id::text)
        where coalesce(o.funnel_variant, 'v1') = 'v3'
          and o.paid_at >= p_from
          and o.paid_at < p_to
          and coalesce(o.status, '') <> 'refunded'
          and public.pet_order_analytics_class(
            o.stripe_checkout_session_id,
            o.stripe_payment_intent_id,
            o.charged_amount_cents,
            o.amount_cents,
            o.discount_percent,
            o.stripe_payment_status
          ) = 'paid'
          and coalesce(e.is_test, false) = false
      )
      select jsonb_build_object(
        'purchases', (
          select count(*)::int
          from confirmed c
          where (version_filter is null or c.funnel_version = version_filter)
            and (campaign_filter is null or c.campaign_id = campaign_filter)
            and (adset_filter is null or c.adset_id = adset_filter)
            and (ad_filter is null or c.ad_id = ad_filter)
            and (creative_filter is null or c.creative_id = creative_filter or c.utm_content = creative_filter)
            and (source_filter is null or c.utm_source = source_filter)
            and (medium_filter is null or c.utm_medium = medium_filter)
        ),
        'revenue_cents', (
          select coalesce(sum(c.revenue_cents), 0)::int
          from confirmed c
          where (version_filter is null or c.funnel_version = version_filter)
            and (campaign_filter is null or c.campaign_id = campaign_filter)
            and (adset_filter is null or c.adset_id = adset_filter)
            and (ad_filter is null or c.ad_id = ad_filter)
            and (creative_filter is null or c.creative_id = creative_filter or c.utm_content = creative_filter)
            and (source_filter is null or c.utm_source = source_filter)
            and (medium_filter is null or c.utm_medium = medium_filter)
        ),
        'currency', (
          select coalesce(max(c.currency), 'usd')
          from confirmed c
          where (version_filter is null or c.funnel_version = version_filter)
            and (campaign_filter is null or c.campaign_id = campaign_filter)
            and (adset_filter is null or c.adset_id = adset_filter)
            and (ad_filter is null or c.ad_id = ad_filter)
            and (creative_filter is null or c.creative_id = creative_filter or c.utm_content = creative_filter)
            and (source_filter is null or c.utm_source = source_filter)
            and (medium_filter is null or c.utm_medium = medium_filter)
        ),
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
    'daily', coalesce((
      select jsonb_agg(row_to_json(d) order by d.metric_date)
      from (
        select
          (c.paid_at at time zone 'UTC')::date as metric_date,
          count(distinct c.order_id)::int as purchases,
          coalesce(sum(c.revenue_cents), 0)::int as revenue_cents
        from (
          select
            o.id as order_id,
            o.paid_at,
            coalesce(o.charged_amount_cents, o.amount_cents, 0)::int as revenue_cents,
            e.campaign_id,
            e.adset_id,
            e.ad_id,
            e.creative_id,
            e.utm_content,
            e.utm_source,
            e.utm_medium,
            coalesce(e.funnel_version, 'v3') as funnel_version
          from public.pet_orders o
          inner join public.pet_v3_funnel_events e
            on e.event_name = 'v3_purchase'
           and e.idempotency_key = ('v3_purchase:' || o.id::text)
          where coalesce(o.funnel_variant, 'v1') = 'v3'
            and o.paid_at >= p_from
            and o.paid_at < p_to
            and coalesce(o.status, '') <> 'refunded'
            and public.pet_order_analytics_class(
              o.stripe_checkout_session_id,
              o.stripe_payment_intent_id,
              o.charged_amount_cents,
              o.amount_cents,
              o.discount_percent,
              o.stripe_payment_status
            ) = 'paid'
            and coalesce(e.is_test, false) = false
        ) c
        where (version_filter is null or c.funnel_version = version_filter)
          and (campaign_filter is null or c.campaign_id = campaign_filter)
          and (adset_filter is null or c.adset_id = adset_filter)
          and (ad_filter is null or c.ad_id = ad_filter)
          and (creative_filter is null or c.creative_id = creative_filter or c.utm_content = creative_filter)
          and (source_filter is null or c.utm_source = source_filter)
          and (medium_filter is null or c.utm_medium = medium_filter)
        group by 1
      ) d
    ), '[]'::jsonb),
    'checkout_daily', coalesce((
      select jsonb_agg(row_to_json(d) order by d.metric_date)
      from (
        select
          (e.created_at at time zone 'UTC')::date as metric_date,
          count(distinct e.funnel_session_id)::int as checkouts
        from public.pet_v3_funnel_events e
        where e.event_name = 'v3_begin_checkout'
          and e.created_at >= p_from
          and e.created_at < p_to
          and coalesce(e.is_test, false) = false
          and (version_filter is null or coalesce(e.funnel_version, 'v3') = version_filter)
          and (campaign_filter is null or e.campaign_id = campaign_filter)
          and (adset_filter is null or e.adset_id = adset_filter)
          and (ad_filter is null or e.ad_id = ad_filter)
          and (creative_filter is null or e.creative_id = creative_filter or e.utm_content = creative_filter)
          and (source_filter is null or e.utm_source = source_filter)
          and (medium_filter is null or e.utm_medium = medium_filter)
        group by 1
      ) d
    ), '[]'::jsonb),
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
        with confirmed as (
          select
            coalesce(nullif(btrim(e.campaign_id), ''), 'unattributed') as campaign_id,
            o.id as order_id,
            coalesce(o.charged_amount_cents, o.amount_cents, 0)::int as revenue_cents
          from public.pet_orders o
          inner join public.pet_v3_funnel_events e
            on e.event_name = 'v3_purchase'
           and e.idempotency_key = ('v3_purchase:' || o.id::text)
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
            and coalesce(e.is_test, false) = false
            and (version_filter is null or coalesce(e.funnel_version, 'v3') = version_filter)
            and (campaign_filter is null or e.campaign_id = campaign_filter)
            and (adset_filter is null or e.adset_id = adset_filter)
            and (ad_filter is null or e.ad_id = ad_filter)
            and (creative_filter is null or e.creative_id = creative_filter or e.utm_content = creative_filter)
            and (source_filter is null or e.utm_source = source_filter)
            and (medium_filter is null or e.utm_medium = medium_filter)
        ),
        event_rollups as (
          select
            coalesce(nullif(btrim(campaign_id), ''), 'unattributed') as campaign_id,
            coalesce(nullif(btrim(utm_campaign), ''), nullif(btrim(campaign_id), ''), 'Unattributed') as campaign,
            count(distinct funnel_session_id) filter (where event_name = 'v3_landing_view')::int as lpv,
            count(distinct funnel_session_id) filter (where event_name = 'v3_upload_completed')::int as upload_count,
            count(distinct funnel_session_id) filter (where event_name = 'v3_preview_viewed')::int as review_count,
            count(distinct funnel_session_id) filter (where event_name = 'v3_offer_viewed')::int as offer_viewed_count,
            count(distinct funnel_session_id) filter (where event_name = 'v3_checkout_viewed')::int as checkout_viewed_count,
            count(distinct funnel_session_id) filter (where event_name = 'v3_begin_checkout')::int as checkout_count
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
        ),
        purchase_rollups as (
          select campaign_id, count(distinct order_id)::int as purchase_count, coalesce(sum(revenue_cents), 0)::int as revenue_cents
          from confirmed
          group by 1
        )
        select
          er.campaign_id,
          er.campaign,
          er.lpv,
          er.upload_count,
          er.review_count,
          er.offer_viewed_count,
          er.checkout_viewed_count,
          er.checkout_count,
          coalesce(pr.purchase_count, 0) as purchase_count,
          coalesce(pr.revenue_cents, 0) as revenue_cents
        from event_rollups er
        left join purchase_rollups pr using (campaign_id)
        order by er.lpv desc, er.campaign asc
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
        with confirmed as (
          select
            coalesce(nullif(btrim(e.creative_id), ''), nullif(btrim(e.utm_content), ''), 'unattributed') as creative_id,
            o.id as order_id,
            coalesce(o.charged_amount_cents, o.amount_cents, 0)::int as revenue_cents
          from public.pet_orders o
          inner join public.pet_v3_funnel_events e
            on e.event_name = 'v3_purchase'
           and e.idempotency_key = ('v3_purchase:' || o.id::text)
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
            and coalesce(e.is_test, false) = false
            and (version_filter is null or coalesce(e.funnel_version, 'v3') = version_filter)
            and (campaign_filter is null or e.campaign_id = campaign_filter)
            and (adset_filter is null or e.adset_id = adset_filter)
            and (ad_filter is null or e.ad_id = ad_filter)
            and (creative_filter is null or e.creative_id = creative_filter or e.utm_content = creative_filter)
            and (source_filter is null or e.utm_source = source_filter)
            and (medium_filter is null or e.utm_medium = medium_filter)
        ),
        event_rollups as (
          select
            coalesce(nullif(btrim(e.creative_id), ''), nullif(btrim(e.utm_content), ''), 'unattributed') as creative_id,
            count(distinct e.funnel_session_id) filter (where e.event_name = 'v3_landing_view')::int as lpv,
            count(distinct e.funnel_session_id) filter (where e.event_name = 'v3_checkout_viewed')::int as checkout_viewed_count,
            count(distinct e.funnel_session_id) filter (where e.event_name = 'v3_begin_checkout')::int as checkout_count
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
        ),
        purchase_rollups as (
          select
            creative_id,
            count(distinct order_id)::int as purchase_count,
            coalesce(sum(revenue_cents), 0)::int as revenue_cents
          from confirmed
          group by 1
        )
        select
          er.creative_id,
          er.lpv,
          er.checkout_viewed_count,
          er.checkout_count,
          coalesce(pr.purchase_count, 0) as purchase_count,
          coalesce(pr.revenue_cents, 0) as revenue_cents
        from event_rollups er
        left join purchase_rollups pr using (creative_id)
        order by er.lpv desc
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

revoke all on function public.admin_pet_v3_dashboard_context(
  timestamptz, timestamptz, text, text, text, text, text, text, text
) from public, anon;
grant execute on function public.admin_pet_v3_dashboard_context(
  timestamptz, timestamptz, text, text, text, text, text, text, text
) to authenticated, service_role;

commit;
