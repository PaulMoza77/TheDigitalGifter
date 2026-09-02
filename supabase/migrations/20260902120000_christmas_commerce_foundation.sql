-- Additive Christmas commerce foundation.
-- Does not modify pet_orders, pet SKU constraints, or Pet prices.

begin;

-- ---------------------------------------------------------------------------
-- Catalog
-- ---------------------------------------------------------------------------

create table if not exists public.christmas_products (
  id uuid primary key default gen_random_uuid(),
  product_key text not null,
  slug text not null,
  product_type text not null,
  name text not null,
  description text not null default '',
  active boolean not null default false,
  public_discoverable boolean not null default false,
  sort_order integer not null default 100,
  route_path text,
  locale_default text not null default 'en',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint christmas_products_key_chk check (length(trim(product_key)) > 0),
  constraint christmas_products_slug_chk check (length(trim(slug)) > 0),
  constraint christmas_products_type_chk check (
    product_type in (
      'photo_generator',
      'santa_video',
      'card',
      'tree',
      'advent',
      'wishlist',
      'gift_finder',
      'messages',
      'hub',
      'other'
    )
  )
);

create unique index if not exists christmas_products_key_uidx
  on public.christmas_products (product_key);

create unique index if not exists christmas_products_slug_uidx
  on public.christmas_products (slug);

create table if not exists public.christmas_packages (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.christmas_products (id) on delete cascade,
  package_key text not null,
  package_name text not null,
  description text not null default '',
  currency text not null default 'usd',
  price_cents integer not null,
  compare_at_cents integer,
  active boolean not null default false,
  purchasable boolean not null default false,
  features jsonb not null default '[]'::jsonb,
  sort_order integer not null default 100,
  locale_default text not null default 'en',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint christmas_packages_key_chk check (length(trim(package_key)) > 0),
  constraint christmas_packages_currency_chk check (currency in ('usd', 'eur', 'ron')),
  constraint christmas_packages_price_chk check (price_cents >= 0),
  constraint christmas_packages_compare_chk check (
    compare_at_cents is null or compare_at_cents >= price_cents
  )
);

create unique index if not exists christmas_packages_product_package_uidx
  on public.christmas_packages (product_id, package_key);

create index if not exists christmas_packages_purchasable_idx
  on public.christmas_packages (purchasable, active)
  where purchasable = true and active = true;

-- ---------------------------------------------------------------------------
-- Orders (payment vs fulfillment separated)
-- ---------------------------------------------------------------------------

create table if not exists public.christmas_orders (
  id uuid primary key default gen_random_uuid(),
  public_token_hash text not null,
  public_token_ciphertext text,
  user_id uuid,
  email text,
  email_normalized text,
  product_key text not null,
  package_key text not null,
  sku text not null,
  currency text not null default 'usd',
  amount_cents integer not null,
  payment_status text not null default 'draft',
  fulfillment_status text not null default 'not_started',
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  paid_at timestamptz,
  refunded_at timestamptz,
  fulfillment_queued_at timestamptz,
  fulfillment_started_at timestamptz,
  fulfillment_completed_at timestamptz,
  last_error text,
  locale text not null default 'en',
  landing_path text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  affiliate_ref text,
  campaign_id text,
  adset_id text,
  ad_id text,
  funnel_session_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint christmas_orders_currency_chk check (currency in ('usd', 'eur', 'ron')),
  constraint christmas_orders_amount_chk check (amount_cents >= 0),
  constraint christmas_orders_payment_chk check (
    payment_status in ('draft', 'pending', 'paid', 'failed', 'refunded')
  ),
  constraint christmas_orders_fulfillment_chk check (
    fulfillment_status in ('not_started', 'queued', 'processing', 'completed', 'failed')
  )
);

create unique index if not exists christmas_orders_public_token_hash_uidx
  on public.christmas_orders (public_token_hash);

