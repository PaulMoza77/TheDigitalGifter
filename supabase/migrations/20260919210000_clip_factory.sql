-- AI Clip Factory: jobs, cached analysis, renders, and Library provenance.
-- Additive only. RLS denies PostgREST clients; origin/service_role owns access.

begin;

create table if not exists public.clip_factory_media (
  id uuid primary key default gen_random_uuid(),
  media_hash text not null unique,
  source_kind text not null check (source_kind in ('upload', 'library', 'direct_media_url', 'supported_external_source')),
  source_label text not null default '',
  source_url text,
  library_asset_id text,
  storage_bucket text not null default 'clip-factory',
  storage_path text not null,
  content_type text,
  file_size_bytes bigint,
  duration_seconds double precision,
  width integer,
  height integer,
  fps double precision,
  codec_video text,
  codec_audio text,
  has_audio boolean,
  orientation text,
  probe jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.clip_factory_transcripts (
  id uuid primary key default gen_random_uuid(),
  media_hash text not null unique references public.clip_factory_media (media_hash) on delete cascade,
  language text,
  language_probability double precision,
  full_text text not null default '',
  words jsonb not null default '[]'::jsonb,
  segments jsonb not null default '[]'::jsonb,
  speakers jsonb not null default '[]'::jsonb,
  provider text not null default 'openai_whisper',
  duration_seconds double precision,
  created_at timestamptz not null default now()
);

create table if not exists public.clip_factory_scene_analyses (
  id uuid primary key default gen_random_uuid(),
  media_hash text not null unique references public.clip_factory_media (media_hash) on delete cascade,
  scenes jsonb not null default '[]'::jsonb,
  frames jsonb not null default '[]'::jsonb,
  visual_summary text,
  provider text not null default 'ffmpeg_gpt4o_mini',
  created_at timestamptz not null default now()
);

create table if not exists public.clip_factory_jobs (
  id uuid primary key default gen_random_uuid(),
  created_by uuid,
  created_by_email text,
  idempotency_key text,
  status text not null default 'queued'
    check (status in (
      'queued',
      'ingesting',
      'analyzing_audio',
      'transcribing',
      'understanding_scenes',
      'finding_hooks',
      'scoring',
      'ready',
      'rendering',
      'completed',
      'partial',
      'failed'
    )),
  stage text not null default 'queued',
  progress integer not null default 0 check (progress >= 0 and progress <= 100),
  source_kind text not null,
  source_payload jsonb not null default '{}'::jsonb,
  source_label text not null default '',
  source_thumbnail_path text,
  media_id uuid references public.clip_factory_media (id),
  media_hash text,
  options jsonb not null default '{}'::jsonb,
  moments_found integer not null default 0,
  clips_generated integer not null default 0,
  error_code text,
  error_message text,
  failed_stage text,
  retry_count integer not null default 0,
  claimed_by text,
  claimed_at timestamptz,
  lease_expires_at timestamptz,
  analysis_started_at timestamptz,
  analysis_completed_at timestamptz,
  cost jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists clip_factory_jobs_idem_uidx
  on public.clip_factory_jobs (created_by_email, idempotency_key)
  where idempotency_key is not null;

create index if not exists clip_factory_jobs_status_idx
  on public.clip_factory_jobs (status, updated_at desc);

create index if not exists clip_factory_jobs_created_idx
  on public.clip_factory_jobs (created_at desc);

create table if not exists public.clip_factory_candidates (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.clip_factory_jobs (id) on delete cascade,
  media_hash text,
  start_time double precision not null,
  end_time double precision not null,
  duration double precision not null,
  title text not null default '',
  hook text not null default '',
  summary text not null default '',
  reason text not null default '',
  category text not null default 'auto',
  suggested_platforms jsonb not null default '[]'::jsonb,
  suggested_caption text not null default '',
  suggested_post_caption text not null default '',
  hashtags jsonb not null default '[]'::jsonb,
  confidence double precision,
  scores jsonb not null default '{}'::jsonb,
  overall_viral_score integer not null default 0,
  why_it_works jsonb not null default '[]'::jsonb,
  crop jsonb not null default '{}'::jsonb,
  rejected boolean not null default false,
  sort_index integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists clip_factory_candidates_job_idx
  on public.clip_factory_candidates (job_id, overall_viral_score desc);

create table if not exists public.clip_factory_renders (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.clip_factory_jobs (id) on delete cascade,
  candidate_id uuid not null references public.clip_factory_candidates (id) on delete cascade,
  library_asset_id uuid,
  status text not null default 'queued'
    check (status in ('queued', 'rendering', 'completed', 'failed')),
  start_time double precision not null,
  end_time double precision not null,
  caption_style text not null default 'auto',
  ai_hook_enabled boolean not null default true,
  crop jsonb not null default '{}'::jsonb,
  storage_bucket text,
  storage_path text,
  thumbnail_path text,
  width integer,
  height integer,
  duration_seconds double precision,
  file_size_bytes bigint,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, candidate_id)
);

create table if not exists public.library_assets (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  src text not null,
  filename text not null,
  category text not null default 'clip_factory',
  kind text not null default 'reel',
  duration_seconds double precision,
  width integer,
  height integer,
  poster_src text,
  storage_bucket text,
  storage_path text,
  thumbnail_path text,
  provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists library_assets_created_idx
  on public.library_assets (created_at desc);

create table if not exists public.clip_factory_events (
  id bigint generated always as identity primary key,
  job_id uuid,
  event_name text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists clip_factory_events_job_idx
  on public.clip_factory_events (job_id, created_at desc);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'clip-factory',
  'clip-factory',
  false,
  524288000,
  array[
    'video/mp4',
    'video/quicktime',
    'video/webm',
    'video/x-m4v',
    'image/jpeg',
    'image/png',
    'audio/mpeg',
    'audio/wav',
    'audio/mp4'
  ]
)
on conflict (id) do nothing;

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
        'ingesting',
        'analyzing_audio',
        'transcribing',
        'understanding_scenes',
        'finding_hooks',
        'scoring',
        'rendering'
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

alter table public.clip_factory_media enable row level security;
alter table public.clip_factory_transcripts enable row level security;
alter table public.clip_factory_scene_analyses enable row level security;
alter table public.clip_factory_jobs enable row level security;
alter table public.clip_factory_candidates enable row level security;
alter table public.clip_factory_renders enable row level security;
alter table public.library_assets enable row level security;
alter table public.clip_factory_events enable row level security;

revoke all on public.clip_factory_media from anon, authenticated;
revoke all on public.clip_factory_transcripts from anon, authenticated;
revoke all on public.clip_factory_scene_analyses from anon, authenticated;
revoke all on public.clip_factory_jobs from anon, authenticated;
revoke all on public.clip_factory_candidates from anon, authenticated;
revoke all on public.clip_factory_renders from anon, authenticated;
revoke all on public.library_assets from anon, authenticated;
revoke all on public.clip_factory_events from anon, authenticated;

grant select, insert, update, delete on public.clip_factory_media to service_role;
grant select, insert, update, delete on public.clip_factory_transcripts to service_role;
grant select, insert, update, delete on public.clip_factory_scene_analyses to service_role;
grant select, insert, update, delete on public.clip_factory_jobs to service_role;
grant select, insert, update, delete on public.clip_factory_candidates to service_role;
grant select, insert, update, delete on public.clip_factory_renders to service_role;
grant select, insert, update, delete on public.library_assets to service_role;
grant select, insert, update, delete on public.clip_factory_events to service_role;
grant usage, select on sequence public.clip_factory_events_id_seq to service_role;

commit;
