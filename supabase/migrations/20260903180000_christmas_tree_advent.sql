-- Christmas Tree + Advent + Free Gift foundation
-- Additive. Tree state separate from christmas_orders.
-- Monetary Advent credits remain inactive by default.

begin;

-- ---------------------------------------------------------------------------
-- Trees
-- ---------------------------------------------------------------------------
create table if not exists public.christmas_trees (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  owner_token_hash text,
  share_id text not null,
  share_enabled boolean not null default false,
  title text not null default 'My Christmas Tree',
  message text not null default '',
  from_name text not null default '',
  tree_style text not null default 'classic',
  decoration_config jsonb not null default '{}'::jsonb,
  locale text not null default 'en',
  moderation_status text not null default 'active',
  view_count integer not null default 0,
  share_count integer not null default 0,
  open_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_viewed_at timestamptz,
  constraint christmas_trees_style_chk check (
    tree_style in ('classic', 'snowy', 'gold', 'cozy', 'minimal', 'magical')
  ),
  constraint christmas_trees_mod_chk check (
    moderation_status in ('active', 'disabled', 'removed')
  ),
  constraint christmas_trees_title_chk check (char_length(title) between 1 and 80),
  constraint christmas_trees_message_chk check (char_length(message) <= 500),
  constraint christmas_trees_from_chk check (char_length(from_name) <= 80),
  constraint christmas_trees_share_id_chk check (char_length(share_id) >= 22),
  constraint christmas_trees_owner_presence_chk check (
    user_id is not null or (owner_token_hash is not null and length(owner_token_hash) = 64)
  )
);

create unique index if not exists christmas_trees_share_id_uidx
  on public.christmas_trees (share_id);
create index if not exists christmas_trees_user_idx
  on public.christmas_trees (user_id, created_at desc)
  where user_id is not null;
create index if not exists christmas_trees_owner_token_idx
  on public.christmas_trees (owner_token_hash)
  where owner_token_hash is not null;

drop trigger if exists christmas_trees_touch on public.christmas_trees;
create trigger christmas_trees_touch
before update on public.christmas_trees
for each row execute function public.christmas_touch_updated_at();

alter table public.christmas_trees enable row level security;

drop policy if exists christmas_trees_owner_select on public.christmas_trees;
create policy christmas_trees_owner_select
  on public.christmas_trees for select
  using (user_id = auth.uid() or public.is_admin());

revoke all on table public.christmas_trees from anon, authenticated, public;
grant select on table public.christmas_trees to authenticated;
grant all on table public.christmas_trees to service_role;

-- ---------------------------------------------------------------------------
-- Gifts
-- ---------------------------------------------------------------------------
create table if not exists public.christmas_tree_gifts (
  id uuid primary key default gen_random_uuid(),
  tree_id uuid not null references public.christmas_trees (id) on delete cascade,
  sort_order integer not null default 0,
  gift_type text not null default 'message',
  box_style text not null default 'red',
  display_name text not null default '',
  message text not null default '',
  unlock_mode text not null default 'immediate',
  unlock_at timestamptz,
  opened_at timestamptz,
  reward_definition_id uuid,
  linked_order_id uuid,
  linked_product_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint christmas_tree_gifts_type_chk check (
    gift_type in ('message', 'tdg_reward', 'product_link', 'cosmetic')
  ),
  constraint christmas_tree_gifts_box_chk check (
    box_style in ('red', 'gold', 'green', 'blue', 'snow')
  ),
  constraint christmas_tree_gifts_unlock_chk check (
    unlock_mode in ('immediate', 'on_date')
  ),
  constraint christmas_tree_gifts_name_chk check (char_length(display_name) <= 80),
  constraint christmas_tree_gifts_message_chk check (char_length(message) <= 800),
  constraint christmas_tree_gifts_sort_chk check (sort_order >= 0)
);

create index if not exists christmas_tree_gifts_tree_sort_idx
  on public.christmas_tree_gifts (tree_id, sort_order);

drop trigger if exists christmas_tree_gifts_touch on public.christmas_tree_gifts;
create trigger christmas_tree_gifts_touch
before update on public.christmas_tree_gifts
for each row execute function public.christmas_touch_updated_at();

alter table public.christmas_tree_gifts enable row level security;

drop policy if exists christmas_tree_gifts_owner_select on public.christmas_tree_gifts;
create policy christmas_tree_gifts_owner_select
  on public.christmas_tree_gifts for select
  using (
    exists (
      select 1 from public.christmas_trees t
      where t.id = tree_id and (t.user_id = auth.uid() or public.is_admin())
    )
  );

revoke all on table public.christmas_tree_gifts from anon, authenticated, public;
grant select on table public.christmas_tree_gifts to authenticated;
grant all on table public.christmas_tree_gifts to service_role;