create unique index if not exists christmas_orders_stripe_session_uidx
  on public.christmas_orders (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null
    and length(trim(stripe_checkout_session_id)) > 0;

create index if not exists christmas_orders_created_idx
  on public.christmas_orders (created_at desc);

create index if not exists christmas_orders_email_idx
  on public.christmas_orders (email_normalized, created_at desc);

create index if not exists christmas_orders_product_payment_idx
  on public.christmas_orders (product_key, payment_status, created_at desc);

create index if not exists christmas_orders_fulfillment_idx
  on public.christmas_orders (fulfillment_status, created_at desc);

create table if not exists public.christmas_order_assets (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.christmas_orders (id) on delete cascade,
  asset_kind text not null,
  storage_bucket text,
  storage_path text,
  public_url text,
  generation_id uuid,
  job_id uuid,
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint christmas_order_assets_kind_chk check (
    asset_kind in ('image', 'images', 'card', 'video', 'other')
  )
);

create index if not exists christmas_order_assets_order_idx
  on public.christmas_order_assets (order_id, sort_order);

-- ---------------------------------------------------------------------------
-- Funnel events
-- ---------------------------------------------------------------------------

create table if not exists public.christmas_funnel_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  funnel_session_id uuid not null,
  idempotency_key text not null,
  product_key text,
  package_key text,
  order_id uuid,
  user_id uuid,
  locale text,
  pathname text,
  landing_path text,
  device_type text,
  amount_cents integer,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  affiliate_ref text,
  campaign_id text,
  adset_id text,
  ad_id text,
  has_meta_click boolean not null default false,
  referrer_host text,
  client_event_id uuid,
  is_test boolean not null default false,
  environment text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint christmas_funnel_events_amount_chk check (
    amount_cents is null or amount_cents >= 0
  )
);

create unique index if not exists christmas_funnel_events_idempotency_uidx
  on public.christmas_funnel_events (idempotency_key);

create index if not exists christmas_funnel_events_created_idx
  on public.christmas_funnel_events (created_at desc);

create index if not exists christmas_funnel_events_name_created_idx
  on public.christmas_funnel_events (event_name, created_at desc);

create index if not exists christmas_funnel_events_product_idx
  on public.christmas_funnel_events (product_key, created_at desc);

-- ---------------------------------------------------------------------------
-- Updated_at trigger helper
-- ---------------------------------------------------------------------------

create or replace function public.christmas_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists christmas_products_touch_updated_at on public.christmas_products;
create trigger christmas_products_touch_updated_at
before update on public.christmas_products
for each row execute function public.christmas_touch_updated_at();

drop trigger if exists christmas_packages_touch_updated_at on public.christmas_packages;
create trigger christmas_packages_touch_updated_at
before update on public.christmas_packages
for each row execute function public.christmas_touch_updated_at();

drop trigger if exists christmas_orders_touch_updated_at on public.christmas_orders;
create trigger christmas_orders_touch_updated_at
before update on public.christmas_orders
for each row execute function public.christmas_touch_updated_at();

-- ---------------------------------------------------------------------------
-- Idempotent payment fulfillment
-- ---------------------------------------------------------------------------

