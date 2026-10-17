-- Christmas V2 EUR offer contract + finalize RPC remap to christmas_v2_* tables.
-- Reversible: constraints widen (legacy USD SKUs remain valid); new columns nullable.
-- Does NOT mutate production when only committed to git — apply via authorized deploy.

set lock_timeout = '5s';
set statement_timeout = '120s';

-- ---------------------------------------------------------------------------
-- 1) Snapshot columns for versioned offers (historical rows keep amount/image/video)
-- ---------------------------------------------------------------------------

alter table if exists public.christmas_v2_orders
  add column if not exists offer_catalog_version text;

alter table if exists public.christmas_v2_orders
  add column if not exists offer_snapshot jsonb;

comment on column public.christmas_v2_orders.offer_catalog_version is
  'Offer catalog version at order creation (e.g. v2_eur_2026_10). Historical USD orders may be null.';
comment on column public.christmas_v2_orders.offer_snapshot is
  'Immutable pack snapshot: sku, amountCents, currency, imageCount, videoCount.';

-- ---------------------------------------------------------------------------
-- 2) Widen currency + SKU checks (keep legacy USD SKUs for already-paid orders)
-- ---------------------------------------------------------------------------

do $$
declare
  cons record;
begin
  if to_regclass('public.christmas_v2_orders') is null then
    raise notice 'christmas_v2_orders missing · skip constraint rewrite';
    return;
  end if;

  for cons in
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'christmas_v2_orders'
      and c.contype = 'c'
      and (
        c.conname in (
          'christmas_orders_currency_chk',
          'christmas_v2_orders_currency_chk',
          'christmas_orders_sku_chk',
          'christmas_v2_orders_sku_chk'
        )
        or pg_get_constraintdef(c.oid) ilike '%currency%'
        or pg_get_constraintdef(c.oid) ilike '%sku%'
      )
  loop
    execute format('alter table public.christmas_v2_orders drop constraint if exists %I', cons.conname);
  end loop;

  alter table public.christmas_v2_orders
    add constraint christmas_v2_orders_currency_chk
    check (currency in ('usd', 'eur'));

  alter table public.christmas_v2_orders
    add constraint christmas_v2_orders_sku_chk
    check (
      sku in (
        -- Active EUR catalog
        'christmas-starter-eur7',
        'christmas-magic-eur17',
        'christmas-ultimate-eur27',
        -- Legacy USD catalog (historical / in-flight)
        'christmas-starter-3',
        'christmas-magic-8',
        'christmas-ultimate-12'
      )
    );
end $$;

-- ---------------------------------------------------------------------------
-- 3) Finalize RPC remapped onto christmas_v2_* (fixes quarantine body drift)
--    Also recreate legacy alias name used by edge workers.
-- ---------------------------------------------------------------------------

