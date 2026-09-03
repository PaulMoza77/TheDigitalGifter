-- Christmas Wishlist + AI Gift Finder foundation
-- Additive. Reuses Tree ownership/share patterns. No checkout activation.

begin;

-- Allow text LLM cost rows in ai_cost_ledger
alter table public.ai_cost_ledger drop constraint if exists ai_cost_ledger_media_chk;
alter table public.ai_cost_ledger
  add constraint ai_cost_ledger_media_chk check (media_type in ('image', 'video', 'text'));

-- ---------------------------------------------------------------------------
-- Wishlists
-- ---------------------------------------------------------------------------
create table if not exists public.christmas_wishlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  owner_token_hash text,
  share_id text not null,
  share_enabled boolean not null default false,
  title text not null default 'My Christmas Wishlist',
  description text not null default '',
  locale text not null default 'en',
  currency text,
  show_budgets_public boolean not null default true,
  moderation_status text not null default 'active',
  view_count integer not null default 0,
  share_count integer not null default 0,
  external_click_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_viewed_at timestamptz,
  constraint christmas_wishlists_title_chk check (char_length(title) between 1 and 80),
  constraint christmas_wishlists_desc_chk check (char_length(description) <= 500),
  constraint christmas_wishlists_share_id_chk check (char_length(share_id) >= 22),
  constraint christmas_wishlists_mod_chk check (
    moderation_status in ('active', 'disabled', 'removed')
  ),
  constraint christmas_wishlists_owner_presence_chk check (
    user_id is not null or (owner_token_hash is not null and length(owner_token_hash) = 64)
  )
);

create unique index if not exists christmas_wishlists_share_id_uidx
  on public.christmas_wishlists (share_id);
create index if not exists christmas_wishlists_user_idx
  on public.christmas_wishlists (user_id, created_at desc)
  where user_id is not null;
create index if not exists christmas_wishlists_owner_token_idx
  on public.christmas_wishlists (owner_token_hash)
  where owner_token_hash is not null;

drop trigger if exists christmas_wishlists_touch on public.christmas_wishlists;
create trigger christmas_wishlists_touch
before update on public.christmas_wishlists
for each row execute function public.christmas_touch_updated_at();

alter table public.christmas_wishlists enable row level security;
drop policy if exists christmas_wishlists_owner_select on public.christmas_wishlists;
create policy christmas_wishlists_owner_select
  on public.christmas_wishlists for select
  using (user_id = auth.uid() or public.is_admin());
revoke all on table public.christmas_wishlists from anon, authenticated, public;
grant select on table public.christmas_wishlists to authenticated;
grant all on table public.christmas_wishlists to service_role;

-- ---------------------------------------------------------------------------
-- Wishlist items
-- ---------------------------------------------------------------------------
create table if not exists public.christmas_wishlist_items (
  id uuid primary key default gen_random_uuid(),
  wishlist_id uuid not null references public.christmas_wishlists (id) on delete cascade,
  sort_order integer not null default 0,
  title text not null,
  note text not null default '',
  external_url text,
  priority text not null default 'would_love',
  budget_amount numeric(12,2),
  currency text,
  status text not null default 'active',
  source_type text not null default 'manual',
  source_ref text,
  -- Future "I'll get this" seam (not activated for V1 UX)
  reservation_status text not null default 'none',
  reservation_token_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint christmas_wishlist_items_title_chk check (char_length(title) between 1 and 120),
  constraint christmas_wishlist_items_note_chk check (char_length(note) <= 500),
  constraint christmas_wishlist_items_sort_chk check (sort_order >= 0),
  constraint christmas_wishlist_items_priority_chk check (
    priority in ('would_love', 'nice_to_have', 'surprise_me')
  ),
  constraint christmas_wishlist_items_status_chk check (
    status in ('active', 'removed')
  ),
  constraint christmas_wishlist_items_source_chk check (
    source_type in ('manual', 'gift_finder', 'tdg_product')
  ),
  constraint christmas_wishlist_items_reservation_chk check (
    reservation_status in ('none', 'reserved', 'purchased')
  ),
  constraint christmas_wishlist_items_url_chk check (
    external_url is null
    or (
      char_length(external_url) <= 500
      and external_url ~* '^https?://'
      and external_url !~* '^(javascript|data|vbscript):'
    )
  )
);

create index if not exists christmas_wishlist_items_list_sort_idx
  on public.christmas_wishlist_items (wishlist_id, sort_order);
create unique index if not exists christmas_wishlist_items_finder_uidx
  on public.christmas_wishlist_items (wishlist_id, source_ref)
  where source_type = 'gift_finder' and source_ref is not null and status = 'active';

drop trigger if exists christmas_wishlist_items_touch on public.christmas_wishlist_items;
create trigger christmas_wishlist_items_touch
before update on public.christmas_wishlist_items
for each row execute function public.christmas_touch_updated_at();

alter table public.christmas_wishlist_items enable row level security;
drop policy if exists christmas_wishlist_items_owner_select on public.christmas_wishlist_items;
create policy christmas_wishlist_items_owner_select
  on public.christmas_wishlist_items for select
  using (
    exists (
      select 1 from public.christmas_wishlists w
      where w.id = wishlist_id and (w.user_id = auth.uid() or public.is_admin())
    )
  );
