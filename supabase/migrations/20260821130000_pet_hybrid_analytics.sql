-- Hybrid Pet funnel analytics: Meta Ads + GA4 sync tables + backend truth in admin RPC.
-- Additive only. Does not change checkout, pricing, pixels, or public funnel.

begin;

-- ---------------------------------------------------------------------------
-- Meta Ads daily metrics (ad-level grain; campaign/adset names denormalized)
-- ---------------------------------------------------------------------------

create table if not exists public.pet_meta_daily_metrics (
  id uuid primary key default gen_random_uuid(),
  metric_date date not null,
  campaign_id text not null default '',
  campaign_name text not null default '',
  adset_id text not null default '',
  adset_name text not null default '',
  ad_id text not null default '',
  ad_name text not null default '',
  spend_cents integer not null default 0,
  impressions bigint not null default 0,
  reach bigint not null default 0,
  link_clicks bigint not null default 0,
  outbound_clicks bigint not null default 0,
  landing_page_views bigint not null default 0,
  initiate_checkouts bigint not null default 0,
  purchases bigint not null default 0,
  purchase_value_cents integer not null default 0,
  -- Optional historical custom events when Meta Insights exposes them truthfully.
  pet_name_submitted bigint,
  photo_upload_completed bigint,
  order_review_viewed bigint,
  pet_details_completed bigint,
  cpc_cents integer,
  ctr_bps integer,
  cpm_cents integer,
  synced_at timestamptz not null default now(),
  constraint pet_meta_daily_metrics_spend_chk check (spend_cents >= 0),
  constraint pet_meta_daily_metrics_purchase_value_chk check (purchase_value_cents >= 0)
);

create unique index if not exists pet_meta_daily_metrics_grain_uidx
  on public.pet_meta_daily_metrics (
    metric_date,
    campaign_id,
    adset_id,
    ad_id
  );

create index if not exists pet_meta_daily_metrics_date_idx
  on public.pet_meta_daily_metrics (metric_date desc);

create index if not exists pet_meta_daily_metrics_campaign_idx
  on public.pet_meta_daily_metrics (campaign_id, metric_date desc);

create index if not exists pet_meta_daily_metrics_ad_idx
  on public.pet_meta_daily_metrics (ad_id, metric_date desc);

alter table public.pet_meta_daily_metrics enable row level security;

drop policy if exists pet_meta_daily_metrics_admin_read on public.pet_meta_daily_metrics;
create policy pet_meta_daily_metrics_admin_read
  on public.pet_meta_daily_metrics for select
  using (public.is_admin());

revoke all on table public.pet_meta_daily_metrics from anon, authenticated, public;
grant select on table public.pet_meta_daily_metrics to authenticated;
grant all on table public.pet_meta_daily_metrics to service_role;

-- ---------------------------------------------------------------------------
-- GA4 daily aggregated metrics (no PII)
-- ---------------------------------------------------------------------------

create table if not exists public.pet_ga4_daily_metrics (
  id uuid primary key default gen_random_uuid(),
  metric_date date not null,
  source text not null default '(not set)',
  medium text not null default '(not set)',
  campaign text not null default '(not set)',
  device_category text not null default '(not set)',
  country text not null default '(not set)',
  sessions bigint not null default 0,
  total_users bigint not null default 0,
  screen_page_views bigint not null default 0,
  landing_views bigint not null default 0,
  pet_name_submitted bigint,
  photo_upload_completed bigint,
  order_review_viewed bigint,
  begin_checkouts bigint not null default 0,
  purchases bigint not null default 0,
  purchase_revenue_cents integer not null default 0,
  synced_at timestamptz not null default now(),
  constraint pet_ga4_daily_metrics_revenue_chk check (purchase_revenue_cents >= 0)
);

create unique index if not exists pet_ga4_daily_metrics_grain_uidx
  on public.pet_ga4_daily_metrics (
    metric_date,
    source,
    medium,
    campaign,
    device_category,
    country
  );

create index if not exists pet_ga4_daily_metrics_date_idx
  on public.pet_ga4_daily_metrics (metric_date desc);

alter table public.pet_ga4_daily_metrics enable row level security;

