-- Christmas Santa Voice Call (AI realtime conversation).
-- Extends christmas commerce; does not alter pet or portrait prices.
-- Product purchasable flag / CHRISTMAS_LIVE_PRODUCTS gate launch.

begin;

-- ---------------------------------------------------------------------------
-- Product type + catalog
-- ---------------------------------------------------------------------------
alter table public.christmas_products
  drop constraint if exists christmas_products_type_chk;

alter table public.christmas_products
  add constraint christmas_products_type_chk check (
    product_type in (
      'photo_generator',
      'santa_video',
      'santa_voice_call',
      'card',
      'tree',
      'advent',
      'wishlist',
      'gift_finder',
      'messages',
      'planner',
      'hub',
      'send_a_gift',
      'other'
    )
  );

insert into public.christmas_products (
  product_key, slug, product_type, name, description,
  active, public_discoverable, sort_order, route_path, metadata
)
values (
  'christmas_santa_voice_call',
  'santa-call',
  'santa_voice_call',
  'Call Santa Claus',
  'A magical 3-minute realtime voice conversation with AI Santa Claus.',
  true,
  true,
  65,
  '/christmas/santa-call',
  jsonb_build_object(
    'foundation', true,
    'live_offer', false,
    'privacy_required', true,
    'santa_voice_call_v1', true,
    'ai_disclosure', true,
    'max_duration_seconds', 180,
    'access_ttl_days', 30,
    'checkout_live', false
  )
)
on conflict (product_key) do update set
  name = excluded.name,
  description = excluded.description,
  product_type = excluded.product_type,
  route_path = excluded.route_path,
  metadata = coalesce(public.christmas_products.metadata, '{}'::jsonb) || excluded.metadata,
  updated_at = now();

insert into public.christmas_packages (
  product_id, package_key, package_name, description,
  currency, price_cents, compare_at_cents, active, purchasable, features, sort_order, metadata
)
select
  p.id,
  'single',
  'Call Santa — 3 minutes',
  'One private AI Santa voice call (up to 180 seconds).',
  'ron',
  9900,
  null,
  true,
  false,
  '["3-minute AI Santa voice call","Romanian or English","Private access link"]'::jsonb,
  10,
  jsonb_build_object(
    'live_offer', false,
    'note', 'Authoritative web price lives in pricing_items; package purchasable stays false until launch flag.'
  )
from public.christmas_products p
where p.product_key = 'christmas_santa_voice_call'
  and not exists (
    select 1 from public.christmas_packages x
    where x.product_id = p.id and x.package_key = 'single'
  );

-- Authoritative commercial offer (checkout fails closed without this row).
insert into public.pricing_items (
  key, name, category, price_cents, currency, credits, active, is_active, is_featured, sort_order, metadata
)
values (
  'xmas_santa_voice_call',
  'Call Santa Claus',
  'christmas_offer',
  9900,
  'ron',
  300,
  true,
  true,
  false,
  25,
  jsonb_build_object(
    'web_price_minor', 9900,
    'web_currency', 'ron',
    'web_checkout_enabled', true,
    'app_credits_cost', 300,
    'product_type', 'santa_voice_call',
    'max_duration_seconds', 180,
    'enabled', true
  )
)
on conflict (key) do update set
  name = excluded.name,
  category = excluded.category,
  price_cents = excluded.price_cents,
  currency = excluded.currency,
  credits = excluded.credits,
  active = excluded.active,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order,
  metadata = coalesce(public.pricing_items.metadata, '{}'::jsonb) || excluded.metadata,
  updated_at = now();

