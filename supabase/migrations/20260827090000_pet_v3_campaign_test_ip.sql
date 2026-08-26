-- V3: client IP test exclusion, Meta campaign context RPC, retroactive test cleanup.

begin;

alter table public.pet_v3_funnel_events
  add column if not exists client_ip text,
  add column if not exists client_ip_hostname text;

create index if not exists pet_v3_funnel_events_client_ip_created_idx
  on public.pet_v3_funnel_events (client_ip, created_at desc)
  where client_ip is not null;

-- Known internal test traffic (reverse-DNS suffix rentalcarsoradea).
update public.pet_v3_funnel_events
set is_test = true
where coalesce(is_test, false) = false
  and client_ip_hostname is not null
  and lower(client_ip_hostname) like '%rentalcarsoradea%';

create or replace function public.record_pet_v3_funnel_event(
  p_event_name text,
  p_funnel_session_id uuid,
  p_idempotency_key text,
  p_species text default 'cat',
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
  p_funnel_version text default 'v3',
  p_creative_id text default null,
  p_fbc text default null,
  p_fbp text default null,
  p_client_ip text default null,
  p_client_ip_hostname text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
  key text := left(btrim(coalesce(p_idempotency_key, '')), 180);
  version text := lower(btrim(coalesce(p_funnel_version, 'v3')));
begin
  if length(key) < 8 then
    raise exception 'invalid_idempotency_key';
  end if;
  if version not in ('v3', 'unknown') then
    version := 'v3';
  end if;

  insert into public.pet_v3_funnel_events (
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
    funnel_version,
    creative_id,
    fbc,
    fbp,
    client_ip,
    client_ip_hostname
  )
  values (
    p_event_name,
    p_funnel_session_id,
    key,
    coalesce(nullif(btrim(p_species), ''), 'cat'),
    public.pet_funnel_safe_text(p_utm_source, 120),
    public.pet_funnel_safe_text(p_utm_medium, 120),
    public.pet_funnel_safe_text(p_utm_campaign, 120),
    public.pet_funnel_safe_text(p_utm_content, 120),
    public.pet_funnel_safe_text(p_utm_term, 120),
    public.pet_funnel_safe_text(p_campaign_id, 64),
    public.pet_funnel_safe_text(p_adset_id, 64),
    public.pet_funnel_safe_text(p_ad_id, 64),
    public.pet_funnel_safe_text(p_device_type, 16),
    case when p_pathname = '/pet/cat-v3' then p_pathname else null end,
    p_amount_cents,
    coalesce(p_has_meta_click, false),
    public.pet_funnel_safe_text(p_referrer_host, 120),
    p_client_event_id,
    coalesce(p_is_test, false),
    public.pet_funnel_safe_text(p_environment, 32),
    version,
    public.pet_funnel_safe_text(p_creative_id, 120),
    public.pet_funnel_safe_text(p_fbc, 200),
    public.pet_funnel_safe_text(p_fbp, 200),
    public.pet_funnel_safe_text(p_client_ip, 64),
    public.pet_funnel_safe_text(p_client_ip_hostname, 200)
  )
  on conflict (idempotency_key) do nothing
  returning id into new_id;

  return new_id;
end;
$$;

revoke all on function public.record_pet_v3_funnel_event(
  text, uuid, text, text, text, text, text, text, text, text, text, text, text, text, integer, boolean, text, uuid, boolean, text, text, text, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.record_pet_v3_funnel_event(
  text, uuid, text, text, text, text, text, text, text, text, text, text, text, text, integer, boolean, text, uuid, boolean, text, text, text, text, text, text, text
) to service_role;

create or replace function public.admin_pet_v3_meta_context(
  p_from timestamptz,
  p_to timestamptz,
  p_campaign_id text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  campaign_filter text := nullif(btrim(coalesce(p_campaign_id, '')), '');
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if campaign_filter is null then
    return jsonb_build_object(
      'row_count', 0,
      'last_synced_at', (
        select max(finished_at)
        from public.pet_analytics_sync_runs
        where source = 'meta' and status = 'success'
      ),
      'totals', jsonb_build_object(),
      'daily', '[]'::jsonb,
      'campaigns', '[]'::jsonb,
      'ads', '[]'::jsonb
    );
  end if;

  return (
    with meta_range as (
      select *
      from public.pet_meta_daily_metrics m
      where m.metric_date >= (p_from at time zone 'UTC')::date
        and m.metric_date < (p_to at time zone 'UTC')::date
        and m.campaign_id = campaign_filter
        and exists (
          select 1
          from public.pet_meta_campaign_allowlist a
          where a.enabled and a.campaign_id = m.campaign_id
        )
    ),
    meta_totals as (
      select
        coalesce(sum(spend_cents), 0)::bigint as spend_cents,
        coalesce(sum(impressions), 0)::bigint as impressions,
        coalesce(sum(link_clicks), 0)::bigint as link_clicks,
        coalesce(sum(landing_page_views), 0)::bigint as landing_page_views,
        coalesce(sum(initiate_checkouts), 0)::bigint as initiate_checkouts,
        coalesce(sum(purchases), 0)::bigint as purchases,
        coalesce(sum(purchase_value_cents), 0)::bigint as purchase_value_cents,
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
        coalesce(sum(spend_cents), 0)::bigint as spend_cents,
        coalesce(sum(impressions), 0)::bigint as impressions,
        coalesce(sum(link_clicks), 0)::bigint as link_clicks,
        coalesce(sum(landing_page_views), 0)::bigint as landing_page_views,
        coalesce(sum(initiate_checkouts), 0)::bigint as initiate_checkouts,
        coalesce(sum(purchases), 0)::bigint as purchases,
        coalesce(sum(purchase_value_cents), 0)::bigint as purchase_value_cents
      from meta_range
      group by campaign_id
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
    )
    select jsonb_build_object(
      'row_count', (select row_count from meta_totals),
      'last_synced_at', (
        select max(finished_at)
        from public.pet_analytics_sync_runs
        where source = 'meta' and status = 'success'
      ),
      'totals', (select to_jsonb(meta_totals) - 'row_count' from meta_totals),
      'daily', coalesce((select jsonb_agg(meta_daily) from meta_daily), '[]'::jsonb),
      'campaigns', coalesce((select jsonb_agg(meta_campaigns) from meta_campaigns), '[]'::jsonb),
      'ads', coalesce((select jsonb_agg(meta_ads) from meta_ads), '[]'::jsonb)
    )
  );
end;
$$;

revoke all on function public.admin_pet_v3_meta_context(timestamptz, timestamptz, text)
  from public, anon;
grant execute on function public.admin_pet_v3_meta_context(timestamptz, timestamptz, text)
  to authenticated, service_role;

commit;
