-- Long-Form Studio: music library, productions, jobs.
-- Additive only. Reuses public.library_assets for finished videos.

create table if not exists public.music_tracks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  artist_source text not null default '',
  duration_seconds double precision,
  genre text not null default '',
  mood text not null default '',
  source text not null,
  license_type text not null,
  commercial_use_allowed boolean,
  youtube_monetization_allowed text not null default 'unknown',
  attribution_required boolean not null default false,
  attribution_text text not null default '',
  license_url text,
  acquisition_date date,
  proof_storage_path text,
  internal_notes text not null default '',
  storage_bucket text,
  storage_path text,
  filename text,
  public_src text,
  provider_track_id text,
  composition_rights text not null default 'unknown',
  recording_rights text not null default 'unknown',
  rights_complete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint music_tracks_source_chk check (
    source in (
      'youtube_audio_library',
      'original_owned',
      'commissioned',
      'licensed_ai',
      'other_licensed'
    )
  ),
  constraint music_tracks_youtube_chk check (
    youtube_monetization_allowed in ('yes', 'no', 'unknown')
  )
);

create index if not exists music_tracks_mood_idx on public.music_tracks (mood, created_at desc);
create index if not exists music_tracks_source_idx on public.music_tracks (source);

create table if not exists public.long_form_productions (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'draft',
  theme text not null default 'christmas',
  style_preset text not null default 'cozy',
  duration_seconds integer not null,
  scene_ids jsonb not null default '[]'::jsonb,
  scene_sequence jsonb not null default '[]'::jsonb,
  music_track_ids jsonb not null default '[]'::jsonb,
  playlist jsonb not null default '[]'::jsonb,
  visual_treatment text not null default '',
  title_suggestions jsonb not null default '[]'::jsonb,
  description text not null default '',
  thumbnail_concepts jsonb not null default '[]'::jsonb,
  thumbnail_path text,
  rights_manifest jsonb not null default '{}'::jsonb,
  similarity jsonb not null default '{}'::jsonb,
  library_asset_id uuid references public.library_assets(id) on delete set null,
  storage_bucket text,
  storage_path text,
  width integer,
  height integer,
  probe jsonb,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint long_form_productions_status_chk check (
    status in (
      'draft',
      'queued',
      'rendering',
      'ready_to_publish',
      'rights_review_required',
      'similarity_review_required',
      'failed'
    )
  )
);

create index if not exists long_form_productions_created_idx
  on public.long_form_productions (created_at desc);

create table if not exists public.long_form_jobs (
  id uuid primary key default gen_random_uuid(),
  production_id uuid references public.long_form_productions(id) on delete cascade,
  status text not null default 'queued',
  stage text not null default 'queued',
  progress integer not null default 0,
  progress_label text,
  error_message text,
  claimed_by text,
  claimed_at timestamptz,
  lease_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists long_form_jobs_status_idx
  on public.long_form_jobs (status, created_at);

create table if not exists public.long_form_events (
  id bigint generated always as identity primary key,
  job_id uuid,
  production_id uuid,
  event_name text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

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
on conflict (id) do nothing;

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
    where j.status in ('queued', 'rendering')
      and (j.lease_expires_at is null or j.lease_expires_at < p_now)
    order by j.created_at asc
    limit greatest(1, least(coalesce(p_limit, 1), 2))
    for update of j skip locked
  )
  update public.long_form_jobs as j
  set
    claimed_by = p_worker_id,
    claimed_at = p_now,
    lease_expires_at = p_now + interval '45 minutes',
    updated_at = p_now
  from due
  where j.id = due.id
  returning j.*;
end;
$$;

revoke all on function public.claim_long_form_jobs(integer, text, timestamptz) from public, anon, authenticated;
grant execute on function public.claim_long_form_jobs(integer, text, timestamptz) to service_role;

alter table public.music_tracks enable row level security;
alter table public.long_form_productions enable row level security;
alter table public.long_form_jobs enable row level security;
alter table public.long_form_events enable row level security;

revoke all on public.music_tracks from anon, authenticated;
revoke all on public.long_form_productions from anon, authenticated;
revoke all on public.long_form_jobs from anon, authenticated;
revoke all on public.long_form_events from anon, authenticated;

grant select, insert, update, delete on public.music_tracks to service_role;
grant select, insert, update, delete on public.long_form_productions to service_role;
grant select, insert, update, delete on public.long_form_jobs to service_role;
grant select, insert, update, delete on public.long_form_events to service_role;
grant usage, select on sequence public.long_form_events_id_seq to service_role;
