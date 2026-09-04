-- Christmas Cards + Message Generator foundation
-- Additive. Free acquisition. No checkout activation.
-- Schema aligned with christmas-cards-messages-funnel edge function.

begin;

create table if not exists public.christmas_message_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  guest_token_hash text,
  rate_bucket text not null,
  locale text not null default 'en',
  recipient_key text not null,
  tone_key text not null,
  length_key text not null,
  relationship_key text,
  custom_detail_len integer not null default 0,
  attempt integer not null default 1,
  status text not null default 'completed',
  provider text,
  model text,
  used_fallback boolean not null default false,
  latency_ms integer,
  input_tokens integer,
  output_tokens integer,
  cost_usd numeric(12,6),
  cost_state text not null default 'none',
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint christmas_message_sessions_locale_chk check (locale in ('en', 'ro')),
  constraint christmas_message_sessions_status_chk check (status in ('completed', 'failed')),
  constraint christmas_message_sessions_cost_chk check (
    cost_state in ('actual', 'estimated', 'unknown', 'none')
  ),
  constraint christmas_message_sessions_guest_hash_chk check (
    guest_token_hash is null or length(guest_token_hash) = 64
  )
);

create index if not exists christmas_message_sessions_rate_idx
  on public.christmas_message_sessions (rate_bucket, created_at desc);
create index if not exists christmas_message_sessions_user_idx
  on public.christmas_message_sessions (user_id, created_at desc)
  where user_id is not null;

drop trigger if exists christmas_message_sessions_touch on public.christmas_message_sessions;
create trigger christmas_message_sessions_touch
before update on public.christmas_message_sessions
for each row execute function public.christmas_touch_updated_at();

alter table public.christmas_message_sessions enable row level security;
drop policy if exists christmas_message_sessions_owner_select on public.christmas_message_sessions;
create policy christmas_message_sessions_owner_select
  on public.christmas_message_sessions for select
  using (user_id = auth.uid() or public.is_admin());
revoke all on table public.christmas_message_sessions from anon, authenticated, public;
grant select on table public.christmas_message_sessions to authenticated;
grant all on table public.christmas_message_sessions to service_role;

create table if not exists public.christmas_message_results (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.christmas_message_sessions (id) on delete cascade,
  result_key text not null,
  sort_order integer not null default 0,
  message_text text not null,
  tone_key text not null,
  length_key text not null,
  recipient_key text not null,
  language text not null default 'en',
  created_at timestamptz not null default now(),
  constraint christmas_message_results_text_chk check (char_length(message_text) between 1 and 1200),
  constraint christmas_message_results_key_chk check (char_length(result_key) between 4 and 64),
  constraint christmas_message_results_lang_chk check (language in ('en', 'ro')),
  unique (session_id, result_key)
);

create index if not exists christmas_message_results_session_idx
  on public.christmas_message_results (session_id, sort_order);

alter table public.christmas_message_results enable row level security;
revoke all on table public.christmas_message_results from anon, authenticated, public;
grant all on table public.christmas_message_results to service_role;

create table if not exists public.christmas_card_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  owner_token_hash text,
  locale text not null default 'en',
  style_key text not null default 'classic_christmas',
  layout_key text not null default 'square',
  message_text text not null default '',
  message_source text not null default 'manual',
  message_result_id uuid references public.christmas_message_results (id) on delete set null,
  recipient_name text not null default '',
  from_name text not null default '',
  photo_present boolean not null default false,
  status text not null default 'draft',
  download_count integer not null default 0,
  share_count integer not null default 0,
  render_count integer not null default 0,
  render_failure_count integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint christmas_card_projects_locale_chk check (locale in ('en', 'ro')),
  constraint christmas_card_projects_message_chk check (char_length(message_text) <= 800),
  constraint christmas_card_projects_names_chk check (
    char_length(recipient_name) <= 80 and char_length(from_name) <= 80
  ),
  constraint christmas_card_projects_source_chk check (
    message_source in ('manual', 'message_generator')
  ),
  constraint christmas_card_projects_status_chk check (
    status in ('draft', 'rendered', 'failed', 'removed')
  ),
  constraint christmas_card_projects_owner_presence_chk check (
    user_id is not null or (owner_token_hash is not null and length(owner_token_hash) = 64)
  )
);

create index if not exists christmas_card_projects_user_idx
  on public.christmas_card_projects (user_id, created_at desc)
  where user_id is not null;
create index if not exists christmas_card_projects_owner_idx
  on public.christmas_card_projects (owner_token_hash)
  where owner_token_hash is not null;

drop trigger if exists christmas_card_projects_touch on public.christmas_card_projects;
create trigger christmas_card_projects_touch
before update on public.christmas_card_projects
for each row execute function public.christmas_touch_updated_at();

alter table public.christmas_card_projects enable row level security;
drop policy if exists christmas_card_projects_owner_select on public.christmas_card_projects;
create policy christmas_card_projects_owner_select
  on public.christmas_card_projects for select
  using (user_id = auth.uid() or public.is_admin());
revoke all on table public.christmas_card_projects from anon, authenticated, public;
grant select on table public.christmas_card_projects to authenticated;
grant all on table public.christmas_card_projects to service_role;

create table if not exists public.christmas_card_assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.christmas_card_projects (id) on delete cascade,
  asset_kind text not null,
  layout_key text not null default 'square',
  storage_bucket text,
  storage_path text,
  mime_type text not null default 'image/png',
  width integer,
  height integer,
  byte_size integer,
  created_at timestamptz not null default now(),
  constraint christmas_card_assets_kind_chk check (
    asset_kind in ('source_photo', 'rendered')
  )
);

create index if not exists christmas_card_assets_project_idx
  on public.christmas_card_assets (project_id, created_at desc);

alter table public.christmas_card_assets enable row level security;
revoke all on table public.christmas_card_assets from anon, authenticated, public;
grant all on table public.christmas_card_assets to service_role;

update public.christmas_products
set
  description = 'Turn your photo and Christmas message into a card worth sending.',
  metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
    'coming_soon', false,
    'cards_v1', true,
    'live_offer', false,
    'checkout_live', false
  ),
  updated_at = now()
where product_key = 'christmas_card';

update public.christmas_products
set
  name = 'Christmas Message Generator',
  description = 'Find the right Christmas words in seconds.',
  metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
    'coming_soon', false,
    'messages_v1', true,
    'live_offer', false
  ),
  updated_at = now()
where product_key = 'christmas_messages';

commit;
