-- Security hardening for MVP fulfillment. Apply after 20260813_mvp_fulfillment.sql.

create table if not exists public.upload_sessions (
  id uuid primary key default gen_random_uuid(),
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

create index if not exists upload_sessions_status_idx on public.upload_sessions (status, expires_at);
create index if not exists upload_sessions_ip_hash_idx on public.upload_sessions (ip_hash, created_at);

create table if not exists public.fulfillment_jobs (
  id uuid primary key default gen_random_uuid(),
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

create index if not exists fulfillment_jobs_claim_idx
  on public.fulfillment_jobs (status, run_after);

create unique index if not exists fulfillment_jobs_one_active
  on public.fulfillment_jobs (order_id)
  where status in ('queued','running');

alter table public.mvp_orders add column if not exists upload_id uuid;
alter table public.mvp_orders add column if not exists template_prompt text;

alter table public.stripe_webhook_events enable row level security;
alter table public.upload_sessions enable row level security;
alter table public.fulfillment_jobs enable row level security;

drop policy if exists stripe_webhook_events_no_direct_access on public.stripe_webhook_events;
create policy stripe_webhook_events_no_direct_access
  on public.stripe_webhook_events for all to anon, authenticated
  using (false) with check (false);

drop policy if exists upload_sessions_no_direct_access on public.upload_sessions;
create policy upload_sessions_no_direct_access
  on public.upload_sessions for all to anon, authenticated
  using (false) with check (false);

drop policy if exists fulfillment_jobs_no_direct_access on public.fulfillment_jobs;
create policy fulfillment_jobs_no_direct_access
  on public.fulfillment_jobs for all to anon, authenticated
  using (false) with check (false);

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
  v_job_id uuid;
begin
  insert into public.stripe_webhook_events (event_id, event_type, order_id)
  values (p_event_id, p_event_type, p_order_id)
  on conflict (event_id) do nothing;

  get diagnostics v_rowcount = row_count;
  if v_rowcount = 0 then
    select * into v_order from public.mvp_orders where id = p_order_id;
    return jsonb_build_object(
      'kind', 'duplicate_event',
      'enqueue_job', false,
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
    insert into public.fulfillment_jobs (
      order_id, generation_id, kind, status, max_attempts
    ) values (
      v_order.id, v_order.generation_id, 'initial', 'queued', 3
    )
    returning id into v_job_id;

    return jsonb_build_object(
      'kind', 'claimed',
      'enqueue_job', true,
      'job_id', v_job_id,
      'order', to_jsonb(v_order)
    );
  end if;

  select * into v_order from public.mvp_orders where id = p_order_id;
  return jsonb_build_object(
    'kind', 'already_paid',
    'enqueue_job', false,
    'order', to_jsonb(v_order)
  );
end;
$$;

create or replace function public.claim_next_fulfillment_job(
  p_stale_after interval default interval '10 minutes'
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.fulfillment_jobs%rowtype;
begin
  update public.fulfillment_jobs
  set status = 'queued', locked_at = null, updated_at = now(), run_after = now()
  where status = 'running'
    and locked_at is not null
    and locked_at < now() - p_stale_after;

  select * into v_job
  from public.fulfillment_jobs
  where status = 'queued'
    and run_after <= now()
  order by run_after asc
  for update skip locked
  limit 1;

  if not found then
    return jsonb_build_object('kind', 'empty');
  end if;

  update public.fulfillment_jobs
  set
    status = 'running',
    locked_at = now(),
    attempts = attempts + 1,
    updated_at = now()
  where id = v_job.id
  returning * into v_job;

  return jsonb_build_object('kind', 'claimed', 'job', to_jsonb(v_job));
end;
$$;

create or replace function public.finish_fulfillment_job(
  p_job_id uuid,
  p_ok boolean,
  p_error text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.fulfillment_jobs%rowtype;
begin
  select * into v_job from public.fulfillment_jobs where id = p_job_id;
  if not found then
    return jsonb_build_object('kind', 'missing');
  end if;

  if p_ok then
    update public.fulfillment_jobs
    set status = 'succeeded', last_error = null, locked_at = null, updated_at = now()
    where id = p_job_id;
    return jsonb_build_object('kind', 'succeeded');
  end if;

  if v_job.attempts >= v_job.max_attempts then
    update public.fulfillment_jobs
    set status = 'dead', last_error = p_error, locked_at = null, updated_at = now()
    where id = p_job_id;
    update public.mvp_orders
    set status = 'failed', error = coalesce(p_error, 'max_attempts_reached'), updated_at = now()
    where id = v_job.order_id;
    return jsonb_build_object('kind', 'dead');
  end if;

  update public.fulfillment_jobs
  set
    status = 'queued',
    last_error = p_error,
    locked_at = null,
    run_after = now() + make_interval(secs => power(2, least(v_job.attempts, 6))::int),
    updated_at = now()
  where id = p_job_id;

  return jsonb_build_object('kind', 'requeued');
end;
$$;

create or replace function public.claim_included_regeneration(
  p_order_id uuid,
  p_generation_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.mvp_orders%rowtype;
  v_job_id uuid;
begin
  if exists (
    select 1 from public.fulfillment_jobs
    where order_id = p_order_id and status in ('queued','running')
  ) then
    return jsonb_build_object('kind', 'in_flight', 'ok', false);
  end if;

  update public.mvp_orders
  set
    included_regenerations_used = included_regenerations_used + 1,
    generation_id = p_generation_id,
    status = 'fulfilling',
    updated_at = now()
  where id = p_order_id
    and included_regenerations_used < included_regenerations_allowed
    and status in ('completed','paid')
  returning * into v_order;

  if not found then
    return jsonb_build_object('kind', 'conflict', 'ok', false);
  end if;

  insert into public.fulfillment_jobs (order_id, generation_id, kind, status, max_attempts)
  values (v_order.id, p_generation_id, 'included_retry', 'queued', 3)
  returning id into v_job_id;

  return jsonb_build_object('kind', 'claimed', 'ok', true, 'order', to_jsonb(v_order), 'job_id', v_job_id);
end;
$$;

revoke all on function public.claim_mvp_order_paid(uuid, text, text, text, text) from public, anon, authenticated;
revoke all on function public.claim_next_fulfillment_job(interval) from public, anon, authenticated;
revoke all on function public.finish_fulfillment_job(uuid, boolean, text) from public, anon, authenticated;
revoke all on function public.claim_included_regeneration(uuid, uuid) from public, anon, authenticated;
grant execute on function public.claim_mvp_order_paid(uuid, text, text, text, text) to service_role;
grant execute on function public.claim_next_fulfillment_job(interval) to service_role;
grant execute on function public.finish_fulfillment_job(uuid, boolean, text) to service_role;
grant execute on function public.claim_included_regeneration(uuid, uuid) to service_role;