-- Email delivery kinds (commerce table if present)
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'christmas_email_deliveries'
  ) then
    alter table public.christmas_email_deliveries
      drop constraint if exists christmas_email_deliveries_kind_chk;
    alter table public.christmas_email_deliveries
      add constraint christmas_email_deliveries_kind_chk check (
        kind in (
          'starter_ready',
          'magic_ready',
          'ultimate_ready',
          'partial_failure',
          'planner_ready',
          'portrait_ready',
          'portrait_refunded',
          'santa_call_ready',
          'santa_call_resent'
        )
      );
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Child profile (minimized PII — no school/address/phone)
-- ---------------------------------------------------------------------------
create table if not exists public.christmas_santa_call_profiles (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.christmas_orders (id) on delete cascade,
  child_first_name text not null,
  language text not null,
  age smallint,
  christmas_wish text,
  hobbies text,
  pet_name text,
  positive_detail text,
  guardian_consent boolean not null default false,
  consent_version text not null default 'santa_call_v1_2026_10',
  consented_at timestamptz,
  retention_delete_after timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint christmas_santa_call_profiles_lang_chk check (language in ('en', 'ro')),
  constraint christmas_santa_call_profiles_name_chk check (
    char_length(trim(child_first_name)) between 1 and 40
  ),
  constraint christmas_santa_call_profiles_age_chk check (
    age is null or (age >= 1 and age <= 17)
  ),
  constraint christmas_santa_call_profiles_wish_chk check (
    christmas_wish is null or char_length(christmas_wish) <= 160
  ),
  constraint christmas_santa_call_profiles_hobbies_chk check (
    hobbies is null or char_length(hobbies) <= 120
  ),
  constraint christmas_santa_call_profiles_pet_chk check (
    pet_name is null or char_length(pet_name) <= 40
  ),
  constraint christmas_santa_call_profiles_detail_chk check (
    positive_detail is null or char_length(positive_detail) <= 160
  )
);

drop trigger if exists christmas_santa_call_profiles_touch on public.christmas_santa_call_profiles;
create trigger christmas_santa_call_profiles_touch
before update on public.christmas_santa_call_profiles
for each row execute function public.christmas_touch_updated_at();

alter table public.christmas_santa_call_profiles enable row level security;

drop policy if exists christmas_santa_call_profiles_admin_read on public.christmas_santa_call_profiles;
create policy christmas_santa_call_profiles_admin_read
  on public.christmas_santa_call_profiles for select
  using (public.is_admin());

revoke all on table public.christmas_santa_call_profiles from anon, authenticated, public;
grant select on table public.christmas_santa_call_profiles to authenticated;
grant all on table public.christmas_santa_call_profiles to service_role;

-- ---------------------------------------------------------------------------
-- Call entitlement (token hash only; plaintext never stored)
-- ---------------------------------------------------------------------------
create table if not exists public.christmas_santa_call_entitlements (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.christmas_orders (id) on delete cascade,
  profile_id uuid not null references public.christmas_santa_call_profiles (id) on delete cascade,
  access_token_hash text not null unique,
  status text not null default 'pending_payment',
  max_duration_seconds integer not null default 180,
  remaining_seconds integer not null default 180,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  revoke_reason text,
  email_sent_at timestamptz,
  grace_period_seconds integer not null default 45,
  provider_preference text not null default 'openai_realtime',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint christmas_santa_call_entitlements_status_chk check (
    status in (
      'pending_payment',
      'ready',
      'in_progress',
      'completed',
      'expired',
      'revoked',
      'refunded',
      'failed'
    )
  ),
  constraint christmas_santa_call_entitlements_duration_chk check (
    max_duration_seconds > 0 and max_duration_seconds <= 600
    and remaining_seconds >= 0
    and remaining_seconds <= max_duration_seconds
  ),
  constraint christmas_santa_call_entitlements_provider_chk check (
    provider_preference in ('openai_realtime', 'elevenlabs_agents', 'auto')
  )
);

create index if not exists christmas_santa_call_entitlements_status_idx
  on public.christmas_santa_call_entitlements (status, created_at desc);

create index if not exists christmas_santa_call_entitlements_expires_idx
  on public.christmas_santa_call_entitlements (expires_at)
  where status in ('ready', 'in_progress');

drop trigger if exists christmas_santa_call_entitlements_touch on public.christmas_santa_call_entitlements;
create trigger christmas_santa_call_entitlements_touch
before update on public.christmas_santa_call_entitlements
for each row execute function public.christmas_touch_updated_at();

