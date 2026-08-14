-- Minimal schema for Postgres function tests. No PII. No live data.
-- PGlite does not ship pgcrypto; provide a local UUID helper.

create or replace function public.gen_random_uuid()
returns uuid
language plpgsql
as $$
declare
  v text;
begin
  v := md5(random()::text || clock_timestamp()::text || random()::text);
  return (
    substr(v, 1, 8) || '-' ||
    substr(v, 9, 4) || '-' ||
    '4' || substr(v, 13, 3) || '-' ||
    substr('89ab', 1 + floor(random() * 4)::int, 1) || substr(v, 17, 3) || '-' ||
    substr(v, 21, 12)
  )::uuid;
end;
$$;

create table if not exists public.generations (
  id uuid primary key default public.gen_random_uuid(),
  status text not null default 'pending',
  attempt_count integer default 0,
  error text,
  started_at timestamptz,
  updated_at timestamptz not null default now(),
  order_id uuid,
  replicate_prediction_id text,
  completed_at timestamptz,
  result_mime text
);

create table if not exists public.mvp_orders (
  id uuid primary key default public.gen_random_uuid(),
  email text not null default 'test@example.com',
  user_id uuid,
  status text not null default 'pending',
  sku text not null default 'still_image_single',
  amount_cents integer not null default 499,
  currency text not null default 'eur',
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  generation_id uuid,
  template_id text,
  included_regenerations_allowed integer not null default 1,
  included_regenerations_used integer not null default 0,
  generation_attempts integer not null default 0,
  error text,
  paid_at timestamptz,
  fulfilled_at timestamptz,
  upload_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stripe_webhook_events (
  event_id text primary key,
  event_type text not null,
  order_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.upload_sessions (
  id uuid primary key default public.gen_random_uuid(),
  bucket text not null default 'customer-uploads',
  path text not null unique,
  declared_mime text,
  declared_size integer,
  status text not null default 'pending_upload'
    check (status in ('pending_upload','confirmed','rejected','abandoned')),
  magic_ok boolean not null default false,
  user_id uuid,
  ip_hash text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  confirmed_at timestamptz
);

create table if not exists public.fulfillment_jobs (
  id uuid primary key default public.gen_random_uuid(),
  order_id uuid not null,
  generation_id uuid not null,
  kind text not null default 'initial',
  status text not null default 'queued'
    check (status in ('queued','running','succeeded','failed','dead')),
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  run_after timestamptz not null default now(),
  locked_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists fulfillment_jobs_one_active
  on public.fulfillment_jobs (order_id)
  where status in ('queued','running');
