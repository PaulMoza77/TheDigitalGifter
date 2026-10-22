-- Christmas V2 Meta Purchase delivery ledger + AI cost ledger extensions.
-- Additive / reversible: new columns nullable; new tables; no rewrite of historical migrations.
-- Do NOT apply to production from this agent — staging/operator only.

set lock_timeout = '5s';
set statement_timeout = '120s';

-- ---------------------------------------------------------------------------
-- 1) Order columns for Purchase dedupe + click ids (server-side only)
-- ---------------------------------------------------------------------------

alter table if exists public.christmas_v2_orders
  add column if not exists meta_purchase_sent_at timestamptz;

alter table if exists public.christmas_v2_orders
  add column if not exists meta_fbc text;

alter table if exists public.christmas_v2_orders
  add column if not exists meta_fbp text;

comment on column public.christmas_v2_orders.meta_purchase_sent_at is
  'Set after successful Meta CAPI Purchase. Idempotency gate; never clear on webhook replay.';
comment on column public.christmas_v2_orders.meta_fbc is
  'Sanitized Meta _fbc click id for CAPI matching. Never log.';
comment on column public.christmas_v2_orders.meta_fbp is
  'Sanitized Meta _fbp browser id for CAPI matching. Never log.';

-- ---------------------------------------------------------------------------
-- 2) Meta delivery observability (pending/sent/failed/deduplicated)
-- ---------------------------------------------------------------------------

create table if not exists public.christmas_v2_meta_deliveries (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.christmas_v2_orders (id) on delete cascade,
  kind text not null,
  event_id text not null,
  status text not null default 'pending',
  attempt_count integer not null default 0,
  last_error text,
  http_status integer,
  events_received integer,
  amount_cents integer,
  currency text,
  sku text,
  sent_at timestamptz,
  next_retry_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint christmas_v2_meta_deliveries_kind_chk check (kind in ('purchase')),
  constraint christmas_v2_meta_deliveries_status_chk check (
    status in (
      'pending',
      'sending',
      'sent',
      'deduplicated',
      'skipped',
      'failed',
      'permanently_failed'
    )
  ),
  constraint christmas_v2_meta_deliveries_attempts_chk check (attempt_count >= 0)
);

create unique index if not exists christmas_v2_meta_deliveries_order_kind_uidx
  on public.christmas_v2_meta_deliveries (order_id, kind);

create unique index if not exists christmas_v2_meta_deliveries_event_id_uidx
  on public.christmas_v2_meta_deliveries (event_id);

create index if not exists christmas_v2_meta_deliveries_retry_idx
  on public.christmas_v2_meta_deliveries (status, next_retry_at)
  where status in ('pending', 'failed');

alter table public.christmas_v2_meta_deliveries enable row level security;

revoke all on table public.christmas_v2_meta_deliveries from anon, authenticated, public;
grant select on table public.christmas_v2_meta_deliveries to authenticated;
grant all on table public.christmas_v2_meta_deliveries to service_role;

-- Admin read when is_admin() exists; otherwise deny authenticated (service_role bypasses RLS).
do $$
begin
  drop policy if exists christmas_v2_meta_deliveries_admin_read on public.christmas_v2_meta_deliveries;
  if to_regprocedure('public.is_admin()') is not null then
    execute $p$
      create policy christmas_v2_meta_deliveries_admin_read
        on public.christmas_v2_meta_deliveries
        for select
        to authenticated
        using (public.is_admin())
    $p$;
  else
    execute $p$
      create policy christmas_v2_meta_deliveries_admin_read
        on public.christmas_v2_meta_deliveries
        for select
        to authenticated
        using (false)
    $p$;
  end if;
end
$$;

-- Claim / finalize Meta Purchase delivery (exactly-once logical send)
create or replace function public.christmas_v2_claim_meta_purchase_delivery(
  p_order_id uuid,
  p_event_id text,
  p_amount_cents integer,
  p_currency text,
  p_sku text
)
returns jsonb
language plpgsql
security definer
set search_path to public
as $$
declare
  order_row public.christmas_v2_orders%rowtype;
  delivery public.christmas_v2_meta_deliveries%rowtype;
  max_attempts constant integer := 5;
