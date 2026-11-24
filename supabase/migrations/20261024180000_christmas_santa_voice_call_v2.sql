-- Santa Voice Call V2: 59 RON / 180s + optional one-time 49 RON / 300s extension.
-- Does not enable CHRISTMAS_LIVE_PRODUCTS or alter other product prices.

begin;

-- Pricing: initial call 59.00 RON
update public.pricing_items
set
  price_cents = 5900,
  credits = 180,
  metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
    'web_price_minor', 5900,
    'web_currency', 'ron',
    'max_duration_seconds', 180,
    'extension_price_minor', 4900,
    'extension_seconds', 300,
    'santa_voice_call_v2', true
  ),
  updated_at = now()
where key = 'xmas_santa_voice_call';

-- Extension commercial offer (not publicly sold in catalog hub until launch)
insert into public.pricing_items (
  key, name, category, price_cents, currency, credits, active, is_active, is_featured, sort_order, metadata
)
values (
  'xmas_santa_voice_call_extension',
  'Santa Call +5 minutes',
  'christmas_offer',
  4900,
  'ron',
  300,
  true,
  true,
  false,
  26,
  jsonb_build_object(
    'web_price_minor', 4900,
    'web_currency', 'ron',
    'web_checkout_enabled', true,
    'app_credits_cost', 300,
    'product_type', 'santa_voice_call_extension',
    'extension_seconds', 300,
    'max_one_per_call', true,
    'enabled', true,
    'public_catalog', false
  )
)
on conflict (key) do update set
  name = excluded.name,
  price_cents = excluded.price_cents,
  currency = excluded.currency,
  credits = excluded.credits,
  active = excluded.active,
  is_active = excluded.is_active,
  metadata = coalesce(public.pricing_items.metadata, '{}'::jsonb) || excluded.metadata,
  updated_at = now();

-- Ensure base Santa Call product exists (Contabo may only have pricing_items from V1).
-- product_type must satisfy christmas_products_type_chk (no 'santa_voice_call' enum value).
insert into public.christmas_products (
  product_key, slug, product_type, name, description,
  active, public_discoverable, sort_order, route_path, metadata
)
values (
  'christmas_santa_voice_call',
  'santa-call',
  'other',
  'Call Santa Claus',
  'A magical realtime voice conversation with AI Santa Claus (3 minutes, optional +5).',
  true,
  false,
  65,
  '/christmas/santa-call',
  jsonb_build_object(
    'live_offer', false,
    'checkout_live', false,
    'santa_voice_call_v2', true,
    'max_duration_seconds', 180,
    'extension_seconds', 300,
    'extension_price_minor', 4900,
    'initial_price_minor', 5900,
    'public_catalog', false
  )
)
on conflict (product_key) do update set
  description = excluded.description,
  public_discoverable = false,
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
  'One private AI Santa voice call (up to 180 seconds). Optional +5 min extension available after the call.',
  'ron',
  5900,
  null,
  true,
  false,
  '["3-minute AI Santa voice call","Optional +5 minutes","Multilingual","Private access link"]'::jsonb,
  10,
  jsonb_build_object('live_offer', false, 'santa_voice_call_v2', true)
from public.christmas_products p
where p.product_key = 'christmas_santa_voice_call'
  and not exists (
    select 1 from public.christmas_packages x
    where x.product_id = p.id and x.package_key = 'single'
  );

update public.christmas_packages pkg
set
  price_cents = 5900,
  package_name = 'Call Santa — 3 minutes',
  description = 'One private AI Santa voice call (up to 180 seconds). Optional +5 min extension available after the call.',
  features = '["3-minute AI Santa voice call","Optional +5 minutes","Multilingual","Private access link"]'::jsonb,
  purchasable = false,
  metadata = coalesce(pkg.metadata, '{}'::jsonb) || jsonb_build_object('live_offer', false, 'santa_voice_call_v2', true),
  updated_at = now()
from public.christmas_products p
where pkg.product_id = p.id
  and p.product_key = 'christmas_santa_voice_call'
  and pkg.package_key = 'single';

update public.christmas_products
set
  description = 'A magical realtime voice conversation with AI Santa Claus (3 minutes, optional +5).',
  public_discoverable = false,
  metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
    'santa_voice_call_v2', true,
    'max_duration_seconds', 180,
    'extension_seconds', 300,
    'extension_price_minor', 4900,
    'initial_price_minor', 5900,
    'checkout_live', false,
    'live_offer', false,
    'public_catalog', false
  ),
  updated_at = now()
where product_key = 'christmas_santa_voice_call';

