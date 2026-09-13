-- Canonical Christmas commercial offers + credit-pack grant snapshots.
-- Additive only. Does not drop existing christmas_products / christmas_packages.

begin;

-- ---------------------------------------------------------------------------
-- Seed / upsert the 3 commercial offers into pricing_items
-- ---------------------------------------------------------------------------

insert into public.pricing_items (
  key, category, name, description,
  price_cents, currency, credits,
  active, is_active, is_featured, sort_order, metadata
)
values
  (
    'xmas_portrait',
    'christmas_offer',
    'Christmas Portrait Pack',
    'One Christmas portrait generation (person, family, couple, or pet).',
    499, 'eur', 100,
    true, true, false, 10,
    jsonb_build_object(
      'product_type', 'photo_generator',
      'web_checkout_enabled', true,
      'web_price_minor', 499,
      'web_currency', 'eur',
      'app_credits_cost', 100,
      'display_badge', null,
      'bundle_components', null
    )
  ),
  (
    'xmas_santa_video',
    'christmas_offer',
    'Personalized Santa Video',
    'One personalized Santa video.',
    999, 'eur', 250,
    true, true, false, 20,
    jsonb_build_object(
      'product_type', 'santa_video',
      'web_checkout_enabled', true,
      'web_price_minor', 999,
      'web_currency', 'eur',
      'app_credits_cost', 250,
      'display_badge', null,
      'bundle_components', null
    )
  ),
  (
    'xmas_magic_bundle',
    'christmas_offer',
    'Christmas Magic Bundle',
    'Portrait + Santa video + Christmas card/message.',
    1499, 'eur', 350,
    true, true, true, 30,
    jsonb_build_object(
      'product_type', 'bundle',
      'web_checkout_enabled', true,
      'web_price_minor', 1499,
      'web_currency', 'eur',
      'app_credits_cost', 350,
      'display_badge', 'Best Value',
      'bundle_components', jsonb_build_array('xmas_portrait', 'xmas_santa_video', 'xmas_card_message')
    )
  )
on conflict (key) do update
set
  -- Promote legacy app_christmas rows (e.g. xmas_santa_video @ 120) onto the
  -- commercial offer. Keep already-customized christmas_offer Admin values.
  category = excluded.category,
  name = excluded.name,
  description = excluded.description,
  price_cents = case
    when public.pricing_items.category = 'christmas_offer'
      and coalesce(public.pricing_items.price_cents, 0) > 0
      then public.pricing_items.price_cents
    else excluded.price_cents
  end,
  currency = coalesce(nullif(public.pricing_items.currency, ''), excluded.currency),
  credits = case
    when public.pricing_items.category = 'christmas_offer'
      and coalesce(public.pricing_items.credits, 0) > 0
      then public.pricing_items.credits
    else excluded.credits
  end,
  active = coalesce(public.pricing_items.active, true),
  is_active = coalesce(public.pricing_items.is_active, true),
  is_featured = coalesce(public.pricing_items.is_featured, excluded.is_featured),
  sort_order = coalesce(public.pricing_items.sort_order, excluded.sort_order),
  metadata = coalesce(public.pricing_items.metadata, '{}'::jsonb) || excluded.metadata,
  updated_at = now();

-- Free Christmas utilities: keep historical rows, runtime cost = 0.
update public.pricing_items
set
  credits = 0,
  metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
    'credit_cost', 0,
    'app_credits_cost', 0,
    'commercial_policy', 'free'
  ),
  updated_at = now()
where key in (
  'xmas_gift_finder',
  'xmas_wishlist',
  'xmas_tree',
  'xmas_advent',
  'xmas_message',
  'xmas_card'
);

-- Portrait verticals stay as historical app rows; spend maps to xmas_portrait.
update public.pricing_items
set
  credits = 0,
  metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
    'credit_cost', 0,
    'maps_to_commercial_key', 'xmas_portrait',
    'commercial_policy', 'mapped_to_xmas_portrait'
  ),
  updated_at = now()
