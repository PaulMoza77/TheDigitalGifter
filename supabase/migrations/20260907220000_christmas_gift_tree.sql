-- Christmas Gift Tree chance funnel (/christmas/gifts)
-- Distinct from shareable christmas_trees / christmas_tree_gifts.
-- Additive. Paid packs default not purchasable. Monetary rewards inactive.

begin;

alter table public.christmas_products drop constraint if exists christmas_products_type_chk;
alter table public.christmas_products add constraint christmas_products_type_chk check (
  product_type in (
    'photo_generator',
    'santa_video',
    'card',
    'tree',
    'advent',
    'wishlist',
    'gift_finder',
    'messages',
    'gift_tree',
    'hub',
    'other'
  )
);

alter table public.christmas_reward_entitlements drop constraint if exists christmas_reward_entitlements_source_chk;
alter table public.christmas_reward_entitlements add constraint christmas_reward_entitlements_source_chk check (
  source in ('christmas_advent', 'christmas_free_gift', 'christmas_tree', 'christmas_gift_tree')
);

-- ---------------------------------------------------------------------------
-- Reward catalog (server-owned; client never picks amounts)
-- ---------------------------------------------------------------------------
create table if not exists public.christmas_gift_tree_rewards (
  id uuid primary key default gen_random_uuid(),
  season_year integer not null,
  reward_key text not null,
  reward_type text not null,
  title text not null,
  description text not null default '',
  weight integer not null default 1,
  reward_value integer not null default 0,
  active boolean not null default false,
  paid_only boolean not null default false,
  guest_allowed boolean not null default true,
  locale text not null default 'en',
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint christmas_gift_tree_rewards_key_chk check (char_length(trim(reward_key)) between 1 and 80),
  constraint christmas_gift_tree_rewards_type_chk check (
    reward_type in ('cosmetic', 'surprise_message', 'content_unlock', 'credits')
  ),
  constraint christmas_gift_tree_rewards_weight_chk check (weight > 0),
  constraint christmas_gift_tree_rewards_value_chk check (reward_value >= 0),
  constraint christmas_gift_tree_rewards_title_chk check (char_length(title) between 1 and 80),
  constraint christmas_gift_tree_rewards_unique unique (season_year, reward_key, locale)
);

drop trigger if exists christmas_gift_tree_rewards_touch on public.christmas_gift_tree_rewards;
create trigger christmas_gift_tree_rewards_touch
before update on public.christmas_gift_tree_rewards
for each row execute function public.christmas_touch_updated_at();

alter table public.christmas_gift_tree_rewards enable row level security;
drop policy if exists christmas_gift_tree_rewards_read on public.christmas_gift_tree_rewards;
create policy christmas_gift_tree_rewards_read
  on public.christmas_gift_tree_rewards for select
  using (true);

revoke all on table public.christmas_gift_tree_rewards from anon, authenticated, public;
grant select on table public.christmas_gift_tree_rewards to anon, authenticated;
grant all on table public.christmas_gift_tree_rewards to service_role;

-- ---------------------------------------------------------------------------
-- Identity-scoped accounts (opens balance)
-- ---------------------------------------------------------------------------
create table if not exists public.christmas_gift_tree_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  guest_token_hash text,
  season_year integer not null,
  free_opens_used integer not null default 0,
  paid_opens_remaining integer not null default 0,
  paid_opens_granted integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint christmas_gift_tree_accounts_identity_chk check (
    user_id is not null or (guest_token_hash is not null and length(guest_token_hash) = 64)
  ),
  constraint christmas_gift_tree_accounts_free_chk check (free_opens_used >= 0),
  constraint christmas_gift_tree_accounts_paid_chk check (
    paid_opens_remaining >= 0 and paid_opens_granted >= 0
  )
);

create unique index if not exists christmas_gift_tree_accounts_user_season_uidx
  on public.christmas_gift_tree_accounts (user_id, season_year)
  where user_id is not null;
create unique index if not exists christmas_gift_tree_accounts_guest_season_uidx
  on public.christmas_gift_tree_accounts (guest_token_hash, season_year)
  where guest_token_hash is not null;

drop trigger if exists christmas_gift_tree_accounts_touch on public.christmas_gift_tree_accounts;
create trigger christmas_gift_tree_accounts_touch
before update on public.christmas_gift_tree_accounts
for each row execute function public.christmas_touch_updated_at();

