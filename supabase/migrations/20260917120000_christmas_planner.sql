-- Christmas Planner V1 — product tables, RLS, catalog, entitlements.
-- Additive. Reuses christmas_orders / christmas-checkout. Does not replace
-- existing wishlist, gift finder, cards, messages, tree, or photo commerce.

begin;

-- ---------------------------------------------------------------------------
-- Feature keys (package mapping lives in app + grant RPC)
-- ---------------------------------------------------------------------------

create table if not exists public.christmas_feature_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  email_normalized text,
  feature_key text not null,
  source text not null default 'order',
  source_ref text,
  order_id uuid references public.christmas_orders (id) on delete set null,
  season_year integer not null,
  status text not null default 'active',
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint christmas_feature_grants_key_chk check (
    feature_key in (
      'planner_core',
      'gift_planner',
      'budget',
      'food_planner',
      'recipes',
      'hosting',
      'travel',
      'advanced_planning',
      'rescue_mode',
      'premium_content'
    )
  ),
  constraint christmas_feature_grants_source_chk check (
    source in ('order', 'addon', 'admin', 'claim', 'promo')
  ),
  constraint christmas_feature_grants_status_chk check (
    status in ('active', 'revoked', 'expired')
  ),
  constraint christmas_feature_grants_year_chk check (season_year between 2024 and 2100),
  constraint christmas_feature_grants_owner_chk check (
    user_id is not null or (email_normalized is not null and length(email_normalized) >= 5)
  )
);

create unique index if not exists christmas_feature_grants_user_feat_uidx
  on public.christmas_feature_grants (user_id, feature_key, season_year)
  where user_id is not null and status = 'active';

-- Guest + authenticated webhook replay: one logical grant per order/feature/season.
-- Includes revoked rows so a replay cannot recreate access after revoke/refund.
create unique index if not exists christmas_feature_grants_order_feat_uidx
  on public.christmas_feature_grants (order_id, feature_key, season_year)
  where order_id is not null;

create index if not exists christmas_feature_grants_email_idx
  on public.christmas_feature_grants (email_normalized, season_year)
  where email_normalized is not null;

create index if not exists christmas_feature_grants_order_idx
  on public.christmas_feature_grants (order_id)
  where order_id is not null;

drop trigger if exists christmas_feature_grants_touch on public.christmas_feature_grants;
create trigger christmas_feature_grants_touch
before update on public.christmas_feature_grants
for each row execute function public.christmas_touch_updated_at();

alter table public.christmas_feature_grants enable row level security;

drop policy if exists christmas_feature_grants_owner_select on public.christmas_feature_grants;
create policy christmas_feature_grants_owner_select
  on public.christmas_feature_grants for select
  using (
    public.is_admin()
    or (user_id is not null and user_id = auth.uid())
  );

revoke all on table public.christmas_feature_grants from anon, authenticated, public;
grant select on table public.christmas_feature_grants to authenticated;
grant all on table public.christmas_feature_grants to service_role;

-- ---------------------------------------------------------------------------
-- Planner profile (one per user per season)
-- ---------------------------------------------------------------------------

create table if not exists public.christmas_planner_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  season_year integer not null,
  country_code text not null default 'US',
  currency text not null default 'eur',
  timezone text not null default 'UTC',
  household_label text not null default '',
  recipient_count_approx integer not null default 3,
  total_budget_minor integer,
  hosting boolean not null default false,
  travelling boolean not null default false,
  has_children boolean not null default false,
  prepared_level text not null default 'starting',
  known_dates jsonb not null default '[]'::jsonb,
  onboarding_completed_at timestamptz,
  plan_mode text not null default 'standard',
  locale text not null default 'en',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint christmas_planner_profiles_year_chk check (season_year between 2024 and 2100),
  constraint christmas_planner_profiles_currency_chk check (
    currency in ('eur', 'usd', 'gbp', 'ron')
  ),
  constraint christmas_planner_profiles_country_chk check (char_length(country_code) between 2 and 8),
  constraint christmas_planner_profiles_recipients_chk check (
    recipient_count_approx between 0 and 200
  ),
  constraint christmas_planner_profiles_budget_chk check (
    total_budget_minor is null or total_budget_minor >= 0
  ),
  constraint christmas_planner_profiles_prepared_chk check (
    prepared_level in ('starting', 'some', 'mostly', 'rescue')
  ),
  constraint christmas_planner_profiles_plan_chk check (
    plan_mode in ('early', 'standard', 'sprint', 'rescue', 'wrap')
  ),
  constraint christmas_planner_profiles_household_chk check (char_length(household_label) <= 80)
);

create unique index if not exists christmas_planner_profiles_user_year_uidx
  on public.christmas_planner_profiles (user_id, season_year);

create index if not exists christmas_planner_profiles_user_idx
  on public.christmas_planner_profiles (user_id, updated_at desc);

drop trigger if exists christmas_planner_profiles_touch on public.christmas_planner_profiles;
create trigger christmas_planner_profiles_touch
before update on public.christmas_planner_profiles
for each row execute function public.christmas_touch_updated_at();

alter table public.christmas_planner_profiles enable row level security;

drop policy if exists christmas_planner_profiles_owner_all on public.christmas_planner_profiles;
create policy christmas_planner_profiles_owner_all
  on public.christmas_planner_profiles for all
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

revoke all on table public.christmas_planner_profiles from anon, authenticated, public;
grant select, insert, update, delete on table public.christmas_planner_profiles to authenticated;
grant all on table public.christmas_planner_profiles to service_role;

create or replace function public.christmas_planner_owns_profile(p_profile_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1
    from public.christmas_planner_profiles p
    where p.id = p_profile_id
      and p.user_id = auth.uid()
  );
$$;