alter table public.christmas_santa_call_entitlements enable row level security;

drop policy if exists christmas_santa_call_entitlements_admin_read on public.christmas_santa_call_entitlements;
create policy christmas_santa_call_entitlements_admin_read
  on public.christmas_santa_call_entitlements for select
  using (public.is_admin());

revoke all on table public.christmas_santa_call_entitlements from anon, authenticated, public;
grant select on table public.christmas_santa_call_entitlements to authenticated;
grant all on table public.christmas_santa_call_entitlements to service_role;

-- ---------------------------------------------------------------------------
-- Sessions (one active per entitlement)
-- ---------------------------------------------------------------------------
create table if not exists public.christmas_santa_call_sessions (
  id uuid primary key default gen_random_uuid(),
  entitlement_id uuid not null references public.christmas_santa_call_entitlements (id) on delete cascade,
  order_id uuid not null references public.christmas_orders (id) on delete cascade,
  status text not null default 'connecting',
  provider text not null,
  provider_session_id text,
  started_at timestamptz,
  connected_at timestamptz,
  ended_at timestamptz,
  remaining_seconds_at_start integer,
  seconds_used integer not null default 0,
  end_reason text,
  error_code text,
  error_message_safe text,
  cost_usd numeric(10, 6),
  cost_ron_estimate numeric(10, 4),
  cost_metadata jsonb not null default '{}'::jsonb,
  client_fingerprint_hash text,
  last_heartbeat_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint christmas_santa_call_sessions_status_chk check (
    status in (
      'connecting',
      'connected',
      'listening',
      'speaking',
      'reconnecting',
      'completed',
      'failed',
      'orphaned_closed'
    )
  ),
  constraint christmas_santa_call_sessions_provider_chk check (
    provider in ('openai_realtime', 'elevenlabs_agents')
  ),
  constraint christmas_santa_call_sessions_seconds_chk check (seconds_used >= 0)
);

create unique index if not exists christmas_santa_call_sessions_one_active_idx
  on public.christmas_santa_call_sessions (entitlement_id)
  where status in ('connecting', 'connected', 'listening', 'speaking', 'reconnecting');

create index if not exists christmas_santa_call_sessions_order_idx
  on public.christmas_santa_call_sessions (order_id, created_at desc);

drop trigger if exists christmas_santa_call_sessions_touch on public.christmas_santa_call_sessions;
create trigger christmas_santa_call_sessions_touch
before update on public.christmas_santa_call_sessions
for each row execute function public.christmas_touch_updated_at();

alter table public.christmas_santa_call_sessions enable row level security;

drop policy if exists christmas_santa_call_sessions_admin_read on public.christmas_santa_call_sessions;
create policy christmas_santa_call_sessions_admin_read
  on public.christmas_santa_call_sessions for select
  using (public.is_admin());

revoke all on table public.christmas_santa_call_sessions from anon, authenticated, public;
grant select on table public.christmas_santa_call_sessions to authenticated;
grant all on table public.christmas_santa_call_sessions to service_role;

-- ---------------------------------------------------------------------------
-- Events (no transcripts / no audio payloads by default)
-- ---------------------------------------------------------------------------
create table if not exists public.christmas_santa_call_events (
  id uuid primary key default gen_random_uuid(),
  entitlement_id uuid references public.christmas_santa_call_entitlements (id) on delete cascade,
  session_id uuid references public.christmas_santa_call_sessions (id) on delete cascade,
  order_id uuid references public.christmas_orders (id) on delete set null,
  event_name text not null,
  event_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint christmas_santa_call_events_name_chk check (char_length(trim(event_name)) between 1 and 80)
);

create index if not exists christmas_santa_call_events_entitlement_idx
  on public.christmas_santa_call_events (entitlement_id, created_at desc);

create index if not exists christmas_santa_call_events_session_idx
  on public.christmas_santa_call_events (session_id, created_at desc);