create or replace function public.fulfill_christmas_order_payment(
  p_order_id uuid,
  p_stripe_session_id text,
  p_stripe_payment_intent_id text default null,
  p_amount_cents integer default null,
  p_currency text default null,
  p_stripe_event_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  order_row public.christmas_orders%rowtype;
  expected_amount integer;
  expected_currency text;
begin
  if p_order_id is null then
    return jsonb_build_object('ok', false, 'reason', 'missing_order_id');
  end if;

  select * into order_row
  from public.christmas_orders
  where id = p_order_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'order_not_found');
  end if;

  if order_row.payment_status = 'paid' then
    return jsonb_build_object(
      'ok', true,
      'status', 'already_paid',
      'order_id', order_row.id,
      'fulfillment_status', order_row.fulfillment_status
    );
  end if;

  if order_row.payment_status = 'refunded' then
    return jsonb_build_object('ok', false, 'reason', 'already_refunded');
  end if;

  expected_amount := order_row.amount_cents;
  expected_currency := lower(order_row.currency);

  if p_amount_cents is not null and p_amount_cents <> expected_amount then
    return jsonb_build_object(
      'ok', false,
      'reason', 'amount_mismatch',
      'expected_amount_cents', expected_amount,
      'got_amount_cents', p_amount_cents
    );
  end if;

  if p_currency is not null and lower(p_currency) <> expected_currency then
    return jsonb_build_object(
      'ok', false,
      'reason', 'currency_mismatch',
      'expected_currency', expected_currency,
      'got_currency', lower(p_currency)
    );
  end if;

  if p_stripe_session_id is not null
     and order_row.stripe_checkout_session_id is not null
     and order_row.stripe_checkout_session_id <> p_stripe_session_id then
    return jsonb_build_object('ok', false, 'reason', 'stripe_session_mismatch');
  end if;

  update public.christmas_orders
  set
    payment_status = 'paid',
    paid_at = coalesce(paid_at, now()),
    stripe_checkout_session_id = coalesce(nullif(trim(p_stripe_session_id), ''), stripe_checkout_session_id),
    stripe_payment_intent_id = coalesce(nullif(trim(p_stripe_payment_intent_id), ''), stripe_payment_intent_id),
    fulfillment_status = case
      when fulfillment_status = 'not_started' then 'queued'
      else fulfillment_status
    end,
    fulfillment_queued_at = case
      when fulfillment_status = 'not_started' then now()
      else fulfillment_queued_at
    end,
    last_error = null,
    metadata = metadata || jsonb_build_object(
      'last_stripe_event_id', nullif(trim(p_stripe_event_id), '')
    )
  where id = order_row.id
  returning * into order_row;

  return jsonb_build_object(
    'ok', true,
    'status', 'paid',
    'order_id', order_row.id,
    'payment_status', order_row.payment_status,
    'fulfillment_status', order_row.fulfillment_status,
    'amount_cents', order_row.amount_cents,
    'currency', order_row.currency
  );
end;
$$;

revoke all on function public.fulfill_christmas_order_payment(uuid, text, text, integer, text, text)
  from anon, authenticated, public;
grant execute on function public.fulfill_christmas_order_payment(uuid, text, text, integer, text, text)
  to service_role;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.christmas_products enable row level security;
alter table public.christmas_packages enable row level security;
alter table public.christmas_orders enable row level security;
alter table public.christmas_order_assets enable row level security;
alter table public.christmas_funnel_events enable row level security;

drop policy if exists christmas_products_public_read on public.christmas_products;
create policy christmas_products_public_read
  on public.christmas_products for select
  using ((active = true and public_discoverable = true) or public.is_admin());

drop policy if exists christmas_packages_public_read on public.christmas_packages;
create policy christmas_packages_public_read
  on public.christmas_packages for select
  using (
    public.is_admin()
    or (
      active = true
      and exists (
        select 1 from public.christmas_products p
        where p.id = product_id
          and p.active = true
          and p.public_discoverable = true
      )
    )
  );

drop policy if exists christmas_orders_admin_read on public.christmas_orders;
create policy christmas_orders_admin_read
  on public.christmas_orders for select
  using (public.is_admin());

drop policy if exists christmas_orders_own_read on public.christmas_orders;
create policy christmas_orders_own_read
  on public.christmas_orders for select
  using (user_id is not null and auth.uid() = user_id);

drop policy if exists christmas_order_assets_admin_read on public.christmas_order_assets;
create policy christmas_order_assets_admin_read
  on public.christmas_order_assets for select
  using (public.is_admin());

drop policy if exists christmas_order_assets_own_read on public.christmas_order_assets;
create policy christmas_order_assets_own_read
  on public.christmas_order_assets for select
  using (
    exists (
      select 1 from public.christmas_orders o
      where o.id = order_id
        and o.user_id is not null
        and o.user_id = auth.uid()
    )
  );

drop policy if exists christmas_funnel_events_admin_read on public.christmas_funnel_events;
create policy christmas_funnel_events_admin_read
  on public.christmas_funnel_events for select
  using (public.is_admin());

revoke all on table public.christmas_products from anon, public;
revoke all on table public.christmas_packages from anon, public;
revoke all on table public.christmas_orders from anon, authenticated, public;
revoke all on table public.christmas_order_assets from anon, authenticated, public;
revoke all on table public.christmas_funnel_events from anon, authenticated, public;

grant select on table public.christmas_products to anon, authenticated;
grant select on table public.christmas_packages to anon, authenticated;
grant select on table public.christmas_orders to authenticated;
grant select on table public.christmas_order_assets to authenticated;
grant select on table public.christmas_funnel_events to authenticated;

