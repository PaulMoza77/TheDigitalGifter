-- Publisher V1 scheduling foundation.
-- Additive only. References Library assets by id; does not copy media files.

begin;

alter table public.library_assets
  add column if not exists publisher_excluded boolean not null default false,
  add column if not exists publisher_eligible boolean not null default true,
  add column if not exists publisher_content_type text
    check (publisher_content_type is null or publisher_content_type in ('video', 'image')),
  add column if not exists publisher_tags text[] not null default '{}';

create table if not exists public.publisher_settings (
  id smallint primary key default 1 check (id = 1),
  timezone text not null default 'Europe/Bucharest',
  live_posts_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

insert into public.publisher_settings (id, timezone, live_posts_enabled)
values (1, 'Europe/Bucharest', false)
on conflict (id) do nothing;

create table if not exists public.publisher_asset_state (
  library_asset_id text primary key,
  excluded boolean not null default false,
  eligible boolean not null default true,
  content_type text check (content_type is null or content_type in ('video', 'image')),
  tags text[] not null default '{}',
  last_used_by_destination jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.publisher_schedule_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  timezone text not null default 'Europe/Bucharest',
  weekdays integer[] not null default '{1,2,3,4,5}',
  times text[] not null default '{}',
  content_type text not null default 'video' check (content_type in ('video', 'image')),
  destinations text[] not null default '{}',
  library_category text,
  library_tags text[] not null default '{}',
  auto_assign boolean not null default true,
  reuse_cooldown_days integer not null default 14 check (reuse_cooldown_days >= 0),
  approval_required boolean not null default true,
  active boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.publisher_slots (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid not null references public.publisher_schedule_rules(id) on delete restrict,
  scheduled_at timestamptz not null,
  timezone text not null default 'Europe/Bucharest',
  status text not null default 'needs_content'
    check (status in ('needs_content', 'needs_approval', 'scheduled', 'processing', 'completed', 'failed', 'cancelled')),
  locked boolean not null default false,
  manually_edited boolean not null default false,
  assignment_locked boolean not null default false,
  content_reason text,
  publication_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (rule_id, scheduled_at)
);

create table if not exists public.publisher_publications (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid unique references public.publisher_slots(id) on delete set null,
  library_asset_id text,
  caption text not null default '',
  content_type text not null default 'video' check (content_type in ('video', 'image')),
  assignment_source text not null default 'none' check (assignment_source in ('auto', 'manual', 'none')),
  approved boolean not null default false,
  approved_at timestamptz,
  status text not null default 'needs_content'
    check (status in ('needs_content', 'needs_approval', 'scheduled', 'processing', 'completed', 'failed', 'cancelled')),
  scheduled_at timestamptz not null,
  timezone text not null default 'Europe/Bucharest',
  locked boolean not null default false,
  destinations text[] not null default '{}',
  duplicate_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists publisher_publications_duplicate_key_idx
  on public.publisher_publications (duplicate_key)
  where duplicate_key is not null and status <> 'cancelled';

alter table public.publisher_slots
  drop constraint if exists publisher_slots_publication_id_fkey;
alter table public.publisher_slots
  add constraint publisher_slots_publication_id_fkey
  foreign key (publication_id) references public.publisher_publications(id) on delete set null;

create table if not exists public.publisher_destination_jobs (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references public.publisher_publications(id) on delete cascade,
  destination text not null,
  status text not null default 'needs_content'
    check (status in ('needs_content', 'needs_approval', 'scheduled', 'processing', 'completed', 'failed', 'cancelled')),
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  next_retry_at timestamptz,
  claimed_by text,
  claimed_at timestamptz,
  lease_expires_at timestamptz,
  remote_post_id text,
  remote_url text,
  last_error text,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (publication_id, destination)
);

create index if not exists publisher_destination_jobs_due_idx
  on public.publisher_destination_jobs (status, next_retry_at, lease_expires_at);

create index if not exists publisher_slots_schedule_idx
  on public.publisher_slots (scheduled_at, status);

create index if not exists publisher_publications_schedule_idx
  on public.publisher_publications (scheduled_at, status);

create table if not exists public.publisher_attempts (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.publisher_destination_jobs(id) on delete cascade,
  kind text not null check (kind in ('dry_run', 'provider')),
  success boolean not null,
  result_code text not null,
  message text not null default '',
  remote_post_id text,
  remote_url text,
  created_at timestamptz not null default now()
);

create or replace function public.claim_publisher_destination_jobs(
  p_limit integer,
  p_worker_id text,
  p_now timestamptz default now()
)
returns setof public.publisher_destination_jobs
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
    select j.id
    from public.publisher_destination_jobs j
    join public.publisher_publications p on p.id = j.publication_id
    where j.status in ('scheduled', 'failed')
      and j.remote_post_id is null
      and p.status <> 'cancelled'
      and p.approved = true
      and p.status in ('scheduled', 'processing', 'failed')
      and p.library_asset_id is not null
      and p.scheduled_at <= p_now
      and j.attempts < j.max_attempts
      and (j.next_retry_at is null or j.next_retry_at <= p_now)
      and (j.lease_expires_at is null or j.lease_expires_at <= p_now)
    order by p.scheduled_at asc, j.id asc
    limit greatest(1, least(coalesce(p_limit, 8), 25))
    for update of j skip locked
  )
  update public.publisher_destination_jobs as j
  set
    status = 'processing',
    attempts = j.attempts + 1,
    claimed_by = p_worker_id,
    claimed_at = p_now,
    lease_expires_at = p_now + interval '5 minutes',
    updated_at = p_now
  from due
  where j.id = due.id
  returning j.*;
end;
$$;

revoke all on function public.claim_publisher_destination_jobs(integer, text, timestamptz) from public, anon, authenticated;
grant execute on function public.claim_publisher_destination_jobs(integer, text, timestamptz) to service_role;

alter table public.publisher_settings enable row level security;
alter table public.publisher_asset_state enable row level security;
alter table public.publisher_schedule_rules enable row level security;
alter table public.publisher_slots enable row level security;
alter table public.publisher_publications enable row level security;
alter table public.publisher_destination_jobs enable row level security;
alter table public.publisher_attempts enable row level security;

revoke all on public.publisher_settings from anon, authenticated;
revoke all on public.publisher_asset_state from anon, authenticated;
revoke all on public.publisher_schedule_rules from anon, authenticated;
revoke all on public.publisher_slots from anon, authenticated;
revoke all on public.publisher_publications from anon, authenticated;
revoke all on public.publisher_destination_jobs from anon, authenticated;
revoke all on public.publisher_attempts from anon, authenticated;

grant select, insert, update, delete on public.publisher_settings to service_role;
grant select, insert, update, delete on public.publisher_asset_state to service_role;
grant select, insert, update, delete on public.publisher_schedule_rules to service_role;
grant select, insert, update, delete on public.publisher_slots to service_role;
grant select, insert, update, delete on public.publisher_publications to service_role;
grant select, insert, update, delete on public.publisher_destination_jobs to service_role;
grant select, insert, update, delete on public.publisher_attempts to service_role;

commit;