-- ---------------------------------------------------------------------------
-- Advent rewards + claims
-- ---------------------------------------------------------------------------
create table if not exists public.christmas_advent_rewards (
  id uuid primary key default gen_random_uuid(),
  season_year integer not null,
  day integer not null,
  locale text not null default 'en',
  reward_type text not null,
  reward_value integer not null default 0,
  title text not null,
  description text not null default '',
  active boolean not null default false,
  max_global_claims integer,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint christmas_advent_rewards_day_chk check (day between 1 and 25),
  constraint christmas_advent_rewards_type_chk check (
    reward_type in ('credits', 'cosmetic', 'content_unlock', 'surprise_message', 'discount')
  ),
  constraint christmas_advent_rewards_value_chk check (reward_value >= 0),
  constraint christmas_advent_rewards_unique unique (season_year, day, locale)
);

drop trigger if exists christmas_advent_rewards_touch on public.christmas_advent_rewards;
create trigger christmas_advent_rewards_touch
before update on public.christmas_advent_rewards
for each row execute function public.christmas_touch_updated_at();

alter table public.christmas_advent_rewards enable row level security;

drop policy if exists christmas_advent_rewards_read on public.christmas_advent_rewards;
create policy christmas_advent_rewards_read
  on public.christmas_advent_rewards for select
  using (true);

revoke all on table public.christmas_advent_rewards from anon, authenticated, public;
grant select on table public.christmas_advent_rewards to anon, authenticated;
grant all on table public.christmas_advent_rewards to service_role;

create table if not exists public.christmas_advent_claims (
  id uuid primary key default gen_random_uuid(),
  reward_id uuid not null references public.christmas_advent_rewards (id) on delete cascade,
  user_id uuid references auth.users (id) on delete cascade,
  guest_token_hash text,
  season_year integer not null,
  day integer not null,
  claim_date date not null,
  ledger_entry_id uuid,
  entitlement_key text,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  constraint christmas_advent_claims_identity_chk check (
    user_id is not null or (guest_token_hash is not null and length(guest_token_hash) = 64)
  ),
  constraint christmas_advent_claims_day_chk check (day between 1 and 25)
);

create unique index if not exists christmas_advent_claims_idem_uidx
  on public.christmas_advent_claims (idempotency_key);
create unique index if not exists christmas_advent_claims_user_day_uidx
  on public.christmas_advent_claims (user_id, season_year, day)
  where user_id is not null;
create unique index if not exists christmas_advent_claims_guest_day_uidx
  on public.christmas_advent_claims (guest_token_hash, season_year, day)
  where guest_token_hash is not null;

alter table public.christmas_advent_claims enable row level security;

drop policy if exists christmas_advent_claims_own on public.christmas_advent_claims;
create policy christmas_advent_claims_own
  on public.christmas_advent_claims for select
  using (user_id = auth.uid() or public.is_admin());

revoke all on table public.christmas_advent_claims from anon, authenticated, public;
grant select on table public.christmas_advent_claims to authenticated;
grant all on table public.christmas_advent_claims to service_role;

-- ---------------------------------------------------------------------------
-- Free Christmas Gift
-- ---------------------------------------------------------------------------
create table if not exists public.christmas_free_gifts (
  id uuid primary key default gen_random_uuid(),
  season_year integer not null,
  reward_type text not null,
  reward_value integer not null default 0,
  title text not null,
  description text not null default '',
  weight integer not null default 1,
  active boolean not null default false,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint christmas_free_gifts_type_chk check (
    reward_type in ('cosmetic', 'surprise_message', 'content_unlock', 'credits')
  ),
  constraint christmas_free_gifts_weight_chk check (weight > 0),
  constraint christmas_free_gifts_value_chk check (reward_value >= 0)
);

alter table public.christmas_free_gifts enable row level security;
drop policy if exists christmas_free_gifts_read on public.christmas_free_gifts;
create policy christmas_free_gifts_read
  on public.christmas_free_gifts for select using (true);
revoke all on table public.christmas_free_gifts from anon, authenticated, public;
grant select on table public.christmas_free_gifts to anon, authenticated;
grant all on table public.christmas_free_gifts to service_role;

create table if not exists public.christmas_free_gift_claims (
  id uuid primary key default gen_random_uuid(),
  gift_id uuid not null references public.christmas_free_gifts (id) on delete cascade,
  user_id uuid references auth.users (id) on delete cascade,
  guest_token_hash text,
  season_year integer not null,
  ledger_entry_id uuid,
  entitlement_key text,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  constraint christmas_free_gift_claims_identity_chk check (
    user_id is not null or (guest_token_hash is not null and length(guest_token_hash) = 64)
  )
);

create unique index if not exists christmas_free_gift_claims_idem_uidx
  on public.christmas_free_gift_claims (idempotency_key);
create unique index if not exists christmas_free_gift_claims_user_season_uidx
  on public.christmas_free_gift_claims (user_id, season_year)
  where user_id is not null;