alter table public.christmas_gift_tree_accounts enable row level security;
drop policy if exists christmas_gift_tree_accounts_own on public.christmas_gift_tree_accounts;
create policy christmas_gift_tree_accounts_own
  on public.christmas_gift_tree_accounts for select
  using (user_id = auth.uid() or public.is_admin());

revoke all on table public.christmas_gift_tree_accounts from anon, authenticated, public;
grant select on table public.christmas_gift_tree_accounts to authenticated;
grant all on table public.christmas_gift_tree_accounts to service_role;

-- ---------------------------------------------------------------------------
-- Opens (server-drawn outcomes)
-- ---------------------------------------------------------------------------
create table if not exists public.christmas_gift_tree_opens (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.christmas_gift_tree_accounts (id) on delete cascade,
  reward_id uuid not null references public.christmas_gift_tree_rewards (id),
  user_id uuid references auth.users (id) on delete cascade,
  guest_token_hash text,
  season_year integer not null,
  open_kind text not null,
  box_slot integer,
  reward_key text not null,
  reward_type text not null,
  title text not null,
  entitlement_key text,
  order_id uuid references public.christmas_orders (id) on delete set null,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  constraint christmas_gift_tree_opens_kind_chk check (open_kind in ('free', 'paid')),
  constraint christmas_gift_tree_opens_identity_chk check (
    user_id is not null or (guest_token_hash is not null and length(guest_token_hash) = 64)
  ),
  constraint christmas_gift_tree_opens_slot_chk check (box_slot is null or box_slot between 0 and 20)
);

create unique index if not exists christmas_gift_tree_opens_idem_uidx
  on public.christmas_gift_tree_opens (idempotency_key);
create unique index if not exists christmas_gift_tree_opens_free_user_uidx
  on public.christmas_gift_tree_opens (user_id, season_year)
  where user_id is not null and open_kind = 'free';
create unique index if not exists christmas_gift_tree_opens_free_guest_uidx
  on public.christmas_gift_tree_opens (guest_token_hash, season_year)
  where guest_token_hash is not null and open_kind = 'free';
create index if not exists christmas_gift_tree_opens_account_idx
  on public.christmas_gift_tree_opens (account_id, created_at desc);

alter table public.christmas_gift_tree_opens enable row level security;
drop policy if exists christmas_gift_tree_opens_own on public.christmas_gift_tree_opens;
create policy christmas_gift_tree_opens_own
  on public.christmas_gift_tree_opens for select
  using (user_id = auth.uid() or public.is_admin());

revoke all on table public.christmas_gift_tree_opens from anon, authenticated, public;
grant select on table public.christmas_gift_tree_opens to authenticated;
grant all on table public.christmas_gift_tree_opens to service_role;

