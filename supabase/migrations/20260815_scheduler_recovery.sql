-- Scheduler recovery, search_path hardening, one-upload-one-order, redeem codes.
-- Apply after 20260814_security_hardening.sql. Do not apply from this environment.

alter table public.generations add column if not exists result_mime text;

alter table public.upload_sessions drop constraint if exists upload_sessions_status_check;
alter table public.upload_sessions
  add constraint upload_sessions_status_check
  check (status in ('pending_upload','confirmed','rejected','abandoned','consumed'));

alter table public.upload_sessions add column if not exists consumed_order_id uuid;

create unique index if not exists mvp_orders_one_live_upload
  on public.mvp_orders (upload_id)
  where upload_id is not null and status <> 'canceled';

create table if not exists public.access_redeem_codes (
  code_hash text primary key,
  order_id uuid not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default pg_catalog.now()
);

create index if not exists access_redeem_codes_order_idx
  on public.access_redeem_codes (order_id);

alter table public.access_redeem_codes enable row level security;

drop policy if exists access_redeem_codes_no_direct_access on public.access_redeem_codes;
create policy access_redeem_codes_no_direct_access
  on public.access_redeem_codes for all to anon, authenticated
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
set search_path = ''
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
    return pg_catalog.jsonb_build_object(
      'kind', 'duplicate_event',
      'enqueue_job', false,
      'order', pg_catalog.to_jsonb(v_order)
    );
  end if;

  update public.mvp_orders
  set
    status = 'paid',
    paid_at = coalesce(paid_at, pg_catalog.now()),
    stripe_checkout_session_id = coalesce(p_session_id, stripe_checkout_session_id),
    stripe_payment_intent_id = coalesce(p_payment_intent_id, stripe_payment_intent_id),
    updated_at = pg_catalog.now()
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

    return pg_catalog.jsonb_build_object(
      'kind', 'claimed',
      'enqueue_job', true,
      'job_id', v_job_id,
      'order', pg_catalog.to_jsonb(v_order)
    );
  end if;

  select * into v_order from public.mvp_orders where id = p_order_id;
  return pg_catalog.jsonb_build_object(
    'kind', 'already_paid',
    'enqueue_job', false,
    'order', pg_catalog.to_jsonb(v_order)
  );
end;
$$;

