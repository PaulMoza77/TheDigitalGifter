-- URL-first Clip Factory: provider metadata, rights confirmation, expanded job states.

begin;

alter table public.clip_factory_jobs
  add column if not exists provider text,
  add column if not exists source_metadata jsonb not null default '{}'::jsonb,
  add column if not exists progress_label text,
  add column if not exists rights_confirmed boolean not null default false,
  add column if not exists rights_confirmed_at timestamptz,
  add column if not exists auto_render boolean not null default true;

alter table public.clip_factory_jobs drop constraint if exists clip_factory_jobs_status_check;
alter table public.clip_factory_jobs
  add constraint clip_factory_jobs_status_check
  check (status in (
    'queued',
    'importing',
    'extracting_audio',
    'transcribing',
    'analyzing',
    'selecting_moments',
    'rendering',
    'captioning',
    'saving',
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

alter table public.clip_factory_media drop constraint if exists clip_factory_media_source_kind_check;
alter table public.clip_factory_media
  add constraint clip_factory_media_source_kind_check
  check (source_kind in (
    'upload',
    'library',
    'direct_media_url',
    'youtube',
    'vimeo',
    'supported_external_source'
  ));

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
        'extracting_audio',
        'transcribing',
        'analyzing',
        'selecting_moments',
        'rendering',
        'captioning',
        'saving',
        'ingesting',
        'analyzing_audio',
        'understanding_scenes',
        'finding_hooks',
        'scoring'
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

revoke all on function public.claim_clip_factory_jobs(integer, text, timestamptz) from public, anon, authenticated;
grant execute on function public.claim_clip_factory_jobs(integer, text, timestamptz) to service_role;

commit;