begin
  if p_order_id is null or nullif(trim(p_event_id), '') is null then
    return jsonb_build_object('claim', false, 'reason', 'invalid');
  end if;

  select * into order_row from public.christmas_v2_orders where id = p_order_id for update;
  if not found then
    return jsonb_build_object('claim', false, 'reason', 'order_not_found');
  end if;

  if order_row.paid_at is null then
    return jsonb_build_object('claim', false, 'reason', 'not_paid');
  end if;

  if order_row.meta_purchase_sent_at is not null then
    insert into public.christmas_v2_meta_deliveries (
      order_id, kind, event_id, status, amount_cents, currency, sku, sent_at, attempt_count
    ) values (
      p_order_id, 'purchase', p_event_id, 'deduplicated',
      p_amount_cents, lower(coalesce(p_currency, order_row.currency)), p_sku,
      order_row.meta_purchase_sent_at, 0
    )
    on conflict (order_id, kind) do update
      set status = case
        when christmas_v2_meta_deliveries.status = 'sent' then 'sent'
        else 'deduplicated'
      end,
      updated_at = now();
    return jsonb_build_object('claim', false, 'reason', 'already_sent');
  end if;

  insert into public.christmas_v2_meta_deliveries (
    order_id, kind, event_id, status, amount_cents, currency, sku, attempt_count
  ) values (
    p_order_id, 'purchase', p_event_id, 'pending',
    p_amount_cents, lower(coalesce(p_currency, order_row.currency)), p_sku, 0
  )
  on conflict (order_id, kind) do nothing;

  select * into delivery
  from public.christmas_v2_meta_deliveries
  where order_id = p_order_id and kind = 'purchase'
  for update;

  if delivery.status in ('sent', 'deduplicated') then
    return jsonb_build_object('claim', false, 'reason', delivery.status);
  end if;

  if delivery.status = 'permanently_failed' then
    return jsonb_build_object('claim', false, 'reason', 'permanently_failed');
  end if;

  if delivery.status = 'sending'
     and delivery.updated_at > now() - interval '2 minutes' then
    return jsonb_build_object('claim', false, 'reason', 'in_flight');
  end if;

  if delivery.attempt_count >= max_attempts then
    update public.christmas_v2_meta_deliveries
    set status = 'permanently_failed', updated_at = now()
    where id = delivery.id;
    return jsonb_build_object('claim', false, 'reason', 'permanently_failed');
  end if;

  update public.christmas_v2_meta_deliveries
  set
    status = 'sending',
    attempt_count = attempt_count + 1,
    event_id = p_event_id,
    amount_cents = coalesce(p_amount_cents, amount_cents),
    currency = lower(coalesce(nullif(trim(p_currency), ''), currency, order_row.currency)),
    sku = coalesce(nullif(trim(p_sku), ''), sku),
    updated_at = now()
  where id = delivery.id
  returning * into delivery;

  return jsonb_build_object(
    'claim', true,
    'delivery_id', delivery.id,
    'attempt_count', delivery.attempt_count,
    'event_id', delivery.event_id,
    'amount_cents', delivery.amount_cents,
    'currency', delivery.currency,
    'sku', delivery.sku,
    'fbc', order_row.meta_fbc,
    'fbp', order_row.meta_fbp,
    -- email intentionally omitted from claim payload · emit path hashes from order row
    'paid_at', order_row.paid_at
  );
end;
$$;

create or replace function public.christmas_v2_finalize_meta_purchase_delivery(
  p_order_id uuid,
  p_status text,
  p_http_status integer default null,
  p_events_received integer default null,
  p_last_error text default null
)
returns jsonb
language plpgsql
security definer
set search_path to public
as $$
declare
  delivery public.christmas_v2_meta_deliveries%rowtype;
  safe_error text := left(coalesce(p_last_error, ''), 200);
