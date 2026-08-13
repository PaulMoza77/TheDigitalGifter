-- MVP checkout, private storage, webhook idempotency, and retention.
-- Apply in the Supabase SQL editor or via `supabase db push` before enabling checkout.

create extension if not exists pgcrypto;

create table if not exists public.stripe_webhook_events (
  event_id text primary key,
  event_type text not null,
  order_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.mvp_orders (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  user_id uuid,
  status text not null default 'pending'
    check (status in ('pending','paid','fulfilling','completed','failed','refunded','canceled')),
  sku text not null default 'still_image_single',
  amount_cents integer not null default 499,
  currency text not null default 'eur',
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text,
  generation_id uuid,
  template_id text,
  style_id text,
  occasion text,
  photo_bucket text,
  photo_path text,
  included_regenerations_allowed integer not null default 1,
  included_regenerations_used integer not null default 0,
  generation_attempts integer not null default 0,
  digital_content_consent boolean not null default false,
  license text not null default 'personal',
  error text,
  paid_at timestamptz,
  fulfilled_at timestamptz,
  result_emailed_at timestamptz,
  upload_expires_at timestamptz,
  result_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mvp_orders_email_idx on public.mvp_orders (email);
create index if not exists mvp_orders_status_idx on public.mvp_orders (status);
create index if not exists mvp_orders_generation_idx on public.mvp_orders (generation_id);

alter table public.generations add column if not exists order_id uuid;
alter table public.generations add column if not exists attempt_kind text default 'initial';
alter table public.generations add column if not exists attempt_count integer default 0;
alter table public.generations add column if not exists result_bucket text;
alter table public.generations add column if not exists result_path text;
alter table public.generations add column if not exists upload_expires_at timestamptz;
alter table public.generations add column if not exists result_expires_at timestamptz;
alter table public.generations add column if not exists started_at timestamptz;
alter table public.generations add column if not exists completed_at timestamptz;
alter table public.generations add column if not exists replicate_prediction_id text;

create index if not exists generations_order_id_idx on public.generations (order_id);
create index if not exists generations_stripe_session_idx on public.generations (stripe_session_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'customer-uploads',
    'customer-uploads',
    false,
    10485760,
    array['image/jpeg','image/png','image/webp']
  ),
  (
    'generated-results',
    'generated-results',
    false,
    20971520,
    array['image/jpeg','image/png','image/webp']
  )
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.mvp_orders enable row level security;

drop policy if exists mvp_orders_no_direct_access on public.mvp_orders;
create policy mvp_orders_no_direct_access
  on public.mvp_orders
  for all
  to anon, authenticated
  using (false)
  with check (false);

-- Private buckets have public = false. Do not add storage.objects
-- SELECT policies for customer-uploads / generated-results: access is
-- only via service-role signed URLs created by edge functions.

create or replace function public.claim_mvp_order_paid(
  p_order_id uuid,
  p_event_id text,
  p_event_type text,
  p_session_id text,
  p_payment_intent_id text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rowcount integer := 0;
  v_order public.mvp_orders%rowtype;
begin
  insert into public.stripe_webhook_events (event_id, event_type, order_id)
  values (p_event_id, p_event_type, p_order_id)
  on conflict (event_id) do nothing;

  get diagnostics v_rowcount = row_count;
  if v_rowcount = 0 then
    select * into v_order from public.mvp_orders where id = p_order_id;
    return jsonb_build_object(
      'kind', 'duplicate_event',
      'should_start_generation', false,
      'order', to_jsonb(v_order)
    );
  end if;

  update public.mvp_orders
  set
    status = 'paid',
    paid_at = coalesce(paid_at, now()),
    stripe_checkout_session_id = coalesce(p_session_id, stripe_checkout_session_id),
    stripe_payment_intent_id = coalesce(p_payment_intent_id, stripe_payment_intent_id),
    updated_at = now()
  where id = p_order_id
    and status = 'pending'
  returning * into v_order;

  if found then
    return jsonb_build_object(
      'kind', 'claimed',
      'should_start_generation', true,
      'order', to_jsonb(v_order)
    );
  end if;

  select * into v_order from public.mvp_orders where id = p_order_id;
  return jsonb_build_object(
    'kind', 'already_paid',
    'should_start_generation', false,
    'order', to_jsonb(v_order)
  );
end;
$$;

create or replace function public.claim_mvp_generation_start(
  p_generation_id uuid,
  p_max_attempts integer default 3
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gen public.generations%rowtype;
  v_attempts integer;
begin
  select * into v_gen from public.generations where id = p_generation_id;
  if not found then
    return jsonb_build_object('kind', 'missing', 'run_generation', false);
  end if;

  v_attempts := coalesce(v_gen.attempt_count, 0);

  if v_gen.status in ('processing') then
    return jsonb_build_object('kind', 'already_running', 'run_generation', false, 'generation', to_jsonb(v_gen));
  end if;

  if v_gen.status in ('completed', 'ready', 'succeeded', 'saved') then
    return jsonb_build_object('kind', 'already_complete', 'run_generation', false, 'generation', to_jsonb(v_gen));
  end if;

  if v_gen.status = 'failed' and v_attempts >= p_max_attempts then
    return jsonb_build_object('kind', 'blocked', 'run_generation', false, 'reason', 'max_attempts_reached');
  end if;

  if v_gen.status not in ('pending', 'queued', 'failed') then
    return jsonb_build_object('kind', 'blocked', 'run_generation', false, 'reason', v_gen.status);
  end if;

  update public.generations
  set
    status = 'processing',
    error = null,
    attempt_count = v_attempts + 1,
    started_at = now(),
    updated_at = now()
  where id = p_generation_id
    and status in ('pending', 'queued', 'failed')
  returning * into v_gen;

  if not found then
    return jsonb_build_object('kind', 'already_running', 'run_generation', false);
  end if;

  update public.mvp_orders
  set
    status = 'fulfilling',
    generation_attempts = coalesce(generation_attempts, 0) + 1,
    updated_at = now()
  where generation_id = p_generation_id
     or id = v_gen.order_id;

  return jsonb_build_object('kind', 'claimed', 'run_generation', true, 'generation', to_jsonb(v_gen));
end;
$$;

revoke all on function public.claim_mvp_order_paid(uuid, text, text, text, text) from public, anon, authenticated;
revoke all on function public.claim_mvp_generation_start(uuid, integer) from public, anon, authenticated;
grant execute on function public.claim_mvp_order_paid(uuid, text, text, text, text) to service_role;
grant execute on function public.claim_mvp_generation_start(uuid, integer) to service_role;