create unique index if not exists christmas_free_gift_claims_guest_season_uidx
  on public.christmas_free_gift_claims (guest_token_hash, season_year)
  where guest_token_hash is not null;

alter table public.christmas_free_gift_claims enable row level security;
drop policy if exists christmas_free_gift_claims_own on public.christmas_free_gift_claims;
create policy christmas_free_gift_claims_own
  on public.christmas_free_gift_claims for select
  using (user_id = auth.uid() or public.is_admin());
revoke all on table public.christmas_free_gift_claims from anon, authenticated, public;
grant select on table public.christmas_free_gift_claims to authenticated;
grant all on table public.christmas_free_gift_claims to service_role;

-- Non-cash entitlements (cosmetics etc.) — never confuse with EUR credits_ledger
create table if not exists public.christmas_reward_entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  guest_token_hash text,
  entitlement_key text not null,
  source text not null,
  source_ref text not null,
  created_at timestamptz not null default now(),
  constraint christmas_reward_entitlements_identity_chk check (
    user_id is not null or (guest_token_hash is not null and length(guest_token_hash) = 64)
  ),
  constraint christmas_reward_entitlements_source_chk check (
    source in ('christmas_advent', 'christmas_free_gift', 'christmas_tree')
  )
);

create unique index if not exists christmas_reward_entitlements_source_uidx
  on public.christmas_reward_entitlements (source, source_ref);
create index if not exists christmas_reward_entitlements_user_idx
  on public.christmas_reward_entitlements (user_id, entitlement_key)
  where user_id is not null;

alter table public.christmas_reward_entitlements enable row level security;
drop policy if exists christmas_reward_entitlements_own on public.christmas_reward_entitlements;
create policy christmas_reward_entitlements_own
  on public.christmas_reward_entitlements for select
  using (user_id = auth.uid() or public.is_admin());
revoke all on table public.christmas_reward_entitlements from anon, authenticated, public;
grant select on table public.christmas_reward_entitlements to authenticated;
grant all on table public.christmas_reward_entitlements to service_role;

-- Seed inactive Advent 2026 definitions (cosmetic / message only — credits inactive)
insert into public.christmas_advent_rewards
  (season_year, day, locale, reward_type, reward_value, title, description, active, config)
select
  2026,
  d,
  'en',
  case when d % 7 = 0 then 'cosmetic' else 'surprise_message' end,
  0,
  'Day ' || d::text,
  'Advent reward definition (inactive until season/flag enables).',
  false,
  case when d % 7 = 0
    then '{"entitlement_key":"gold_star_topper"}'::jsonb
    else '{"message":"A warm Christmas surprise awaits."}'::jsonb
  end
from generate_series(1, 24) as d
on conflict (season_year, day, locale) do nothing;

-- Free gift pool (inactive monetary credits; cosmetics/messages active for engine tests via flag)
insert into public.christmas_free_gifts
  (season_year, reward_type, reward_value, title, description, weight, active, config)
values
  (2026, 'cosmetic', 0, 'Snow Globe Ornament', 'Unlock a snow globe ornament for your Tree.', 3, false,
   '{"entitlement_key":"snow_globe_ornament"}'::jsonb),
  (2026, 'surprise_message', 0, 'Holiday Cheer', 'A warm Christmas note from The Digital Gifter.', 5, false,
   '{"message":"May your holidays sparkle."}'::jsonb),
  (2026, 'credits', 1, 'Test Credit (disabled)', 'Must stay inactive in production.', 1, false,
   '{"monetary":true}'::jsonb);

-- Catalog: tree/advent no longer coming_soon metadata for hub truthfulness
update public.christmas_products
set
  name = 'Shareable Christmas Tree',
  description = 'Decorate a Christmas tree, add gifts, and share securely.',
  metadata = coalesce(metadata, '{}'::jsonb) - 'coming_soon' || '{"tree_v1":true,"live_offer":false}'::jsonb
where product_key = 'christmas_tree';

update public.christmas_products
set
  name = 'Advent Calendar',
  description = 'Daily Christmas rewards — starts December 1.',
  metadata = coalesce(metadata, '{}'::jsonb) - 'coming_soon' || '{"advent_v1":true,"starts":"2026-12-01","live_offer":false}'::jsonb
where product_key = 'christmas_advent';

-- Idempotent Advent credit grants via note (same pattern as stripe:/generation:)
create unique index if not exists credits_ledger_christmas_advent_note_uidx
  on public.credits_ledger (note)
  where note like 'christmas_advent:%';

comment on table public.christmas_trees is
  'Interactive Christmas Tree. share_id is read-only public capability; owner_token_hash/user_id are write auth.';
comment on table public.christmas_advent_rewards is
  'Advent reward catalog. active=false by default; monetary credits never auto-enabled.';
comment on table public.christmas_reward_entitlements is
  'Non-cash Christmas entitlements (cosmetics). Distinct from credits_ledger EUR purchase credits.';

commit;
