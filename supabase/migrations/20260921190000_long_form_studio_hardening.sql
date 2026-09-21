-- Harden Long-Form Studio: extra columns, statuses, job retries, demo music, private bucket.

alter table public.music_tracks add column if not exists file_sha256 text;
alter table public.music_tracks add column if not exists demo boolean not null default false;
alter table public.music_tracks add column if not exists creation_record jsonb not null default '{}'::jsonb;
alter table public.music_tracks add column if not exists proof_accessible boolean not null default false;
alter table public.music_tracks add column if not exists editorial_status text not null default 'unreviewed';

alter table public.music_tracks drop constraint if exists music_tracks_source_chk;
alter table public.music_tracks add constraint music_tracks_source_chk check (
  source in (
    'youtube_audio_library',
    'original_owned',
    'commissioned',
    'licensed_ai',
    'other_licensed',
    'generated_demo'
  )
);

create unique index if not exists music_tracks_sha_uidx
  on public.music_tracks (file_sha256)
  where file_sha256 is not null;

alter table public.long_form_productions add column if not exists job_id uuid;
alter table public.long_form_productions add column if not exists persist_confirmed boolean not null default false;
alter table public.long_form_productions add column if not exists file_size_bytes bigint;
alter table public.long_form_productions add column if not exists soundtrack_kind text not null default 'unknown';
alter table public.long_form_productions add column if not exists rights_status text not null default 'rights_review_required';
alter table public.long_form_productions add column if not exists editorial_status text not null default 'unreviewed';
alter table public.long_form_productions add column if not exists error_message text;
alter table public.long_form_productions add column if not exists progress integer not null default 0;
alter table public.long_form_productions add column if not exists stage text not null default 'queued';
alter table public.long_form_productions add column if not exists progress_label text;

alter table public.long_form_productions drop constraint if exists long_form_productions_status_chk;
alter table public.long_form_productions add constraint long_form_productions_status_chk check (
  status in (
    'draft',
    'queued',
    'rendering',
    'saved',
    'demo',
    'ready_to_publish',
    'rights_review_required',
    'similarity_review_required',
    'persist_failed',
    'failed'
  )
);

alter table public.long_form_jobs add column if not exists attempt_count integer not null default 0;
alter table public.long_form_jobs add column if not exists max_attempts integer not null default 3;
alter table public.long_form_jobs add column if not exists heartbeat_at timestamptz;
alter table public.long_form_jobs add column if not exists payload jsonb not null default '{}'::jsonb;

drop function if exists public.claim_long_form_jobs(integer, text, timestamptz);

create or replace function public.claim_long_form_jobs(
  p_limit integer,
  p_worker_id text,
  p_now timestamptz default now()
)
returns setof public.long_form_jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with due as (
    select j.id
    from public.long_form_jobs j
    where j.status = 'queued'
       or (
         j.status = 'rendering'
         and j.lease_expires_at is not null
         and j.lease_expires_at < p_now
         and j.attempt_count < j.max_attempts
       )
    order by j.created_at asc
    limit greatest(1, least(coalesce(p_limit, 1), 1))
    for update of j skip locked
  )
  update public.long_form_jobs as j
  set
    status = 'rendering',
    claimed_by = p_worker_id,
    claimed_at = p_now,
    heartbeat_at = p_now,
    lease_expires_at = p_now + interval '20 minutes',
    attempt_count = j.attempt_count + 1,
    updated_at = p_now
  from due
  where j.id = due.id
  returning j.*;
end;
$$;

revoke all on function public.claim_long_form_jobs(integer, text, timestamptz) from public, anon, authenticated;
grant execute on function public.claim_long_form_jobs(integer, text, timestamptz) to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'long-form',
  'long-form',
  false,
  8589934592,
  array[
    'video/mp4',
    'video/quicktime',
    'image/jpeg',
    'image/png',
    'audio/mpeg',
    'audio/wav',
    'audio/mp4',
    'audio/aac',
    'application/pdf',
    'text/plain'
  ]
)
on conflict (id) do update
set
  public = false,
  file_size_limit = greatest(storage.buckets.file_size_limit, 8589934592);

-- Demo seed IDs are stable slugs, not UUIDs.
alter table public.music_tracks alter column id drop default;
alter table public.music_tracks alter column id type text using id::text;
alter table public.music_tracks alter column id set default (gen_random_uuid())::text;

alter table public.long_form_productions add column if not exists mood text not null default 'cozy_instrumental';

create index if not exists library_assets_storage_path_idx
  on public.library_assets (storage_path);

create index if not exists library_assets_kind_idx
  on public.library_assets (kind, created_at desc);
