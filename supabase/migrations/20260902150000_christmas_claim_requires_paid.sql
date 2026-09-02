-- Harden christmas generation claim: unpaid orders cannot claim a job.
-- Edge christmas-generate already returns 402 when unpaid; this enforces the
-- same invariant at the database RPC boundary (defense in depth).

set lock_timeout = '5s';
set statement_timeout = '60s';

create or replace function public.claim_christmas_generation_job(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  order_row public.christmas_orders%rowtype;
  job_row public.christmas_generation_jobs%rowtype;
begin
  if p_order_id is null then
    return jsonb_build_object('claimed', false, 'reason', 'missing_order_id');
  end if;

  select * into order_row
  from public.christmas_orders
  where id = p_order_id
  for update;

  if not found then
    return jsonb_build_object('claimed', false, 'reason', 'order_not_found');
  end if;

  if order_row.payment_status <> 'paid' then
    return jsonb_build_object(
      'claimed', false,
      'reason', 'payment_required',
      'payment_status', order_row.payment_status
    );
  end if;

  insert into public.christmas_generation_jobs (order_id, status, attempt_number)
  values (p_order_id, 'queued', 0)
  on conflict (order_id) do nothing;

  select * into job_row
  from public.christmas_generation_jobs
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

  update public.christmas_generation_jobs
  set
    status = 'running',
    attempt_number = attempt_number + 1,
    claimed_at = now(),
    last_error = null
  where order_id = p_order_id
  returning * into job_row;

  update public.christmas_orders
  set
    fulfillment_status = 'processing',
    generation_started_at = coalesce(generation_started_at, now())
  where id = p_order_id;

  return jsonb_build_object(
    'claimed', true,
    'status', job_row.status,
    'attempt_number', job_row.attempt_number
  );
end;
$$;

revoke all on function public.claim_christmas_generation_job(uuid) from anon, authenticated, public;
grant execute on function public.claim_christmas_generation_job(uuid) to service_role;
