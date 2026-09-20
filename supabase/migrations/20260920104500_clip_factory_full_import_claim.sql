-- Clip Factory: claim downloading/finalizing/partial jobs so URL ingest and per-clip retries continue after refresh.

create or replace function public.claim_clip_factory_jobs(
  p_limit integer,
  p_worker_id text,
  p_now timestamptz default now()
)
returns setof public.clip_factory_jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with due as (
    select j.id
    from public.clip_factory_jobs j
    where j.status in (
        'queued',
        'importing',
        'downloading',
        'extracting_audio',
        'transcribing',
        'analyzing',
        'selecting_moments',
        'rendering',
        'captioning',
        'saving',
        'finalizing',
        'ingesting',
        'analyzing_audio',
        'understanding_scenes',
        'finding_hooks',
        'scoring',
        'partial'
      )
      and j.status not in ('waiting_for_media', 'source_detected')
      and (j.lease_expires_at is null or j.lease_expires_at < p_now)
    order by j.created_at asc
    limit greatest(1, least(coalesce(p_limit, 1), 4))
    for update of j skip locked
  )
  update public.clip_factory_jobs as j
  set
    claimed_by = p_worker_id,
    claimed_at = p_now,
    lease_expires_at = p_now + interval '12 minutes',
    updated_at = p_now
  from due
  where j.id = due.id
  returning j.*;
end;
$$;

revoke all on function public.claim_clip_factory_jobs(integer, text, timestamptz) from public, anon, authenticated;
grant execute on function public.claim_clip_factory_jobs(integer, text, timestamptz) to service_role;
