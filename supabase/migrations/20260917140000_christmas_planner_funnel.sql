-- Christmas Planner catalog, entitlements, claim RPCs.
-- Additive. Does not alter pet_orders or Pet prices.

begin;

alter table public.christmas_email_deliveries
  drop constraint if exists christmas_email_deliveries_kind_chk;
alter table public.christmas_email_deliveries
  add constraint christmas_email_deliveries_kind_chk check (
    kind in ('starter_ready', 'magic_ready', 'ultimate_ready', 'partial_failure', 'planner_ready')
  );

alter table public.christmas_products
  drop constraint if exists christmas_products_type_chk;

alter table public.christmas_products
  add constraint christmas_products_type_chk check (
    product_type in (
      'photo_generator',
      'santa_video',
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
  'christmas_planner_2026',
  'planner',
  'planner',
  'Christmas Planner by The Digital Gifter',
  'An interactive Christmas planning experience · gifts, budget, meals, hosting, cards, traditions, and more in one place. Not a PDF.',
  true,
  true,
  8,
  '/christmas/planner',
  jsonb_build_object(
    'product_family', 'christmas_planner',
    'season_year', 2026,
    'checkout_live', false,
    'live_offer', false
  )
)
on conflict (product_key) do update
set
  name = excluded.name,
  description = excluded.description,
  product_type = excluded.product_type,
  active = true,
  public_discoverable = true,
  route_path = excluded.route_path,
  metadata = coalesce(public.christmas_products.metadata, '{}'::jsonb) || excluded.metadata,
  updated_at = now();

insert into public.christmas_packages (
  product_id, package_key, package_name, description,
  currency, price_cents, compare_at_cents, active, purchasable, features, sort_order, metadata
)
select p.id, v.package_key, v.package_name, v.description,
  v.currency, v.price_cents, v.compare_at_cents, true, true, v.features::jsonb, v.sort_order, v.metadata
from public.christmas_products p
cross join (
  values
    (
      'essentials',
      'Essentials',
      'Countdown, plan, tasks, gifts, budget, shopping tracker, and wishlist.',
      'usd', 1299, null, 10,
      '["Christmas countdown","Personalized Christmas plan","Daily tasks","Gift planning","Budget tracker","Shopping tracker","Wishlist"]',
      '{"kind":"package","tier":"essentials"}'::jsonb
    ),
    (
      'magic',
      'Christmas Magic',
      'Essentials plus meals, hosting, cards, traditions, travel, Gift Finder, and Rescue Mode.',
      'usd', 2700, null, 20,
      '["Everything in Essentials","Meals planner","Hosting","Cards & messages","Activities & traditions","Travel","Advanced Gift Finder","Christmas Rescue Mode"]',
      '{"kind":"package","tier":"magic"}'::jsonb
    ),
    (
      'all_in',
      'All-In Christmas',
      'The complete Planner · recipes, premium planning, bonus credits, and future AI assistant access.',
      'usd', 4900, null, 30,
      '["Everything in Christmas Magic","Recipe collection / food planner","Premium planning content","Digital Gifter photo credit bonus","Future AI Christmas Assistant access","Premium Christmas Club content where applicable"]',
      '{"kind":"package","tier":"all_in","highlight":true,"badge":"Best value"}'::jsonb
    ),
    (
      'addon_recipes',
      'Christmas Recipes & Food Guide',
      'Standalone meals and recipe planning pack.',
      'usd', 900, null, 40,
      '["Recipe collection","Meal planner"]',
      '{"kind":"addon"}'::jsonb
    ),
    (
      'addon_hosting',
      'Hosting Pack',
      'Standalone hosting planner pack.',
      'usd', 900, null, 50,
      '["Hosting planner"]',
      '{"kind":"addon"}'::jsonb
    ),
    (
      'addon_activities',
      'Christmas Activity Pack',
      'Standalone activities and traditions pack.',
      'usd', 900, null, 60,
      '["Activities & traditions"]',
      '{"kind":"addon"}'::jsonb
    ),
    (
      'addon_gift_ideas',
      'Gift Ideas Pack',
      'Standalone Gift Finder ideas pack.',
      'usd', 900, null, 70,
      '["Advanced Gift Finder"]',
      '{"kind":"addon"}'::jsonb
    ),
    (
      'addon_travel',
      'Christmas Travel / Places Inspiration',
      'Standalone travel planning pack.',
      'usd', 900, null, 80,
      '["Travel planner"]',
      '{"kind":"addon"}'::jsonb
    ),
    (
      'addon_photo_credits',
      'Digital Gifter Christmas photo credit pack',
      'Bonus Christmas photo credits entitlement.',
      'usd', 1500, null, 90,
      '["Christmas photo credit bonus"]',
      '{"kind":"addon"}'::jsonb
    )
) as v(package_key, package_name, description, currency, price_cents, compare_at_cents, sort_order, features, metadata)
where p.product_key = 'christmas_planner_2026'
on conflict (product_id, package_key) do update
set
  package_name = excluded.package_name,
  description = excluded.description,
  features = excluded.features,
  sort_order = excluded.sort_order,
  metadata = coalesce(public.christmas_packages.metadata, '{}'::jsonb) || excluded.metadata,
  -- Keep operator-edited prices / purchasable flags.
  price_cents = public.christmas_packages.price_cents,
  currency = public.christmas_packages.currency,
  purchasable = public.christmas_packages.purchasable,
  active = public.christmas_packages.active,
  updated_at = now();

create table if not exists public.user_entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  guest_token_hash text,
  product_key text not null,
  entitlement_key text not null,
  tier text,
  season_year integer not null default 2026,
  status text not null default 'active'
    check (status in ('active', 'revoked', 'expired')),
  source text not null
    check (source in ('stripe', 'apple', 'promo', 'admin')),
  source_transaction_id text,
  christmas_order_id uuid references public.christmas_orders (id) on delete set null,
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists user_entitlements_order_key_uidx
  on public.user_entitlements (christmas_order_id, entitlement_key)
  where christmas_order_id is not null;

create unique index if not exists user_entitlements_user_active_uidx
  on public.user_entitlements (user_id, entitlement_key, season_year)
  where user_id is not null and status = 'active';

create unique index if not exists user_entitlements_guest_active_uidx
  on public.user_entitlements (guest_token_hash, entitlement_key, season_year)
  where guest_token_hash is not null and status = 'active';

create index if not exists user_entitlements_user_idx
  on public.user_entitlements (user_id, status, season_year);

create index if not exists user_entitlements_order_idx
  on public.user_entitlements (christmas_order_id);

drop trigger if exists user_entitlements_touch_updated_at on public.user_entitlements;
create trigger user_entitlements_touch_updated_at
before update on public.user_entitlements
for each row execute function public.christmas_touch_updated_at();

alter table public.user_entitlements enable row level security;

drop policy if exists user_entitlements_owner_read on public.user_entitlements;
create policy user_entitlements_owner_read
  on public.user_entitlements for select
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists user_entitlements_admin_all on public.user_entitlements;
create policy user_entitlements_admin_all
  on public.user_entitlements for all
  using (public.is_admin())
  with check (public.is_admin());

revoke all on table public.user_entitlements from anon, authenticated, public;
grant select on table public.user_entitlements to authenticated;
grant all on table public.user_entitlements to service_role;

create or replace function public.grant_christmas_planner_entitlements(
  p_order_id uuid,
  p_entitlements text[],
  p_tier text default null,
  p_source text default 'stripe',
  p_source_transaction_id text default null,
  p_season_year integer default 2026
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  order_row public.christmas_orders%rowtype;
  guest_hash text;
  granted integer := 0;
  key text;
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

  if order_row.payment_status <> 'paid' and coalesce(p_source, 'stripe') = 'stripe' then
    return jsonb_build_object('ok', false, 'reason', 'not_paid');
  end if;

  guest_hash := nullif(trim(coalesce(order_row.metadata->>'guest_token_hash', '')), '');

  foreach key in array coalesce(p_entitlements, array[]::text[])
  loop
    if length(trim(key)) = 0 then
      continue;
    end if;
    insert into public.user_entitlements (
      user_id, guest_token_hash, product_key, entitlement_key, tier, season_year,
      status, source, source_transaction_id, christmas_order_id, metadata
    )
    values (
      order_row.user_id,
      guest_hash,
      order_row.product_key,
      trim(key),
      nullif(trim(coalesce(p_tier, order_row.package_key)), ''),
      coalesce(p_season_year, 2026),
      'active',
      coalesce(nullif(trim(p_source), ''), 'stripe'),
      nullif(trim(p_source_transaction_id), ''),
      order_row.id,
      jsonb_build_object('package_key', order_row.package_key)
    )
    on conflict do nothing;
    if found then
      granted := granted + 1;
    end if;
  end loop;

  update public.christmas_orders
  set
    fulfillment_status = 'completed',
    fulfillment_completed_at = coalesce(fulfillment_completed_at, now()),
    metadata = metadata || jsonb_build_object('planner_entitlements_granted', true)
  where id = order_row.id
    and product_key in ('christmas_planner_2026', 'christmas_planner');

  return jsonb_build_object(
    'ok', true,
    'order_id', order_row.id,
    'granted', granted,
    'already', coalesce(array_length(p_entitlements, 1), 0) - granted
  );
end;
$$;

revoke all on function public.grant_christmas_planner_entitlements(uuid, text[], text, text, text, integer)
  from anon, authenticated, public;
grant execute on function public.grant_christmas_planner_entitlements(uuid, text[], text, text, text, integer)
  to service_role;

create or replace function public.claim_christmas_planner_order(
  p_user_id uuid,
  p_public_token_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  order_row public.christmas_orders%rowtype;
begin
  if p_user_id is null or length(trim(coalesce(p_public_token_hash, ''))) < 16 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_claim');
  end if;

  select * into order_row
  from public.christmas_orders
  where public_token_hash = p_public_token_hash
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'order_not_found');
  end if;

  if order_row.payment_status <> 'paid' then
    return jsonb_build_object('ok', false, 'reason', 'not_paid');
  end if;

  if order_row.user_id is not null and order_row.user_id <> p_user_id then
    return jsonb_build_object('ok', false, 'reason', 'already_claimed');
  end if;

  update public.christmas_orders
  set user_id = p_user_id
  where id = order_row.id
    and (user_id is null or user_id = p_user_id);

  update public.user_entitlements e
  set user_id = p_user_id
  where e.christmas_order_id = order_row.id
    and (e.user_id is null or e.user_id = p_user_id)
    and not exists (
      select 1
      from public.user_entitlements other
      where other.user_id = p_user_id
        and other.entitlement_key = e.entitlement_key
        and other.season_year = e.season_year
        and other.status = 'active'
        and other.id <> e.id
    );

  return jsonb_build_object(
    'ok', true,
    'order_id', order_row.id,
    'already', order_row.user_id = p_user_id,
    'product_key', order_row.product_key,
    'package_key', order_row.package_key
  );
end;
$$;

revoke all on function public.claim_christmas_planner_order(uuid, text)
  from anon, authenticated, public;
grant execute on function public.claim_christmas_planner_order(uuid, text)
  to service_role;

create or replace function public.admin_set_christmas_planner_entitlement(
  p_user_id uuid,
  p_entitlement_key text,
  p_status text,
  p_tier text default null,
  p_season_year integer default 2026,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null or length(trim(coalesce(p_entitlement_key, ''))) = 0 then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;
  if p_status not in ('active', 'revoked') then
    return jsonb_build_object('ok', false, 'reason', 'invalid_status');
  end if;

  if p_status = 'revoked' then
    update public.user_entitlements
    set status = 'revoked',
        metadata = metadata || jsonb_build_object('admin_reason', left(coalesce(p_reason, ''), 200))
    where user_id = p_user_id
      and entitlement_key = trim(p_entitlement_key)
      and season_year = coalesce(p_season_year, 2026)
      and status = 'active';
    return jsonb_build_object('ok', true, 'action', 'revoked');
  end if;

  insert into public.user_entitlements (
    user_id, product_key, entitlement_key, tier, season_year, status, source, metadata
  )
  values (
    p_user_id,
    'christmas_planner_2026',
    trim(p_entitlement_key),
    nullif(trim(coalesce(p_tier, '')), ''),
    coalesce(p_season_year, 2026),
    'active',
    'admin',
    jsonb_build_object('admin_reason', left(coalesce(p_reason, ''), 200))
  )
  on conflict do nothing;

  return jsonb_build_object('ok', true, 'action', 'granted');
end;
$$;

revoke all on function public.admin_set_christmas_planner_entitlement(uuid, text, text, text, integer, text)
  from anon, authenticated, public;
grant execute on function public.admin_set_christmas_planner_entitlement(uuid, text, text, text, integer, text)
  to service_role;

commit;
