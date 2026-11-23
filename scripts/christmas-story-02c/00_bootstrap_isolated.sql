-- Mission 02C isolated DB bootstrap (local Docker only).
-- Stubs minimal Supabase/auth/storage surfaces so the durable-orders migration can apply
-- without touching production or shared local projects.

begin;

create schema if not exists auth;
create table if not exists auth.users (
  id uuid primary key
);

create schema if not exists storage;
create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text,
  owner uuid,
  created_at timestamptz default now()
);

-- Role stubs used by RLS grants/revokes
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end $$;

create or replace function auth.role()
returns text
language sql
stable
as $$
  select coalesce(current_setting('request.jwt.claim.role', true), current_user);
$$;

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

create or replace function public.christmas_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Stripe event idempotency table (normally from earlier TDG migrations)
create table if not exists public.processed_stripe_events (
  event_id text primary key,
  event_type text,
  stripe_session_id text,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

revoke all on table public.processed_stripe_events from anon, authenticated, public;
grant all on table public.processed_stripe_events to service_role;

commit;