where key in (
  'xmas_photo',
  'xmas_family_photo',
  'xmas_couple_photo',
  'xmas_pet_photo'
)
  and category = 'app_christmas';

-- Align christmas_packages for portrait + santa with canonical EUR offers (only if still unpublished zeros).
update public.christmas_packages pkg
set
  currency = 'eur',
  price_cents = 499,
  compare_at_cents = null,
  active = true,
  purchasable = true,
  metadata = coalesce(pkg.metadata, '{}'::jsonb) || jsonb_build_object(
    'commercial_key', 'xmas_portrait',
    'live_offer', true
  )
from public.christmas_products p
where pkg.product_id = p.id
  and p.product_key in ('christmas_photo', 'christmas_family', 'christmas_couple', 'christmas_pet')
  and pkg.package_key = 'single'
  and coalesce(pkg.price_cents, 0) = 0;

update public.christmas_packages pkg
set
  currency = 'eur',
  price_cents = 999,
  active = true,
  purchasable = true,
  metadata = coalesce(pkg.metadata, '{}'::jsonb) || jsonb_build_object(
    'commercial_key', 'xmas_santa_video',
    'live_offer', true
  )
from public.christmas_products p
where pkg.product_id = p.id
  and p.product_key = 'christmas_santa_video'
  and pkg.package_key = 'basic'
  and coalesce(pkg.price_cents, 0) = 0;

insert into public.christmas_products (
  product_key, slug, product_type, name, description,
  active, public_discoverable, sort_order, route_path, metadata
)
values (
  'christmas_magic_bundle',
  'magic-bundle',
  'other',
  'Christmas Magic Bundle',
  'Portrait + Santa + Christmas card/message.',
  true, true, 15, '/christmas/photo-generator',
  '{"commercial_key":"xmas_magic_bundle","live_offer":true}'::jsonb
)
on conflict (product_key) do update
set
  name = excluded.name,
  active = true,
  public_discoverable = true,
  metadata = coalesce(public.christmas_products.metadata, '{}'::jsonb) || excluded.metadata;

insert into public.christmas_packages (
  product_id, package_key, package_name, description,
  currency, price_cents, compare_at_cents, active, purchasable, features, sort_order, metadata
)
select
  p.id,
  'bundle',
  'Christmas Magic Bundle',
  'Portrait pack + Santa video + Christmas card/message.',
  'eur',
  1499,
  null,
  true,
  true,
  '["1 portrait","1 Santa video","1 Christmas card/message"]'::jsonb,
  10,
  jsonb_build_object('commercial_key', 'xmas_magic_bundle', 'live_offer', true)
from public.christmas_products p
where p.product_key = 'christmas_magic_bundle'
  and not exists (
    select 1 from public.christmas_packages x
    where x.product_id = p.id and x.package_key = 'bundle'
  );

-- Credit pack bonus metadata defaults (do not overwrite apple product ids).
update public.pricing_items
set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
  'base_credits', coalesce(credits, 0),
  'bonus_credits', coalesce((metadata->>'bonus_credits')::int, 0)
)
where category in ('credit_pack', 'credits')
  and metadata->>'base_credits' is null
  and coalesce(credits, 0) > 0;

-- ---------------------------------------------------------------------------
-- Snapshots + entitlements + spend audit
-- ---------------------------------------------------------------------------

