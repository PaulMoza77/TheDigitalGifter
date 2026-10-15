-- Christmas commerce portrait refunds (full + partial).
-- Additive. Does not alter pet tables. Does not delete assets.

begin;

alter table public.christmas_orders
  add column if not exists refunded_amount_cents integer not null default 0,
  add column if not exists last_refund_id text,
  add column if not exists last_refund_at timestamptz;

alter table public.christmas_orders
  drop constraint if exists christmas_orders_refunded_amount_chk;
alter table public.christmas_orders
  add constraint christmas_orders_refunded_amount_chk
  check (refunded_amount_cents >= 0);

alter table public.christmas_orders
  drop constraint if exists christmas_orders_payment_chk;
alter table public.christmas_orders
  add constraint christmas_orders_payment_chk check (
    payment_status = any (
      array[
        'draft'::text,
        'pending'::text,
        'paid'::text,
        'failed'::text,
        'partially_refunded'::text,
        'refunded'::text
      ]
    )
  );

alter table public.christmas_email_deliveries
  drop constraint if exists christmas_email_deliveries_kind_chk;
alter table public.christmas_email_deliveries
  add constraint christmas_email_deliveries_kind_chk check (
    kind in (
      'starter_ready',
      'magic_ready',
      'ultimate_ready',
      'partial_failure',
      'planner_ready',
      'portrait_ready',
      'portrait_refunded'
    )
  );

create or replace function public.refund_christmas_commerce_order(
  p_order_id uuid,
  p_refund_amount_cents integer,
  p_charge_amount_cents integer default null,
  p_stripe_refund_id text default null,
  p_stripe_event_id text default null,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ord public.christmas_orders%rowtype;
  next_refunded integer;
  charge_total integer;
  new_status text;
  applied_ids jsonb;
  is_cumulative boolean := false;
begin
  if p_order_id is null then
    return jsonb_build_object('ok', false, 'code', 'missing_order_id');
  end if;
  if p_refund_amount_cents is null or p_refund_amount_cents < 0 then
    return jsonb_build_object('ok', false, 'code', 'invalid_refund_amount');
  end if;

  select * into ord
  from public.christmas_orders
  where id = p_order_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'order_not_found');
  end if;

  if ord.product_key not in (
    'christmas_photo',
    'christmas_family',
    'christmas_kids',
    'christmas_couple',
    'christmas_pet',
    'christmas_santa_video'
  ) then
    return jsonb_build_object('ok', false, 'code', 'not_commerce_refundable', 'product_key', ord.product_key);
  end if;

  if ord.payment_status not in ('paid', 'partially_refunded', 'refunded') then
    return jsonb_build_object(
      'ok', false,
      'code', 'not_refundable_state',
      'payment_status', ord.payment_status
    );
  end if;

  applied_ids := coalesce(ord.metadata->'applied_refund_ids', '[]'::jsonb);
  if p_stripe_refund_id is not null
     and applied_ids @> jsonb_build_array(p_stripe_refund_id) then
    return jsonb_build_object(
      'ok', true,
      'status', 'already_applied',
      'payment_status', ord.payment_status,
      'refunded_amount_cents', ord.refunded_amount_cents,
      'order_id', ord.id
    );
  end if;

  is_cumulative := coalesce(p_reason, '') = 'charge_refunded_cumulative';
  -- charge.refunded reports cumulative amount_refunded (absolute).
  -- refund.created reports a per-refund delta (additive, keyed by refund id).
  if is_cumulative then
    next_refunded := p_refund_amount_cents;
  else
    next_refunded := coalesce(ord.refunded_amount_cents, 0) + p_refund_amount_cents;
  end if;

  charge_total := coalesce(
    nullif(p_charge_amount_cents, 0),
    nullif(ord.charged_amount_cents, 0),
    nullif(ord.amount_cents, 0),
    0
  );

  if charge_total > 0 and next_refunded > charge_total then
    next_refunded := charge_total;
  end if;

  -- Avoid regressing a higher cumulative already recorded.
  if next_refunded < coalesce(ord.refunded_amount_cents, 0) then
    next_refunded := coalesce(ord.refunded_amount_cents, 0);
  end if;

  if charge_total > 0 and next_refunded >= charge_total then
    new_status := 'refunded';
  elsif next_refunded > 0 then
    new_status := 'partially_refunded';
  else
    new_status := ord.payment_status;
  end if;

  if p_stripe_refund_id is not null and not is_cumulative then
    applied_ids := applied_ids || jsonb_build_array(p_stripe_refund_id);
  end if;

  update public.christmas_orders
  set
    payment_status = new_status,
    refunded_amount_cents = next_refunded,
    refunded_at = case
      when new_status = 'refunded' then coalesce(refunded_at, now())
      else refunded_at
    end,
    last_refund_id = coalesce(p_stripe_refund_id, last_refund_id),
    last_refund_at = now(),
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'applied_refund_ids', applied_ids,
      'last_refund', jsonb_build_object(
        'amount_cents', p_refund_amount_cents,
        'cumulative_cents', next_refunded,
        'stripe_refund_id', p_stripe_refund_id,
        'stripe_event_id', p_stripe_event_id,
        'reason', p_reason,
        'at', now()
      )
    ),
    updated_at = now()
  where id = p_order_id;

  -- Full refund: cancel unfinished generation jobs (assets retained for audit).
  if new_status = 'refunded' then
    update public.christmas_generation_jobs
    set
      status = case
        when status in ('queued', 'running', 'held') then 'failed'
        else status
      end,
      last_error = case
        when status in ('queued', 'running', 'held') then 'order_refunded'
        else last_error
      end,
      updated_at = now()
    where order_id = p_order_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'status', new_status,
    'payment_status', new_status,
    'refunded_amount_cents', next_refunded,
    'charge_amount_cents', charge_total,
    'order_id', p_order_id,
    'product_key', ord.product_key,
    'download_revoked', new_status = 'refunded'
  );
end;
$$;

revoke all on function public.refund_christmas_commerce_order(uuid, integer, integer, text, text, text)
  from public, anon, authenticated;
grant execute on function public.refund_christmas_commerce_order(uuid, integer, integer, text, text, text)
  to service_role;

-- Partial refunds still authorize generation; full refunds do not.
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

  if order_row.payment_status not in ('paid', 'partially_refunded') then
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

commit;
