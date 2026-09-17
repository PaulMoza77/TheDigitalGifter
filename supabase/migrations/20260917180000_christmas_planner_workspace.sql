-- Christmas Planner workspace tables + access bridge (launch integration).
-- Forward migration AFTER funnel commerce (20260917140000).
-- Workspace data from V1; entitlements store remains public.user_entitlements.
-- Does NOT redefine grant_christmas_planner_entitlements(uuid, ...).

begin;

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
-- Access bridge: map funnel user_entitlements (planner.*) → V1 feature flags
-- Does NOT create grant_christmas_planner_entitlements(uuid) — funnel multi-arg
-- grant remains canonical.
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

create or replace function public.map_planner_entitlement_to_features(p_entitlement_key text)
returns text[]
language sql
immutable
as $$
  select case p_entitlement_key
    when 'planner.countdown' then array['planner_core']
    when 'planner.plan' then array['planner_core', 'advanced_planning']
    when 'planner.tasks' then array['planner_core']
    when 'planner.gifts' then array['gift_planner']
    when 'planner.wishlist' then array['gift_planner']
    when 'planner.budget' then array['budget']
    when 'planner.shopping' then array['budget', 'advanced_planning']
    when 'planner.meals' then array['food_planner']
    when 'planner.recipes_collection' then array['recipes']
    when 'planner.hosting' then array['hosting']
    when 'planner.travel' then array['travel']
    when 'planner.rescue_mode' then array['rescue_mode']
    when 'planner.premium_content' then array['premium_content']
    when 'planner.club_premium' then array['premium_content']
    when 'planner.gift_finder_advanced' then array['advanced_planning']
    when 'planner.activities' then array['advanced_planning']
    when 'planner.cards_messages' then array['advanced_planning']
    when 'planner.ai_assistant' then array['advanced_planning']
    when 'planner.photo_credits_bonus' then array['premium_content']
    -- Already-mapped V1 feature keys pass through (legacy / tests)
    when 'planner_core' then array['planner_core']
    when 'gift_planner' then array['gift_planner']
    when 'budget' then array['budget']
    when 'food_planner' then array['food_planner']
    when 'recipes' then array['recipes']
    when 'hosting' then array['hosting']
    when 'travel' then array['travel']
    when 'advanced_planning' then array['advanced_planning']
    when 'rescue_mode' then array['rescue_mode']
    when 'premium_content' then array['premium_content']
    else array[]::text[]
  end;
$$;

revoke all on function public.map_planner_entitlement_to_features(text) from public;
grant execute on function public.map_planner_entitlement_to_features(text) to authenticated, service_role;

create or replace function public.get_christmas_planner_access()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid;
  season integer;
  features text[] := array[]::text[];
  package_keys text[] := array[]::text[];
begin
  uid := auth.uid();
  if uid is null then
    return jsonb_build_object('ok', false, 'code', 'not_authenticated', 'features', '[]'::jsonb);
  end if;

  season := public.christmas_planner_season_year(now());

  select coalesce(array_agg(distinct feat), array[]::text[])
  into features
  from public.user_entitlements e
  cross join lateral unnest(public.map_planner_entitlement_to_features(e.entitlement_key)) as feat
  where e.status = 'active'
    and (e.expires_at is null or e.expires_at > now())
    and e.season_year = season
    and e.user_id = uid
    and feat is not null;

  select coalesce(array_agg(distinct e.tier), array[]::text[])
  into package_keys
  from public.user_entitlements e
  where e.status = 'active'
    and (e.expires_at is null or e.expires_at > now())
    and e.season_year = season
    and e.user_id = uid
    and e.tier is not null
    and e.tier <> '';

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

-- Refund / revoke against funnel user_entitlements (compatible with stripe refund path)
create or replace function public.revoke_christmas_planner_entitlements(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer := 0;
begin
  update public.user_entitlements
  set status = 'revoked', updated_at = now()
  where christmas_order_id = p_order_id
    and status = 'active';
  get diagnostics n = row_count;

  return jsonb_build_object('ok', true, 'revoked', n);
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
    and (
      product_key = 'christmas_planner_2026'
      or product_key = 'christmas_planner'
      or product_key like 'christmas_planner%'
    );
  get diagnostics updated = row_count;

  perform public.revoke_christmas_planner_entitlements(p_order_id);

  return jsonb_build_object('ok', true, 'matched', updated > 0);
end;
$$;

revoke all on function public.refund_christmas_planner_order(uuid) from public;
grant execute on function public.refund_christmas_planner_order(uuid) to service_role;


-- Original TDG recipe teasers + paid catalog

-- Original TDG recipe teasers + paid catalog
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
