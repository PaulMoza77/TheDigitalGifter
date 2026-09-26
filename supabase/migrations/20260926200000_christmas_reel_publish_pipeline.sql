-- Christmas Reel / Short publish pipeline: CC0 music, finish render, READY_TO_PUBLISH gate.
-- Additive only. Reuses music_tracks, library_assets, publisher + social publisher.

begin;

alter table public.music_tracks add column if not exists tags text[] not null default '{}';
alter table public.music_tracks add column if not exists source_url text;
alter table public.music_tracks add column if not exists approved_for_autopilot boolean not null default false;
alter table public.music_tracks add column if not exists instagram_allowed boolean not null default false;
alter table public.music_tracks add column if not exists facebook_allowed boolean not null default false;
alter table public.music_tracks add column if not exists youtube_allowed boolean not null default false;
alter table public.music_tracks add column if not exists last_used_at timestamptz;

alter table public.music_tracks drop constraint if exists music_tracks_source_chk;
alter table public.music_tracks add constraint music_tracks_source_chk check (
  source in (
    'youtube_audio_library',
    'original_owned',
    'commissioned',
    'licensed_ai',
    'other_licensed',
    'generated_demo',
    'cc0_recorded'
  )
);

alter table public.library_assets add column if not exists publish_status text not null default 'legacy';
alter table public.library_assets add column if not exists music_track_id text;
alter table public.library_assets add column if not exists content_tags text[] not null default '{}';
alter table public.library_assets add column if not exists platform_metadata jsonb not null default '{}'::jsonb;
alter table public.library_assets add column if not exists publish_checks jsonb not null default '{}'::jsonb;
alter table public.library_assets add column if not exists source_video_path text;
alter table public.library_assets add column if not exists finish_error text;

alter table public.library_assets drop constraint if exists library_assets_publish_status_chk;
alter table public.library_assets add constraint library_assets_publish_status_chk check (
  publish_status in (
    'legacy',
    'pending_finish',
    'processing',
    'ready_to_publish',
    'failed'
  )
);

create index if not exists library_assets_publish_status_idx
  on public.library_assets (publish_status, updated_at desc);

create index if not exists music_tracks_autopilot_idx
  on public.music_tracks (approved_for_autopilot, last_used_at nulls first)
  where approved_for_autopilot = true and demo = false;

create table if not exists public.library_reel_finish_jobs (
  id uuid primary key default gen_random_uuid(),
  library_asset_id uuid not null references public.library_assets(id) on delete cascade,
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'completed', 'failed', 'cancelled')),
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  claimed_by text,
  claimed_at timestamptz,
  lease_expires_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (library_asset_id)
);

create index if not exists library_reel_finish_jobs_due_idx
  on public.library_reel_finish_jobs (status, lease_expires_at);

create or replace function public.claim_library_reel_finish_jobs(
  p_limit integer,
  p_worker_id text,
  p_now timestamptz default now()
)
returns setof public.library_reel_finish_jobs
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
    from public.library_reel_finish_jobs j
    where j.status = 'queued'
       or (
         j.status = 'processing'
         and j.lease_expires_at is not null
         and j.lease_expires_at < p_now
         and j.attempts < j.max_attempts
       )
    order by j.created_at asc
    limit greatest(1, least(coalesce(p_limit, 1), 4))
    for update of j skip locked
  )
  update public.library_reel_finish_jobs as j
  set
    status = 'processing',
    claimed_by = p_worker_id,
    claimed_at = p_now,
    lease_expires_at = p_now + interval '15 minutes',
    attempts = j.attempts + 1,
    updated_at = p_now
  from due
  where j.id = due.id
  returning j.*;
end;
$$;

revoke all on function public.claim_library_reel_finish_jobs(integer, text, timestamptz) from public, anon, authenticated;
grant execute on function public.claim_library_reel_finish_jobs(integer, text, timestamptz) to service_role;

alter table public.library_reel_finish_jobs enable row level security;
revoke all on public.library_reel_finish_jobs from anon, authenticated;
grant select, insert, update, delete on public.library_reel_finish_jobs to service_role;

commit;