-- Product row for extension (not discoverable)
insert into public.christmas_products (
  product_key, slug, product_type, name, description,
  active, public_discoverable, sort_order, route_path, metadata
)
values (
  'christmas_santa_voice_call_extension',
  'santa-call-extension',
  'other',
  'Santa Call Extension',
  'Add 5 minutes to an existing Santa voice call.',
  true,
  false,
  66,
  '/christmas/santa-call',
  jsonb_build_object(
    'live_offer', false,
    'checkout_live', false,
    'extension_seconds', 300,
    'santa_voice_call_v2', true,
    'public_catalog', false
  )
)
on conflict (product_key) do update set
  metadata = coalesce(public.christmas_products.metadata, '{}'::jsonb) || excluded.metadata,
  public_discoverable = false,
  updated_at = now();

insert into public.christmas_packages (
  product_id, package_key, package_name, description,
  currency, price_cents, compare_at_cents, active, purchasable, features, sort_order, metadata
)
select
  p.id,
  'extension_5min',
  'Santa Call +5 minutes',
  'One-time extension of 300 seconds for an existing call.',
  'ron',
  4900,
  null,
  true,
  false,
  '["+5 minutes","Same Santa voice","Continue conversation"]'::jsonb,
  10,
  jsonb_build_object('live_offer', false, 'extension_seconds', 300)
from public.christmas_products p
where p.product_key = 'christmas_santa_voice_call_extension'
  and not exists (
    select 1 from public.christmas_packages x
    where x.product_id = p.id and x.package_key = 'extension_5min'
  );

-- Entitlement: allow awaiting_extension + larger duration budget (180+300)
alter table public.christmas_santa_call_entitlements
  drop constraint if exists christmas_santa_call_entitlements_status_chk;

alter table public.christmas_santa_call_entitlements
  add constraint christmas_santa_call_entitlements_status_chk check (
    status in (
      'pending_payment',
      'ready',
      'in_progress',
      'awaiting_extension',
      'completed',
      'expired',
      'revoked',
      'refunded',
      'failed'
    )
  );

alter table public.christmas_santa_call_entitlements
  drop constraint if exists christmas_santa_call_entitlements_duration_chk;

alter table public.christmas_santa_call_entitlements
  add constraint christmas_santa_call_entitlements_duration_chk check (
    max_duration_seconds > 0 and max_duration_seconds <= 600
    and remaining_seconds >= 0
    and remaining_seconds <= max_duration_seconds
  );

alter table public.christmas_santa_call_entitlements
  add column if not exists extension_purchased_at timestamptz,
  add column if not exists extension_seconds_granted integer not null default 0,
  add column if not exists resume_context jsonb not null default '{}'::jsonb,
  add column if not exists resume_context_expires_at timestamptz;

-- One extension purchase record per entitlement (idempotent webhook)
create table if not exists public.christmas_santa_call_extensions (
  id uuid primary key default gen_random_uuid(),
  entitlement_id uuid not null unique references public.christmas_santa_call_entitlements (id) on delete cascade,
  order_id uuid not null unique references public.christmas_orders (id) on delete cascade,
  seconds_granted integer not null default 300,
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  paid_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint christmas_santa_call_extensions_seconds_chk check (seconds_granted > 0 and seconds_granted <= 300)
);

alter table public.christmas_santa_call_extensions enable row level security;

drop policy if exists christmas_santa_call_extensions_admin_read on public.christmas_santa_call_extensions;
create policy christmas_santa_call_extensions_admin_read
  on public.christmas_santa_call_extensions for select
  using (public.is_admin());

revoke all on table public.christmas_santa_call_extensions from anon, authenticated, public;
grant select on table public.christmas_santa_call_extensions to authenticated;
grant all on table public.christmas_santa_call_extensions to service_role;