create table if not exists public.christmas_commerce_snapshots (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  pricing_key text not null,
  amount_minor integer,
  currency text,
  credit_cost integer,
  apple_product_id text,
  base_credits integer,
  bonus_credits integer,
  total_credits integer,
  config_updated_at timestamptz,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.christmas_bundle_entitlements (
  id uuid primary key default gen_random_uuid(),
  order_id uuid,
  user_id uuid,
  email_normalized text,
  offer_key text not null default 'xmas_magic_bundle',
  component_key text not null,
  status text not null default 'available'
    check (status in ('available', 'consumed', 'refunded')),
  consume_idempotency_key text,
  consumed_at timestamptz,
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (order_id, component_key)
);

create index if not exists christmas_bundle_entitlements_email_idx
  on public.christmas_bundle_entitlements (email_normalized, status);

alter table public.christmas_orders
  add column if not exists pricing_key text,
  add column if not exists pricing_updated_at timestamptz,
  add column if not exists charged_amount_cents integer,
  add column if not exists commercial_snapshot jsonb not null default '{}'::jsonb;

do $$
begin
  if to_regclass('public.apple_iap_transactions') is not null then
    alter table public.apple_iap_transactions
      add column if not exists base_credits_granted integer,
      add column if not exists bonus_credits_granted integer,
      add column if not exists pricing_key text,
      add column if not exists pricing_updated_at timestamptz,
      add column if not exists grant_snapshot jsonb not null default '{}'::jsonb;
  end if;
end $$;

create table if not exists public.app_christmas_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  user_email text not null,
  job_type text not null,
  product_key text not null,
  pricing_key text not null,
  credit_cost integer not null check (credit_cost >= 0),
  idempotency_key text not null,
  status text not null default 'created',
  generation_id uuid,
  payload jsonb not null default '{}'::jsonb,
  result jsonb,
  result_url text,
  result_text text,
  error_message text,
  credits_spent boolean not null default false,
  credits_refunded boolean not null default false,
  commercial_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint app_christmas_jobs_idempotency_key unique (user_id, idempotency_key)
);

alter table public.app_christmas_jobs
  add column if not exists commercial_snapshot jsonb not null default '{}'::jsonb;

alter table public.christmas_commerce_snapshots enable row level security;
alter table public.christmas_bundle_entitlements enable row level security;
alter table public.app_christmas_jobs enable row level security;

drop policy if exists christmas_commerce_snapshots_admin_read on public.christmas_commerce_snapshots;
create policy christmas_commerce_snapshots_admin_read
  on public.christmas_commerce_snapshots for select
  using (public.is_admin());

drop policy if exists christmas_bundle_entitlements_own on public.christmas_bundle_entitlements;
create policy christmas_bundle_entitlements_own
  on public.christmas_bundle_entitlements for select
  to authenticated
  using (auth.uid() = user_id or public.is_admin());

drop policy if exists app_christmas_jobs_select_own on public.app_christmas_jobs;
create policy app_christmas_jobs_select_own
  on public.app_christmas_jobs for select
  to authenticated
  using (auth.uid() = user_id or public.is_admin());

grant select on table public.christmas_commerce_snapshots to authenticated;
grant select on table public.christmas_bundle_entitlements to authenticated;
grant select on table public.app_christmas_jobs to authenticated;
grant all on table public.christmas_commerce_snapshots to service_role;
grant all on table public.christmas_bundle_entitlements to service_role;
grant all on table public.app_christmas_jobs to service_role;

create or replace function public.app_credits_balance(p_email text)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(
    case
      when direction = 'in' then credits
      when direction = 'out' then -credits
      else 0
    end
  ), 0)::integer
  from public.credits_ledger
  where user_convex_id = lower(trim(p_email));
$$;

revoke all on function public.app_credits_balance(text) from public;
grant execute on function public.app_credits_balance(text) to service_role;