-- ---------------------------------------------------------------------------
-- Webhook pack grants (idempotent on order)
-- ---------------------------------------------------------------------------
create table if not exists public.christmas_gift_tree_grants (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.christmas_orders (id) on delete cascade,
  account_id uuid not null references public.christmas_gift_tree_accounts (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  guest_token_hash text,
  package_key text not null,
  opens_granted integer not null,
  stripe_event_id text,
  email_status text not null default 'pending',
  email_provider_id text,
  created_at timestamptz not null default now(),
  constraint christmas_gift_tree_grants_opens_chk check (opens_granted > 0),
  constraint christmas_gift_tree_grants_email_chk check (
    email_status in ('pending', 'queued', 'sent', 'skipped', 'failed')
  )
);

create unique index if not exists christmas_gift_tree_grants_order_uidx
  on public.christmas_gift_tree_grants (order_id);
create index if not exists christmas_gift_tree_grants_account_idx
  on public.christmas_gift_tree_grants (account_id, created_at desc);

alter table public.christmas_gift_tree_grants enable row level security;
drop policy if exists christmas_gift_tree_grants_own on public.christmas_gift_tree_grants;
create policy christmas_gift_tree_grants_own
  on public.christmas_gift_tree_grants for select
  using (user_id = auth.uid() or public.is_admin());

revoke all on table public.christmas_gift_tree_grants from anon, authenticated, public;
grant select on table public.christmas_gift_tree_grants to authenticated;
grant all on table public.christmas_gift_tree_grants to service_role;

create unique index if not exists credits_ledger_christmas_gift_tree_note_uidx
  on public.credits_ledger (note)
  where note like 'christmas_gift_tree:%';

-- Catalog product + Stripe packs (not purchasable until founder sets live prices)
insert into public.christmas_products (
  product_key, slug, product_type, name, description, active, public_discoverable,
  sort_order, route_path, locale_default, metadata
)
values (
  'christmas_gift_tree',
  'gifts',
  'gift_tree',
  'Christmas Gift Tree',
  'Open gifts on your chance tree. Free and paid packs — rewards come from the catalog, never the browser.',
  true,
  true,
  85,
  '/christmas/gifts',
  'en',
  '{"gift_tree_v1":true,"live_offer":false,"chance_funnel":true}'::jsonb
)
on conflict (product_key) do update set
  slug = excluded.slug,
  product_type = excluded.product_type,
  name = excluded.name,
  description = excluded.description,
  active = excluded.active,
  public_discoverable = excluded.public_discoverable,
  sort_order = excluded.sort_order,
  route_path = excluded.route_path,
  metadata = excluded.metadata;

insert into public.christmas_packages (
  product_id, package_key, package_name, description, currency, price_cents,
  compare_at_cents, active, purchasable, features, sort_order, locale_default, metadata
)
select
  p.id,
  v.package_key,
  v.package_name,
  v.description,
  'usd',
  0,
  null,
  true,
  false,
  v.features,
  v.sort_order,
  'en',
  v.metadata
from public.christmas_products p
cross join (
  values
    (
      'open_1',
      '1 Gift Open',
      'Draft pack — not a live public offer.',
      '["1 catalog gift open"]'::jsonb,
      10,
      '{"opens":1,"live_offer":false}'::jsonb
    ),
    (
      'open_3',
      '3 Gift Opens',
      'Draft pack — not a live public offer.',
      '["3 catalog gift opens"]'::jsonb,
      20,
      '{"opens":3,"live_offer":false}'::jsonb
    ),
    (
      'open_5',
      '5 Gift Opens',
      'Draft pack — not a live public offer.',
      '["5 catalog gift opens"]'::jsonb,
      30,
      '{"opens":5,"live_offer":false}'::jsonb
    )
) as v(package_key, package_name, description, features, sort_order, metadata)
where p.product_key = 'christmas_gift_tree'
on conflict (product_id, package_key) do nothing;

insert into public.christmas_gift_tree_rewards
  (season_year, reward_key, reward_type, title, description, weight, reward_value, active, paid_only, guest_allowed, config)
values
  (
    2026, 'snowflake_bauble', 'cosmetic', 'Snowflake Bauble',
    'Unlock a snowflake bauble for your Christmas tree.',
    4, 0, false, false, true,
    '{"entitlement_key":"gift_tree_snowflake_bauble"}'::jsonb
  ),
  (
    2026, 'holiday_cheer', 'surprise_message', 'Holiday Cheer',
    'A warm Christmas note from The Digital Gifter.',
    5, 0, false, false, true,
    '{"message":"May your holidays sparkle."}'::jsonb
  ),
  (
    2026, 'advent_teaser', 'content_unlock', 'Advent Preview',
    'A teaser unlock for the Advent calendar experience.',
    2, 0, false, false, true,
    '{"entitlement_key":"gift_tree_advent_teaser"}'::jsonb
  ),
  (
    2026, 'test_credit_disabled', 'credits', 'Test Credit (disabled)',
    'Must stay inactive in production. Login + flag required.',
    1, 1, false, true, false,
    '{"monetary":true}'::jsonb
  )
on conflict (season_year, reward_key, locale) do nothing;

comment on table public.christmas_gift_tree_rewards is
  'Chance-funnel catalog. Server draws only. active=false and credits inactive by default.';
comment on table public.christmas_gift_tree_accounts is
  'Identity-scoped Gift Tree balances. Distinct from shareable christmas_trees.';
comment on table public.christmas_gift_tree_opens is
  'Recorded gift opens with catalog snapshots. Client cannot insert rewards.';
comment on table public.christmas_gift_tree_grants is
  'Idempotent Stripe webhook grants of paid opens. One row per christmas_order.';

commit;
