-- Idempotent redeem codes and result-email retry jobs.
-- Apply after 20260815_scheduler_recovery.sql. Does not install cron.

alter table public.mvp_orders add column if not exists result_emailed_at timestamptz;

drop function if exists public.consume_access_redeem_code(text);

create or replace function public.consume_access_redeem_code(
  p_code_hash text,
  p_order_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.access_redeem_codes%rowtype;
begin
  select * into v_row
  from public.access_redeem_codes
  where code_hash = p_code_hash
  for update;

  if not found then
    return pg_catalog.jsonb_build_object('ok', false, 'kind', 'invalid');
  end if;

  if v_row.order_id is distinct from p_order_id then
    return pg_catalog.jsonb_build_object('ok', false, 'kind', 'mismatch');
  end if;

  if v_row.expires_at <= pg_catalog.now() then
    return pg_catalog.jsonb_build_object('ok', false, 'kind', 'expired');
  end if;

  if v_row.used_at is null then
    update public.access_redeem_codes
    set used_at = pg_catalog.now()
    where code_hash = p_code_hash
    returning * into v_row;
  end if;

  return pg_catalog.jsonb_build_object('ok', true, 'kind', 'ok', 'order_id', v_row.order_id);
end;
$$;

create or replace function public.enqueue_result_email_job(
  p_order_id uuid,
  p_generation_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job_id uuid;
begin
  if exists (
    select 1 from public.mvp_orders
    where id = p_order_id and result_emailed_at is not null
  ) then
    return pg_catalog.jsonb_build_object('ok', true, 'kind', 'already_emailed');
  end if;

  if exists (
    select 1 from public.fulfillment_jobs
    where order_id = p_order_id
      and kind = 'result_email'
      and status in ('queued', 'running')
  ) then
    return pg_catalog.jsonb_build_object('ok', true, 'kind', 'in_flight');
  end if;

  insert into public.fulfillment_jobs (
    order_id, generation_id, kind, status, max_attempts
  ) values (
    p_order_id, p_generation_id, 'result_email', 'queued', 8
  )
  returning id into v_job_id;

  return pg_catalog.jsonb_build_object('ok', true, 'kind', 'queued', 'job_id', v_job_id);
exception
  when unique_violation then
    return pg_catalog.jsonb_build_object('ok', true, 'kind', 'in_flight');
end;
$$;

revoke all on function public.consume_access_redeem_code(text, uuid) from public, anon, authenticated;
revoke all on function public.enqueue_result_email_job(uuid, uuid) from public, anon, authenticated;
grant execute on function public.consume_access_redeem_code(text, uuid) to service_role;
grant execute on function public.enqueue_result_email_job(uuid, uuid) to service_role;