begin
  if p_status not in ('sent', 'skipped', 'failed', 'deduplicated', 'permanently_failed') then
    raise exception 'invalid meta delivery status';
  end if;

  -- Strip obvious PII shapes from error text (emails / long tokens).
  safe_error := regexp_replace(safe_error, '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', '[redacted]', 'g');

  update public.christmas_v2_meta_deliveries
  set
    status = p_status,
    http_status = p_http_status,
    events_received = p_events_received,
    last_error = case when p_status in ('failed', 'permanently_failed') then safe_error else null end,
    sent_at = case when p_status = 'sent' then coalesce(sent_at, now()) else sent_at end,
    next_retry_at = case
      when p_status = 'failed' then now() + (least(attempt_count, 5) * interval '2 minutes')
      else null
    end,
    updated_at = now()
  where order_id = p_order_id and kind = 'purchase'
  returning * into delivery;

  if p_status = 'sent' then
    update public.christmas_v2_orders
    set meta_purchase_sent_at = coalesce(meta_purchase_sent_at, now()), updated_at = now()
    where id = p_order_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'status', coalesce(delivery.status, p_status),
    'attempt_count', coalesce(delivery.attempt_count, 0)
  );
end;
$$;

revoke all on function public.christmas_v2_claim_meta_purchase_delivery(uuid, text, integer, text, text)
  from anon, authenticated, public;
grant execute on function public.christmas_v2_claim_meta_purchase_delivery(uuid, text, integer, text, text)
  to service_role;

revoke all on function public.christmas_v2_finalize_meta_purchase_delivery(uuid, text, integer, integer, text)
  from anon, authenticated, public;
grant execute on function public.christmas_v2_finalize_meta_purchase_delivery(uuid, text, integer, integer, text)
  to service_role;

-- List deliveries eligible for bounded retry after process restart / Meta outage.
create or replace function public.christmas_v2_list_meta_purchase_retries(
  p_limit integer default 25
)
returns table (
  order_id uuid,
  event_id text,
  attempt_count integer,
  amount_cents integer,
  currency text,
  sku text,
  status text
)
language sql
security definer
set search_path to public
as $$
  select
    d.order_id,
    d.event_id,
    d.attempt_count,
    d.amount_cents,
    d.currency,
    d.sku,
    d.status
  from public.christmas_v2_meta_deliveries d
  join public.christmas_v2_orders o on o.id = d.order_id
  where d.kind = 'purchase'
    and o.paid_at is not null
    and o.meta_purchase_sent_at is null
    and d.status in ('pending', 'failed')
    and d.attempt_count < 5
    and (d.next_retry_at is null or d.next_retry_at <= now())
  order by coalesce(d.next_retry_at, d.created_at) asc
  limit greatest(coalesce(p_limit, 25), 1);
$$;

revoke all on function public.christmas_v2_list_meta_purchase_retries(integer)
  from anon, authenticated, public;
grant execute on function public.christmas_v2_list_meta_purchase_retries(integer)
  to service_role;

-- ---------------------------------------------------------------------------
-- 3) AI cost ledger: Christmas V2 FKs + estimated vs actual separation
-- ---------------------------------------------------------------------------

alter table if exists public.ai_cost_ledger
  add column if not exists christmas_v2_order_id uuid references public.christmas_v2_orders (id) on delete set null;

alter table if exists public.ai_cost_ledger
  add column if not exists christmas_v2_scene_id uuid references public.christmas_v2_order_scenes (id) on delete set null;

alter table if exists public.ai_cost_ledger
  add column if not exists christmas_v2_video_id uuid references public.christmas_v2_order_videos (id) on delete set null;

alter table if exists public.ai_cost_ledger
  add column if not exists estimated_cost_usd numeric(12,6);

alter table if exists public.ai_cost_ledger
  add column if not exists actual_cost_usd numeric(12,6);

comment on column public.ai_cost_ledger.estimated_cost_usd is
  'Catalog/estimate COGS. Never treat as provider-billed actual.';
comment on column public.ai_cost_ledger.actual_cost_usd is
  'Provider-billed actual when known; NULL means unknown (do not invent).';

create index if not exists ai_cost_ledger_christmas_v2_order_idx
  on public.ai_cost_ledger (christmas_v2_order_id, occurred_at desc)
  where christmas_v2_order_id is not null;

-- Estimate-only tariff seeds (NOT billed actuals). Source labeled explicitly.
insert into public.ai_model_pricing (
  provider, model_name, pricing_method, unit_cost_usd, currency, is_active, source, notes
)
select
  'higgsfield',
  'higgsfield-ai/soul/v2/image-to-image',
  'per_successful_output',
  0.006,
  'usd',
  true,
  'estimate_catalog',
  'Christmas V2 estimate only · not provider invoice. Do not report as actual billed cost.'
