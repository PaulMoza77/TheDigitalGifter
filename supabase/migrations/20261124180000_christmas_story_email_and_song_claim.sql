-- Christmas Story: delivery email kinds + song job claim for licensed instrumental automation.

begin;

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'christmas_email_deliveries'
  ) then
    alter table public.christmas_email_deliveries
      drop constraint if exists christmas_email_deliveries_kind_chk;
    alter table public.christmas_email_deliveries
      add constraint christmas_email_deliveries_kind_chk check (
        kind in (
          'starter_ready',
          'magic_ready',
          'ultimate_ready',
          'partial_failure',
          'planner_ready',
          'portrait_ready',
          'portrait_refunded',
          'santa_call_ready',
          'santa_call_resent',
          'santa_call_extension_recovery',
          'christmas_story_gift_sent',
          'christmas_story_gift_resent'
        )
      );
  end if;
end $$;

-- Allow licensed FMA instrumental automation worker (CC0 manifest in repo).
alter table public.christmas_story_jobs
  drop constraint if exists christmas_story_jobs_provider_chk;
alter table public.christmas_story_jobs
  add constraint christmas_story_jobs_provider_chk check (
    provider in ('mock','manual','authorized_api','ffmpeg','licensed_fma')
  );

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
      or (
        p_job_type = 'song'
        and status = 'awaiting_manual'
        and coalesce(production_state, '') in ('awaiting_song_production', 'in_production')
      )
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
    production_state = case
      when job_type = 'song' and coalesce(production_state, '') = 'awaiting_song_production' then 'in_production'
      else production_state
    end,
    updated_at = now()
  where id = v_job.id
  returning * into v_job;

  return v_job;
end;
$$;

commit;