alter table public.christmas_santa_call_events enable row level security;

drop policy if exists christmas_santa_call_events_admin_read on public.christmas_santa_call_events;
create policy christmas_santa_call_events_admin_read
  on public.christmas_santa_call_events for select
  using (public.is_admin());

revoke all on table public.christmas_santa_call_events from anon, authenticated, public;
grant select on table public.christmas_santa_call_events to authenticated;
grant all on table public.christmas_santa_call_events to service_role;

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

-- Activate entitlement after paid webhook (idempotent).
create or replace function public.activate_christmas_santa_call_entitlement(
  p_order_id uuid,
  p_access_token_hash text,
  p_ttl_days integer default 30
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ord public.christmas_orders%rowtype;
  profile public.christmas_santa_call_profiles%rowtype;
  ent public.christmas_santa_call_entitlements%rowtype;
  ttl integer := greatest(1, least(coalesce(p_ttl_days, 30), 90));
begin
  if p_access_token_hash is null or length(trim(p_access_token_hash)) < 32 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_token_hash');
  end if;

  select * into ord from public.christmas_orders where id = p_order_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'missing_order');
  end if;
  if ord.payment_status <> 'paid' then
    return jsonb_build_object('ok', false, 'reason', 'payment_required');
  end if;
  if ord.product_key <> 'christmas_santa_voice_call' then
    return jsonb_build_object('ok', false, 'reason', 'wrong_product');
  end if;

  select * into profile from public.christmas_santa_call_profiles where order_id = p_order_id;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'missing_profile');
  end if;

  insert into public.christmas_santa_call_entitlements (
    order_id, profile_id, access_token_hash, status, expires_at, remaining_seconds, max_duration_seconds
  )
  values (
    p_order_id,
    profile.id,
    lower(trim(p_access_token_hash)),
    'ready',
    now() + make_interval(days => ttl),
    180,
    180
  )
  on conflict (order_id) do update set
    access_token_hash = case
      when public.christmas_santa_call_entitlements.status in ('pending_payment', 'failed')
        then excluded.access_token_hash
      else public.christmas_santa_call_entitlements.access_token_hash
    end,
    status = case
      when public.christmas_santa_call_entitlements.status in ('revoked', 'refunded', 'completed', 'expired')
        then public.christmas_santa_call_entitlements.status
      else 'ready'
    end,
    expires_at = case
      when public.christmas_santa_call_entitlements.status in ('revoked', 'refunded', 'completed', 'expired')
        then public.christmas_santa_call_entitlements.expires_at
      else now() + make_interval(days => ttl)
    end,
    updated_at = now()
  returning * into ent;

  update public.christmas_orders
  set fulfillment_status = 'completed',
      fulfillment_completed_at = coalesce(fulfillment_completed_at, now()),
      generation_finished_at = coalesce(generation_finished_at, now())
  where id = p_order_id;

  update public.christmas_santa_call_profiles
  set retention_delete_after = now() + interval '90 days',
      updated_at = now()
  where id = profile.id;

  return jsonb_build_object(
    'ok', true,
    'entitlement_id', ent.id,
    'status', ent.status,
    'expires_at', ent.expires_at
  );
end;
$$;

revoke all on function public.activate_christmas_santa_call_entitlement(uuid, text, integer) from anon, authenticated, public;
grant execute on function public.activate_christmas_santa_call_entitlement(uuid, text, integer) to service_role;

