-- First-party My Pet's Secret Life funnel analytics.
-- Public users can insert only through a whitelisted RPC.
-- Admins can read aggregated reports. Anon cannot select rows.

begin;

create table if not exists public.pet_funnel_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  funnel_session_id uuid not null,
  order_id uuid references public.pet_orders (id) on delete set null,
  idempotency_key text not null,
  species text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  campaign_id text,
  adset_id text,
  ad_id text,
  device_type text,
  pathname text,
  amount_cents integer,
  created_at timestamptz not null default now(),
  constraint pet_funnel_events_name_chk check (
    event_name in (
      'landing_view',
      'pet_name_submitted',
      'photo_upload_completed',
      'order_review_viewed',
      'initiate_checkout',
      'purchase',
      'photo_upload_started',
      'pet_details_completed',
      'checkout_error'
    )
  ),
  constraint pet_funnel_events_species_chk check (
    species is null or species in ('dog', 'cat', 'other')
  ),
  constraint pet_funnel_events_device_chk check (
    device_type is null or device_type in ('mobile', 'tablet', 'desktop')
  ),
  constraint pet_funnel_events_amount_chk check (
    amount_cents is null or amount_cents >= 0
  )
);

create unique index if not exists pet_funnel_events_idempotency_uidx
  on public.pet_funnel_events (idempotency_key);

create index if not exists pet_funnel_events_created_idx
  on public.pet_funnel_events (created_at desc);

create index if not exists pet_funnel_events_name_created_idx
  on public.pet_funnel_events (event_name, created_at desc);

create index if not exists pet_funnel_events_session_idx
  on public.pet_funnel_events (funnel_session_id, created_at desc);

create index if not exists pet_funnel_events_order_idx
  on public.pet_funnel_events (order_id)
  where order_id is not null;

create index if not exists pet_funnel_events_campaign_idx
  on public.pet_funnel_events (campaign_id)
  where campaign_id is not null;

create index if not exists pet_funnel_events_adset_idx
  on public.pet_funnel_events (adset_id)
  where adset_id is not null;

create index if not exists pet_funnel_events_ad_idx
  on public.pet_funnel_events (ad_id)
  where ad_id is not null;

alter table public.pet_funnel_events enable row level security;

drop policy if exists pet_funnel_events_admin_read on public.pet_funnel_events;
create policy pet_funnel_events_admin_read
  on public.pet_funnel_events for select
  using (public.is_admin());

revoke all on table public.pet_funnel_events from anon, authenticated, public;
grant select on table public.pet_funnel_events to authenticated;
grant all on table public.pet_funnel_events to service_role;

create or replace function public.pet_funnel_safe_text(p_value text, p_max integer default 200)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  trimmed text;
begin
  trimmed := left(btrim(coalesce(p_value, '')), greatest(p_max, 1));
  if trimmed = '' then
    return null;
  end if;
  if trimmed ~ '[<>]' then
    return null;
  end if;
  if position('@' in trimmed) > 0 then
    return null;
  end if;
  if trimmed ~* '^https?:' then
    return null;
  end if;
  return trimmed;
end;
$$;

create or replace function public.record_pet_funnel_event(
  p_event_name text,
  p_funnel_session_id uuid,
  p_idempotency_key text,
  p_order_id uuid default null,
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
  p_amount_cents integer default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  allowed constant text[] := array[
    'landing_view',
    'pet_name_submitted',
    'photo_upload_completed',
    'order_review_viewed',
    'initiate_checkout',
    'purchase',
    'photo_upload_started',
    'pet_details_completed',
    'checkout_error'
  ];
  clean_path text;
  new_id uuid;
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

  clean_path := public.pet_funnel_safe_text(split_part(coalesce(p_pathname, ''), '?', 1), 64);
  if clean_path is not null and left(clean_path, 5) <> '/pet/' then
    clean_path := null;
  end if;

  insert into public.pet_funnel_events (
    event_name,
    funnel_session_id,
    order_id,
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
    amount_cents
  )
  values (
    p_event_name,
    p_funnel_session_id,
    p_order_id,
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
    case when p_amount_cents is not null and p_amount_cents >= 0 then p_amount_cents else null end
  )
  on conflict (idempotency_key) do nothing
  returning id into new_id;

  return new_id;
end;
$$;

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
  )
  select jsonb_build_object(
    'first_event_at', (select first_at from first_event),
    'steps', coalesce((select jsonb_agg(step_counts) from step_counts), '[]'::jsonb),
    'previous_steps', coalesce((select jsonb_agg(prev_step_counts) from prev_step_counts), '[]'::jsonb),
    'revenue_cents', (select revenue_cents from revenue),
    'previous_revenue_cents', (select revenue_cents from prev_revenue),
    'campaigns', coalesce((select jsonb_agg(campaign_rollups) from campaign_rollups), '[]'::jsonb),
    'ads', coalesce((select jsonb_agg(ad_rollups) from ad_rollups), '[]'::jsonb),
    'species', coalesce((select jsonb_agg(species_rollups) from species_rollups), '[]'::jsonb),
    'devices', coalesce((select jsonb_agg(device_rollups) from device_rollups), '[]'::jsonb),
    'recent', coalesce((select jsonb_agg(recent_rows) from recent_rows), '[]'::jsonb)
  )
  into report;

  return report;
end;
$$;

revoke all on function public.pet_funnel_safe_text(text, integer) from public;
grant execute on function public.pet_funnel_safe_text(text, integer) to service_role;

revoke all on function public.record_pet_funnel_event(
  text, uuid, text, uuid, text, text, text, text, text, text, text, text, text, text, text, integer
) from public;
grant execute on function public.record_pet_funnel_event(
  text, uuid, text, uuid, text, text, text, text, text, text, text, text, text, text, text, integer
) to anon, authenticated, service_role;

revoke all on function public.admin_pet_funnel_analytics(timestamptz, timestamptz, timestamptz, timestamptz) from public, anon;
grant execute on function public.admin_pet_funnel_analytics(timestamptz, timestamptz, timestamptz, timestamptz)
  to authenticated, service_role;

commit;