create or replace function public.grant_christmas_bundle_entitlements(
  p_order_id uuid,
  p_user_id uuid,
  p_email text,
  p_snapshot jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  email_norm text;
begin
  email_norm := lower(trim(coalesce(p_email, '')));
  insert into public.christmas_bundle_entitlements (
    order_id, user_id, email_normalized, offer_key, component_key, status, snapshot
  )
  select
    p_order_id,
    p_user_id,
    nullif(email_norm, ''),
    'xmas_magic_bundle',
    c.component_key,
    'available',
    coalesce(p_snapshot, '{}'::jsonb)
  from (values
    ('xmas_portrait'),
    ('xmas_santa_video'),
    ('xmas_card_message')
  ) as c(component_key)
  on conflict (order_id, component_key) do nothing;
end;
$$;

revoke all on function public.grant_christmas_bundle_entitlements(uuid, uuid, text, jsonb) from public;
grant execute on function public.grant_christmas_bundle_entitlements(uuid, uuid, text, jsonb) to service_role;

create or replace function public.consume_christmas_bundle_component(
  p_user_id uuid,
  p_email text,
  p_component_key text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  email_norm text;
  existing public.christmas_bundle_entitlements%rowtype;
begin
  email_norm := lower(trim(coalesce(p_email, '')));

  if p_idempotency_key is not null then
    select * into existing
    from public.christmas_bundle_entitlements
    where consume_idempotency_key = trim(p_idempotency_key)
    limit 1;
    if found then
      return jsonb_build_object(
        'ok', true,
        'already_processed', true,
        'component_key', existing.component_key,
        'entitlement_id', existing.id
      );
    end if;
  end if;

  select * into existing
  from public.christmas_bundle_entitlements
  where status = 'available'
    and component_key = p_component_key
    and (
      (p_user_id is not null and user_id = p_user_id)
      or (email_norm <> '' and email_normalized = email_norm)
    )
  order by created_at asc
  limit 1
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'no_entitlement');
  end if;

  update public.christmas_bundle_entitlements
  set
    status = 'consumed',
    consume_idempotency_key = coalesce(nullif(trim(p_idempotency_key), ''), consume_idempotency_key),
    consumed_at = now()
  where id = existing.id;

  return jsonb_build_object(
    'ok', true,
    'already_processed', false,
    'component_key', existing.component_key,
    'entitlement_id', existing.id
  );
end;
$$;

revoke all on function public.consume_christmas_bundle_component(uuid, text, text, text) from public;
grant execute on function public.consume_christmas_bundle_component(uuid, text, text, text) to service_role;

-- Authoritative spend: ignores client credit_cost; reads pricing_items.
create or replace function public.spend_credits_idempotent(
  p_user_id uuid,
  p_user_email text,
  p_idempotency_key text,
  p_job_type text,
  p_product_key text,
  p_pricing_key text,
  p_credit_cost integer,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  email_norm text;
  existing public.app_christmas_jobs%rowtype;
  inserted public.app_christmas_jobs%rowtype;
  bal integer;
  note_text text;
  configured_credits integer;
  offer_active boolean;
  offer_updated timestamptz;
  commercial_key text;
  displayed integer;
begin
  if p_user_id is null then
    raise exception 'user required';
  end if;
  email_norm := lower(trim(coalesce(p_user_email, '')));
  if email_norm = '' then
    raise exception 'email required';
  end if;
  if p_idempotency_key is null or length(trim(p_idempotency_key)) < 8 then
    raise exception 'idempotency_key required';
  end if;

  select * into existing
  from public.app_christmas_jobs
  where user_id = p_user_id
    and idempotency_key = trim(p_idempotency_key);

  if found then
    return jsonb_build_object(
      'status', existing.status,
      'job_id', existing.id,
      'generation_id', existing.generation_id,
      'already_processed', true,
      'credits_charged', case when existing.credits_spent then existing.credit_cost else 0 end,
      'result_url', existing.result_url,
      'result_text', existing.result_text,
      'result', existing.result,
      'error', existing.error_message
    );
  end if;

  commercial_key := case
    when p_pricing_key in ('xmas_portrait', 'xmas_photo', 'xmas_family_photo', 'xmas_couple_photo', 'xmas_pet_photo') then 'xmas_portrait'
    when p_product_key in ('christmas_photo', 'christmas_family', 'christmas_couple', 'christmas_pet', 'xmas_portrait') then 'xmas_portrait'
    when p_pricing_key in ('xmas_santa_video') or p_product_key in ('christmas_santa_video', 'xmas_santa_video') then 'xmas_santa_video'
    when p_pricing_key in ('xmas_magic_bundle') or p_product_key in ('christmas_magic_bundle', 'xmas_magic_bundle') then 'xmas_magic_bundle'
    else nullif(trim(p_pricing_key), '')
  end;

  select
    greatest(0, coalesce((pi.metadata->>'app_credits_cost')::int, pi.credits, 0)),
    (coalesce(pi.active, true) and coalesce(pi.is_active, true)),
    pi.updated_at
  into configured_credits, offer_active, offer_updated
  from public.pricing_items pi
  where pi.key = commercial_key
  limit 1;

  if configured_credits is null then
    return jsonb_build_object(
      'status', 'failed',
      'code', 'config_missing',
      'error', 'Christmas pricing is not configured'
    );
  end if;
  if offer_active is not true then
    return jsonb_build_object(
      'status', 'failed',
      'code', 'inactive_product',
      'error', 'This offer is not available'
    );
  end if;
  if configured_credits <= 0 then
    return jsonb_build_object(
      'status', 'failed',
      'code', 'invalid_credits',
      'error', 'Configured credit cost is invalid'
    );
  end if;

  displayed := p_credit_cost;
  if displayed is not null and displayed <> configured_credits then
    return jsonb_build_object(
      'status', 'failed',
      'code', 'pricing_changed',
      'error', 'Credit cost changed',
      'server_credit_cost', configured_credits,
      'displayed_credit_cost', displayed
    );
  end if;

  -- Client cannot underpay by omitting displayed cost: server uses configured_credits.
  bal := public.app_credits_balance(email_norm);
  if bal < configured_credits then
    return jsonb_build_object(
      'status', 'failed',
      'code', 'insufficient_credits',
      'error', 'Not enough credits',
      'balance', bal,
      'credits_required', configured_credits
    );
  end if;

  insert into public.app_christmas_jobs (
    user_id, user_email, job_type, product_key, pricing_key,
    credit_cost, idempotency_key, status, payload, credits_spent, commercial_snapshot
  ) values (
    p_user_id, email_norm, p_job_type, p_product_key, coalesce(commercial_key, p_pricing_key),
    configured_credits, trim(p_idempotency_key), 'queued',
    coalesce(p_payload, '{}'::jsonb),
    false,
    jsonb_build_object(
      'pricing_item', commercial_key,
      'credit_cost_debited', configured_credits,
      'config_updated_at', offer_updated
    )
  )
  returning * into inserted;

  note_text := 'app_christmas:' || inserted.id::text;
  if not exists (select 1 from public.credits_ledger cl where cl.note = note_text) then
    insert into public.credits_ledger (
      user_convex_id, user_id, direction, credits, event_type, category, note, template_title
    ) values (
      email_norm, p_user_id, 'out', configured_credits,
      'app_christmas', 'app_christmas', note_text, p_product_key
    );
  end if;

  update public.app_christmas_jobs
    set credits_spent = true, status = 'processing', updated_at = now()
    where id = inserted.id
    returning * into inserted;

  insert into public.christmas_commerce_snapshots (
    source, pricing_key, credit_cost, config_updated_at, payload
  ) values (
    'app_spend', commercial_key, configured_credits, offer_updated,
    jsonb_build_object('job_id', inserted.id, 'idempotency_key', trim(p_idempotency_key))
  );

  return jsonb_build_object(
    'status', inserted.status,
    'job_id', inserted.id,
    'generation_id', inserted.generation_id,
    'already_processed', false,
    'credits_charged', configured_credits,
    'balance', public.app_credits_balance(email_norm)
  );
exception
  when unique_violation then
    select * into existing
    from public.app_christmas_jobs
    where user_id = p_user_id
      and idempotency_key = trim(p_idempotency_key);
    return jsonb_build_object(
      'status', existing.status,
      'job_id', existing.id,
      'generation_id', existing.generation_id,
      'already_processed', true,
      'credits_charged', case when existing.credits_spent then existing.credit_cost else 0 end
    );
end;
$$;

revoke all on function public.spend_credits_idempotent(uuid, text, text, text, text, text, integer, jsonb) from public;
grant execute on function public.spend_credits_idempotent(uuid, text, text, text, text, text, integer, jsonb) to service_role;

commit;
