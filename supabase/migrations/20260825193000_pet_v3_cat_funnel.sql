-- V3 cat preview funnel: isolated analytics, preview attempts, and order variant.

begin;

-- ---------------------------------------------------------------------------
-- pet_v3_funnel_events
-- ---------------------------------------------------------------------------
create table if not exists public.pet_v3_funnel_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  funnel_session_id uuid not null,
  idempotency_key text not null,
  species text not null default 'cat',
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
  has_meta_click boolean not null default false,
  referrer_host text,
  client_event_id uuid,
  is_test boolean not null default false,
  environment text,
  created_at timestamptz not null default now(),
  constraint pet_v3_funnel_events_name_chk check (
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
      'v3_begin_checkout',
      'v3_purchase'
    )
  ),
  constraint pet_v3_funnel_events_species_chk check (species = 'cat'),
  constraint pet_v3_funnel_events_path_chk check (
    pathname is null or pathname = '/pet/cat-v3'
  )
);

create unique index if not exists pet_v3_funnel_events_idempotency_uidx
  on public.pet_v3_funnel_events (idempotency_key);

create index if not exists pet_v3_funnel_events_created_idx
  on public.pet_v3_funnel_events (created_at desc);

create index if not exists pet_v3_funnel_events_name_created_idx
  on public.pet_v3_funnel_events (event_name, created_at desc);

alter table public.pet_v3_funnel_events enable row level security;

drop policy if exists pet_v3_funnel_events_admin_read on public.pet_v3_funnel_events;
create policy pet_v3_funnel_events_admin_read
  on public.pet_v3_funnel_events for select
  using (public.is_admin());

revoke all on table public.pet_v3_funnel_events from anon, authenticated, public;
grant select on table public.pet_v3_funnel_events to authenticated;
grant all on table public.pet_v3_funnel_events to service_role;

-- ---------------------------------------------------------------------------
-- pet_v3_preview_attempts (isolated from V2 dog preview quota)
-- ---------------------------------------------------------------------------
create table if not exists public.pet_v3_preview_attempts (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text,
  session_id text,
  ip_hash text,
  image_hash text,
  species text not null default 'cat',
  scene_key text not null default 'royal-portrait',
  live_generation boolean not null default false,
  prediction_id text,
  status text not null default 'pending',
  provider text,
  started_at timestamptz,
  completed_at timestamptz,
  last_error_category text,
  created_at timestamptz not null default now(),
  constraint pet_v3_preview_attempts_status_chk check (
    status in ('pending', 'processing', 'succeeded', 'failed')
  ),
  constraint pet_v3_preview_attempts_species_chk check (species = 'cat')
);

create unique index if not exists pet_v3_preview_attempts_idempotency_uidx
  on public.pet_v3_preview_attempts (idempotency_key)
  where idempotency_key is not null;

create index if not exists pet_v3_preview_attempts_session_status_idx
  on public.pet_v3_preview_attempts (session_id, status, created_at desc);

create index if not exists pet_v3_preview_attempts_created_idx
  on public.pet_v3_preview_attempts (created_at desc);

alter table public.pet_v3_preview_attempts enable row level security;

drop policy if exists pet_v3_preview_attempts_admin_read on public.pet_v3_preview_attempts;
create policy pet_v3_preview_attempts_admin_read
  on public.pet_v3_preview_attempts for select
  using (public.is_admin());

revoke all on table public.pet_v3_preview_attempts from anon, authenticated, public;
grant select on table public.pet_v3_preview_attempts to authenticated;
grant all on table public.pet_v3_preview_attempts to service_role;

-- ---------------------------------------------------------------------------
-- Order funnel variant: add v3
-- ---------------------------------------------------------------------------
alter table public.pet_orders drop constraint if exists pet_orders_funnel_variant_chk;
alter table public.pet_orders
  add constraint pet_orders_funnel_variant_chk
  check (funnel_variant in ('v1', 'v2', 'v3'));

comment on column public.pet_orders.funnel_variant is
  'Checkout funnel origin: v1 sequential, v2 dog preview, v3 cat preview.';

-- ---------------------------------------------------------------------------
-- Event failure dataset
-- ---------------------------------------------------------------------------
alter table public.pet_funnel_event_failures drop constraint if exists pet_funnel_event_failures_dataset_chk;
alter table public.pet_funnel_event_failures
  add constraint pet_funnel_event_failures_dataset_chk
  check (funnel_dataset is null or funnel_dataset in ('v1', 'v2', 'v3'));

-- ---------------------------------------------------------------------------
-- Campaign allowlist funnel variant
-- ---------------------------------------------------------------------------
alter table public.pet_meta_campaign_allowlist drop constraint if exists pet_meta_campaign_allowlist_variant_chk;
alter table public.pet_meta_campaign_allowlist
  add constraint pet_meta_campaign_allowlist_variant_chk
  check (funnel_variant is null or funnel_variant in ('v1', 'v2_preview', 'v3_cat_preview'));

-- ---------------------------------------------------------------------------
-- record_pet_v3_funnel_event
-- ---------------------------------------------------------------------------
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
  p_environment text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
  key text := left(btrim(coalesce(p_idempotency_key, '')), 180);
begin
  if length(key) < 8 then
    raise exception 'invalid_idempotency_key';
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
    environment
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
    public.pet_funnel_safe_text(p_environment, 32)
  )
  on conflict (idempotency_key) do nothing
  returning id into new_id;

  return new_id;
