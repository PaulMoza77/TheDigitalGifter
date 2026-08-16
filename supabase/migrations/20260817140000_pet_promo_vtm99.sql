-- Additive 100% promo code VTM99 for pet checkout and affiliate lookup.
-- Does not enable image or video generation.

begin;

insert into public.affiliate_codes (code, discount_percent, commission_percent, active)
select 'VTM99', 100, 0, true
where not exists (
  select 1 from public.affiliate_codes where upper(trim(code)) = 'VTM99'
);

update public.affiliate_codes
set discount_percent = 100, active = true, max_uses = null
where upper(trim(code)) = 'VTM99';

alter table public.pet_orders
  add column if not exists promo_code text,
  add column if not exists discount_percent integer not null default 0,
  add column if not exists charged_amount_cents integer;

update public.pet_orders
set charged_amount_cents = amount_cents
where charged_amount_cents is null;

alter table public.pet_orders
  drop constraint if exists pet_orders_discount_chk;

alter table public.pet_orders
  add constraint pet_orders_discount_chk check (
    discount_percent >= 0 and discount_percent <= 100
  );

alter table public.pet_orders
  drop constraint if exists pet_orders_charged_chk;

alter table public.pet_orders
  add constraint pet_orders_charged_chk check (
    charged_amount_cents is null or charged_amount_cents >= 0
  );

create or replace function public.fulfill_pet_order_payment(
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
set search_path = public
as $$
declare
  existing public.processed_stripe_events%rowtype;
  order_row public.pet_orders%rowtype;
  job_row public.pet_generation_jobs%rowtype;
  inserted_event boolean := false;
  already_paid boolean := false;
  should_enqueue boolean := false;
  expected_charge integer;
begin
  if p_event_id is null or length(trim(p_event_id)) = 0 then
    raise exception 'event_id required';
  end if;
  if p_order_id is null then
    raise exception 'pet order id required';
  end if;

  select * into existing
  from public.processed_stripe_events
  where event_id = trim(p_event_id);

  if found then
    return jsonb_build_object(
      'status', 'already_processed',
      'event_id', existing.event_id,
      'result', existing.result
    );
  end if;

  insert into public.processed_stripe_events (event_id, event_type, stripe_session_id, result)
  values (
    trim(p_event_id),
    nullif(trim(coalesce(p_event_type, '')), ''),
    nullif(trim(coalesce(p_session_id, '')), ''),
    jsonb_build_object('status', 'pet_pending')
  )
  on conflict (event_id) do nothing;

  get diagnostics inserted_event = row_count;
  if not inserted_event then
    select * into existing from public.processed_stripe_events where event_id = trim(p_event_id);
    return jsonb_build_object(
      'status', 'already_processed',
      'event_id', existing.event_id,
      'result', existing.result
    );
  end if;

  select * into order_row
  from public.pet_orders
  where id = p_order_id
  for update;

  if not found then
    update public.processed_stripe_events
    set result = jsonb_build_object('status', 'order_not_found')
    where event_id = trim(p_event_id);
    raise exception 'pet order not found';
  end if;

  if order_row.sku <> 'pet-secret-life-12' then
    raise exception 'invalid pet sku';
  end if;

  expected_charge := coalesce(order_row.charged_amount_cents, order_row.amount_cents);
  if coalesce(p_amount_cents, 0) <> expected_charge
    or lower(coalesce(p_currency, '')) <> lower(order_row.currency) then
    update public.processed_stripe_events
    set result = jsonb_build_object(
      'status', 'amount_mismatch',
      'amount_cents', p_amount_cents,
      'currency', p_currency,
      'expected_amount_cents', expected_charge
    )
    where event_id = trim(p_event_id);
    raise exception 'pet payment amount mismatch';
  end if;

  if p_session_id is not null and length(trim(p_session_id)) > 0 then
    insert into public.pet_checkout_sessions (order_id, stripe_session_id)
    values (order_row.id, trim(p_session_id))
    on conflict (stripe_session_id) do nothing;
  end if;

  already_paid := order_row.status in (
    'paid', 'generating', 'awaiting_qc', 'selecting_video_scenes',
    'generating_videos', 'awaiting_video_qc', 'complete', 'partial_failure', 'refunded'
  ) or order_row.paid_at is not null;

  if not already_paid then
    update public.pet_orders
    set
      status = 'paid',
      stripe_checkout_session_id = coalesce(stripe_checkout_session_id, nullif(trim(p_session_id), '')),
      stripe_payment_intent_id = coalesce(nullif(trim(p_payment_intent_id), ''), stripe_payment_intent_id),
      stripe_payment_status = coalesce(nullif(trim(p_payment_status), ''), stripe_payment_status),
      paid_at = now(),
      last_error = null
    where id = order_row.id
    returning * into order_row;

    perform public.pet_seed_scenes(order_row.id);

    insert into public.pet_generation_jobs (order_id, status)
    values (order_row.id, 'queued')
    on conflict (order_id) do nothing;

    perform public.pet_log_event(
      order_row.id,
      'payment_fulfilled',
      'stripe',
      null,
      null,
      jsonb_build_object(
        'event_type', p_event_type,
        'session_id', p_session_id,
        'amount_cents', order_row.amount_cents,
        'charged_amount_cents', expected_charge,
        'promo_code', order_row.promo_code,
        'currency', order_row.currency,
        'mode', 'payment'
      )
    );
  end if;

  select * into job_row
  from public.pet_generation_jobs
  where order_id = order_row.id;

  should_enqueue := job_row.id is not null and job_row.status in ('queued', 'held');

  update public.processed_stripe_events
  set result = jsonb_build_object(
    'status', case when already_paid then 'already_paid' else 'fulfilled' end,
    'pet_order_id', order_row.id,
    'should_enqueue', should_enqueue,
    'meta_event_id', order_row.meta_event_id,
    'charged_amount_cents', expected_charge
  )
  where event_id = trim(p_event_id);

  return jsonb_build_object(
    'status', case when already_paid then 'already_paid' else 'fulfilled' end,
    'pet_order_id', order_row.id,
    'should_enqueue', should_enqueue,
    'already_paid', already_paid,
    'meta_event_id', order_row.meta_event_id,
    'public_token_hash', order_row.public_token_hash,
    'charged_amount_cents', expected_charge
  );
exception
  when unique_violation then
    select * into existing from public.processed_stripe_events where event_id = trim(p_event_id);
    if found then
      return jsonb_build_object('status', 'already_processed', 'event_id', existing.event_id, 'result', existing.result);
    end if;
    raise;
end;
$$;

commit;