drop policy if exists pet_ga4_daily_metrics_admin_read on public.pet_ga4_daily_metrics;
create policy pet_ga4_daily_metrics_admin_read
  on public.pet_ga4_daily_metrics for select
  using (public.is_admin());

revoke all on table public.pet_ga4_daily_metrics from anon, authenticated, public;
grant select on table public.pet_ga4_daily_metrics to authenticated;
grant all on table public.pet_ga4_daily_metrics to service_role;

-- ---------------------------------------------------------------------------
-- Sync run ledger (status only; never store tokens)
-- ---------------------------------------------------------------------------

create table if not exists public.pet_analytics_sync_runs (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  mode text not null,
  range_from date,
  range_to date,
  status text not null,
  rows_upserted integer not null default 0,
  error_message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  constraint pet_analytics_sync_runs_source_chk check (source in ('meta', 'ga4')),
  constraint pet_analytics_sync_runs_mode_chk check (
    mode in ('historical', 'today', 'yesterday', 'range')
  ),
  constraint pet_analytics_sync_runs_status_chk check (
    status in ('running', 'success', 'error', 'skipped_unconfigured')
  )
);

create index if not exists pet_analytics_sync_runs_source_started_idx
  on public.pet_analytics_sync_runs (source, started_at desc);

alter table public.pet_analytics_sync_runs enable row level security;

drop policy if exists pet_analytics_sync_runs_admin_read on public.pet_analytics_sync_runs;
create policy pet_analytics_sync_runs_admin_read
  on public.pet_analytics_sync_runs for select
  using (public.is_admin());

revoke all on table public.pet_analytics_sync_runs from anon, authenticated, public;
grant select on table public.pet_analytics_sync_runs to authenticated;
grant all on table public.pet_analytics_sync_runs to service_role;