where to_regclass('public.ai_model_pricing') is not null
  and not exists (
    select 1 from public.ai_model_pricing
    where provider = 'higgsfield'
      and model_name = 'higgsfield-ai/soul/v2/image-to-image'
      and is_active = true
  );

insert into public.ai_model_pricing (
  provider, model_name, pricing_method, unit_cost_usd, currency, is_active, source, notes
)
select
  'higgsfield',
  'kling-video/v3.0/pro/image-to-video',
  'per_successful_output',
  0.35,
  'usd',
  true,
  'estimate_catalog',
  'Christmas V2 estimate for ~5s Kling 3 Pro · not provider invoice.'
where to_regclass('public.ai_model_pricing') is not null
  and not exists (
    select 1 from public.ai_model_pricing
    where provider = 'higgsfield'
      and model_name = 'kling-video/v3.0/pro/image-to-video'
      and is_active = true
  );

create or replace function public.christmas_v2_ai_cost_ledger_record_attempt(
  p_provider text,
  p_prediction_id text,
  p_order_id uuid,
  p_scene_id uuid,
  p_video_id uuid,
  p_scene_key text,
  p_attempt_number integer,
  p_product_sku text,
  p_model_name text,
  p_media_type text,
  p_provider_status text,
  p_is_mock boolean default false,
  p_is_retry boolean default false,
  p_estimated_unit_cost_usd numeric default null,
  p_cost_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path to public
as $$
declare
  v_prediction_id text := nullif(trim(coalesce(p_prediction_id, '')), '');
  v_model text := coalesce(nullif(trim(p_model_name), ''), 'higgsfield-ai/soul/v2/image-to-image');
  v_provider text := coalesce(nullif(trim(p_provider), ''), 'higgsfield');
  v_status text := coalesce(nullif(trim(p_provider_status), ''), 'starting');
  v_media text := coalesce(nullif(trim(p_media_type), ''), 'image');
  v_attempt integer := greatest(coalesce(p_attempt_number, 1), 1);
  tariff jsonb;
  unit_cost numeric(12,6);
  estimated numeric(12,6);
  billable numeric(12,6) := 0;
  cost_state text := 'pending';
  ledger_id uuid;
  notes text := nullif(trim(coalesce(p_cost_notes, '')), '');
begin
  if v_media not in ('image', 'video') then
    raise exception 'media_type must be image or video';
  end if;

  if coalesce(p_is_mock, false) and v_prediction_id is null then
    v_prediction_id := 'mock:christmas_v2:' || coalesce(p_order_id::text, 'unknown') || ':' || coalesce(p_scene_key, v_media) || ':' || v_attempt;
  end if;

  if v_prediction_id is null then
    raise exception 'prediction_id required';
  end if;

  tariff := public.ai_cost_lookup_tariff(v_provider, v_model, null);
  unit_cost := coalesce(
    p_estimated_unit_cost_usd,
    nullif((tariff->>'unitCostUsd')::numeric, 0),
    case when v_media = 'video' then 0.35 else 0.006 end
  );

  if coalesce(p_is_mock, false) then
    estimated := 0;
    billable := 0;
    cost_state := 'exact';
    notes := coalesce(notes, 'mock_generation_zero_cost');
  elsif v_status in ('succeeded', 'completed', 'ready') then
    estimated := unit_cost;
    billable := 1;
    cost_state := 'estimated';
    notes := coalesce(notes, 'estimate_catalog_not_provider_invoice');
  elsif v_status in ('failed', 'error') then
    -- Retries still consume provider capacity; keep estimate labeled, not actual.
    estimated := unit_cost;
    billable := 1;
    cost_state := 'estimated';
    notes := coalesce(notes, 'failed_attempt_estimated_consumption');
  else
    estimated := unit_cost;
    billable := 0;
    cost_state := 'pending';
  end if;

  insert into public.ai_cost_ledger (
    provider,
    prediction_id,
    product_family,
    christmas_v2_order_id,
    christmas_v2_scene_id,
    christmas_v2_video_id,
    scene_key,
    attempt_number,
    is_retry,
    is_mock,
    product_sku,
    model_name,
    provider_status,
    pricing_method,
    unit_cost_usd,
    billable_units,
    cost_usd,
    estimated_cost_usd,
    actual_cost_usd,
    cost_state,
    pricing_source,
    tariff_snapshot,
    currency,
    media_type,
    cost_notes,
    completed_at
  ) values (
    v_provider,
    v_prediction_id,
    'christmas_v2',
    p_order_id,
    p_scene_id,
    p_video_id,
    p_scene_key,
    v_attempt,
    coalesce(p_is_retry, false),
    coalesce(p_is_mock, false),
    p_product_sku,
    v_model,
    v_status,
    coalesce(tariff->>'pricingMethod', 'per_successful_output'),
    unit_cost,
    billable,
    estimated,
    estimated,
    null, -- actual unknown unless reconciled later
    cost_state,
    coalesce(tariff->>'source', 'estimate_catalog'),
    coalesce(tariff, jsonb_build_object(
      'provider', v_provider,
      'model', v_model,
      'unitCostUsd', unit_cost,
      'source', 'estimate_catalog',
      'notes', 'Christmas V2 estimate · actual_cost_usd null until provider billing'
    )),
    'usd',
    v_media,
    notes,
    case when v_status in ('succeeded', 'completed', 'ready', 'failed', 'error') then now() else null end
  )
  on conflict (provider, prediction_id) do update
    set
      provider_status = excluded.provider_status,
      billable_units = excluded.billable_units,
      cost_usd = excluded.cost_usd,
      estimated_cost_usd = excluded.estimated_cost_usd,
      -- Never overwrite a known actual with null/estimate
      actual_cost_usd = coalesce(public.ai_cost_ledger.actual_cost_usd, excluded.actual_cost_usd),
      cost_state = case
        when public.ai_cost_ledger.cost_state = 'reconciled' then 'reconciled'
        when public.ai_cost_ledger.actual_cost_usd is not null then 'exact'
        else excluded.cost_state
      end,
      completed_at = coalesce(excluded.completed_at, public.ai_cost_ledger.completed_at),
      updated_at = now(),
      cost_notes = coalesce(excluded.cost_notes, public.ai_cost_ledger.cost_notes)
  returning id into ledger_id;

  return jsonb_build_object(
    'ok', true,
    'ledger_id', ledger_id,
    'prediction_id', v_prediction_id,
    'cost_state', cost_state,
    'estimated_cost_usd', estimated,
    'actual_cost_usd', null,
    'is_estimate', cost_state = 'estimated'
  );
end;
$$;

revoke all on function public.christmas_v2_ai_cost_ledger_record_attempt(
  text, text, uuid, uuid, uuid, text, integer, text, text, text, text, boolean, boolean, numeric, text
) from anon, authenticated, public;
grant execute on function public.christmas_v2_ai_cost_ledger_record_attempt(
  text, text, uuid, uuid, uuid, text, integer, text, text, text, text, boolean, boolean, numeric, text
) to service_role;

-- ---------------------------------------------------------------------------
-- 4) Business metrics view (revenue vs AI COGS; ROAS marked unavailable)
-- ---------------------------------------------------------------------------

