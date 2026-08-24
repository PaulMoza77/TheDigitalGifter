-- Isolated V2 preview-funnel analytics and attempt log.
-- Does not alter pet_funnel_events, pet_orders, Stripe prices, or V1 RPCs.

begin;

create table if not exists public.pet_v2_funnel_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  funnel_session_id uuid not null,
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
  has_meta_click boolean not null default false,
  referrer_host text,
  client_event_id uuid,
  created_at timestamptz not null default now(),
  constraint pet_v2_funnel_events_name_chk check (
    event_name in (
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
    )
  ),
  constraint pet_v2_funnel_events_species_chk check (
    species is null or species in ('dog', 'cat', 'other')
  ),
  constraint pet_v2_funnel_events_path_chk check (
    pathname is null or pathname = '/pet-v2' or pathname like '/pet-v2/%'
  )
);

create unique index if not exists pet_v2_funnel_events_idempotency_uidx
  on public.pet_v2_funnel_events (idempotency_key);

create index if not exists pet_v2_funnel_events_created_idx
  on public.pet_v2_funnel_events (created_at desc);

create index if not exists pet_v2_funnel_events_name_created_idx
  on public.pet_v2_funnel_events (event_name, created_at desc);

alter table public.pet_v2_funnel_events enable row level security;

drop policy if exists pet_v2_funnel_events_admin_read on public.pet_v2_funnel_events;
create policy pet_v2_funnel_events_admin_read
  on public.pet_v2_funnel_events for select
  using (public.is_admin());

revoke all on table public.pet_v2_funnel_events from anon, authenticated, public;
grant select on table public.pet_v2_funnel_events to authenticated;
grant all on table public.pet_v2_funnel_events to service_role;

create table if not exists public.pet_v2_preview_attempts (
  id uuid primary key default gen_random_uuid(),
  session_id text,
  ip_hash text,
  image_hash text,
  species text,
  scene_key text not null default 'royal-portrait',
  live_generation boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists pet_v2_preview_attempts_created_idx
  on public.pet_v2_preview_attempts (created_at desc);

alter table public.pet_v2_preview_attempts enable row level security;
drop policy if exists pet_v2_preview_attempts_admin_read on public.pet_v2_preview_attempts;
create policy pet_v2_preview_attempts_admin_read
  on public.pet_v2_preview_attempts for select
  using (public.is_admin());

revoke all on table public.pet_v2_preview_attempts from anon, authenticated, public;
grant select on table public.pet_v2_preview_attempts to authenticated;
grant all on table public.pet_v2_preview_attempts to service_role;

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
  p_client_event_id uuid default null
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
  new_id uuid;
  clean_path text;
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
  if clean_path is not null and clean_path <> '/pet-v2' and left(clean_path, 8) <> '/pet-v2/' then
    clean_path := null;
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
    client_event_id
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
    p_client_event_id
  )
  on conflict (idempotency_key) do nothing
  returning id into new_id;

  return new_id;
end;
$$;

revoke all on function public.record_pet_v2_funnel_event(
  text, uuid, text, text, text, text, text, text, text, text, text, text, text, text, integer, boolean, text, uuid
) from public, anon, authenticated;
grant execute on function public.record_pet_v2_funnel_event(
  text, uuid, text, text, text, text, text, text, text, text, text, text, text, text, integer, boolean, text, uuid
) to service_role;

commit;
