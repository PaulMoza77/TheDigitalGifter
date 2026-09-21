-- Mac import worker: YouTube jobs wait for an outbound device claim.
-- Additive columns and functions only. Does not drop tables or rewrite existing media.

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
    'partial'
  ));

alter table public.clip_factory_jobs
  add column if not exists import_attempt_id uuid,
  add column if not exists import_attempt_count integer not null default 0,
  add column if not exists import_worker_id text,
  add column if not exists import_lease_expires_at timestamptz,
  add column if not exists import_object_path text;

create table if not exists public.clip_factory_import_devices (
  device_id text primary key,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

revoke all on public.clip_factory_import_devices from public, anon, authenticated;
grant select, insert, update on public.clip_factory_import_devices to service_role;

update storage.buckets
set file_size_limit = 2147483648
where id = 'clip-factory'
  and (file_size_limit is null or file_size_limit < 2147483648);

-- Park YouTube jobs that still have no file so the origin does not download them.
update public.clip_factory_jobs
set
  status = 'waiting_for_import',
  stage = 'waiting_for_import',
  progress = 4,
  progress_label = 'Waiting for import device',
  error_code = null,
  error_message = null,
  lease_expires_at = null,
  updated_at = now()
where source_kind = 'youtube'
  and media_id is null
  and import_object_path is null
  and status in ('queued', 'importing', 'downloading', 'ingesting', 'waiting_for_media', 'source_detected');

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
      and j.status not in ('waiting_for_media', 'source_detected', 'waiting_for_import')
      and not (
        j.source_kind = 'youtube'
        and j.media_id is null
      )
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

create or replace function public.claim_clip_factory_import(
  p_worker_id text,
  p_now timestamptz default now()
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

revoke all on function public.claim_clip_factory_jobs(integer, text, timestamptz) from public, anon, authenticated;
grant execute on function public.claim_clip_factory_jobs(integer, text, timestamptz) to service_role;

revoke all on function public.claim_clip_factory_import(text, timestamptz) from public, anon, authenticated;
grant execute on function public.claim_clip_factory_import(text, timestamptz) to service_role;

create or replace function public.heartbeat_clip_factory_import(
  p_job_id uuid,
  p_attempt_id uuid,
  p_worker_id text,
  p_now timestamptz default now()
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_id uuid;
begin
  update public.clip_factory_jobs
  set
    import_lease_expires_at = p_now + interval '4 minutes',
    updated_at = p_now
  where id = p_job_id
    and import_attempt_id = p_attempt_id
    and import_worker_id = p_worker_id
    and status = 'importing'
    and media_id is null
    and import_lease_expires_at > p_now
  returning id into updated_id;
  return updated_id is not null;
end;
$$;

revoke all on function public.heartbeat_clip_factory_import(uuid, uuid, text, timestamptz) from public, anon, authenticated;
grant execute on function public.heartbeat_clip_factory_import(uuid, uuid, text, timestamptz) to service_role;