-- Activate paid extension (exactly once)
create or replace function public.activate_christmas_santa_call_extension(
  p_entitlement_id uuid,
  p_order_id uuid,
  p_seconds integer default 300,
  p_stripe_checkout_session_id text default null,
  p_stripe_payment_intent_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ent public.christmas_santa_call_entitlements%rowtype;
  ord public.christmas_orders%rowtype;
  secs integer := least(300, greatest(1, coalesce(p_seconds, 300)));
  existing uuid;
begin
  select * into ord from public.christmas_orders where id = p_order_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'missing_order');
  end if;
  if ord.payment_status <> 'paid' then
    return jsonb_build_object('ok', false, 'reason', 'payment_required');
  end if;
  if ord.product_key <> 'christmas_santa_voice_call_extension' then
    return jsonb_build_object('ok', false, 'reason', 'wrong_product');
  end if;

  select * into ent from public.christmas_santa_call_entitlements where id = p_entitlement_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'missing_entitlement');
  end if;
  if ent.status in ('revoked', 'refunded', 'expired') then
    return jsonb_build_object('ok', false, 'reason', ent.status);
  end if;

  select id into existing from public.christmas_santa_call_extensions where entitlement_id = p_entitlement_id;
  if found then
    return jsonb_build_object('ok', true, 'reason', 'already_extended', 'entitlement_id', ent.id, 'remaining_seconds', ent.remaining_seconds);
  end if;

  -- Minutes only after initial segment exhausted — never before payment + webhook.
  if ent.status <> 'awaiting_extension' then
    return jsonb_build_object('ok', false, 'reason', 'not_awaiting_extension', 'status', ent.status);
  end if;

  insert into public.christmas_santa_call_extensions (
    entitlement_id, order_id, seconds_granted, stripe_checkout_session_id, stripe_payment_intent_id
  ) values (
    p_entitlement_id, p_order_id, secs, p_stripe_checkout_session_id, p_stripe_payment_intent_id
  );

  update public.christmas_santa_call_entitlements
  set
    remaining_seconds = secs,
    max_duration_seconds = least(600, max_duration_seconds + secs),
    extension_purchased_at = now(),
    extension_seconds_granted = secs,
    status = 'ready',
    updated_at = now()
  where id = p_entitlement_id
  returning * into ent;

  update public.christmas_orders
  set fulfillment_status = 'completed',
      fulfillment_completed_at = coalesce(fulfillment_completed_at, now())
  where id = p_order_id;

  return jsonb_build_object(
    'ok', true,
    'entitlement_id', ent.id,
    'remaining_seconds', ent.remaining_seconds,
    'max_duration_seconds', ent.max_duration_seconds,
    'status', ent.status
  );
end;
$$;

revoke all on function public.activate_christmas_santa_call_extension(uuid, uuid, integer, text, text) from anon, authenticated, public;
grant execute on function public.activate_christmas_santa_call_extension(uuid, uuid, integer, text, text) to service_role;

-- Resolve: surface extension offer when initial time is exhausted
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
  has_extension boolean := false;
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
  if ent.expires_at < now() or ent.status = 'expired' then
    update public.christmas_santa_call_entitlements
      set status = 'expired', updated_at = now()
      where id = ent.id and status <> 'expired';
    return jsonb_build_object('ok', false, 'code', 'expired');
  end if;

  select exists(
    select 1 from public.christmas_santa_call_extensions x where x.entitlement_id = ent.id
  ) into has_extension;

  if ent.status = 'awaiting_extension' or (ent.remaining_seconds <= 0 and not has_extension and ent.status in ('completed', 'awaiting_extension', 'ready', 'in_progress')) then
    if not has_extension then
      if ent.status <> 'awaiting_extension' then
        update public.christmas_santa_call_entitlements
          set status = 'awaiting_extension', updated_at = now()
          where id = ent.id;
      end if;
      select * into profile from public.christmas_santa_call_profiles where id = ent.profile_id;
      return jsonb_build_object(
        'ok', false,
        'code', 'awaiting_extension',
        'extension_available', true,
        'extension_price_minor', 4900,
        'extension_currency', 'ron',
        'extension_seconds', 300,
        'entitlement_id', ent.id,
        'child_first_name', profile.child_first_name,
        'language', profile.language,
        'remaining_seconds', 0
      );
    end if;
  end if;

  if ent.status = 'completed' or ent.remaining_seconds <= 0 then
    return jsonb_build_object('ok', false, 'code', 'completed', 'remaining_seconds', 0, 'extension_available', false);
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
    'provider_preference', ent.provider_preference,
    'extension_purchased', has_extension,
    'is_extension_segment', has_extension and ent.extension_seconds_granted > 0 and ent.remaining_seconds <= ent.extension_seconds_granted
  );
end;
$$;

-- Mark awaiting_extension on duration limit end (keep_remaining false, remaining 0)
-- Parameter names MUST match V1 (p_reason) — named RPC args from edge functions.
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
  used integer := greatest(0, coalesce(p_seconds_elapsed, 0));
  new_remaining integer;
  has_extension boolean := false;
  next_status text;
  reason text := coalesce(nullif(trim(p_reason), ''), 'user_hangup');
