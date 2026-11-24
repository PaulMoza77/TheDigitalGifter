-- Mission 02D — durable media job leasing + song production states.
-- Apply only to isolated/staging. Do NOT apply to production without authorization.

begin;

alter table public.christmas_story_jobs
  add column if not exists worker_id text,
  add column if not exists leased_until timestamptz,
  add column if not exists heartbeat_at timestamptz,
  add column if not exists started_at timestamptz,
  add column if not exists finished_at timestamptz,
  add column if not exists max_attempts integer not null default 5,
  add column if not exists next_retry_at timestamptz,
  add column if not exists input_checksum text,
  add column if not exists output_checksum text,
  add column if not exists error_class text,
  add column if not exists production_state text,
  add column if not exists progress jsonb not null default '{}'::jsonb;

alter table public.christmas_story_jobs
  drop constraint if exists christmas_story_jobs_production_state_chk;

alter table public.christmas_story_jobs
  add constraint christmas_story_jobs_production_state_chk check (
    production_state is null or production_state in (
      'awaiting_song_production',
      'in_production',
      'song_uploaded',
      'rights_verification_pending',
      'ready_for_buyer_review',
      'revision_requested',
      'approved',
      'failed'
    )
  );

create index if not exists christmas_story_jobs_claim_idx
  on public.christmas_story_jobs (status, job_type, next_retry_at, leased_until)
  where status in ('queued', 'generating', 'failed', 'awaiting_manual');

-- Atomic claim helper (service_role only)
create or replace function public.christmas_story_claim_job(
  p_worker_id text,
  p_job_type text default 'film',
  p_lease_seconds integer default 120
) returns public.christmas_story_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.christmas_story_jobs;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'service_role_required';
  end if;
  if p_worker_id is null or length(p_worker_id) < 8 then
    raise exception 'invalid_worker_id';
  end if;

  select * into v_job
  from public.christmas_story_jobs
  where job_type = p_job_type
    and (
      status = 'queued'
      or (status = 'failed' and attempts < coalesce(max_attempts, 5) and (next_retry_at is null or next_retry_at <= now()))
      or (status = 'generating' and leased_until is not null and leased_until < now())
    )
  order by created_at asc
  for update skip locked
  limit 1;

  if not found then
    return null;
  end if;

  update public.christmas_story_jobs
  set
    status = 'generating',
    worker_id = p_worker_id,
    attempts = attempts + 1,
    started_at = coalesce(started_at, now()),
    heartbeat_at = now(),
    leased_until = now() + make_interval(secs => greatest(30, least(p_lease_seconds, 900))),
    error_code = null,
    updated_at = now()
  where id = v_job.id
  returning * into v_job;

  return v_job;
end;
$$;

revoke all on function public.christmas_story_claim_job(text, text, integer) from public, anon, authenticated;
grant execute on function public.christmas_story_claim_job(text, text, integer) to service_role;

create or replace function public.christmas_story_heartbeat_job(
  p_job_id uuid,
  p_worker_id text,
  p_lease_seconds integer default 120
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'service_role_required';
  end if;
  update public.christmas_story_jobs
  set
    heartbeat_at = now(),
    leased_until = now() + make_interval(secs => greatest(30, least(p_lease_seconds, 900))),
    updated_at = now()
  where id = p_job_id
    and worker_id = p_worker_id
    and status = 'generating';
  return found;
end;
$$;

revoke all on function public.christmas_story_heartbeat_job(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.christmas_story_heartbeat_job(uuid, text, integer) to service_role;

-- Buyer media revision requests (server-authoritative)
create table if not exists public.christmas_story_media_revisions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.christmas_story_orders (id) on delete cascade,
  job_id uuid references public.christmas_story_jobs (id) on delete set null,
  media_kind text not null,
  reason text not null,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint christmas_story_media_revisions_kind_chk check (media_kind in ('song','film')),
  constraint christmas_story_media_revisions_status_chk check (status in ('open','resolved','rejected'))
);

alter table public.christmas_story_media_revisions enable row level security;
revoke all on table public.christmas_story_media_revisions from anon, authenticated, public;
grant all on table public.christmas_story_media_revisions to service_role;

commit;