create or replace function public.christmas_v2_finalize_generation_if_done(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to public
as $$
declare
  total int;
  succeeded int;
  failed int;
  video_total int;
  video_succeeded int;
  video_failed int;
  video_entitled int;
  final_status text;
begin
  select count(*) into total from public.christmas_v2_order_scenes where order_id = p_order_id;
  select count(*) into succeeded from public.christmas_v2_order_scenes
    where order_id = p_order_id and status in ('succeeded', 'ready');
  select count(*) into failed from public.christmas_v2_order_scenes
    where order_id = p_order_id and status = 'failed';

  if total = 0 then
    return jsonb_build_object('done', false);
  end if;

  if succeeded + failed < total then
    return jsonb_build_object('done', false, 'succeeded', succeeded, 'failed', failed, 'total', total);
  end if;

  select coalesce(video_count, 0) into video_entitled
  from public.christmas_v2_orders where id = p_order_id;

  select count(*) into video_total from public.christmas_v2_order_videos where order_id = p_order_id;
  select count(*) into video_succeeded from public.christmas_v2_order_videos
    where order_id = p_order_id and status in ('succeeded', 'ready');
  select count(*) into video_failed from public.christmas_v2_order_videos
    where order_id = p_order_id and status = 'failed';

  -- Paid videos outstanding: keep order generating; do not mark complete/email-ready.
  if video_entitled > 0 and (video_total < video_entitled or video_succeeded + video_failed < video_total) then
    update public.christmas_v2_orders
    set status = 'generating', updated_at = now()
    where id = p_order_id
      and status is distinct from 'generating';

    return jsonb_build_object(
      'done', false,
      'scenes_done', true,
      'awaiting_videos', true,
      'succeeded', succeeded,
      'failed', failed,
      'total', total,
      'video_succeeded', video_succeeded,
      'video_failed', video_failed,
      'video_total', video_total,
      'video_entitled', video_entitled
    );
  end if;

  final_status := case
    when failed > 0 and succeeded = 0 then 'failed'
    when failed > 0 or video_failed > 0 then 'partial_failure'
    else 'complete'
  end;

  update public.christmas_v2_orders
  set
    status = final_status,
    generation_finished_at = now(),
    completed_at = case when failed = 0 and video_failed = 0 then now() else completed_at end,
    updated_at = now()
  where id = p_order_id;

  update public.christmas_v2_generation_jobs
  set status = 'completed', finished_at = now(), updated_at = now()
  where order_id = p_order_id;

  return jsonb_build_object(
    'done', true,
    'succeeded', succeeded,
    'failed', failed,
    'total', total,
    'video_succeeded', video_succeeded,
    'video_failed', video_failed,
    'video_total', video_total
  );
end;
$$;

-- Legacy alias kept for workers that still call the pre-quarantine name.
create or replace function public.christmas_finalize_generation_if_done(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to public
as $$
begin
  return public.christmas_v2_finalize_generation_if_done(p_order_id);
end;
$$;

revoke all on function public.christmas_v2_finalize_generation_if_done(uuid)
  from anon, authenticated, public;
grant execute on function public.christmas_v2_finalize_generation_if_done(uuid)
  to service_role;

revoke all on function public.christmas_finalize_generation_if_done(uuid)
  from anon, authenticated, public;
grant execute on function public.christmas_finalize_generation_if_done(uuid)
  to service_role;

-- ---------------------------------------------------------------------------
-- 4) Fulfillment: reject Stripe amount/currency mismatch vs order snapshot
--    Already-paid orders remain idempotent (no double enqueue).
-- ---------------------------------------------------------------------------

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
  stripe_currency text := lower(coalesce(nullif(trim(p_currency), ''), ''));
  order_currency text;
begin
  select * into order_row from public.christmas_v2_orders where id = p_order_id for update;
  if not found then
    raise exception 'christmas v2 order not found';
  end if;

  order_currency := lower(coalesce(order_row.currency, ''));

  if order_row.paid_at is not null then
    already := true;
  else
    if p_amount_cents is null or p_amount_cents <> order_row.amount_cents then
      raise exception 'christmas v2 amount mismatch: stripe=% order=%', p_amount_cents, order_row.amount_cents
        using errcode = 'check_violation';
    end if;
    if stripe_currency = '' or order_currency = '' or stripe_currency <> order_currency then
      raise exception 'christmas v2 currency mismatch: stripe=% order=%', stripe_currency, order_currency
        using errcode = 'check_violation';
    end if;

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
      'should_enqueue', not already,
      'schema', 'christmas_v2',
      'amount_cents', p_amount_cents,
      'currency', stripe_currency
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

revoke all on function public.fulfill_christmas_v2_order_payment(text, text, text, text, text, integer, text, uuid)
  from anon, authenticated, public;
grant execute on function public.fulfill_christmas_v2_order_payment(text, text, text, text, text, integer, text, uuid)
  to service_role;

-- ---------------------------------------------------------------------------
-- 5) Claim: treat finalize's `completed` as terminal (prevents re-paid jobs)
--    Also allow stale `running` reclaim after 3 minutes (unchanged).
-- ---------------------------------------------------------------------------

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

  if job_row.status in ('completed', 'succeeded') then
    return jsonb_build_object('claimed', false, 'status', 'already_completed');
  end if;

  if job_row.status = 'held' then
    return jsonb_build_object('claimed', false, 'status', 'held');
  end if;

  if job_row.status = 'running' and job_row.claimed_at is not null
     and job_row.claimed_at > now() - interval '3 minutes' then
    return jsonb_build_object('claimed', false, 'status', 'already_running');
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

revoke all on function public.claim_christmas_v2_generation_job(uuid)
  from anon, authenticated, public;
grant execute on function public.claim_christmas_v2_generation_job(uuid)
  to service_role;
