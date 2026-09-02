-- Point quarantined Christmas V2 RPCs at christmas_v2_* tables.
-- Required after 20260902105000 renamed legacy tables out of the commerce names.

set lock_timeout = '5s';
set statement_timeout = '60s';

create or replace function public.fulfill_christmas_v2_order_payment(
  p_event_id text,
  p_session_id text,
  p_event_type text,
  p_payment_status text,
  p_payment_intent_id text,
  p_amount_cents integer,
  p_currency text,
  p_order_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to public
as $$
declare
  order_row public.christmas_v2_orders%rowtype;
  already boolean := false;
begin
  select * into order_row from public.christmas_v2_orders where id = p_order_id for update;
  if not found then
    raise exception 'christmas v2 order not found';
  end if;

  if order_row.paid_at is not null then
    already := true;
  else
    update public.christmas_v2_orders
    set
      status = 'paid',
      paid_at = now(),
      stripe_checkout_session_id = coalesce(nullif(p_session_id, ''), stripe_checkout_session_id),
      stripe_payment_intent_id = nullif(p_payment_intent_id, ''),
      stripe_payment_status = coalesce(nullif(p_payment_status, ''), 'paid'),
      charged_amount_cents = coalesce(p_amount_cents, amount_cents),
      updated_at = now()
    where id = p_order_id;

    insert into public.christmas_v2_generation_jobs (order_id, status)
    values (p_order_id, 'queued')
    on conflict (order_id) do nothing;
  end if;

  insert into public.processed_stripe_events (event_id, event_type, stripe_session_id, result)
  values (
    p_event_id,
    p_event_type,
    p_session_id,
    jsonb_build_object(
      'status', case when already then 'already_paid' else 'fulfilled' end,
      'christmas_order_id', p_order_id,
      'should_enqueue', true,
      'schema', 'christmas_v2'
    )
  )
  on conflict (event_id) do nothing;

  return jsonb_build_object(
    'status', case when already then 'already_paid' else 'fulfilled' end,
    'should_enqueue', not already,
    'already_paid', already,
    'christmas_order_id', p_order_id,
    'meta_event_id', order_row.meta_event_id
  );
end;
$$;

create or replace function public.claim_christmas_v2_generation_job(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to public
as $$
declare
  job_row public.christmas_v2_generation_jobs%rowtype;
begin
  insert into public.christmas_v2_generation_jobs (order_id, status)
  values (p_order_id, 'queued')
  on conflict (order_id) do nothing;

  select * into job_row
  from public.christmas_v2_generation_jobs
  where order_id = p_order_id
  for update;

  if not found then
    return jsonb_build_object('claimed', false, 'reason', 'missing_job');
  end if;

  if job_row.status = 'running' and job_row.claimed_at is not null
     and job_row.claimed_at > now() - interval '3 minutes' then
    return jsonb_build_object('claimed', false, 'status', 'already_running');
  end if;

  if job_row.status = 'succeeded' then
    return jsonb_build_object('claimed', false, 'status', 'already_succeeded');
  end if;

  update public.christmas_v2_generation_jobs
  set
    status = 'running',
    claimed_at = now(),
    last_error = null,
    updated_at = now()
  where order_id = p_order_id
  returning * into job_row;

  return jsonb_build_object('claimed', true, 'status', job_row.status);
end;
$$;

revoke all on function public.fulfill_christmas_v2_order_payment(text, text, text, text, text, integer, text, uuid)
  from anon, authenticated, public;
grant execute on function public.fulfill_christmas_v2_order_payment(text, text, text, text, text, integer, text, uuid)
  to service_role;

revoke all on function public.claim_christmas_v2_generation_job(uuid)
  from anon, authenticated, public;
grant execute on function public.claim_christmas_v2_generation_job(uuid)
  to service_role;