revoke all on table public.christmas_wishlist_items from anon, authenticated, public;
grant select on table public.christmas_wishlist_items to authenticated;
grant all on table public.christmas_wishlist_items to service_role;

-- ---------------------------------------------------------------------------
-- Gift Finder sessions + results
-- ---------------------------------------------------------------------------
create table if not exists public.christmas_gift_finder_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  guest_token_hash text,
  locale text not null default 'en',
  country_code text,
  recipient_key text not null,
  relationship_key text,
  age_range_key text not null,
  interest_keys text[] not null default '{}',
  custom_interest text not null default '',
  budget_key text not null,
  gift_type_key text not null,
  vibe_key text,
  attempt_number integer not null default 1,
  status text not null default 'draft',
  provider text,
  model text,
  latency_ms integer,
  input_tokens integer,
  output_tokens integer,
  cost_usd numeric(12,6),
  cost_state text not null default 'unknown',
  error_code text,
  rate_bucket text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint christmas_gift_finder_sessions_status_chk check (
    status in ('draft', 'completed', 'failed')
  ),
  constraint christmas_gift_finder_sessions_cost_chk check (
    cost_state in ('actual', 'estimated', 'unknown', 'none')
  ),
  constraint christmas_gift_finder_sessions_identity_chk check (
    user_id is not null or (guest_token_hash is not null and length(guest_token_hash) = 64)
  ),
  constraint christmas_gift_finder_sessions_custom_chk check (char_length(custom_interest) <= 120),
  constraint christmas_gift_finder_sessions_attempt_chk check (attempt_number >= 1)
);

create index if not exists christmas_gift_finder_sessions_user_idx
  on public.christmas_gift_finder_sessions (user_id, created_at desc)
  where user_id is not null;
create index if not exists christmas_gift_finder_sessions_guest_idx
  on public.christmas_gift_finder_sessions (guest_token_hash, created_at desc)
  where guest_token_hash is not null;
create index if not exists christmas_gift_finder_sessions_rate_idx
  on public.christmas_gift_finder_sessions (rate_bucket, created_at desc);

drop trigger if exists christmas_gift_finder_sessions_touch on public.christmas_gift_finder_sessions;
create trigger christmas_gift_finder_sessions_touch
before update on public.christmas_gift_finder_sessions
for each row execute function public.christmas_touch_updated_at();

alter table public.christmas_gift_finder_sessions enable row level security;
drop policy if exists christmas_gift_finder_sessions_own on public.christmas_gift_finder_sessions;
create policy christmas_gift_finder_sessions_own
  on public.christmas_gift_finder_sessions for select
  using (user_id = auth.uid() or public.is_admin());
revoke all on table public.christmas_gift_finder_sessions from anon, authenticated, public;
grant select on table public.christmas_gift_finder_sessions to authenticated;
grant all on table public.christmas_gift_finder_sessions to service_role;

create table if not exists public.christmas_gift_finder_results (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.christmas_gift_finder_sessions (id) on delete cascade,
  sort_order integer not null default 0,
  title text not null,
  reason text not null default '',
  budget_min integer,
  budget_max integer,
  currency text,
  category text not null default 'other',
  search_query text not null default '',
  tdg_product_key text,
  created_at timestamptz not null default now(),
  constraint christmas_gift_finder_results_title_chk check (char_length(title) between 1 and 120),
  constraint christmas_gift_finder_results_reason_chk check (char_length(reason) <= 400),
  constraint christmas_gift_finder_results_search_chk check (char_length(search_query) <= 160)
);

create index if not exists christmas_gift_finder_results_session_idx
  on public.christmas_gift_finder_results (session_id, sort_order);

alter table public.christmas_gift_finder_results enable row level security;
drop policy if exists christmas_gift_finder_results_own on public.christmas_gift_finder_results;
create policy christmas_gift_finder_results_own
  on public.christmas_gift_finder_results for select
  using (
    exists (
      select 1 from public.christmas_gift_finder_sessions s
      where s.id = session_id and (s.user_id = auth.uid() or public.is_admin())
    )
  );
revoke all on table public.christmas_gift_finder_results from anon, authenticated, public;
grant select on table public.christmas_gift_finder_results to authenticated;
grant all on table public.christmas_gift_finder_results to service_role;

-- Catalog: wishlist + gift finder open experiences
update public.christmas_products
set
  name = 'Christmas Wishlist',
  description = 'Make your Christmas list. Share one link.',
  metadata = coalesce(metadata, '{}'::jsonb) - 'coming_soon' || '{"wishlist_v1":true,"live_offer":false}'::jsonb
where product_key = 'christmas_wishlist';

update public.christmas_products
set
  name = 'Christmas Gift Finder',
  description = 'Find a Christmas gift they''ll actually love.',
  metadata = coalesce(metadata, '{}'::jsonb) - 'coming_soon' || '{"gift_finder_v1":true,"live_offer":false}'::jsonb
where product_key = 'christmas_gift_finder';

comment on table public.christmas_wishlists is
  'Christmas Wishlist. share_id is read-only; owner_token_hash/user_id are write auth. Private by default.';
comment on table public.christmas_gift_finder_sessions is
  'Gift Finder sessions. Normalized taxonomy inputs only; free-text custom interest truncated and not sent to analytics.';
comment on column public.christmas_wishlist_items.reservation_status is
  'Future reserve seam (I''ll get this). V1 leaves none; do not expose reservation identity publicly.';

commit;
