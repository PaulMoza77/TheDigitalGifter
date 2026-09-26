-- Minimal Content Autopilot: concept memory + daily pipeline (reuses library, reel finish, publisher).

begin;

create table if not exists public.content_autopilot_settings (
  id text primary key default 'default',
  enabled boolean not null default false,
  generation_paused boolean not null default false,
  research_candidates_per_day integer not null default 25,
  production_concepts_per_day integer not null default 5,
  clips_per_reel integer not null default 4,
  max_images_per_day integer not null default 30,
  max_image_retries_per_day integer not null default 10,
  max_videos_per_day integer not null default 25,
  max_video_retries_per_day integer not null default 8,
  max_image_attempts_per_clip integer not null default 2,
  max_daily_spend_usd numeric not null default 15,
  updated_at timestamptz not null default now()
);

insert into public.content_autopilot_settings (id)
values ('default')
on conflict (id) do nothing;

create table if not exists public.content_autopilot_daily_usage (
  usage_date date primary key,
  research_candidates integer not null default 0,
  production_concepts integer not null default 0,
  images_generated integer not null default 0,
  image_retries integer not null default 0,
  videos_generated integer not null default 0,
  video_retries integer not null default 0,
  estimated_spend_usd numeric not null default 0,
  research_completed boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.content_concepts (
  id uuid primary key default gen_random_uuid(),
  usage_date date not null default (timezone('utc', now()))::date,
  concept_family text not null,
  concept text not null,
  hook text not null,
  dedupe_key text not null,
  classification text not null default 'test'
    check (classification in ('repeat', 'test', 'skip')),
  target_platforms text[] not null default '{}',
  pipeline_status text not null default 'candidate'
    check (
      pipeline_status in (
        'candidate',
        'skipped',
        'selected',
        'prompts_ready',
        'generating_assets',
        'qc_review',
        'assembling_reel',
        'library_pending_finish',
        'ready',
        'failed'
      )
    ),
  failure_reason text,
  concept_description text,
  image_prompts jsonb not null default '[]'::jsonb,
  motion_prompts jsonb not null default '[]'::jsonb,
  clips jsonb not null default '[]'::jsonb,
  library_asset_id uuid references public.library_assets(id) on delete set null,
  generation_cost_usd numeric not null default 0,
  generation_count integer not null default 0,
  publication_count integer not null default 0,
  performance_summary jsonb not null default '{}'::jsonb,
  concept_status text not null default 'active'
    check (concept_status in ('active', 'paused', 'archived')),
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists content_concepts_dedupe_key_uq
  on public.content_concepts (dedupe_key);

create index if not exists content_concepts_usage_date_idx
  on public.content_concepts (usage_date, pipeline_status);

create index if not exists content_concepts_family_idx
  on public.content_concepts (concept_family, concept_status);

create table if not exists public.content_autopilot_events (
  id uuid primary key default gen_random_uuid(),
  usage_date date not null default (timezone('utc', now()))::date,
  concept_id uuid references public.content_concepts(id) on delete set null,
  kind text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists content_autopilot_events_date_idx
  on public.content_autopilot_events (usage_date, created_at desc);

alter table public.content_autopilot_settings enable row level security;
alter table public.content_autopilot_daily_usage enable row level security;
alter table public.content_concepts enable row level security;
alter table public.content_autopilot_events enable row level security;

commit;