-- Idempotent upsert helpers (service_role only)
create or replace function public.upsert_pet_meta_daily_metrics(p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  upserted integer := 0;
begin
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    return 0;
  end if;

  insert into public.pet_meta_daily_metrics (
    metric_date, campaign_id, campaign_name, adset_id, adset_name, ad_id, ad_name,
    spend_cents, impressions, reach, link_clicks, outbound_clicks, landing_page_views,
    initiate_checkouts, purchases, purchase_value_cents,
    pet_name_submitted, photo_upload_completed, order_review_viewed, pet_details_completed,
    cpc_cents, ctr_bps, cpm_cents, synced_at
  )
  select
    (row->>'metric_date')::date,
    coalesce(row->>'campaign_id', ''),
    coalesce(row->>'campaign_name', ''),
    coalesce(row->>'adset_id', ''),
    coalesce(row->>'adset_name', ''),
    coalesce(row->>'ad_id', ''),
    coalesce(row->>'ad_name', ''),
    greatest(coalesce((row->>'spend_cents')::integer, 0), 0),
    greatest(coalesce((row->>'impressions')::bigint, 0), 0),
    greatest(coalesce((row->>'reach')::bigint, 0), 0),
    greatest(coalesce((row->>'link_clicks')::bigint, 0), 0),
    greatest(coalesce((row->>'outbound_clicks')::bigint, 0), 0),
    greatest(coalesce((row->>'landing_page_views')::bigint, 0), 0),
    greatest(coalesce((row->>'initiate_checkouts')::bigint, 0), 0),
    greatest(coalesce((row->>'purchases')::bigint, 0), 0),
    greatest(coalesce((row->>'purchase_value_cents')::integer, 0), 0),
    case when row ? 'pet_name_submitted' then (row->>'pet_name_submitted')::bigint else null end,
    case when row ? 'photo_upload_completed' then (row->>'photo_upload_completed')::bigint else null end,
    case when row ? 'order_review_viewed' then (row->>'order_review_viewed')::bigint else null end,
    case when row ? 'pet_details_completed' then (row->>'pet_details_completed')::bigint else null end,
    case when row ? 'cpc_cents' then (row->>'cpc_cents')::integer else null end,
    case when row ? 'ctr_bps' then (row->>'ctr_bps')::integer else null end,
    case when row ? 'cpm_cents' then (row->>'cpm_cents')::integer else null end,
    now()
  from jsonb_array_elements(p_rows) as row
  on conflict (metric_date, campaign_id, adset_id, ad_id) do update set
    campaign_name = excluded.campaign_name,
    adset_name = excluded.adset_name,
    ad_name = excluded.ad_name,
    spend_cents = excluded.spend_cents,
    impressions = excluded.impressions,
    reach = excluded.reach,
    link_clicks = excluded.link_clicks,
    outbound_clicks = excluded.outbound_clicks,
    landing_page_views = excluded.landing_page_views,
    initiate_checkouts = excluded.initiate_checkouts,
    purchases = excluded.purchases,
    purchase_value_cents = excluded.purchase_value_cents,
    pet_name_submitted = excluded.pet_name_submitted,
    photo_upload_completed = excluded.photo_upload_completed,
    order_review_viewed = excluded.order_review_viewed,
    pet_details_completed = excluded.pet_details_completed,
    cpc_cents = excluded.cpc_cents,
    ctr_bps = excluded.ctr_bps,
    cpm_cents = excluded.cpm_cents,
    synced_at = now();

  get diagnostics upserted = row_count;
  return upserted;
end;
$$;

create or replace function public.upsert_pet_ga4_daily_metrics(p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  upserted integer := 0;
begin
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    return 0;
  end if;

  insert into public.pet_ga4_daily_metrics (
    metric_date, source, medium, campaign, device_category, country,
    sessions, total_users, screen_page_views, landing_views,
    pet_name_submitted, photo_upload_completed, order_review_viewed,
    begin_checkouts, purchases, purchase_revenue_cents, synced_at
  )
  select
    (row->>'metric_date')::date,
    coalesce(nullif(row->>'source', ''), '(not set)'),
    coalesce(nullif(row->>'medium', ''), '(not set)'),
    coalesce(nullif(row->>'campaign', ''), '(not set)'),
    coalesce(nullif(row->>'device_category', ''), '(not set)'),
    coalesce(nullif(row->>'country', ''), '(not set)'),
    greatest(coalesce((row->>'sessions')::bigint, 0), 0),
    greatest(coalesce((row->>'total_users')::bigint, 0), 0),
    greatest(coalesce((row->>'screen_page_views')::bigint, 0), 0),
    greatest(coalesce((row->>'landing_views')::bigint, 0), 0),
    case when row ? 'pet_name_submitted' then (row->>'pet_name_submitted')::bigint else null end,
    case when row ? 'photo_upload_completed' then (row->>'photo_upload_completed')::bigint else null end,
    case when row ? 'order_review_viewed' then (row->>'order_review_viewed')::bigint else null end,
    greatest(coalesce((row->>'begin_checkouts')::bigint, 0), 0),
    greatest(coalesce((row->>'purchases')::bigint, 0), 0),
    greatest(coalesce((row->>'purchase_revenue_cents')::integer, 0), 0),
    now()
  from jsonb_array_elements(p_rows) as row
  on conflict (metric_date, source, medium, campaign, device_category, country) do update set
    sessions = excluded.sessions,
    total_users = excluded.total_users,
    screen_page_views = excluded.screen_page_views,
    landing_views = excluded.landing_views,
    pet_name_submitted = excluded.pet_name_submitted,
    photo_upload_completed = excluded.photo_upload_completed,
    order_review_viewed = excluded.order_review_viewed,
    begin_checkouts = excluded.begin_checkouts,
    purchases = excluded.purchases,
    purchase_revenue_cents = excluded.purchase_revenue_cents,
    synced_at = now();

  get diagnostics upserted = row_count;
  return upserted;
end;
$$;

revoke all on function public.upsert_pet_meta_daily_metrics(jsonb) from public, anon, authenticated;
grant execute on function public.upsert_pet_meta_daily_metrics(jsonb) to service_role;

revoke all on function public.upsert_pet_ga4_daily_metrics(jsonb) from public, anon, authenticated;
grant execute on function public.upsert_pet_ga4_daily_metrics(jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- Extended admin analytics RPC (hybrid sources)
-- ---------------------------------------------------------------------------

create or replace function public.admin_pet_funnel_analytics(
  p_from timestamptz,
  p_to timestamptz,
  p_prev_from timestamptz,
  p_prev_to timestamptz
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  report jsonb;
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  with
  first_event as (
    select min(created_at) as first_at from public.pet_funnel_events
  ),
  current_rows as (
    select *
    from public.pet_funnel_events
    where created_at >= p_from
      and created_at < p_to
  ),
  previous_rows as (
    select *
    from public.pet_funnel_events
    where created_at >= p_prev_from
      and created_at < p_prev_to
  ),
  step_counts as (
    select event_name, count(distinct funnel_session_id)::int as unique_sessions, count(*)::int as event_count
    from current_rows
    where event_name in (
      'landing_view', 'pet_name_submitted', 'photo_upload_completed',
      'order_review_viewed', 'initiate_checkout', 'purchase'
    )
    group by event_name
  ),
  prev_step_counts as (
    select event_name, count(distinct funnel_session_id)::int as unique_sessions, count(*)::int as event_count
    from previous_rows
    where event_name in (
      'landing_view', 'pet_name_submitted', 'photo_upload_completed',
      'order_review_viewed', 'initiate_checkout', 'purchase'
    )
    group by event_name
  ),
  revenue as (
    select coalesce(sum(amount_cents), 0)::int as revenue_cents
    from (
      select distinct on (order_id) amount_cents
      from current_rows
      where event_name = 'purchase'
        and order_id is not null
        and coalesce(amount_cents, 0) > 0
      order by order_id, created_at
    ) paid
  ),
  prev_revenue as (
    select coalesce(sum(amount_cents), 0)::int as revenue_cents
    from (
      select distinct on (order_id) amount_cents
      from previous_rows
      where event_name = 'purchase'
        and order_id is not null
        and coalesce(amount_cents, 0) > 0
      order by order_id, created_at
    ) paid
  ),
  -- Stripe / Supabase source-of-truth for money stages
  backend_current as (
    select
      (
        select count(*)::int
        from public.pet_orders o
        where o.paid_at is not null
          and o.paid_at >= p_from
          and o.paid_at < p_to
          and coalesce(o.status, '') <> 'refunded'
      ) as purchases,
      (
        select coalesce(sum(coalesce(o.charged_amount_cents, o.amount_cents)), 0)::int
        from public.pet_orders o
        where o.paid_at is not null
          and o.paid_at >= p_from
          and o.paid_at < p_to
          and coalesce(o.status, '') <> 'refunded'
      ) as revenue_cents,
      (
        select count(distinct cs.order_id)::int
        from public.pet_checkout_sessions cs
        where cs.created_at >= p_from
          and cs.created_at < p_to
      ) as checkouts
  ),
  backend_previous as (
    select
      (
        select count(*)::int
        from public.pet_orders o
        where o.paid_at is not null
          and o.paid_at >= p_prev_from
          and o.paid_at < p_prev_to
          and coalesce(o.status, '') <> 'refunded'
      ) as purchases,
      (
        select coalesce(sum(coalesce(o.charged_amount_cents, o.amount_cents)), 0)::int
        from public.pet_orders o
        where o.paid_at is not null
          and o.paid_at >= p_prev_from
          and o.paid_at < p_prev_to
          and coalesce(o.status, '') <> 'refunded'
      ) as revenue_cents,
      (
        select count(distinct cs.order_id)::int
        from public.pet_checkout_sessions cs
        where cs.created_at >= p_prev_from
          and cs.created_at < p_prev_to
      ) as checkouts
  ),
  meta_range as (
    select *
    from public.pet_meta_daily_metrics m
    where m.metric_date >= (p_from at time zone 'UTC')::date
      and m.metric_date < (p_to at time zone 'UTC')::date
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
      *,
      case
        when campaign_id is not null
          or lower(coalesce(utm_source, '')) in ('facebook', 'fb', 'instagram', 'ig', 'an', 'msg', 'meta', 'paid_social')
          then 'meta'
        when utm_source is not null then 'other'
        else 'unattributed'
      end as source_group,
      coalesce(nullif(utm_campaign, ''), nullif(campaign_id, ''), nullif(utm_source, ''), 'Direct / Organic / Unknown') as campaign_label,
      coalesce(nullif(utm_term, ''), nullif(adset_id, ''), '—') as adset_label,
      coalesce(nullif(utm_content, ''), nullif(ad_id, ''), '—') as ad_label
    from current_rows
  ),
  campaign_rollups as (
    select
      case when source_group = 'unattributed' then 'Direct / Organic / Unknown' else campaign_label end as campaign,
      case when source_group = 'unattributed' then '—' else max(adset_label) end as ad_set,
      case when source_group = 'unattributed' then '—' else max(ad_label) end as ad,
      source_group,
      max(campaign_id) as campaign_id,
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
      max(campaign_id) as campaign_id,
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
  species_rollups as (
    select
      coalesce(species, 'dog') as species,
      count(distinct funnel_session_id) filter (where event_name = 'landing_view')::int as lpv,
      count(distinct funnel_session_id) filter (where event_name = 'initiate_checkout')::int as checkout_count,
      count(distinct funnel_session_id) filter (where event_name = 'purchase')::int as purchase_count,
      coalesce(sum(amount_cents) filter (where event_name = 'purchase'), 0)::int as revenue_cents
    from current_rows
    group by 1
  ),
  device_rollups as (
    select
      coalesce(device_type, 'unknown') as device_type,
      count(distinct funnel_session_id) filter (where event_name = 'landing_view')::int as lpv,
      count(distinct funnel_session_id) filter (where event_name = 'initiate_checkout')::int as checkout_count,
      count(distinct funnel_session_id) filter (where event_name = 'purchase')::int as purchase_count
    from current_rows
    group by 1
  ),
  recent_rows as (
    select
      created_at,
      event_name,
      species,
      left(funnel_session_id::text, 8) as session_short,
      amount_cents
    from current_rows
    where event_name in (
      'landing_view', 'pet_name_submitted', 'photo_upload_completed',
      'order_review_viewed', 'initiate_checkout', 'purchase'
    )
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
      (o.paid_at at time zone 'UTC')::date as metric_date,
      count(*)::int as purchases,
      coalesce(sum(coalesce(o.charged_amount_cents, o.amount_cents)), 0)::int as revenue_cents
    from public.pet_orders o
    where o.paid_at is not null
      and o.paid_at >= p_from
      and o.paid_at < p_to
      and coalesce(o.status, '') <> 'refunded'
    group by 1
    order by 1
  ),
  checkout_daily as (
    select
      (cs.created_at at time zone 'UTC')::date as metric_date,
      count(distinct cs.order_id)::int as checkouts
    from public.pet_checkout_sessions cs
    where cs.created_at >= p_from
      and cs.created_at < p_to
    group by 1
    order by 1
  )
  select jsonb_build_object(
    'first_event_at', (select first_at from first_event),
    'first_party_tracking_started_at', (select first_at from first_event),
    'steps', coalesce((select jsonb_agg(step_counts) from step_counts), '[]'::jsonb),
    'previous_steps', coalesce((select jsonb_agg(prev_step_counts) from prev_step_counts), '[]'::jsonb),
    'revenue_cents', (select revenue_cents from revenue),
    'previous_revenue_cents', (select revenue_cents from prev_revenue),
    'campaigns', coalesce((select jsonb_agg(campaign_rollups) from campaign_rollups), '[]'::jsonb),
    'ads', coalesce((select jsonb_agg(ad_rollups) from ad_rollups), '[]'::jsonb),
    'species', coalesce((select jsonb_agg(species_rollups) from species_rollups), '[]'::jsonb),
    'devices', coalesce((select jsonb_agg(device_rollups) from device_rollups), '[]'::jsonb),
    'recent', coalesce((select jsonb_agg(recent_rows) from recent_rows), '[]'::jsonb),
    'backend', jsonb_build_object(
      'purchases', (select purchases from backend_current),
      'revenue_cents', (select revenue_cents from backend_current),
      'checkouts', (select checkouts from backend_current),
      'previous_purchases', (select purchases from backend_previous),
      'previous_revenue_cents', (select revenue_cents from backend_previous),
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
      'ads', coalesce((select jsonb_agg(meta_ads) from meta_ads), '[]'::jsonb)
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

revoke all on function public.admin_pet_funnel_analytics(timestamptz, timestamptz, timestamptz, timestamptz) from public, anon;
grant execute on function public.admin_pet_funnel_analytics(timestamptz, timestamptz, timestamptz, timestamptz)
  to authenticated, service_role;

commit;
