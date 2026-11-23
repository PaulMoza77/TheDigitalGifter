-- Mission 02F — private media delivery audit + signed playback helpers.
-- Apply only to isolated/staging. Do NOT apply to production without authorization.

begin;

-- Short-lived signed media issuance log (service_role only)
create table if not exists public.christmas_story_media_sign_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.christmas_story_orders (id) on delete cascade,
  asset_id uuid not null references public.christmas_story_assets (id) on delete cascade,
  actor_kind text not null,
  expires_in_sec integer not null,
  storage_bucket text not null,
  storage_path text not null,
  created_at timestamptz not null default now(),
  constraint christmas_story_media_sign_actor_chk check (actor_kind in ('buyer','recipient','admin','worker')),
  constraint christmas_story_media_sign_ttl_chk check (expires_in_sec > 0 and expires_in_sec <= 3600)
);

create index if not exists christmas_story_media_sign_order_idx
  on public.christmas_story_media_sign_events (order_id, created_at desc);

alter table public.christmas_story_media_sign_events enable row level security;
revoke all on table public.christmas_story_media_sign_events from anon, authenticated, public;
grant all on table public.christmas_story_media_sign_events to service_role;

-- Ensure assets always carry order-scoped private paths (enforced at app layer too)
alter table public.christmas_story_assets
  add column if not exists is_private boolean not null default true;

-- Worker upload receipts (no public URLs stored)
create table if not exists public.christmas_story_worker_uploads (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.christmas_story_orders (id) on delete cascade,
  job_id uuid references public.christmas_story_jobs (id) on delete set null,
  asset_id uuid references public.christmas_story_assets (id) on delete set null,
  worker_id text not null,
  storage_bucket text not null,
  storage_path text not null,
  content_type text,
  byte_size bigint,
  checksum_sha256 text,
  created_at timestamptz not null default now(),
  constraint christmas_story_worker_uploads_path_chk check (position('/' in storage_path) > 0)
);

alter table public.christmas_story_worker_uploads enable row level security;
revoke all on table public.christmas_story_worker_uploads from anon, authenticated, public;
grant all on table public.christmas_story_worker_uploads to service_role;

-- Reaffirm private buckets (idempotent)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'christmas-story-source',
    'christmas-story-source',
    false,
    8388608,
    array['image/jpeg','image/png','image/webp']::text[]
  ),
  (
    'christmas-story-generated',
    'christmas-story-generated',
    false,
    52428800,
    array['image/jpeg','image/png','image/webp','audio/mpeg','audio/mp4','video/mp4','application/pdf']::text[]
  )
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Never allow public object policies for story media
drop policy if exists christmas_story_source_public on storage.objects;
drop policy if exists christmas_story_generated_public on storage.objects;
drop policy if exists christmas_story_source_anon_read on storage.objects;
drop policy if exists christmas_story_generated_anon_read on storage.objects;
drop policy if exists christmas_story_source_authenticated_read on storage.objects;
drop policy if exists christmas_story_generated_authenticated_read on storage.objects;

commit;