create or replace function public.claim_next_fulfillment_job(
  p_stale_after interval default interval '10 minutes'
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.fulfillment_jobs%rowtype;
begin
  -- Recover stuck running jobs so cron can retry without a new webhook.
  update public.fulfillment_jobs
  set status = 'queued', locked_at = null, updated_at = pg_catalog.now(), run_after = pg_catalog.now()
  where status = 'running'
    and locked_at is not null
    and locked_at < pg_catalog.now() - p_stale_after;

  select * into v_job
  from public.fulfillment_jobs
  where status = 'queued'
    and run_after <= pg_catalog.now()
  order by run_after asc
  for update skip locked
  limit 1;

  if not found then
    return pg_catalog.jsonb_build_object('kind', 'empty');
  end if;

  update public.fulfillment_jobs
  set
    status = 'running',
    locked_at = pg_catalog.now(),
    attempts = attempts + 1,
    updated_at = pg_catalog.now()
  where id = v_job.id
  returning * into v_job;

  return pg_catalog.jsonb_build_object('kind', 'claimed', 'job', pg_catalog.to_jsonb(v_job));
end;
$$;

create or replace function public.finish_fulfillment_job(
  p_job_id uuid,
  p_ok boolean,
  p_error text default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.fulfillment_jobs%rowtype;
begin
  select * into v_job from public.fulfillment_jobs where id = p_job_id;
  if not found then
    return pg_catalog.jsonb_build_object('kind', 'missing');
  end if;

  if p_ok then
    update public.fulfillment_jobs
    set status = 'succeeded', last_error = null, locked_at = null, updated_at = pg_catalog.now()
    where id = p_job_id;
    return pg_catalog.jsonb_build_object('kind', 'succeeded');
  end if;

  if v_job.attempts >= v_job.max_attempts then
    update public.fulfillment_jobs
    set status = 'dead', last_error = p_error, locked_at = null, updated_at = pg_catalog.now()
    where id = p_job_id;
    update public.mvp_orders
    set status = 'failed', error = coalesce(p_error, 'max_attempts_reached'), updated_at = pg_catalog.now()
    where id = v_job.order_id;
    return pg_catalog.jsonb_build_object('kind', 'dead');
  end if;

  update public.fulfillment_jobs
  set
    status = 'queued',
    last_error = p_error,
    locked_at = null,
    run_after = pg_catalog.now() + pg_catalog.make_interval(secs => pg_catalog.power(2, least(v_job.attempts, 6))::int),
    updated_at = pg_catalog.now()
  where id = p_job_id;

  return pg_catalog.jsonb_build_object('kind', 'requeued');
end;
$$;

create or replace function public.claim_included_regeneration(
  p_order_id uuid,
  p_generation_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.mvp_orders%rowtype;
  v_job_id uuid;
begin
  if exists (
    select 1 from public.fulfillment_jobs
    where order_id = p_order_id and status in ('queued','running')
  ) then
    return pg_catalog.jsonb_build_object('kind', 'in_flight', 'ok', false);
  end if;

  update public.mvp_orders
  set
    included_regenerations_used = included_regenerations_used + 1,
    generation_id = p_generation_id,
    status = 'fulfilling',
    updated_at = pg_catalog.now()
  where id = p_order_id
    and included_regenerations_used < included_regenerations_allowed
    and status in ('completed','paid')
  returning * into v_order;

  if not found then
    return pg_catalog.jsonb_build_object('kind', 'conflict', 'ok', false);
  end if;

  insert into public.fulfillment_jobs (order_id, generation_id, kind, status, max_attempts)
  values (v_order.id, p_generation_id, 'included_retry', 'queued', 3)
  returning id into v_job_id;

  return pg_catalog.jsonb_build_object(
    'kind', 'claimed',
    'ok', true,
    'order', pg_catalog.to_jsonb(v_order),
    'job_id', v_job_id
  );
end;
$$;

create or replace function public.claim_mvp_generation_start(
  p_generation_id uuid,
  p_max_attempts integer default 3
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_gen public.generations%rowtype;
  v_attempts integer;
  v_prev_status text;
begin
  select * into v_gen from public.generations where id = p_generation_id;
  if not found then
    return pg_catalog.jsonb_build_object('kind', 'missing', 'run_generation', false);
  end if;

  v_attempts := coalesce(v_gen.attempt_count, 0);
  v_prev_status := v_gen.status;

  if v_gen.status in ('completed', 'ready', 'succeeded', 'saved') then
    return pg_catalog.jsonb_build_object(
      'kind', 'already_complete',
      'run_generation', false,
      'generation', pg_catalog.to_jsonb(v_gen)
    );
  end if;

  -- processing is reclaimable: a previous worker died after claim. Unique active
  -- job + SKIP LOCKED means only one worker holds the order.
  if v_gen.status = 'processing' then
    if v_attempts >= p_max_attempts then
      return pg_catalog.jsonb_build_object(
        'kind', 'blocked',
        'run_generation', false,
        'reason', 'max_attempts_reached'
      );
    end if;
  elsif v_gen.status = 'failed' and v_attempts >= p_max_attempts then
    return pg_catalog.jsonb_build_object(
      'kind', 'blocked',
      'run_generation', false,
      'reason', 'max_attempts_reached'
    );
  elsif v_gen.status not in ('pending', 'queued', 'failed', 'processing') then
    return pg_catalog.jsonb_build_object(
      'kind', 'blocked',
      'run_generation', false,
      'reason', v_gen.status
    );
  end if;

  update public.generations
  set
    status = 'processing',
    error = null,
    attempt_count = case
      when v_gen.status = 'processing' then v_attempts
      else v_attempts + 1
    end,
    started_at = coalesce(started_at, pg_catalog.now()),
    updated_at = pg_catalog.now()
  where id = p_generation_id
    and status in ('pending', 'queued', 'failed', 'processing')
  returning * into v_gen;

  if not found then
    return pg_catalog.jsonb_build_object('kind', 'already_running', 'run_generation', false);
  end if;

  update public.mvp_orders
  set
    status = 'fulfilling',
    generation_attempts = case
      when v_prev_status = 'processing' then coalesce(generation_attempts, 0)
      else coalesce(generation_attempts, 0) + 1
    end,
    updated_at = pg_catalog.now()
  where generation_id = p_generation_id
     or id = v_gen.order_id;

  return pg_catalog.jsonb_build_object(
    'kind', 'claimed',
    'run_generation', true,
    'generation', pg_catalog.to_jsonb(v_gen)
  );
end;
$$;

create or replace function public.release_mvp_generation_claim(
  p_generation_id uuid,
  p_error text default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.generations
  set
    status = 'failed',
    error = coalesce(p_error, error),
    updated_at = pg_catalog.now()
  where id = p_generation_id
    and status = 'processing';

  if found then
    return pg_catalog.jsonb_build_object('kind', 'released');
  end if;
  return pg_catalog.jsonb_build_object('kind', 'unchanged');
end;
$$;

create or replace function public.consume_confirmed_upload(
  p_upload_id uuid,
  p_order_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_upload public.upload_sessions%rowtype;
begin
  update public.upload_sessions
  set
    status = 'consumed',
    consumed_order_id = p_order_id
  where id = p_upload_id
    and status = 'confirmed'
    and expires_at > pg_catalog.now()
    and consumed_order_id is null
  returning * into v_upload;

  if not found then
    return pg_catalog.jsonb_build_object('ok', false, 'kind', 'unavailable');
  end if;

  return pg_catalog.jsonb_build_object('ok', true, 'kind', 'consumed', 'upload', pg_catalog.to_jsonb(v_upload));
end;
$$;

create or replace function public.consume_access_redeem_code(
  p_code_hash text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.access_redeem_codes%rowtype;
begin
  update public.access_redeem_codes
  set used_at = pg_catalog.now()
  where code_hash = p_code_hash
    and used_at is null
    and expires_at > pg_catalog.now()
  returning * into v_row;

  if not found then
    return pg_catalog.jsonb_build_object('ok', false, 'kind', 'invalid');
  end if;

  return pg_catalog.jsonb_build_object('ok', true, 'order_id', v_row.order_id);
end;
$$;

revoke all on function public.claim_mvp_order_paid(uuid, text, text, text, text) from public, anon, authenticated;
revoke all on function public.claim_next_fulfillment_job(interval) from public, anon, authenticated;
revoke all on function public.finish_fulfillment_job(uuid, boolean, text) from public, anon, authenticated;
revoke all on function public.claim_included_regeneration(uuid, uuid) from public, anon, authenticated;
revoke all on function public.claim_mvp_generation_start(uuid, integer) from public, anon, authenticated;
revoke all on function public.release_mvp_generation_claim(uuid, text) from public, anon, authenticated;
revoke all on function public.consume_confirmed_upload(uuid, uuid) from public, anon, authenticated;
revoke all on function public.consume_access_redeem_code(text) from public, anon, authenticated;

grant execute on function public.claim_mvp_order_paid(uuid, text, text, text, text) to service_role;
grant execute on function public.claim_next_fulfillment_job(interval) to service_role;
grant execute on function public.finish_fulfillment_job(uuid, boolean, text) to service_role;
grant execute on function public.claim_included_regeneration(uuid, uuid) to service_role;
grant execute on function public.claim_mvp_generation_start(uuid, integer) to service_role;
grant execute on function public.release_mvp_generation_claim(uuid, text) to service_role;
grant execute on function public.consume_confirmed_upload(uuid, uuid) to service_role;
grant execute on function public.consume_access_redeem_code(text) to service_role;