grant all on table public.christmas_products to service_role;
grant all on table public.christmas_packages to service_role;
grant all on table public.christmas_orders to service_role;
grant all on table public.christmas_order_assets to service_role;
grant all on table public.christmas_funnel_events to service_role;

-- ---------------------------------------------------------------------------
-- Seed catalog (non-live purchasable defaults)
-- price_cents is draft config only; purchasable=false until a later launch task.
-- ---------------------------------------------------------------------------

insert into public.christmas_products (
  product_key, slug, product_type, name, description,
  active, public_discoverable, sort_order, route_path, metadata
)
values
  ('christmas_hub', 'hub', 'hub', 'Christmas Hub', 'Unified Christmas product suite entry.', true, true, 0, '/christmas', '{"shell":false}'::jsonb),
  ('christmas_photo', 'photo-generator', 'photo_generator', 'Christmas AI Photo Generator', 'Personalized Christmas photo portraits.', true, true, 10, '/christmas/photo-generator', '{"foundation":true,"live_offer":false}'::jsonb),
  ('christmas_family', 'family', 'photo_generator', 'Family Christmas Generator', 'Coming soon.', true, true, 20, '/christmas/family', '{"coming_soon":true}'::jsonb),
  ('christmas_couple', 'couples', 'photo_generator', 'Couples Christmas Generator', 'Coming soon.', true, true, 30, '/christmas/couples', '{"coming_soon":true}'::jsonb),
  ('christmas_kids', 'kids', 'photo_generator', 'Kids Christmas Generator', 'Coming soon.', true, true, 40, '/christmas/kids', '{"coming_soon":true,"privacy_required":true}'::jsonb),
  ('christmas_pet', 'pets', 'photo_generator', 'Pet Christmas Generator', 'Coming soon.', true, true, 50, '/christmas/pets', '{"coming_soon":true}'::jsonb),
  ('christmas_santa_video', 'santa-video', 'santa_video', 'Personalized Santa Video', 'Coming soon.', true, true, 60, '/christmas/santa-video', '{"coming_soon":true,"privacy_required":true}'::jsonb),
  ('christmas_card', 'cards', 'card', 'Personalized Christmas Cards', 'Coming soon.', true, true, 70, '/christmas/cards', '{"coming_soon":true}'::jsonb),
  ('christmas_tree', 'tree', 'tree', 'Shareable Christmas Tree', 'Coming soon.', true, true, 80, '/christmas/tree', '{"coming_soon":true}'::jsonb),
  ('christmas_advent', 'advent', 'advent', 'Advent Calendar', 'Coming soon.', true, true, 90, '/christmas/advent', '{"coming_soon":true}'::jsonb),
  ('christmas_wishlist', 'wishlist', 'wishlist', 'Christmas Wishlist', 'Coming soon.', true, true, 100, '/christmas/wishlist', '{"coming_soon":true}'::jsonb),
  ('christmas_gift_finder', 'gift-finder', 'gift_finder', 'AI Christmas Gift Finder', 'Coming soon.', true, true, 110, '/christmas/gift-finder', '{"coming_soon":true}'::jsonb),
  ('christmas_messages', 'messages', 'messages', 'AI Christmas Message Generator', 'Coming soon.', true, true, 120, '/christmas/messages', '{"coming_soon":true}'::jsonb)
on conflict (product_key) do nothing;

insert into public.christmas_packages (
  product_id, package_key, package_name, description,
  currency, price_cents, compare_at_cents, active, purchasable, features, sort_order, metadata
)
select
  p.id,
  'single',
  'Single portrait',
  'Draft package configuration — not a live public offer.',
  'usd',
  0,
  null,
  true,
  false,
  '["1 Christmas portrait"]'::jsonb,
  10,
  '{"live_offer":false,"note":"price unpublished; set purchasable + price in a later launch task"}'::jsonb
from public.christmas_products p
where p.product_key = 'christmas_photo'
  and not exists (
    select 1 from public.christmas_packages pkg
    where pkg.product_id = p.id and pkg.package_key = 'single'
  );

commit;
