-- Social publisher / scheduler foundation.
-- Tokens live only in social_accounts and are revoked from PostgREST clients.

begin;

create table if not exists public.social_publisher_settings (
  id smallint primary key default 1 check (id = 1),
  timezone text not null default 'UTC',
  live_posts_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

insert into public.social_publisher_settings (id, timezone, live_posts_enabled)
values (1, 'UTC', false)
on conflict (id) do nothing;

create table if not exists public.social_accounts (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('meta', 'tiktok', 'youtube')),
  account_id text not null default '',
  account_name text not null default '',
  status text not null default 'not_connected'
    check (status in ('connected', 'not_connected', 'expired', 'revoked', 'error')),
  access_token_ciphertext text,
  refresh_token_ciphertext text,
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, account_id)
);

create table if not exists public.social_oauth_states (
  state text primary key,
  provider text not null check (provider in ('meta', 'tiktok', 'youtube')),
  created_by uuid,
  redirect_to text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '15 minutes')
);

create table if not exists public.social_publications (
  id uuid primary key default gen_random_uuid(),
  library_asset_id text not null,
  asset_title text,
  asset_src text,
  status text not null default 'draft'
    check (status in ('draft', 'scheduled', 'processing', 'published', 'partial', 'failed', 'cancelled')),
  scheduled_at timestamptz not null,
  timezone text not null default 'UTC',
  caption text not null default '',
  hashtags text not null default '',
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  cancelled_at timestamptz
);

create table if not exists public.social_publication_targets (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references public.social_publications(id) on delete cascade,
  provider text not null check (provider in ('meta', 'tiktok', 'youtube')),
  social_account_id uuid references public.social_accounts(id) on delete set null,
  platform text not null check (platform in ('instagram_reels', 'facebook_reels', 'tiktok', 'youtube_shorts')),
  platform_caption text,
  platform_title text,
  status text not null default 'scheduled'
    check (status in ('draft', 'scheduled', 'processing', 'published', 'failed', 'cancelled')),
  attempts integer not null default 0,
  remote_post_id text,
  remote_url text,
  published_at timestamptz,
  last_error text,
  next_retry_at timestamptz,
  idempotency_key text not null,
  claimed_by text,
  claimed_at timestamptz,
  lease_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (publication_id, platform),
  unique (idempotency_key)
);

create index if not exists social_publication_targets_due_idx
  on public.social_publication_targets (status, next_retry_at, lease_expires_at);

create index if not exists social_publications_scheduled_idx
  on public.social_publications (scheduled_at, status);

-- Future AUTO QUEUE (no UI yet). New approved Reels can take the next slot.
create table if not exists public.social_auto_queues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  platforms text[] not null default '{}',
  posts_per_day integer not null default 3,
  times text[] not null default '{}',
  timezone text not null default 'UTC',
  status text not null default 'paused' check (status in ('draft', 'active', 'paused')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.social_auto_queue_items (
  id uuid primary key default gen_random_uuid(),
  queue_id uuid not null references public.social_auto_queues(id) on delete cascade,
  library_asset_id text not null,
  publication_id uuid references public.social_publications(id) on delete set null,
  position integer not null default 0,
  status text not null default 'waiting' check (status in ('waiting', 'scheduled', 'skipped')),
  created_at timestamptz not null default now(),
  unique (queue_id, library_asset_id)
);

create or replace function public.claim_social_publication_targets(
  p_limit integer,
  p_worker_id text,
  p_now timestamptz default now()
)
returns setof public.social_publication_targets
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role required';
  end if;

  return query
  with due as (
    select t.id
    from public.social_publication_targets t
    join public.social_publications p on p.id = t.publication_id
    where t.status = 'scheduled'
      and t.remote_post_id is null
      and p.cancelled_at is null
      and p.status in ('scheduled', 'processing', 'partial', 'failed')
      and p.scheduled_at <= p_now
      and (t.next_retry_at is null or t.next_retry_at <= p_now)
      and (t.lease_expires_at is null or t.lease_expires_at <= p_now)
    order by p.scheduled_at asc, t.id asc
    limit greatest(1, least(coalesce(p_limit, 8), 25))
    for update of t skip locked
  )
  update public.social_publication_targets as t
  set
    status = 'processing',
    attempts = t.attempts + 1,
    claimed_by = p_worker_id,
    claimed_at = p_now,
    lease_expires_at = p_now + interval '5 minutes',
    updated_at = p_now
  from due
  where t.id = due.id
  returning t.*;
end;
$$;

revoke all on function public.claim_social_publication_targets(integer, text, timestamptz) from public, anon, authenticated;
grant execute on function public.claim_social_publication_targets(integer, text, timestamptz) to service_role;

alter table public.social_publisher_settings enable row level security;
alter table public.social_accounts enable row level security;
alter table public.social_oauth_states enable row level security;
alter table public.social_publications enable row level security;
alter table public.social_publication_targets enable row level security;
alter table public.social_auto_queues enable row level security;
alter table public.social_auto_queue_items enable row level security;

-- Tokens must never be readable via PostgREST. Admin UI uses the Edge Function.
revoke all on public.social_publisher_settings from anon, authenticated;
revoke all on public.social_accounts from anon, authenticated;
revoke all on public.social_oauth_states from anon, authenticated;
revoke all on public.social_publications from anon, authenticated;
revoke all on public.social_publication_targets from anon, authenticated;
revoke all on public.social_auto_queues from anon, authenticated;
revoke all on public.social_auto_queue_items from anon, authenticated;

grant select, insert, update, delete on public.social_publisher_settings to service_role;
grant select, insert, update, delete on public.social_accounts to service_role;
grant select, insert, update, delete on public.social_oauth_states to service_role;
grant select, insert, update, delete on public.social_publications to service_role;
grant select, insert, update, delete on public.social_publication_targets to service_role;
grant select, insert, update, delete on public.social_auto_queues to service_role;
grant select, insert, update, delete on public.social_auto_queue_items to service_role;

commit;
