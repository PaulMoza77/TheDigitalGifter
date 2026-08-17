-- Pet portrait upsells: Gift Pack, Holiday Card, Print Pack, 3-scene retry

create table if not exists public.pet_order_upsells (
  id uuid primary key default gen_random_uuid(),
  pet_order_id uuid not null references public.pet_orders(id) on delete cascade,
  upsell_key text not null,
  scene_key text,
  amount_cents integer not null,
  currency text not null default 'usd',
  status text not null default 'pending',
  fulfillment_status text,
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  fulfilled_at timestamptz,
  constraint pet_order_upsells_status_check check (
    status in ('pending', 'paid', 'fulfilled', 'failed', 'canceled')
  )
);

create index if not exists pet_order_upsells_order_idx
  on public.pet_order_upsells (pet_order_id, created_at desc);

create unique index if not exists pet_order_upsells_session_uidx
  on public.pet_order_upsells (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

create unique index if not exists pet_order_upsells_scene_paid_uidx
  on public.pet_order_upsells (pet_order_id, upsell_key, scene_key)
  where status in ('paid', 'fulfilled')
    and scene_key is not null
    and upsell_key <> 'retry_3_scenes';

create unique index if not exists pet_order_upsells_retry_paid_uidx
  on public.pet_order_upsells (pet_order_id)
  where status in ('paid', 'fulfilled')
    and upsell_key = 'retry_3_scenes';

alter table public.pet_order_upsells enable row level security;

create or replace function public.fulfill_pet_upsell_payment(
  p_event_id text,
  p_session_id text,
  p_event_type text,
  p_payment_status text,
  p_payment_intent_id text,
  p_amount_cents integer,
  p_currency text,
  p_upsell_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  existing public.processed_stripe_events%rowtype;
  upsell_row public.pet_order_upsells%rowtype;
  order_row public.pet_orders%rowtype;
  inserted_event boolean := false;
  scene_keys text[];
  scene_key text;
begin
  if p_event_id is null or length(trim(p_event_id)) = 0 then
    raise exception 'event_id required';
  end if;
  if p_upsell_id is null then
    raise exception 'upsell id required';
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
    jsonb_build_object('status', 'pet_upsell_pending')
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

  select * into upsell_row
  from public.pet_order_upsells
  where id = p_upsell_id
  for update;

  if not found then
    update public.processed_stripe_events
    set result = jsonb_build_object('status', 'upsell_not_found')
    where event_id = trim(p_event_id);
    raise exception 'pet upsell not found';
  end if;

  if upsell_row.status in ('paid', 'fulfilled') then
    update public.processed_stripe_events
    set result = jsonb_build_object('status', 'already_paid', 'upsell_id', upsell_row.id)
    where event_id = trim(p_event_id);
    return jsonb_build_object(
      'status', 'already_paid',
      'upsell_id', upsell_row.id,
      'upsell_key', upsell_row.upsell_key,
      'should_enqueue', false
    );
  end if;

  if coalesce(p_amount_cents, 0) <> upsell_row.amount_cents
    or lower(coalesce(p_currency, '')) <> lower(upsell_row.currency) then
    update public.processed_stripe_events
    set result = jsonb_build_object(
      'status', 'amount_mismatch',
      'amount_cents', p_amount_cents,
      'expected_amount_cents', upsell_row.amount_cents
    )
    where event_id = trim(p_event_id);
    raise exception 'pet upsell payment amount mismatch';
  end if;

  select * into order_row
  from public.pet_orders
  where id = upsell_row.pet_order_id
  for update;

  if not found then
    raise exception 'pet order not found';
  end if;

  update public.pet_order_upsells
  set
    status = 'paid',
    stripe_checkout_session_id = coalesce(nullif(trim(p_session_id), ''), stripe_checkout_session_id),
    stripe_payment_intent_id = coalesce(nullif(trim(p_payment_intent_id), ''), stripe_payment_intent_id),
    paid_at = now(),
    fulfillment_status = case
      when upsell_row.upsell_key = 'retry_3_scenes' then 'queued'
      else 'ready'
    end
  where id = upsell_row.id
  returning * into upsell_row;

  if upsell_row.upsell_key = 'retry_3_scenes' then
    select coalesce(array_agg(value), array[]::text[])
    into scene_keys
    from jsonb_array_elements_text(coalesce(upsell_row.metadata->'scene_keys', '[]'::jsonb)) as value;

    if coalesce(array_length(scene_keys, 1), 0) = 0 then
      raise exception 'retry scene keys missing';
    end if;

    foreach scene_key in array scene_keys loop
      update public.pet_order_scenes
      set
        status = 'queued',
        last_error = null,
        replicate_prediction_id = null,
        result_path = null,
        result_bucket = null,
        progress_percent = 0,
        completed_at = null
      where order_id = upsell_row.pet_order_id
        and scene_key = scene_key;
    end loop;

    update public.pet_orders
    set
      status = case when status = 'complete' then 'generating' else status end,
      completed_at = null,
      last_error = null
    where id = upsell_row.pet_order_id;

    insert into public.pet_generation_jobs (order_id, status)
    values (upsell_row.pet_order_id, 'queued')
    on conflict (order_id) do update
    set status = 'queued', last_error = null, claimed_at = null, finished_at = null;

    update public.pet_order_upsells
    set
      status = 'fulfilled',
      fulfillment_status = 'regeneration_queued',
      fulfilled_at = now()
    where id = upsell_row.id;

    perform public.pet_log_event(
      p_order_id := upsell_row.pet_order_id,
      p_action := 'upsell_retry_3_scenes',
      p_actor_type := 'system',
      p_payload := jsonb_build_object('upsell_id', upsell_row.id, 'scene_keys', to_jsonb(scene_keys))
    );
  else
    update public.pet_order_upsells
    set
      status = 'fulfilled',
      fulfillment_status = 'export_unlocked',
      fulfilled_at = now()
    where id = upsell_row.id;

    perform public.pet_log_event(
      p_order_id := upsell_row.pet_order_id,
      p_action := 'upsell_' || upsell_row.upsell_key,
      p_actor_type := 'system',
      p_scene_key := upsell_row.scene_key,
      p_payload := jsonb_build_object(
        'upsell_id', upsell_row.id,
        'scene_key', upsell_row.scene_key
      )
    );
  end if;

  update public.processed_stripe_events
  set result = jsonb_build_object(
    'status', 'fulfilled',
    'upsell_id', upsell_row.id,
    'upsell_key', upsell_row.upsell_key,
    'pet_order_id', upsell_row.pet_order_id
  )
  where event_id = trim(p_event_id);

  return jsonb_build_object(
    'status', 'fulfilled',
    'upsell_id', upsell_row.id,
    'upsell_key', upsell_row.upsell_key,
    'pet_order_id', upsell_row.pet_order_id,
    'should_enqueue', upsell_row.upsell_key = 'retry_3_scenes'
  );
end;
$$;

revoke all on function public.fulfill_pet_upsell_payment(text, text, text, text, text, integer, text, uuid) from anon, authenticated, public;
grant execute on function public.fulfill_pet_upsell_payment(text, text, text, text, text, integer, text, uuid) to service_role;

revoke all on table public.pet_order_upsells from anon, authenticated, public;
grant select, insert, update on table public.pet_order_upsells to service_role;
