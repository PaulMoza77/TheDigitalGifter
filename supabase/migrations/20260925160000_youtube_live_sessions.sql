-- YouTube Live sessions for long-form VPS streaming.
-- Ingestion credentials stay ciphertext-only. Clients never select that column.

begin;

create table if not exists public.youtube_live_sessions (
  id uuid primary key default gen_random_uuid(),
  library_asset_id text not null,
  production_id text not null,
  youtube_broadcast_id text,
  youtube_stream_id text,
  youtube_video_id text,
  youtube_url text,
  status text not null default 'preparing'
    check (status in (
      'preparing',
      'waiting_for_ingest',
      'live',
      'stopping',
      'completed',
      'failed'
    )),
  title text not null default 'TDG Live',
  description text not null default '',
  privacy_status text not null default 'private'
    check (privacy_status in ('private', 'unlisted', 'public')),
  made_for_kids boolean not null default false,
  duration_hours integer not null default 11
    check (duration_hours in (3, 6, 11) and duration_hours < 12),
  started_at timestamptz,
  planned_end_at timestamptz,
  ended_at timestamptz,
  ffmpeg_pid integer,
  ingestion_ciphertext text,
  source_copy boolean,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists youtube_live_sessions_status_idx
  on public.youtube_live_sessions (status, created_at desc);

create index if not exists youtube_live_sessions_asset_idx
  on public.youtube_live_sessions (library_asset_id, created_at desc);

-- V1: at most one active YouTube live. Drop before raising YOUTUBE_LIVE_MAX_CONCURRENT.
create unique index if not exists youtube_live_sessions_one_active
  on public.youtube_live_sessions ((true))
  where status in ('preparing', 'waiting_for_ingest', 'live', 'stopping');

alter table public.youtube_live_sessions enable row level security;

revoke all on public.youtube_live_sessions from public, anon, authenticated;
grant select, insert, update, delete on public.youtube_live_sessions to service_role;

commit;