create or replace view public.christmas_v2_order_economics
with (security_invoker = true)
as
select
  o.id as order_id,
  o.sku,
  o.pack_key,
  o.currency as revenue_currency,
  o.amount_cents,
  o.charged_amount_cents,
  o.paid_at,
  o.status,
  o.parent_order_id,
  case when o.parent_order_id is null then 'original' else 'upsell' end as purchase_kind,
  o.offer_catalog_version,
  o.meta_purchase_sent_at,
  md.status as meta_delivery_status,
  coalesce(sum(l.estimated_cost_usd) filter (where l.christmas_v2_order_id is not null), 0) as ai_cogs_estimated_usd,
  sum(l.actual_cost_usd) filter (where l.actual_cost_usd is not null) as ai_cogs_actual_usd,
  bool_or(l.actual_cost_usd is null and l.cost_state in ('estimated', 'pending')) as ai_actual_incomplete,
  case
    when o.currency = 'eur' and o.charged_amount_cents is not null
      then (o.charged_amount_cents::numeric / 100.0)
    when o.currency = 'usd' and o.charged_amount_cents is not null
      then (o.charged_amount_cents::numeric / 100.0)
    else null
  end as revenue_major_units,
  -- Gross contribution uses ESTIMATED AI COGS only when actuals incomplete; label in queries.
  case
    when o.currency = 'usd' and o.charged_amount_cents is not null
      then (o.charged_amount_cents::numeric / 100.0)
         - coalesce(sum(l.estimated_cost_usd), 0)
    else null
  end as gross_contribution_usd_using_estimates,
  null::numeric as ad_spend,
  null::numeric as roas,
  null::numeric as cpa,
  'ad_spend_unavailable'::text as attribution_finance_status,
  o.created_at