begin
  select * into sess from public.christmas_santa_call_sessions where id = p_session_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'invalid_session');
  end if;

  select * into ent
  from public.christmas_santa_call_entitlements
  where id = sess.entitlement_id
    and access_token_hash = lower(trim(p_access_token_hash))
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'invalid_token');
  end if;

  if sess.status in ('completed', 'failed', 'orphaned_closed') then
    return jsonb_build_object(
      'ok', true,
      'remaining_seconds', ent.remaining_seconds,
      'entitlement_status', ent.status,
      'extension_available', (ent.status = 'awaiting_extension'),
      'idempotent', true
    );
  end if;

  if p_keep_remaining and reason in ('technical_interrupt', 'network_drop', 'provider_mint_failed', 'provider_unsupported_client') then
    new_remaining := greatest(
      0,
      coalesce(sess.remaining_seconds_at_start, ent.remaining_seconds) - least(used, coalesce(sess.remaining_seconds_at_start, ent.remaining_seconds))
    );
  else
    -- Hangup or duration limit: consume this segment (no residual unpaid time).
    new_remaining := 0;
  end if;

  update public.christmas_santa_call_sessions
  set status = case
        when p_error_code is not null and reason like '%fail%' then 'failed'
        else 'completed'
      end,
      ended_at = now(),
      seconds_used = used,
      end_reason = reason,
      error_code = p_error_code,
      cost_usd = p_cost_usd,
      cost_metadata = coalesce(p_cost_metadata, '{}'::jsonb),
      updated_at = now()
  where id = sess.id;

  select exists(select 1 from public.christmas_santa_call_extensions x where x.entitlement_id = ent.id) into has_extension;

  if new_remaining <= 0 and not has_extension and reason = 'duration_limit' then
    next_status := 'awaiting_extension';
  elsif new_remaining <= 0 then
    next_status := 'completed';
  else
    next_status := 'ready';
  end if;

  update public.christmas_santa_call_entitlements
  set remaining_seconds = new_remaining,
      status = next_status,
      updated_at = now()
  where id = ent.id
  returning * into ent;

  return jsonb_build_object(
    'ok', true,
    'remaining_seconds', ent.remaining_seconds,
    'entitlement_status', ent.status,
    'extension_available', (ent.status = 'awaiting_extension')
  );
end;
$$;

-- Save minimal resume context (no full transcript / audio)
create or replace function public.save_christmas_santa_call_resume_context(
  p_access_token_hash text,
  p_summary text,
  p_language text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ent public.christmas_santa_call_entitlements%rowtype;
  summary text;
  lang text;
begin
  select * into ent
  from public.christmas_santa_call_entitlements
  where access_token_hash = lower(trim(p_access_token_hash))
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'invalid_token');
  end if;

  summary := left(trim(regexp_replace(coalesce(p_summary, ''), '\s+', ' ', 'g')), 600);
  if summary ~* 'ignore\s+(all\s+)?(previous|prior|above)\s+instructions|system\s*prompt' then
    summary := null;
  end if;
  lang := case when lower(coalesce(p_language, '')) in ('en','ro','de','fr','es','it','ar') then lower(p_language) else null end;

  update public.christmas_santa_call_entitlements
  set resume_context = jsonb_build_object(
        'summary', summary,
        'language', lang,
        'captured_at', now()
      ),
      resume_context_expires_at = now() + interval '24 hours',
      updated_at = now()
  where id = ent.id;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.save_christmas_santa_call_resume_context(text, text, text) from anon, authenticated, public;
grant execute on function public.save_christmas_santa_call_resume_context(text, text, text) to service_role;

-- Default initial entitlement duration stays 180 on activate
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
      when public.christmas_santa_call_entitlements.status in ('revoked', 'refunded', 'completed', 'expired', 'awaiting_extension')
        then public.christmas_santa_call_entitlements.status
      else 'ready'
    end,
    expires_at = case
      when public.christmas_santa_call_entitlements.status in ('revoked', 'refunded', 'completed', 'expired', 'awaiting_extension')
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

-- Begin: do not collapse awaiting_extension into completed when remaining is 0
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
  resume jsonb;
  resume_mode boolean := false;
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
  if ent.status = 'awaiting_extension' then
    return jsonb_build_object('ok', false, 'code', 'awaiting_extension', 'extension_available', true);
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

  resume := coalesce(ent.resume_context, '{}'::jsonb);
  if ent.extension_seconds_granted > 0
     and ent.resume_context_expires_at is not null
     and ent.resume_context_expires_at > now()
     and coalesce(resume->>'summary', '') <> '' then
    resume_mode := true;
  end if;

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
  values (ent.id, sess.id, ent.order_id, 'session_begin', jsonb_build_object('provider', p_provider, 'resume_mode', resume_mode));

  return jsonb_build_object(
    'ok', true,
    'resumed', false,
    'resume_mode', resume_mode,
    'resume_summary', case when resume_mode then left(coalesce(resume->>'summary', ''), 600) else null end,
    'resume_language', case when resume_mode then resume->>'language' else null end,
    'session_id', sess.id,
    'remaining_seconds', ent.remaining_seconds,
    'entitlement_id', ent.id,
    'order_id', ent.order_id,
    'child_first_name', profile.child_first_name,
    'language', profile.language,
    'age', profile.age,
    'christmas_wish', profile.christmas_wish,
    'hobbies', profile.hobbies,
    'pet_name', profile.pet_name,
    'positive_detail', profile.positive_detail
  );
end;
$$;

commit;
