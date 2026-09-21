-- Direct Mac → VPS media. Additive columns and a replacement claim signature.
-- Does not drop tables, media, or job history.

alter table public.clip_factory_media
  add column if not exists storage_backend text not null default 'supabase',
  add column if not exists local_relpath text;

alter table public.clip_factory_renders
  add column if not exists storage_backend text not null default 'supabase',
  add column if not exists local_relpath text;

alter table public.clip_factory_jobs drop constraint if exists clip_factory_jobs_status_check;
alter table public.clip_factory_jobs
  add constraint clip_factory_jobs_status_check
  check (status in (
    'queued',
    'uploading',
    'source_detected',
    'waiting_for_media',
    'waiting_for_import',
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
    'completed',
    'failed',
    'ingesting',
    'analyzing_audio',
    'understanding_scenes',
    'finding_hooks',
    'scoring',
    'ready',
    'partial',
    'superseded'
  ));

drop function if exists public.claim_clip_factory_import(text, timestamptz);

create function public.claim_clip_factory_import(
  p_worker_id text,
  p_now timestamptz default now(),
  p_job_id uuid default null
)
returns setof public.clip_factory_jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.clip_factory_jobs
  set
    status = 'failed',
    stage = 'failed',
    failed_stage = 'importing',
    error_code = 'import_attempts_exhausted',
    error_message = 'The import device could not finish this video after several attempts. No clips were created.',
    progress_label = 'Failed',
    import_lease_expires_at = null,
    updated_at = p_now
  where source_kind = 'youtube'
    and media_id is null
    and import_object_path is null
    and import_attempt_count >= 5
    and status = 'importing'
    and import_lease_expires_at is not null
    and import_lease_expires_at < p_now;

  return query
  with due as (
    select j.id
    from public.clip_factory_jobs j
    where j.source_kind = 'youtube'
      and j.media_id is null
      and j.import_object_path is null
      and j.import_attempt_count < 5
      and (p_job_id is null or j.id = p_job_id)
      and (
        j.status = 'waiting_for_import'
        or (
          j.status = 'importing'
          and (j.import_lease_expires_at is null or j.import_lease_expires_at < p_now)
        )
      )
    order by j.created_at asc
    limit 1
    for update of j skip locked
  )
  update public.clip_factory_jobs as j
  set
    status = 'importing',
    stage = 'importing',
    progress = 12,
    progress_label = 'Importing video',
    error_code = null,
    error_message = null,
    failed_stage = null,
    import_worker_id = p_worker_id,
    import_attempt_id = gen_random_uuid(),
    import_attempt_count = j.import_attempt_count + 1,
    import_lease_expires_at = p_now + interval '4 minutes',
    import_object_path = null,
    updated_at = p_now
  from due
  where j.id = due.id
  returning j.*;
end;
$$;

revoke all on function public.claim_clip_factory_import(text, timestamptz, uuid) from public, anon, authenticated;
grant execute on function public.claim_clip_factory_import(text, timestamptz, uuid) to service_role;
