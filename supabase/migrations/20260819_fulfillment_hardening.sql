-- Atomic fulfillment persist, idempotent refunds, and authoritative generations RLS.
-- Apply after 20260818_review_blockers.sql. Does not install cron.

alter table public.generations add column if not exists result_image_url text;
alter table public.generations add column if not exists final_image_url text;
alter table public.generations add column if not exists preview_image_url text;

create or replace function public.complete_mvp_fulfillment(
  p_generation_id uuid,
  p_order_id uuid,
  p_result_bucket text,
  p_result_path text,
  p_result_mime text,
  p_result_image_url text,
  p_prediction_id text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.mvp_orders%rowtype;
  v_gen public.generations%rowtype;
  v_now timestamptz := pg_catalog.now();
  v_gen_updated integer := 0;
begin
  select * into v_order from public.mvp_orders where id = p_order_id for update;
  if not found then
    return pg_catalog.jsonb_build_object('ok', false, 'kind', 'order_missing');
  end if;

  update public.generations
  set
    status = 'completed',
    result_bucket = p_result_bucket,
    result_path = p_result_path,
    result_mime = p_result_mime,
    result_image_url = p_result_image_url,
    final_image_url = p_result_image_url,
    preview_image_url = p_result_image_url,
    replicate_prediction_id = coalesce(p_prediction_id, replicate_prediction_id),
    completed_at = coalesce(completed_at, v_now),
    error = null,
    updated_at = v_now
  where id = p_generation_id
    and status in ('queued', 'pending', 'processing', 'failed')
  returning * into v_gen;
  get diagnostics v_gen_updated = row_count;

  if v_gen_updated = 0 then
    select * into v_gen from public.generations where id = p_generation_id;
    if not found then
      return pg_catalog.jsonb_build_object('ok', false, 'kind', 'generation_missing');
    end if;
    if v_gen.status is distinct from 'completed' then
      return pg_catalog.jsonb_build_object('ok', false, 'kind', 'generation_not_updated');
    end if;
  end if;

  if v_order.status in ('refunded', 'canceled') then
    return pg_catalog.jsonb_build_object(
      'ok', true,
      'kind', v_order.status,
      'order_status', v_order.status,
      'skip_email', true,
      'completed', false
    );
  end if;

  update public.mvp_orders
  set
    status = 'completed',
    fulfilled_at = coalesce(fulfilled_at, v_now),
    error = null,
    updated_at = v_now
  where id = p_order_id
    and status not in ('refunded', 'canceled')
  returning * into v_order;

  if not found then
    select * into v_order from public.mvp_orders where id = p_order_id;
    return pg_catalog.jsonb_build_object(
      'ok', true,
      'kind', coalesce(v_order.status, 'missing'),
      'order_status', v_order.status,
      'skip_email', true,
      'completed', false
    );
  end if;

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'kind', 'completed',
    'order_status', 'completed',
    'skip_email', false,
    'completed', true
  );
end;
$$;

create or replace function public.claim_mvp_order_refunded(
  p_event_id text,
  p_event_type text,
  p_payment_intent_id text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_rows integer := 0;
  v_order public.mvp_orders%rowtype;
begin
  if coalesce(p_event_id, '') = '' or coalesce(p_payment_intent_id, '') = '' then
    return pg_catalog.jsonb_build_object('ok', false, 'kind', 'invalid');
  end if;

  insert into public.stripe_webhook_events (event_id, event_type, order_id)
  values (p_event_id, p_event_type, null)
  on conflict (event_id) do nothing;
  get diagnostics v_event_rows = row_count;

  update public.mvp_orders
  set status = 'refunded', updated_at = pg_catalog.now()
  where stripe_payment_intent_id = p_payment_intent_id
    and status is distinct from 'refunded'
  returning * into v_order;

  if found then
    update public.stripe_webhook_events
    set order_id = v_order.id
    where event_id = p_event_id;
    if not found then
      raise exception 'refund_event_order_link_failed';
    end if;
    return pg_catalog.jsonb_build_object(
      'ok', true,
      'kind', 'refunded',
      'order_id', v_order.id,
      'updated', true,
      'duplicate_event', v_event_rows = 0
    );
  end if;

  select * into v_order from public.mvp_orders where stripe_payment_intent_id = p_payment_intent_id;
  if found then
    update public.stripe_webhook_events
    set order_id = v_order.id
    where event_id = p_event_id;
    if not found then
      raise exception 'refund_event_order_link_failed';
    end if;
    return pg_catalog.jsonb_build_object(
      'ok', true,
      'kind', 'already_refunded',
      'order_id', v_order.id,
      'updated', false,
      'duplicate_event', v_event_rows = 0
    );
  end if;

  -- Order may still be inserting. Fail so Stripe retries; the next attempt
  -- still updates even if this event_id was already recorded.
  return pg_catalog.jsonb_build_object(
    'ok', false,
    'kind', 'missing_order',
    'updated', false,
    'duplicate_event', v_event_rows = 0
  );
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
  v_order public.mvp_orders%rowtype;
begin
  select * into v_order from public.mvp_orders where id = p_order_id;
  if not found then
    return pg_catalog.jsonb_build_object('ok', false, 'kind', 'order_missing');
  end if;

  if v_order.status in ('refunded', 'canceled') then
    return pg_catalog.jsonb_build_object('ok', true, 'kind', 'skipped_terminal');
  end if;

  if v_order.result_emailed_at is not null then
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

revoke all on function public.complete_mvp_fulfillment(uuid, uuid, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.claim_mvp_order_refunded(text, text, text) from public, anon, authenticated;
revoke all on function public.enqueue_result_email_job(uuid, uuid) from public, anon, authenticated;
grant execute on function public.complete_mvp_fulfillment(uuid, uuid, text, text, text, text, text) to service_role;
grant execute on function public.claim_mvp_order_refunded(text, text, text) to service_role;
grant execute on function public.enqueue_result_email_job(uuid, uuid) to service_role;

-- Authoritative generations RLS: drop every existing policy, then recreate.
do $$
declare
  r record;
begin
  for r in
    select policyname
    from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'generations'
  loop
    execute format('drop policy if exists %I on public.generations', r.policyname);
  end loop;
end
$$;

alter table public.generations enable row level security;

revoke all on table public.generations from public, anon, authenticated;

create policy generations_anon_no_access
  on public.generations
  for all
  to anon
  using (false)
  with check (false);

create policy generations_select_own
  on public.generations
  for select
  to authenticated
  using (user_id = auth.uid());

create policy generations_select_admin
  on public.generations
  for select
  to authenticated
  using (public.is_generation_admin());

create policy generations_insert_own
  on public.generations
  for insert
  to authenticated
  with check (user_id = auth.uid());

grant select, insert on table public.generations to authenticated;
grant execute on function public.is_generation_admin() to anon, authenticated, service_role;