from public.christmas_v2_orders o
left join public.christmas_v2_meta_deliveries md
  on md.order_id = o.id and md.kind = 'purchase'
left join public.ai_cost_ledger l
  on l.christmas_v2_order_id = o.id
group by
  o.id, o.sku, o.pack_key, o.currency, o.amount_cents, o.charged_amount_cents,
  o.paid_at, o.status, o.parent_order_id, o.offer_catalog_version,
  o.meta_purchase_sent_at, md.status, o.created_at;

-- Financial ledger view: service_role + admin only. Never expose to anon/customers.
revoke all on public.christmas_v2_order_economics from anon, public, authenticated;
grant select on public.christmas_v2_order_economics to service_role;

do $$
begin
  if to_regprocedure('public.is_admin()') is not null then
    grant select on public.christmas_v2_order_economics to authenticated;
  end if;
end
$$;

-- Cohort helper: paid orders + first-touch UTM from funnel events (when present).
create or replace view public.christmas_v2_paid_order_utm_cohorts
with (security_invoker = true)
as
select
  o.id as order_id,
  o.sku,
  o.pack_key,
  o.currency,
  o.charged_amount_cents,
  o.paid_at,
  o.parent_order_id,
  case when o.parent_order_id is null then 'original' else 'upsell' end as purchase_kind,
  fe.utm_source,
  fe.utm_medium,
  fe.utm_campaign,
  fe.utm_content,
  fe.utm_term,
  fe.campaign_id,
  fe.adset_id,
  fe.ad_id,
  fe.has_meta_click
from public.christmas_v2_orders o
left join lateral (
  select
    e.utm_source, e.utm_medium, e.utm_campaign, e.utm_content, e.utm_term,
    e.campaign_id, e.adset_id, e.ad_id, e.has_meta_click
  from public.christmas_v2_funnel_events e
  where e.funnel_session_id = o.funnel_session_id
  order by e.created_at asc
  limit 1
) fe on true
where o.paid_at is not null;

revoke all on public.christmas_v2_paid_order_utm_cohorts from anon, public, authenticated;
grant select on public.christmas_v2_paid_order_utm_cohorts to service_role;

do $$
begin
  if to_regprocedure('public.is_admin()') is not null then
    grant select on public.christmas_v2_paid_order_utm_cohorts to authenticated;
  end if;
end
$$;

-- Package-level rollup query surface (estimates labeled; ROAS unavailable without ad spend).
create or replace view public.christmas_v2_package_economics
with (security_invoker = true)
as
select
  sku,
  pack_key,
  revenue_currency,
  count(*) filter (where paid_at is not null) as paid_orders,
  count(*) filter (where purchase_kind = 'upsell' and paid_at is not null) as paid_upsells,
  coalesce(sum(charged_amount_cents) filter (where paid_at is not null), 0) as revenue_cents,
  round(
    avg(charged_amount_cents) filter (where paid_at is not null and charged_amount_cents is not null),
    2
  ) as aov_cents,
  coalesce(sum(ai_cogs_estimated_usd), 0) as ai_cogs_estimated_usd,
  sum(ai_cogs_actual_usd) as ai_cogs_actual_usd,
  bool_or(ai_actual_incomplete) as ai_actual_incomplete,
  null::numeric as ad_spend,
  null::numeric as roas,
  null::numeric as cpa,
  'ad_spend_unavailable'::text as attribution_finance_status
from public.christmas_v2_order_economics
group by sku, pack_key, revenue_currency;

revoke all on public.christmas_v2_package_economics from anon, public, authenticated;
grant select on public.christmas_v2_package_economics to service_role;