-- Resolve access by token hash (never returns child PII beyond first name for call UI).
create or replace function public.resolve_christmas_santa_call_access(p_access_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ent public.christmas_santa_call_entitlements%rowtype;
  profile public.christmas_santa_call_profiles%rowtype;
  active_count integer;
begin
  select * into ent
  from public.christmas_santa_call_entitlements
  where access_token_hash = lower(trim(p_access_token_hash));

  if not found then
    return jsonb_build_object('ok', false, 'code', 'invalid_token');
  end if;

  if ent.revoked_at is not null or ent.status = 'revoked' then
    return jsonb_build_object('ok', false, 'code', 'revoked');
  end if;
  if ent.status = 'refunded' then
    return jsonb_build_object('ok', false, 'code', 'refunded');
  end if;
  if ent.status = 'completed' or ent.remaining_seconds <= 0 then
    return jsonb_build_object('ok', false, 'code', 'completed', 'remaining_seconds', 0);
  end if;
  if ent.expires_at < now() or ent.status = 'expired' then
    update public.christmas_santa_call_entitlements
      set status = 'expired', updated_at = now()
      where id = ent.id and status <> 'expired';
    return jsonb_build_object('ok', false, 'code', 'expired');
  end if;
  if ent.status not in ('ready', 'in_progress') then
    return jsonb_build_object('ok', false, 'code', 'not_ready', 'status', ent.status);
  end if;

  select * into profile from public.christmas_santa_call_profiles where id = ent.profile_id;

  select count(*) into active_count
  from public.christmas_santa_call_sessions
  where entitlement_id = ent.id
    and status in ('connecting', 'connected', 'listening', 'speaking', 'reconnecting');

  return jsonb_build_object(
    'ok', true,
    'entitlement_id', ent.id,
    'order_id', ent.order_id,
    'status', ent.status,
    'remaining_seconds', ent.remaining_seconds,
    'max_duration_seconds', ent.max_duration_seconds,
    'expires_at', ent.expires_at,
    'grace_period_seconds', ent.grace_period_seconds,
    'active_session', active_count > 0,
    'language', profile.language,
    'child_first_name', profile.child_first_name,
    'provider_preference', ent.provider_preference
  );
end;
$$;

revoke all on function public.resolve_christmas_santa_call_access(text) from anon, authenticated, public;
grant execute on function public.resolve_christmas_santa_call_access(text) to service_role;

-- Start or resume a session (enforces single active session).
create or replace function public.begin_christmas_santa_call_session(
  p_access_token_hash text,
  p_provider text,
  p_client_fingerprint_hash text default null,
  p_provider_session_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ent public.christmas_santa_call_entitlements%rowtype;
  sess public.christmas_santa_call_sessions%rowtype;
  profile public.christmas_santa_call_profiles%rowtype;
begin
  if p_provider not in ('openai_realtime', 'elevenlabs_agents') then
    return jsonb_build_object('ok', false, 'code', 'invalid_provider');
  end if;

  select * into ent
  from public.christmas_santa_call_entitlements
  where access_token_hash = lower(trim(p_access_token_hash))
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'invalid_token');
  end if;
  if ent.status in ('revoked', 'refunded', 'expired', 'completed', 'pending_payment', 'failed') then
    return jsonb_build_object('ok', false, 'code', ent.status);
  end if;
  if ent.expires_at < now() then
    update public.christmas_santa_call_entitlements set status = 'expired', updated_at = now() where id = ent.id;
    return jsonb_build_object('ok', false, 'code', 'expired');
  end if;
  if ent.remaining_seconds <= 0 then
    update public.christmas_santa_call_entitlements set status = 'completed', updated_at = now() where id = ent.id;
    return jsonb_build_object('ok', false, 'code', 'completed');
  end if;

  select * into sess
  from public.christmas_santa_call_sessions
  where entitlement_id = ent.id
    and status in ('connecting', 'connected', 'listening', 'speaking', 'reconnecting')
  for update;

  if found then
    -- Allow reconnect within grace if same fingerprint or fingerprint unset.
    if sess.last_heartbeat_at is not null
       and sess.last_heartbeat_at < now() - make_interval(secs => ent.grace_period_seconds) then
      update public.christmas_santa_call_sessions
      set status = 'orphaned_closed',
          ended_at = coalesce(ended_at, now()),
          end_reason = 'grace_timeout',
          updated_at = now()
      where id = sess.id;
    elsif p_client_fingerprint_hash is not null
          and sess.client_fingerprint_hash is not null
          and sess.client_fingerprint_hash <> p_client_fingerprint_hash then
      return jsonb_build_object('ok', false, 'code', 'concurrent_session');
    else
      update public.christmas_santa_call_sessions
      set status = 'reconnecting',
          last_heartbeat_at = now(),
          provider_session_id = coalesce(p_provider_session_id, provider_session_id),
          updated_at = now()
      where id = sess.id
      returning * into sess;

      return jsonb_build_object(
        'ok', true,
        'resumed', true,
        'session_id', sess.id,
        'remaining_seconds', ent.remaining_seconds,
        'entitlement_id', ent.id,
        'order_id', ent.order_id
      );
    end if;
  end if;

  select * into profile from public.christmas_santa_call_profiles where id = ent.profile_id;

  insert into public.christmas_santa_call_sessions (
    entitlement_id, order_id, status, provider, provider_session_id,
    started_at, remaining_seconds_at_start, client_fingerprint_hash, last_heartbeat_at
  )
  values (
    ent.id, ent.order_id, 'connecting', p_provider, p_provider_session_id,
    now(), ent.remaining_seconds, p_client_fingerprint_hash, now()
  )
  returning * into sess;

  update public.christmas_santa_call_entitlements
  set status = 'in_progress', updated_at = now()
  where id = ent.id;

  insert into public.christmas_santa_call_events (entitlement_id, session_id, order_id, event_name, event_payload)
  values (ent.id, sess.id, ent.order_id, 'session_begin', jsonb_build_object('provider', p_provider));

  return jsonb_build_object(
    'ok', true,
    'resumed', false,
    'session_id', sess.id,
    'remaining_seconds', ent.remaining_seconds,
    'entitlement_id', ent.id,
    'order_id', ent.order_id,
    'language', profile.language,
    'child_first_name', profile.child_first_name,
    'age', profile.age,
    'christmas_wish', profile.christmas_wish,
    'hobbies', profile.hobbies,
    'pet_name', profile.pet_name,
    'positive_detail', profile.positive_detail
  );
end;
$$;

revoke all on function public.begin_christmas_santa_call_session(text, text, text, text) from anon, authenticated, public;
grant execute on function public.begin_christmas_santa_call_session(text, text, text, text) to service_role;

-- Heartbeat + server-side timer (seconds_elapsed billed against remaining).
create or replace function public.heartbeat_christmas_santa_call_session(
  p_session_id uuid,
  p_access_token_hash text,
  p_seconds_elapsed integer,
  p_ui_status text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ent public.christmas_santa_call_entitlements%rowtype;
  sess public.christmas_santa_call_sessions%rowtype;
  used integer;
  remaining integer;
  warn_wrap boolean := false;
begin
  select * into sess from public.christmas_santa_call_sessions where id = p_session_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'missing_session');
  end if;

  select * into ent from public.christmas_santa_call_entitlements where id = sess.entitlement_id for update;
  if ent.access_token_hash <> lower(trim(p_access_token_hash)) then
    return jsonb_build_object('ok', false, 'code', 'invalid_token');
  end if;

  if sess.status in ('completed', 'failed', 'orphaned_closed') then
    return jsonb_build_object('ok', false, 'code', 'session_closed', 'status', sess.status, 'remaining_seconds', ent.remaining_seconds);
  end if;

  used := greatest(0, least(coalesce(p_seconds_elapsed, 0), ent.max_duration_seconds));
  remaining := greatest(0, coalesce(sess.remaining_seconds_at_start, ent.remaining_seconds) - used);

  update public.christmas_santa_call_sessions
  set
    seconds_used = used,
    status = case
      when p_ui_status in ('connected', 'listening', 'speaking', 'reconnecting') then p_ui_status
      when sess.connected_at is null then 'connected'
      else sess.status
    end,
    connected_at = coalesce(connected_at, now()),
    last_heartbeat_at = now(),
    updated_at = now()
  where id = sess.id;

  update public.christmas_santa_call_entitlements
  set remaining_seconds = remaining, updated_at = now()
  where id = ent.id;

  if remaining <= 20 and remaining > 0 then
    warn_wrap := true;
  end if;

  if remaining <= 0 then
    update public.christmas_santa_call_sessions
    set status = 'completed', ended_at = now(), end_reason = 'duration_limit', updated_at = now()
    where id = sess.id;
    update public.christmas_santa_call_entitlements
    set status = 'completed', remaining_seconds = 0, updated_at = now()
    where id = ent.id;
    insert into public.christmas_santa_call_events (entitlement_id, session_id, order_id, event_name, event_payload)
    values (ent.id, sess.id, ent.order_id, 'session_force_end', jsonb_build_object('reason', 'duration_limit'));
    return jsonb_build_object('ok', true, 'force_end', true, 'remaining_seconds', 0, 'wrap_up', true);
  end if;

  return jsonb_build_object(
    'ok', true,
    'remaining_seconds', remaining,
    'wrap_up', warn_wrap,
    'force_end', false
  );
end;
$$;

revoke all on function public.heartbeat_christmas_santa_call_session(uuid, text, integer, text) from anon, authenticated, public;
grant execute on function public.heartbeat_christmas_santa_call_session(uuid, text, integer, text) to service_role;

-- End session intentionally or after technical failure.
create or replace function public.end_christmas_santa_call_session(
  p_session_id uuid,
  p_access_token_hash text,
  p_seconds_elapsed integer,
  p_reason text default 'user_hangup',
  p_keep_remaining boolean default false,
  p_error_code text default null,
  p_cost_usd numeric default null,
  p_cost_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ent public.christmas_santa_call_entitlements%rowtype;
  sess public.christmas_santa_call_sessions%rowtype;
  used integer;
  remaining integer;
  final_status text;
begin
  select * into sess from public.christmas_santa_call_sessions where id = p_session_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'missing_session');
  end if;
  select * into ent from public.christmas_santa_call_entitlements where id = sess.entitlement_id for update;
  if ent.access_token_hash <> lower(trim(p_access_token_hash)) then
    return jsonb_build_object('ok', false, 'code', 'invalid_token');
  end if;

  used := greatest(0, least(coalesce(p_seconds_elapsed, sess.seconds_used), ent.max_duration_seconds));
  remaining := greatest(0, coalesce(sess.remaining_seconds_at_start, ent.remaining_seconds) - used);

  if p_keep_remaining and remaining > 0 and coalesce(p_reason, '') in ('technical_interrupt', 'network_drop') then
    final_status := 'ready';
  elsif remaining <= 0 or coalesce(p_reason, '') in ('user_hangup', 'duration_limit', 'completed') then
    remaining := case when coalesce(p_reason, '') = 'user_hangup' then 0 else remaining end;
    if coalesce(p_reason, '') = 'user_hangup' then
      remaining := 0;
    end if;
    final_status := 'completed';
  else
    final_status := case when remaining > 0 then 'ready' else 'completed' end;
  end if;

  update public.christmas_santa_call_sessions
  set
    status = case when p_error_code is not null and final_status <> 'ready' then 'failed' else 'completed' end,
    seconds_used = used,
    ended_at = now(),
    end_reason = coalesce(p_reason, 'user_hangup'),
    error_code = p_error_code,
    cost_usd = coalesce(p_cost_usd, cost_usd),
    cost_metadata = coalesce(p_cost_metadata, '{}'::jsonb),
    updated_at = now()
  where id = sess.id;

  update public.christmas_santa_call_entitlements
  set
    remaining_seconds = remaining,
    status = final_status,
    updated_at = now()
  where id = ent.id;

  insert into public.christmas_santa_call_events (entitlement_id, session_id, order_id, event_name, event_payload)
  values (
    ent.id, sess.id, ent.order_id, 'session_end',
    jsonb_build_object('reason', p_reason, 'remaining', remaining, 'used', used)
  );

  return jsonb_build_object('ok', true, 'remaining_seconds', remaining, 'entitlement_status', final_status);
end;
$$;

revoke all on function public.end_christmas_santa_call_session(uuid, text, integer, text, boolean, text, numeric, jsonb) from anon, authenticated, public;
grant execute on function public.end_christmas_santa_call_session(uuid, text, integer, text, boolean, text, numeric, jsonb) to service_role;

-- Admin / webhook helpers
create or replace function public.revoke_christmas_santa_call_entitlement(
  p_order_id uuid,
  p_reason text default 'revoked'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ent_id uuid;
begin
  update public.christmas_santa_call_entitlements
  set
    status = case when p_reason = 'refunded' then 'refunded' else 'revoked' end,
    revoked_at = now(),
    revoke_reason = coalesce(p_reason, 'revoked'),
    updated_at = now()
  where order_id = p_order_id
  returning id into ent_id;

  if ent_id is null then
    return jsonb_build_object('ok', false, 'reason', 'missing_entitlement');
  end if;

  update public.christmas_santa_call_sessions
  set status = 'orphaned_closed', ended_at = coalesce(ended_at, now()), end_reason = p_reason, updated_at = now()
  where entitlement_id = ent_id
    and status in ('connecting', 'connected', 'listening', 'speaking', 'reconnecting');

  insert into public.christmas_santa_call_events (entitlement_id, order_id, event_name, event_payload)
  values (ent_id, p_order_id, 'entitlement_revoked', jsonb_build_object('reason', p_reason));

  return jsonb_build_object('ok', true, 'entitlement_id', ent_id);
end;
$$;

revoke all on function public.revoke_christmas_santa_call_entitlement(uuid, text) from anon, authenticated, public;
grant execute on function public.revoke_christmas_santa_call_entitlement(uuid, text) to service_role;

create or replace function public.reissue_christmas_santa_call_access(
  p_order_id uuid,
  p_access_token_hash text,
  p_ttl_days integer default 30
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ent public.christmas_santa_call_entitlements%rowtype;
  ttl integer := greatest(1, least(coalesce(p_ttl_days, 30), 90));
begin
  if p_access_token_hash is null or length(trim(p_access_token_hash)) < 32 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_token_hash');
  end if;

  select * into ent from public.christmas_santa_call_entitlements where order_id = p_order_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'missing_entitlement');
  end if;
  if ent.status = 'refunded' then
    return jsonb_build_object('ok', false, 'reason', 'refunded');
  end if;
  if ent.remaining_seconds <= 0 then
    return jsonb_build_object('ok', false, 'reason', 'no_remaining_time');
  end if;

  update public.christmas_santa_call_entitlements
  set
    access_token_hash = lower(trim(p_access_token_hash)),
    status = 'ready',
    revoked_at = null,
    revoke_reason = null,
    expires_at = now() + make_interval(days => ttl),
    updated_at = now()
  where id = ent.id
  returning * into ent;

  insert into public.christmas_santa_call_events (entitlement_id, order_id, event_name, event_payload)
  values (ent.id, p_order_id, 'access_reissued', jsonb_build_object('expires_at', ent.expires_at));

  return jsonb_build_object('ok', true, 'entitlement_id', ent.id, 'expires_at', ent.expires_at);
end;
$$;

revoke all on function public.reissue_christmas_santa_call_access(uuid, text, integer) from anon, authenticated, public;
grant execute on function public.reissue_christmas_santa_call_access(uuid, text, integer) to service_role;

comment on table public.christmas_santa_call_profiles is
  'Minimized child context for Santa voice calls. No transcripts/audio. Retention default 90d after activation.';
comment on table public.christmas_santa_call_entitlements is
  'Paid call access. Stores SHA-256 of access token only. Default TTL 30 days (commercial approval before launch).';
comment on table public.christmas_santa_call_sessions is
  'Realtime provider sessions. Server-side duration enforcement. No default transcript storage.';
comment on table public.christmas_santa_call_events is
  'Operational events only — never store conversation transcripts or audio here by default.';

commit;
