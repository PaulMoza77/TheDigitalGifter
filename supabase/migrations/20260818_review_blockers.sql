-- Review blockers: email jobs must not fail completed orders, checkout
-- retry identity, and explicit generations RLS. Apply after 20260817.
-- Does not install cron. Do not apply from this environment.

alter table public.mvp_orders add column if not exists checkout_request_id uuid;

create unique index if not exists mvp_orders_checkout_request_id
  on public.mvp_orders (checkout_request_id)
  where checkout_request_id is not null;

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
  v_email_job boolean := false;
begin
  select * into v_job from public.fulfillment_jobs where id = p_job_id;
  if not found then
    return pg_catalog.jsonb_build_object('kind', 'missing');
  end if;

  v_email_job := v_job.kind = 'result_email';

  if p_ok then
    update public.fulfillment_jobs
    set status = 'succeeded', last_error = null, locked_at = null, updated_at = pg_catalog.now()
    where id = p_job_id;
    return pg_catalog.jsonb_build_object('kind', 'succeeded', 'email_job', v_email_job);
  end if;

  if v_job.attempts >= v_job.max_attempts then
    update public.fulfillment_jobs
    set status = 'dead', last_error = p_error, locked_at = null, updated_at = pg_catalog.now()
    where id = p_job_id;
    if not v_email_job then
      update public.mvp_orders
      set status = 'failed', error = coalesce(p_error, 'max_attempts_reached'), updated_at = pg_catalog.now()
      where id = v_job.order_id
        and status not in ('completed', 'refunded', 'canceled');
    end if;
    return pg_catalog.jsonb_build_object(
      'kind', 'dead',
      'email_job', v_email_job,
      'order_status_unchanged', v_email_job
    );
  end if;

  update public.fulfillment_jobs
  set
    status = 'queued',
    last_error = p_error,
    locked_at = null,
    run_after = pg_catalog.now() + pg_catalog.make_interval(secs => pg_catalog.power(2, least(v_job.attempts, 6))::int),
    updated_at = pg_catalog.now()
  where id = p_job_id;

  return pg_catalog.jsonb_build_object('kind', 'requeued', 'email_job', v_email_job);
end;
$$;

create or replace function public.finish_fulfillment_job_and_enqueue_email(
  p_job_id uuid,
  p_ok boolean,
  p_error text default null,
  p_email_ok boolean default false
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.fulfillment_jobs%rowtype;
  v_finish jsonb;
  v_email jsonb;
begin
  select * into v_job from public.fulfillment_jobs where id = p_job_id for update;
  if not found then
    return pg_catalog.jsonb_build_object('kind', 'missing', 'email', pg_catalog.jsonb_build_object('kind', 'skipped'));
  end if;

  v_finish := public.finish_fulfillment_job(p_job_id, p_ok, p_error);

  if not p_ok or v_job.kind = 'result_email' or p_email_ok then
    return pg_catalog.jsonb_build_object(
      'kind', v_finish->>'kind',
      'email', pg_catalog.jsonb_build_object(
        'kind', case
          when not p_ok then 'skipped'
          when v_job.kind = 'result_email' then 'not_applicable'
          else 'already_sent'
        end
      )
    );
  end if;

  v_email := public.enqueue_result_email_job(v_job.order_id, v_job.generation_id);
  return pg_catalog.jsonb_build_object('kind', v_finish->>'kind', 'email', v_email);
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

  if found then
    return pg_catalog.jsonb_build_object('ok', true, 'kind', 'consumed', 'upload', pg_catalog.to_jsonb(v_upload));
  end if;

  select * into v_upload from public.upload_sessions where id = p_upload_id;
  if found
     and v_upload.status = 'consumed'
     and v_upload.consumed_order_id is not distinct from p_order_id then
    return pg_catalog.jsonb_build_object('ok', true, 'kind', 'already_consumed', 'upload', pg_catalog.to_jsonb(v_upload));
  end if;

  return pg_catalog.jsonb_build_object('ok', false, 'kind', 'unavailable');
end;
$$;

create or replace function public.is_generation_admin()
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if to_regclass('public.profiles') is null then
    return false;
  end if;
  return exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  );
end;
$$;

alter table public.generations enable row level security;

drop policy if exists generations_anon_no_access on public.generations;
create policy generations_anon_no_access
  on public.generations
  for all
  to anon
  using (false)
  with check (false);

drop policy if exists generations_select_own_or_admin on public.generations;
create policy generations_select_own_or_admin
  on public.generations
  for select
  to authenticated
  using (user_id = auth.uid() or public.is_generation_admin());

drop policy if exists generations_insert_own on public.generations;
drop policy if exists generations_insert_own_or_admin on public.generations;
create policy generations_insert_own
  on public.generations
  for insert
  to authenticated
  with check (user_id = auth.uid());

revoke all on table public.generations from public, anon;
grant select, insert on table public.generations to authenticated;

revoke all on function public.finish_fulfillment_job(uuid, boolean, text) from public, anon, authenticated;
revoke all on function public.finish_fulfillment_job_and_enqueue_email(uuid, boolean, text, boolean) from public, anon, authenticated;
revoke all on function public.consume_confirmed_upload(uuid, uuid) from public, anon, authenticated;
grant execute on function public.finish_fulfillment_job(uuid, boolean, text) to service_role;
grant execute on function public.finish_fulfillment_job_and_enqueue_email(uuid, boolean, text, boolean) to service_role;
grant execute on function public.consume_confirmed_upload(uuid, uuid) to service_role;
grant execute on function public.is_generation_admin() to anon, authenticated, service_role;