end;
$$;

revoke all on function public.record_pet_v3_funnel_event(
  text, uuid, text, text, text, text, text, text, text, text, text, text, text, text, integer, boolean, text, uuid, boolean, text
) from public, anon, authenticated;
grant execute on function public.record_pet_v3_funnel_event(
  text, uuid, text, text, text, text, text, text, text, text, text, text, text, text, integer, boolean, text, uuid, boolean, text
) to service_role;

-- ---------------------------------------------------------------------------
-- claim_pet_v3_preview_attempt
-- ---------------------------------------------------------------------------
create or replace function public.claim_pet_v3_preview_attempt(
  p_idempotency_key text,
  p_session_id text,
  p_ip_hash text,
  p_image_hash text,
  p_species text default 'cat',
  p_scene_key text default 'royal-portrait'
)
returns public.pet_v3_preview_attempts
language plpgsql
security definer
set search_path = public
as $$
declare
  existing public.pet_v3_preview_attempts%rowtype;
  inserted public.pet_v3_preview_attempts%rowtype;
  key text := left(btrim(coalesce(p_idempotency_key, '')), 180);
begin
  if length(key) < 8 then
    raise exception 'invalid_idempotency_key';
  end if;

  select * into existing
  from public.pet_v3_preview_attempts
  where idempotency_key = key
  limit 1;

  if found then
    return existing;
  end if;

  insert into public.pet_v3_preview_attempts (
    idempotency_key,
    session_id,
    ip_hash,
    image_hash,
    species,
    scene_key,
    live_generation,
    status,
    provider,
    started_at
  )
  values (
    key,
    left(coalesce(p_session_id, ''), 64),
    left(coalesce(p_ip_hash, ''), 128),
    left(coalesce(p_image_hash, ''), 64),
    'cat',
    coalesce(nullif(btrim(p_scene_key), ''), 'royal-portrait'),
    false,
    'pending',
    'replicate',
    now()
  )
  on conflict (idempotency_key) do nothing
  returning * into inserted;

  if inserted.id is not null then
    return inserted;
  end if;

  select * into existing
  from public.pet_v3_preview_attempts
  where idempotency_key = key
  limit 1;

  return existing;
end;
$$;

revoke all on function public.claim_pet_v3_preview_attempt(text, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.claim_pet_v3_preview_attempt(text, text, text, text, text, text)
  to service_role;

-- ---------------------------------------------------------------------------
-- Lightweight V3 step counts for admin dashboard
-- ---------------------------------------------------------------------------
create or replace function public.admin_pet_v3_funnel_step_counts(
  p_from timestamptz,
  p_to timestamptz
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
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
        and event_name in (
          'v3_landing_view', 'v3_upload_started', 'v3_upload_completed',
          'v3_preview_generation_started', 'v3_preview_generation_completed', 'v3_preview_generation_failed',
          'v3_preview_viewed', 'v3_offer_viewed', 'v3_unlock_clicked',
          'v3_begin_checkout', 'v3_purchase'
        )
      group by event_name
    ) s
  );
end;
$$;

revoke all on function public.admin_pet_v3_funnel_step_counts(timestamptz, timestamptz)
  from public, anon, authenticated;
grant execute on function public.admin_pet_v3_funnel_step_counts(timestamptz, timestamptz)
  to authenticated, service_role;

-- update_pet_v3_preview_attempt (mirrors V2)
create or replace function public.update_pet_v3_preview_attempt(
  p_idempotency_key text,
  p_status text,
  p_prediction_id text default null,
  p_live_generation boolean default null,
  p_last_error_category text default null,
  p_clear_prediction boolean default false
)
returns public.pet_v3_preview_attempts
language plpgsql
security definer
set search_path = public
as $$
declare
  updated public.pet_v3_preview_attempts%rowtype;
  key text := left(btrim(coalesce(p_idempotency_key, '')), 180);
  next_status text := left(btrim(coalesce(p_status, '')), 32);
begin
  if length(key) < 8 then
    raise exception 'invalid_idempotency_key';
  end if;
  if next_status not in ('pending', 'processing', 'succeeded', 'failed') then
    raise exception 'invalid_status';
  end if;

  update public.pet_v3_preview_attempts
  set
    status = next_status,
    prediction_id = case
      when coalesce(p_clear_prediction, false) then null
      when p_prediction_id is not null and length(btrim(p_prediction_id)) > 0
        then left(btrim(p_prediction_id), 80)
      else prediction_id
    end,
    live_generation = coalesce(p_live_generation, live_generation),
    last_error_category = case
      when next_status = 'failed' then left(btrim(coalesce(p_last_error_category, '')), 40)
      when next_status = 'succeeded' then null
      else last_error_category
    end,
    completed_at = case
      when next_status in ('succeeded', 'failed') then now()
      when next_status in ('pending', 'processing') then null
      else completed_at
    end,
    provider = coalesce(provider, 'replicate')
  where idempotency_key = key
  returning * into updated;

  if not found then
    raise exception 'attempt_not_found';
  end if;

  return updated;
end;
$$;

revoke all on function public.update_pet_v3_preview_attempt(text, text, text, boolean, text, boolean)
  from public, anon, authenticated;
grant execute on function public.update_pet_v3_preview_attempt(text, text, text, boolean, text, boolean)
  to service_role;

commit;