revoke all on function public.christmas_planner_owns_profile(uuid) from public, anon;
grant execute on function public.christmas_planner_owns_profile(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Tasks
-- ---------------------------------------------------------------------------

create table if not exists public.christmas_planner_tasks (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.christmas_planner_profiles (id) on delete cascade,
  title text not null,
  category text not null default 'other',
  due_on date,
  status text not null default 'open',
  priority text not null default 'normal',
  notes text not null default '',
  origin text not null default 'system',
  template_key text,
  skipped_reason text,
  completed_at timestamptz,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint christmas_planner_tasks_title_chk check (char_length(title) between 1 and 160),
  constraint christmas_planner_tasks_notes_chk check (char_length(notes) <= 2000),
  constraint christmas_planner_tasks_category_chk check (
    category in (
      'gifts', 'shopping', 'cards', 'food', 'hosting', 'home',
      'decorating', 'travel', 'family', 'events', 'personal', 'other'
    )
  ),
  constraint christmas_planner_tasks_status_chk check (
    status in ('open', 'done', 'skipped', 'rescheduled')
  ),
  constraint christmas_planner_tasks_priority_chk check (
    priority in ('low', 'normal', 'high')
  ),
  constraint christmas_planner_tasks_origin_chk check (
    origin in ('system', 'user')
  )
);

create index if not exists christmas_planner_tasks_profile_due_idx
  on public.christmas_planner_tasks (profile_id, due_on, status);

drop trigger if exists christmas_planner_tasks_touch on public.christmas_planner_tasks;
create trigger christmas_planner_tasks_touch
before update on public.christmas_planner_tasks
for each row execute function public.christmas_touch_updated_at();

alter table public.christmas_planner_tasks enable row level security;

drop policy if exists christmas_planner_tasks_owner_all on public.christmas_planner_tasks;
create policy christmas_planner_tasks_owner_all
  on public.christmas_planner_tasks for all
  using (public.christmas_planner_owns_profile(profile_id) or public.is_admin())
  with check (public.christmas_planner_owns_profile(profile_id) or public.is_admin());

revoke all on table public.christmas_planner_tasks from anon, authenticated, public;
grant select, insert, update, delete on table public.christmas_planner_tasks to authenticated;
grant all on table public.christmas_planner_tasks to service_role;

-- ---------------------------------------------------------------------------
-- Gifts I am giving
-- ---------------------------------------------------------------------------

create table if not exists public.christmas_gift_recipients (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.christmas_planner_profiles (id) on delete cascade,
  display_name text not null,
  relationship text not null default 'other',
  budget_minor integer,
  notes text not null default '',
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint christmas_gift_recipients_name_chk check (char_length(display_name) between 1 and 80),
  constraint christmas_gift_recipients_rel_chk check (char_length(relationship) between 1 and 40),
  constraint christmas_gift_recipients_notes_chk check (char_length(notes) <= 1000),
  constraint christmas_gift_recipients_budget_chk check (
    budget_minor is null or budget_minor >= 0
  )
);

create index if not exists christmas_gift_recipients_profile_idx
  on public.christmas_gift_recipients (profile_id, sort_order);

drop trigger if exists christmas_gift_recipients_touch on public.christmas_gift_recipients;
create trigger christmas_gift_recipients_touch
before update on public.christmas_gift_recipients
for each row execute function public.christmas_touch_updated_at();

alter table public.christmas_gift_recipients enable row level security;

drop policy if exists christmas_gift_recipients_owner_all on public.christmas_gift_recipients;
create policy christmas_gift_recipients_owner_all
  on public.christmas_gift_recipients for all
  using (public.christmas_planner_owns_profile(profile_id) or public.is_admin())
  with check (public.christmas_planner_owns_profile(profile_id) or public.is_admin());

revoke all on table public.christmas_gift_recipients from anon, authenticated, public;
grant select, insert, update, delete on table public.christmas_gift_recipients to authenticated;
grant all on table public.christmas_gift_recipients to service_role;

create table if not exists public.christmas_gift_items (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.christmas_planner_profiles (id) on delete cascade,
  recipient_id uuid not null references public.christmas_gift_recipients (id) on delete cascade,
  idea text not null default '',
  selected_gift text not null default '',
  url text,
  store text not null default '',
  planned_price_minor integer,
  actual_price_minor integer,
  status text not null default 'idea',
  hiding_place text not null default '',
  delivery_on date,
  return_deadline date,
  source_type text not null default 'manual',
  source_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint christmas_gift_items_idea_chk check (char_length(idea) <= 200),
  constraint christmas_gift_items_selected_chk check (char_length(selected_gift) <= 200),
  constraint christmas_gift_items_store_chk check (char_length(store) <= 80),
  constraint christmas_gift_items_hide_chk check (char_length(hiding_place) <= 120),
  constraint christmas_gift_items_status_chk check (
    status in ('idea', 'planned', 'ordered', 'arrived', 'hidden', 'wrapped', 'given')
  ),
  constraint christmas_gift_items_source_chk check (
    source_type in ('manual', 'gift_finder', 'wishlist')
  ),
  constraint christmas_gift_items_price_chk check (
    (planned_price_minor is null or planned_price_minor >= 0)
    and (actual_price_minor is null or actual_price_minor >= 0)
  )
);

create index if not exists christmas_gift_items_recipient_idx
  on public.christmas_gift_items (recipient_id, status);

create index if not exists christmas_gift_items_profile_status_idx
  on public.christmas_gift_items (profile_id, status);

drop trigger if exists christmas_gift_items_touch on public.christmas_gift_items;
create trigger christmas_gift_items_touch
before update on public.christmas_gift_items
for each row execute function public.christmas_touch_updated_at();

alter table public.christmas_gift_items enable row level security;

drop policy if exists christmas_gift_items_owner_all on public.christmas_gift_items;
create policy christmas_gift_items_owner_all
  on public.christmas_gift_items for all
  using (public.christmas_planner_owns_profile(profile_id) or public.is_admin())
  with check (public.christmas_planner_owns_profile(profile_id) or public.is_admin());

revoke all on table public.christmas_gift_items from anon, authenticated, public;
grant select, insert, update, delete on table public.christmas_gift_items to authenticated;
grant all on table public.christmas_gift_items to service_role;

-- ---------------------------------------------------------------------------
-- Budget
-- ---------------------------------------------------------------------------

create table if not exists public.christmas_budget_entries (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.christmas_planner_profiles (id) on delete cascade,
  category text not null,
  label text not null default '',
  planned_minor integer not null default 0,
  spent_minor integer not null default 0,
  source_type text not null default 'manual',
  source_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint christmas_budget_entries_cat_chk check (
    category in ('gifts', 'food', 'travel', 'decor', 'events', 'clothing', 'charity', 'other')
  ),
  constraint christmas_budget_entries_label_chk check (char_length(label) <= 80),
  constraint christmas_budget_entries_amounts_chk check (
    planned_minor >= 0 and spent_minor >= 0
  ),
  constraint christmas_budget_entries_source_chk check (
    source_type in ('manual', 'gift', 'grocery', 'system')
  )
);

create index if not exists christmas_budget_entries_profile_idx
  on public.christmas_budget_entries (profile_id, category);

drop trigger if exists christmas_budget_entries_touch on public.christmas_budget_entries;
create trigger christmas_budget_entries_touch
before update on public.christmas_budget_entries
for each row execute function public.christmas_touch_updated_at();

alter table public.christmas_budget_entries enable row level security;

drop policy if exists christmas_budget_entries_owner_all on public.christmas_budget_entries;
create policy christmas_budget_entries_owner_all
  on public.christmas_budget_entries for all
  using (public.christmas_planner_owns_profile(profile_id) or public.is_admin())
  with check (public.christmas_planner_owns_profile(profile_id) or public.is_admin());

revoke all on table public.christmas_budget_entries from anon, authenticated, public;
grant select, insert, update, delete on table public.christmas_budget_entries to authenticated;
grant all on table public.christmas_budget_entries to service_role;

-- ---------------------------------------------------------------------------
-- Events / calendar
-- ---------------------------------------------------------------------------

create table if not exists public.christmas_events (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.christmas_planner_profiles (id) on delete cascade,
  title text not null,
  event_kind text not null default 'personal',
  starts_on date not null,
  ends_on date,
  notes text not null default '',
  source_type text not null default 'manual',
  source_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint christmas_events_title_chk check (char_length(title) between 1 and 120),
  constraint christmas_events_kind_chk check (
    event_kind in ('task', 'personal', 'delivery', 'hosting', 'travel', 'cards', 'other')
  ),
  constraint christmas_events_notes_chk check (char_length(notes) <= 1000)
);

create index if not exists christmas_events_profile_date_idx
  on public.christmas_events (profile_id, starts_on);

drop trigger if exists christmas_events_touch on public.christmas_events;
create trigger christmas_events_touch
before update on public.christmas_events
for each row execute function public.christmas_touch_updated_at();

alter table public.christmas_events enable row level security;

drop policy if exists christmas_events_owner_all on public.christmas_events;
create policy christmas_events_owner_all
  on public.christmas_events for all
  using (public.christmas_planner_owns_profile(profile_id) or public.is_admin())
  with check (public.christmas_planner_owns_profile(profile_id) or public.is_admin());

revoke all on table public.christmas_events from anon, authenticated, public;
grant select, insert, update, delete on table public.christmas_events to authenticated;
grant all on table public.christmas_events to service_role;

-- ---------------------------------------------------------------------------
-- Recipes (catalog) + meals + grocery
-- ---------------------------------------------------------------------------

create table if not exists public.christmas_recipes (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  title text not null,
  description text not null default '',
  ingredients jsonb not null default '[]'::jsonb,
  steps jsonb not null default '[]'::jsonb,
  servings integer not null default 6,
  prep_minutes integer not null default 15,
  cook_minutes integer not null default 30,
  category text not null default 'easy',
  tags text[] not null default '{}',
  image_path text,
  locale text not null default 'en',
  entitlement_key text not null default 'recipes',
  teaser boolean not null default false,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint christmas_recipes_slug_chk check (char_length(slug) between 2 and 80),
  constraint christmas_recipes_title_chk check (char_length(title) between 1 and 120),
  constraint christmas_recipes_servings_chk check (servings between 1 and 50),
  constraint christmas_recipes_category_chk check (
    category in (
      'christmas_dinner', 'side_dishes', 'desserts', 'cookies',
      'drinks', 'breakfast', 'easy', 'make_ahead', 'vegetarian', 'family_kids'
    )
  ),
  constraint christmas_recipes_entitlement_chk check (
    entitlement_key in ('recipes', 'premium_content', 'free')
  )
);

create unique index if not exists christmas_recipes_slug_uidx
  on public.christmas_recipes (slug);

drop trigger if exists christmas_recipes_touch on public.christmas_recipes;
create trigger christmas_recipes_touch
before update on public.christmas_recipes
for each row execute function public.christmas_touch_updated_at();

alter table public.christmas_recipes enable row level security;

drop policy if exists christmas_recipes_public_select on public.christmas_recipes;
create policy christmas_recipes_public_select
  on public.christmas_recipes for select
  using (published = true);

revoke all on table public.christmas_recipes from anon, authenticated, public;
grant select on table public.christmas_recipes to anon, authenticated;
grant all on table public.christmas_recipes to service_role;

create table if not exists public.christmas_recipe_saves (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.christmas_planner_profiles (id) on delete cascade,
  recipe_id uuid not null references public.christmas_recipes (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (profile_id, recipe_id)
);

alter table public.christmas_recipe_saves enable row level security;

drop policy if exists christmas_recipe_saves_owner_all on public.christmas_recipe_saves;
create policy christmas_recipe_saves_owner_all
  on public.christmas_recipe_saves for all
  using (public.christmas_planner_owns_profile(profile_id) or public.is_admin())
  with check (public.christmas_planner_owns_profile(profile_id) or public.is_admin());

revoke all on table public.christmas_recipe_saves from anon, authenticated, public;
grant select, insert, update, delete on table public.christmas_recipe_saves to authenticated;
grant all on table public.christmas_recipe_saves to service_role;

create table if not exists public.christmas_meals (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.christmas_planner_profiles (id) on delete cascade,
  section text not null default 'christmas_day',
  title text not null,
  meal_on date,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint christmas_meals_section_chk check (
    section in (
      'christmas_eve', 'christmas_day', 'parties', 'breakfast', 'desserts', 'drinks', 'other'
    )
  ),
  constraint christmas_meals_title_chk check (char_length(title) between 1 and 120),
  constraint christmas_meals_notes_chk check (char_length(notes) <= 1000)
);

create index if not exists christmas_meals_profile_idx
  on public.christmas_meals (profile_id, section);

drop trigger if exists christmas_meals_touch on public.christmas_meals;
create trigger christmas_meals_touch
before update on public.christmas_meals
for each row execute function public.christmas_touch_updated_at();

alter table public.christmas_meals enable row level security;

drop policy if exists christmas_meals_owner_all on public.christmas_meals;
create policy christmas_meals_owner_all
  on public.christmas_meals for all
  using (public.christmas_planner_owns_profile(profile_id) or public.is_admin())
  with check (public.christmas_planner_owns_profile(profile_id) or public.is_admin());

revoke all on table public.christmas_meals from anon, authenticated, public;
grant select, insert, update, delete on table public.christmas_meals to authenticated;
grant all on table public.christmas_meals to service_role;

create table if not exists public.christmas_meal_items (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.christmas_planner_profiles (id) on delete cascade,
  meal_id uuid not null references public.christmas_meals (id) on delete cascade,
  recipe_id uuid references public.christmas_recipes (id) on delete set null,
  dish_name text not null,
  servings integer not null default 6,
  prep_minutes integer,
  cook_minutes integer,
  day_time text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint christmas_meal_items_name_chk check (char_length(dish_name) between 1 and 120),
  constraint christmas_meal_items_servings_chk check (servings between 1 and 50),
  constraint christmas_meal_items_notes_chk check (char_length(notes) <= 500)
);

create index if not exists christmas_meal_items_meal_idx
  on public.christmas_meal_items (meal_id);

drop trigger if exists christmas_meal_items_touch on public.christmas_meal_items;
create trigger christmas_meal_items_touch
before update on public.christmas_meal_items
for each row execute function public.christmas_touch_updated_at();

alter table public.christmas_meal_items enable row level security;

drop policy if exists christmas_meal_items_owner_all on public.christmas_meal_items;
create policy christmas_meal_items_owner_all
  on public.christmas_meal_items for all
  using (public.christmas_planner_owns_profile(profile_id) or public.is_admin())
  with check (public.christmas_planner_owns_profile(profile_id) or public.is_admin());

revoke all on table public.christmas_meal_items from anon, authenticated, public;
grant select, insert, update, delete on table public.christmas_meal_items to authenticated;
grant all on table public.christmas_meal_items to service_role;

create table if not exists public.christmas_grocery_items (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.christmas_planner_profiles (id) on delete cascade,
  name text not null,
  quantity text not null default '',
  status text not null default 'need',
  source_type text not null default 'manual',
  meal_item_id uuid references public.christmas_meal_items (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint christmas_grocery_items_name_chk check (char_length(name) between 1 and 120),
  constraint christmas_grocery_items_qty_chk check (char_length(quantity) <= 40),
  constraint christmas_grocery_items_status_chk check (
    status in ('have', 'need', 'bought')
  )
);

create index if not exists christmas_grocery_items_profile_idx
  on public.christmas_grocery_items (profile_id, status);

drop trigger if exists christmas_grocery_items_touch on public.christmas_grocery_items;
create trigger christmas_grocery_items_touch
before update on public.christmas_grocery_items
for each row execute function public.christmas_touch_updated_at();

alter table public.christmas_grocery_items enable row level security;

drop policy if exists christmas_grocery_items_owner_all on public.christmas_grocery_items;
create policy christmas_grocery_items_owner_all
  on public.christmas_grocery_items for all
  using (public.christmas_planner_owns_profile(profile_id) or public.is_admin())
  with check (public.christmas_planner_owns_profile(profile_id) or public.is_admin());

revoke all on table public.christmas_grocery_items from anon, authenticated, public;
grant select, insert, update, delete on table public.christmas_grocery_items to authenticated;
grant all on table public.christmas_grocery_items to service_role;

-- ---------------------------------------------------------------------------
-- Hosting, home, travel, traditions, memories
-- ---------------------------------------------------------------------------

create table if not exists public.christmas_guests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.christmas_planner_profiles (id) on delete cascade,
  display_name text not null,
  rsvp text not null default 'maybe',
  adults integer not null default 1,
  kids integer not null default 0,
  dietary text not null default '',
  sleeping text not null default '',
  bringing text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint christmas_guests_name_chk check (char_length(display_name) between 1 and 80),
  constraint christmas_guests_rsvp_chk check (rsvp in ('yes', 'no', 'maybe')),
  constraint christmas_guests_counts_chk check (adults between 0 and 20 and kids between 0 and 20),
  constraint christmas_guests_dietary_chk check (char_length(dietary) <= 200),
  constraint christmas_guests_sleeping_chk check (char_length(sleeping) <= 120),
  constraint christmas_guests_bringing_chk check (char_length(bringing) <= 200)
);

create index if not exists christmas_guests_profile_idx
  on public.christmas_guests (profile_id);

drop trigger if exists christmas_guests_touch on public.christmas_guests;
create trigger christmas_guests_touch
before update on public.christmas_guests
for each row execute function public.christmas_touch_updated_at();

alter table public.christmas_guests enable row level security;

drop policy if exists christmas_guests_owner_all on public.christmas_guests;
create policy christmas_guests_owner_all
  on public.christmas_guests for all
  using (public.christmas_planner_owns_profile(profile_id) or public.is_admin())
  with check (public.christmas_planner_owns_profile(profile_id) or public.is_admin());

revoke all on table public.christmas_guests from anon, authenticated, public;
grant select, insert, update, delete on table public.christmas_guests to authenticated;
grant all on table public.christmas_guests to service_role;

create table if not exists public.christmas_home_items (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.christmas_planner_profiles (id) on delete cascade,
  area text not null default 'other',
  title text not null,
  status text not null default 'todo',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint christmas_home_items_area_chk check (
    area in ('tree', 'living_room', 'dining', 'outside', 'guest_rooms', 'other')
  ),
  constraint christmas_home_items_status_chk check (
    status in ('todo', 'owned', 'need_buy', 'done')
  ),
  constraint christmas_home_items_title_chk check (char_length(title) between 1 and 120),
  constraint christmas_home_items_notes_chk check (char_length(notes) <= 500)
);

create index if not exists christmas_home_items_profile_idx
  on public.christmas_home_items (profile_id, area);

drop trigger if exists christmas_home_items_touch on public.christmas_home_items;
create trigger christmas_home_items_touch
before update on public.christmas_home_items
for each row execute function public.christmas_touch_updated_at();

alter table public.christmas_home_items enable row level security;

drop policy if exists christmas_home_items_owner_all on public.christmas_home_items;
create policy christmas_home_items_owner_all
  on public.christmas_home_items for all
  using (public.christmas_planner_owns_profile(profile_id) or public.is_admin())
  with check (public.christmas_planner_owns_profile(profile_id) or public.is_admin());

revoke all on table public.christmas_home_items from anon, authenticated, public;
grant select, insert, update, delete on table public.christmas_home_items to authenticated;
grant all on table public.christmas_home_items to service_role;

create table if not exists public.christmas_trips (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.christmas_planner_profiles (id) on delete cascade,
  destination text not null,
  start_on date,
  end_on date,
  booking_notes text not null default '',
  packing text not null default '',
  gifts_to_take text not null default '',
  home_arrangements text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint christmas_trips_dest_chk check (char_length(destination) between 1 and 120),
  constraint christmas_trips_notes_chk check (
    char_length(booking_notes) <= 500
    and char_length(packing) <= 1000
    and char_length(gifts_to_take) <= 500
    and char_length(home_arrangements) <= 500
  )
);

create index if not exists christmas_trips_profile_idx
  on public.christmas_trips (profile_id);

drop trigger if exists christmas_trips_touch on public.christmas_trips;
create trigger christmas_trips_touch
before update on public.christmas_trips
for each row execute function public.christmas_touch_updated_at();

alter table public.christmas_trips enable row level security;

drop policy if exists christmas_trips_owner_all on public.christmas_trips;
create policy christmas_trips_owner_all
  on public.christmas_trips for all
  using (public.christmas_planner_owns_profile(profile_id) or public.is_admin())
  with check (public.christmas_planner_owns_profile(profile_id) or public.is_admin());

revoke all on table public.christmas_trips from anon, authenticated, public;
grant select, insert, update, delete on table public.christmas_trips to authenticated;
grant all on table public.christmas_trips to service_role;

create table if not exists public.christmas_traditions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.christmas_planner_profiles (id) on delete cascade,
  title text not null,
  idea_key text,
  status text not null default 'saved',
  scheduled_on date,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint christmas_traditions_title_chk check (char_length(title) between 1 and 120),
  constraint christmas_traditions_status_chk check (
    status in ('saved', 'scheduled', 'done')
  ),
  constraint christmas_traditions_notes_chk check (char_length(notes) <= 500)
);

create index if not exists christmas_traditions_profile_idx
  on public.christmas_traditions (profile_id, status);

drop trigger if exists christmas_traditions_touch on public.christmas_traditions;
create trigger christmas_traditions_touch
before update on public.christmas_traditions
for each row execute function public.christmas_touch_updated_at();

alter table public.christmas_traditions enable row level security;

drop policy if exists christmas_traditions_owner_all on public.christmas_traditions;
create policy christmas_traditions_owner_all
  on public.christmas_traditions for all
  using (public.christmas_planner_owns_profile(profile_id) or public.is_admin())
  with check (public.christmas_planner_owns_profile(profile_id) or public.is_admin());

revoke all on table public.christmas_traditions from anon, authenticated, public;
grant select, insert, update, delete on table public.christmas_traditions to authenticated;
grant all on table public.christmas_traditions to service_role;

create table if not exists public.christmas_memories (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.christmas_planner_profiles (id) on delete cascade,
  entry_kind text not null default 'moment',
  title text not null default '',
  body text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint christmas_memories_kind_chk check (
    entry_kind in ('photo_note', 'moment', 'meal', 'tradition', 'next_year')
  ),
  constraint christmas_memories_title_chk check (char_length(title) <= 120),
  constraint christmas_memories_body_chk check (char_length(body) <= 2000)
);

create index if not exists christmas_memories_profile_idx
  on public.christmas_memories (profile_id, created_at desc);

drop trigger if exists christmas_memories_touch on public.christmas_memories;
create trigger christmas_memories_touch
before update on public.christmas_memories
for each row execute function public.christmas_touch_updated_at();

alter table public.christmas_memories enable row level security;

drop policy if exists christmas_memories_owner_all on public.christmas_memories;
create policy christmas_memories_owner_all
  on public.christmas_memories for all
  using (public.christmas_planner_owns_profile(profile_id) or public.is_admin())
  with check (public.christmas_planner_owns_profile(profile_id) or public.is_admin());

revoke all on table public.christmas_memories from anon, authenticated, public;
grant select, insert, update, delete on table public.christmas_memories to authenticated;
grant all on table public.christmas_memories to service_role;

create table if not exists public.christmas_card_tracker (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.christmas_planner_profiles (id) on delete cascade,
  contact_name text not null,
  needs_card boolean not null default true,
  status text not null default 'needed',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint christmas_card_tracker_name_chk check (char_length(contact_name) between 1 and 80),
  constraint christmas_card_tracker_status_chk check (
    status in ('needed', 'prepared', 'sent')
  )
);

create index if not exists christmas_card_tracker_profile_idx
  on public.christmas_card_tracker (profile_id, status);

drop trigger if exists christmas_card_tracker_touch on public.christmas_card_tracker;
create trigger christmas_card_tracker_touch
before update on public.christmas_card_tracker
for each row execute function public.christmas_touch_updated_at();

alter table public.christmas_card_tracker enable row level security;

drop policy if exists christmas_card_tracker_owner_all on public.christmas_card_tracker;
create policy christmas_card_tracker_owner_all
  on public.christmas_card_tracker for all
  using (public.christmas_planner_owns_profile(profile_id) or public.is_admin())
  with check (public.christmas_planner_owns_profile(profile_id) or public.is_admin());

revoke all on table public.christmas_card_tracker from anon, authenticated, public;
grant select, insert, update, delete on table public.christmas_card_tracker to authenticated;
grant all on table public.christmas_card_tracker to service_role;

-- ---------------------------------------------------------------------------
-- Entitlement RPCs (server-authoritative; never trust client isPremium)
-- ---------------------------------------------------------------------------

create or replace function public.christmas_planner_season_year(p_at timestamptz default now())
returns integer
language sql
stable
as $$
  select case
    when extract(month from p_at) = 12 and extract(day from p_at) >= 26
      then extract(year from p_at)::integer + 1
    else extract(year from p_at)::integer
  end;
$$;

revoke all on function public.christmas_planner_season_year(timestamptz) from public;
grant execute on function public.christmas_planner_season_year(timestamptz) to anon, authenticated, service_role;

create or replace function public.christmas_planner_package_features(p_package_key text)
returns text[]
language sql
immutable
as $$
  select case p_package_key
    when 'essentials' then array[
      'planner_core', 'gift_planner', 'budget', 'advanced_planning', 'rescue_mode'
    ]
    when 'core' then array[
      'planner_core', 'gift_planner', 'budget', 'advanced_planning', 'rescue_mode'
    ]
    when 'magic' then array[
      'planner_core', 'gift_planner', 'budget', 'food_planner', 'recipes',
      'hosting', 'travel', 'advanced_planning', 'rescue_mode', 'premium_content'
    ]
    when 'complete' then array[
      'planner_core', 'gift_planner', 'budget', 'food_planner', 'recipes',
      'hosting', 'travel', 'advanced_planning', 'rescue_mode', 'premium_content'
    ]
    when 'all_in' then array[
      'planner_core', 'gift_planner', 'budget', 'food_planner', 'recipes',
      'hosting', 'travel', 'advanced_planning', 'rescue_mode', 'premium_content'
    ]
    when 'food' then array['food_planner', 'recipes']
    when 'recipes' then array['recipes', 'premium_content']
    when 'hosting' then array['hosting']
    when 'travel' then array['travel']
    else array[]::text[]
  end;
$$;

create or replace function public.christmas_planner_features_for_product(
  p_product_key text,
  p_package_key text
)
returns text[]
language sql
immutable
as $$
  select case p_product_key
    when 'christmas_planner_food' then public.christmas_planner_package_features('food')
    when 'christmas_planner_recipes' then public.christmas_planner_package_features('recipes')
    when 'christmas_planner_hosting' then public.christmas_planner_package_features('hosting')
    when 'christmas_planner_travel' then public.christmas_planner_package_features('travel')
    else public.christmas_planner_package_features(p_package_key)
  end;
$$;

create or replace function public.grant_christmas_planner_entitlements(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  ord public.christmas_orders%rowtype;
  feat text;
  features text[] := array[]::text[];
  email_norm text;
  season integer;
  addon_key text;
begin
  select * into ord from public.christmas_orders where id = p_order_id;
  if not found then
    return;
  end if;
  if ord.payment_status is distinct from 'paid' then
    return;
  end if;
  if ord.refunded_at is not null then
    return;
  end if;
  if ord.product_key not like 'christmas_planner%' then
    return;
  end if;

  email_norm := lower(trim(coalesce(ord.email_normalized, ord.email, '')));
  season := coalesce(
    nullif((ord.metadata->>'season_year')::integer, 0),
    public.christmas_planner_season_year(coalesce(ord.paid_at, now()))
  );

  features := public.christmas_planner_features_for_product(ord.product_key, ord.package_key);

  if jsonb_typeof(ord.metadata->'addon_keys') = 'array' then
    for addon_key in
      select jsonb_array_elements_text(ord.metadata->'addon_keys')
    loop
      features := array(
        select distinct x from unnest(
          features || public.christmas_planner_package_features(addon_key)
        ) as x
        where x is not null
      );
    end loop;
  end if;

  foreach feat in array coalesce(features, array[]::text[]) loop
    if exists (
      select 1
      from public.christmas_feature_grants g
      where g.order_id = p_order_id
        and g.feature_key = feat
        and g.season_year = season
        and g.status in ('revoked', 'expired')
    ) then
      continue;
    end if;

    begin
      insert into public.christmas_feature_grants (
        user_id, email_normalized, feature_key, source, source_ref, order_id, season_year, status
      )
      values (
        ord.user_id,
        nullif(email_norm, ''),
        feat,
        'order',
        p_order_id::text,
        p_order_id,
        season,
        'active'
      );
    exception
      when unique_violation then
        null;
    end;
  end loop;

  update public.christmas_orders
  set
    fulfillment_status = 'completed',
    fulfillment_completed_at = coalesce(fulfillment_completed_at, now()),
    updated_at = now()
  where id = p_order_id
    and fulfillment_status is distinct from 'completed';
end;
$$;

revoke all on function public.grant_christmas_planner_entitlements(uuid) from public;
grant execute on function public.grant_christmas_planner_entitlements(uuid) to service_role;

create or replace function public.revoke_christmas_planner_entitlements(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.christmas_feature_grants
  set status = 'revoked', updated_at = now()
  where order_id = p_order_id
    and status = 'active';

  return jsonb_build_object(
    'ok', true,
    'revoked', (select count(*) from public.christmas_feature_grants where order_id = p_order_id and status = 'revoked')
  );
end;
$$;

revoke all on function public.revoke_christmas_planner_entitlements(uuid) from public;
grant execute on function public.revoke_christmas_planner_entitlements(uuid) to service_role;

create or replace function public.refund_christmas_planner_order(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  updated integer;
begin
  update public.christmas_orders
  set
    payment_status = 'refunded',
    refunded_at = coalesce(refunded_at, now()),
    updated_at = now()
  where id = p_order_id
    and product_key like 'christmas_planner%';
  get diagnostics updated = row_count;

  perform public.revoke_christmas_planner_entitlements(p_order_id);

  return jsonb_build_object('ok', true, 'matched', updated > 0);
end;
$$;

revoke all on function public.refund_christmas_planner_order(uuid) from public;
grant execute on function public.refund_christmas_planner_order(uuid) to service_role;

create or replace function public.claim_christmas_planner_grants_for_user()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid;
  email_norm text;
  confirmed_at timestamptz;
begin
  uid := auth.uid();
  if uid is null then
    return jsonb_build_object('ok', false, 'code', 'not_authenticated');
  end if;

  select lower(trim(email)), email_confirmed_at
    into email_norm, confirmed_at
  from auth.users
  where id = uid;

  if email_norm is null or confirmed_at is null then
    return jsonb_build_object('ok', false, 'code', 'email_unverified');
  end if;

  -- Attach unclaimed guest orders for this verified email only.
  -- Never take an order already bound to another user.
  update public.christmas_orders
  set user_id = uid, updated_at = now()
  where user_id is null
    and email_normalized = email_norm
    and payment_status = 'paid'
    and refunded_at is null
    and product_key like 'christmas_planner%';

  update public.christmas_feature_grants g
  set user_id = uid, updated_at = now()
  where g.user_id is null
    and g.email_normalized = email_norm
    and g.status = 'active'
    and not exists (
      select 1
      from public.christmas_feature_grants other
      where other.user_id = uid
        and other.feature_key = g.feature_key
        and other.season_year = g.season_year
        and other.status = 'active'
        and other.id is distinct from g.id
    );

  insert into public.christmas_feature_grants (
    user_id, email_normalized, feature_key, source, source_ref, order_id, season_year, status
  )
  select
    uid,
    o.email_normalized,
    f.feat,
    'claim',
    o.id::text,
    o.id,
    coalesce(
      nullif((o.metadata->>'season_year')::integer, 0),
      public.christmas_planner_season_year(coalesce(o.paid_at, o.created_at))
    ),
    'active'
  from public.christmas_orders o
  cross join lateral unnest(
    public.christmas_planner_features_for_product(o.product_key, o.package_key)
  ) as f(feat)
  where o.payment_status = 'paid'
    and o.refunded_at is null
    and o.product_key like 'christmas_planner%'
    and o.user_id = uid
    and not exists (
      select 1
      from public.christmas_feature_grants g
      where (
        g.order_id = o.id
        and g.feature_key = f.feat
        and g.season_year = coalesce(
          nullif((o.metadata->>'season_year')::integer, 0),
          public.christmas_planner_season_year(coalesce(o.paid_at, o.created_at))
        )
      ) or (
        g.user_id = uid
        and g.feature_key = f.feat
        and g.season_year = coalesce(
          nullif((o.metadata->>'season_year')::integer, 0),
          public.christmas_planner_season_year(coalesce(o.paid_at, o.created_at))
        )
        and g.status = 'active'
      )
    );

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.claim_christmas_planner_grants_for_user() from public, anon;
grant execute on function public.claim_christmas_planner_grants_for_user() to authenticated;

create or replace function public.get_christmas_planner_access()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid;
  email_norm text;
  season integer;
  features text[] := array[]::text[];
  package_keys text[] := array[]::text[];
begin
  uid := auth.uid();
  if uid is null then
    return jsonb_build_object('ok', false, 'code', 'not_authenticated', 'features', '[]'::jsonb);
  end if;

  select lower(trim(email)) into email_norm from auth.users where id = uid;
  season := public.christmas_planner_season_year(now());

  -- Entitlements are the source of truth. Historical paid orders never restore
  -- revoked or expired grants, and never leak into another season.
  select coalesce(array_agg(distinct g.feature_key), array[]::text[])
  into features
  from public.christmas_feature_grants g
  where g.status = 'active'
    and (g.expires_at is null or g.expires_at > now())
    and g.season_year = season
    and (
      g.user_id = uid
      or (
        g.user_id is null
        and email_norm is not null
        and g.email_normalized = email_norm
      )
    );

  select coalesce(array_agg(distinct o.package_key), array[]::text[])
  into package_keys
  from public.christmas_orders o
  join public.christmas_feature_grants g on g.order_id = o.id
  where o.product_key like 'christmas_planner%'
    and g.status = 'active'
    and (g.expires_at is null or g.expires_at > now())
    and g.season_year = season
    and (
      g.user_id = uid
      or (g.user_id is null and g.email_normalized = email_norm)
    );

  return jsonb_build_object(
    'ok', true,
    'season_year', season,
    'features', to_jsonb(coalesce(features, array[]::text[])),
    'package_keys', to_jsonb(coalesce(package_keys, array[]::text[])),
    'paid', coalesce(cardinality(features), 0) > 0
  );
end;
$$;

revoke all on function public.get_christmas_planner_access() from public, anon;
grant execute on function public.get_christmas_planner_access() to authenticated;

-- ---------------------------------------------------------------------------
-- Catalog: planner products on existing commerce tables
-- ---------------------------------------------------------------------------

insert into public.christmas_products (
  product_key, slug, product_type, name, description,
  active, public_discoverable, sort_order, route_path, metadata
)
values
  (
    'christmas_planner',
    'planner',
    'other',
    'Christmas Planner',
    'Personal Christmas command center: gifts, budget, meals, hosting, and a date-aware plan.',
    true, true, 8, '/christmas/planner',
    '{"planner_v1":true,"live_offer":false}'::jsonb
  ),
  (
    'christmas_planner_food',
    'planner-food',
    'other',
    'Christmas Food Planner add-on',
    'Meal planner, grocery list, and recipes for Christmas hosting.',
    true, true, 81, '/christmas/planner',
    '{"planner_addon":"food","planner_v1":true}'::jsonb
  ),
  (
    'christmas_planner_recipes',
    'planner-recipes',
    'other',
    'Christmas Recipes add-on',
    'Original TDG Christmas recipe catalog for the planner.',
    true, true, 82, '/christmas/planner',
    '{"planner_addon":"recipes","planner_v1":true}'::jsonb
  ),
  (
    'christmas_planner_hosting',
    'planner-hosting',
    'other',
    'Christmas Hosting add-on',
    'Guest list, RSVP, and hosting tasks.',
    true, true, 83, '/christmas/planner',
    '{"planner_addon":"hosting","planner_v1":true}'::jsonb
  ),
  (
    'christmas_planner_travel',
    'planner-travel',
    'other',
    'Christmas Travel add-on',
    'Trips, packing, and home arrangements — no passport or card data.',
    true, true, 84, '/christmas/planner',
    '{"planner_addon":"travel","planner_v1":true}'::jsonb
  )
on conflict (product_key) do update
set
  name = excluded.name,
  description = excluded.description,
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
  'eur', v.price_cents, v.compare_at_cents, true, false, v.features::jsonb, v.sort_order,
  v.metadata::jsonb
from public.christmas_products p
join (
  values
    (
      'christmas_planner', 'essentials', 'Essentials',
      'Gifts, budget, dynamic plan, and rescue mode for this season.',
      1499, null,
      '["planner_core","gift_planner","budget","advanced_planning","rescue_mode"]',
      10, '{"tier":"paid_1","recommended":false}'
    ),
    (
      'christmas_planner', 'magic', 'Christmas Magic',
      'Everything in Essentials plus food, recipes, hosting, and travel.',
      2499, null,
      '["planner_core","gift_planner","budget","food_planner","recipes","hosting","travel","advanced_planning","rescue_mode","premium_content"]',
      20, '{"tier":"paid_2","recommended":true}'
    ),
    (
      'christmas_planner', 'all_in', 'All-in',
      'The complete season command center. Architecture reserved for the highest commercial tier.',
      3499, null,
      '["planner_core","gift_planner","budget","food_planner","recipes","hosting","travel","advanced_planning","rescue_mode","premium_content"]',
      30, '{"tier":"paid_3","recommended":false}'
    ),
    (
      'christmas_planner_food', 'food', 'Food Planner',
      'Meals, grocery list, and recipe access.',
      799, null,
      '["food_planner","recipes"]',
      10, '{"planner_addon":true}'
    ),
    (
      'christmas_planner_recipes', 'recipes', 'Recipes Pack',
      'Standalone recipe catalog add-on.',
      499, null,
      '["recipes","premium_content"]',
      10, '{"planner_addon":true}'
    ),
    (
      'christmas_planner_hosting', 'hosting', 'Hosting Pack',
      'Guest list and hosting tasks.',
      599, null,
      '["hosting"]',
      10, '{"planner_addon":true}'
    ),
    (
      'christmas_planner_travel', 'travel', 'Travel Pack',
      'Trips and packing (no identity documents).',
      599, null,
      '["travel"]',
      10, '{"planner_addon":true}'
    )
) as v(product_key, package_key, package_name, description, price_cents, compare_at_cents, features, sort_order, metadata)
  on p.product_key = v.product_key
on conflict (product_id, package_key) do update
set
  package_name = excluded.package_name,
  description = excluded.description,
  features = excluded.features,
  metadata = coalesce(public.christmas_packages.metadata, '{}'::jsonb) || excluded.metadata,
  active = true,
  -- Never flip live charges on from a migration re-run. Prices stay editable in DB.
  purchasable = public.christmas_packages.purchasable,
  price_cents = public.christmas_packages.price_cents,
  currency = public.christmas_packages.currency,
  updated_at = now();

-- Original TDG recipe teasers + paid catalog (not copied from third-party sites)
insert into public.christmas_recipes (
  slug, title, description, ingredients, steps, servings, prep_minutes, cook_minutes,
  category, tags, entitlement_key, teaser, published, locale
)
values
  (
    'citrus-honey-carrots',
    'Citrus honey roasted carrots',
    'A bright side dish with orange zest and honey — original TDG holiday table recipe.',
    '["800g carrots, halved","2 tbsp honey","1 orange, zest and juice","2 tbsp olive oil","pinch salt","fresh thyme"]'::jsonb,
    '["Heat oven to 200°C.","Toss carrots with oil, honey, zest, juice, salt.","Roast 25–30 minutes until caramelised.","Finish with thyme."]'::jsonb,
    6, 10, 30, 'side_dishes', array['easy','vegetarian','make-ahead'], 'free', true, true, 'en'
  ),
  (
    'cranberry-sparkler',
    'Cranberry orange sparkler',
    'A non-alcoholic Christmas drink with cranberry, orange, and ginger.',
    '["500ml cranberry juice","250ml orange juice","500ml ginger ale","orange slices","fresh cranberries"]'::jsonb,
    '["Chill all liquids.","Combine juices in a jug.","Add ginger ale just before serving.","Garnish with orange and cranberries."]'::jsonb,
    8, 5, 0, 'drinks', array['easy','family/kids'], 'free', true, true, 'en'
  ),
  (
    'make-ahead-egg-bake',
    'Christmas morning egg bake',
    'Assemble the night before; bake while gifts are opened. Original TDG breakfast.',
    '["8 eggs","250ml milk","200g bread cubes","150g grated cheese","handful spinach","salt and pepper"]'::jsonb,
    '["Whisk eggs, milk, salt, pepper.","Layer bread, spinach, cheese in a dish.","Pour custard over. Cover and chill overnight.","Bake at 180°C for 35–40 minutes."]'::jsonb,
    6, 15, 40, 'breakfast', array['make-ahead','family/kids','easy'], 'recipes', false, true, 'en'
  ),
  (
    'herb-butter-roast',
    'Herb-butter roast centrepiece',
    'A flexible roast method for chicken or a vegetarian loaf, with rosemary and garlic.',
    '["1 roast centrepiece of choice","80g butter or olive oil","4 garlic cloves","rosemary and thyme","salt and pepper","1 lemon"]'::jsonb,
    '["Mix butter with herbs, garlic, lemon zest.","Rub over the roast.","Cook until juices run clear / loaf is hot in the centre.","Rest 10 minutes before carving."]'::jsonb,
    8, 20, 75, 'christmas_dinner', array['christmas dinner'], 'recipes', false, true, 'en'
  ),
  (
    'crispy-roast-potatoes',
    'Crispy rosemary roast potatoes',
    'Parboil, rough the edges, roast hot — a TDG table staple.',
    '["1.5kg potatoes","4 tbsp oil","rosemary","salt"]'::jsonb,
    '["Peel and cut potatoes. Parboil 8 minutes.","Drain, shake to fluff.","Roast in hot oil at 210°C for 40–50 minutes."]'::jsonb,
    8, 15, 50, 'side_dishes', array['easy','vegetarian'], 'recipes', false, true, 'en'
  ),
  (
    'dark-chocolate-pots',
    'Dark chocolate orange pots',
    'Five-minute dessert that sets in the fridge. Original TDG recipe.',
    '["200g dark chocolate","200ml cream","1 orange zest","pinch salt"]'::jsonb,
    '["Warm cream with zest.","Pour over chopped chocolate. Stir until smooth.","Spoon into cups. Chill 2 hours."]'::jsonb,
    6, 10, 0, 'desserts', array['make-ahead','easy'], 'recipes', false, true, 'en'
  ),
  (
    'spiced-cookie-rounds',
    'Soft spiced cookie rounds',
    'A simple spice cookie for decorating with kids — original TDG bake.',
    '["250g flour","125g butter","100g brown sugar","1 egg","1 tsp mixed spice","pinch salt"]'::jsonb,
    '["Cream butter and sugar. Beat in egg.","Mix in flour, spice, salt. Chill 30 minutes.","Roll, cut, bake 12 minutes at 180°C."]'::jsonb,
    24, 20, 12, 'cookies', array['family/kids','easy'], 'recipes', false, true, 'en'
  ),
  (
    'winter-greens-salad',
    'Winter greens with mustard dressing',
    'A sharp salad to cut through rich Christmas food.',
    '["mixed winter greens","1 apple","handful walnuts","2 tsp mustard","3 tbsp olive oil","1 tbsp cider vinegar"]'::jsonb,
    '["Whisk dressing.","Slice apple.","Toss greens, apple, walnuts, dressing just before serving."]'::jsonb,
    6, 10, 0, 'vegetarian', array['vegetarian','easy'], 'recipes', false, true, 'en'
  )
on conflict (slug) do nothing;

commit;
