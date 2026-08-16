-- Additive Replicate / AI cost ledger. Does not modify 20260816160000_pet_funnel.sql.

begin;

create table if not exists public.ai_model_pricing (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  model_name text not null,
  model_version text,
  pricing_method text not null,
  unit_cost_usd numeric(12,6) not null,
  currency text not null default 'usd',
  effective_from timestamptz not null default now(),
  effective_to timestamptz,
  is_active boolean not null default true,
  source text not null default 'server_owned',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_model_pricing_provider_chk check (length(trim(provider)) > 0),
  constraint ai_model_pricing_model_chk check (length(trim(model_name)) > 0),
  constraint ai_model_pricing_method_chk check (
    pricing_method in ('per_successful_output', 'per_second', 'per_token', 'flat', 'none')
  ),
  constraint ai_model_pricing_currency_chk check (currency = 'usd'),
  constraint ai_model_pricing_cost_chk check (unit_cost_usd >= 0)
);

create unique index if not exists ai_model_pricing_active_uidx
  on public.ai_model_pricing (provider, model_name, coalesce(model_version, ''))
  where is_active = true;

create table if not exists public.ai_cost_ledger (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  prediction_id text not null,
  product_family text not null default 'pet_funnel',
  pet_order_id uuid references public.pet_orders (id) on delete set null,
  scene_id uuid references public.pet_order_scenes (id) on delete set null,
  scene_key text,
  attempt_number integer not null default 1,
  is_retry boolean not null default false,
  is_mock boolean not null default false,
  product_sku text,
  model_name text not null,
  model_version text,
  provider_status text not null,
  pricing_method text not null,
  unit_cost_usd numeric(12,6) not null,
  billable_units numeric(12,6) not null default 0,
  cost_usd numeric(12,6) not null default 0,
  cost_state text not null,
  pricing_source text not null,
  tariff_snapshot jsonb not null,
  currency text not null default 'usd',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  occurred_at timestamptz generated always as (coalesce(completed_at, started_at)) stored,
  cost_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_cost_ledger_provider_chk check (length(trim(provider)) > 0),
  constraint ai_cost_ledger_prediction_chk check (length(trim(prediction_id)) > 0),
  constraint ai_cost_ledger_attempt_chk check (attempt_number >= 1),
  constraint ai_cost_ledger_state_chk check (
    cost_state in ('pending', 'exact', 'estimated', 'reconciled')
  ),
  constraint ai_cost_ledger_currency_chk check (currency = 'usd'),
  constraint ai_cost_ledger_cost_chk check (cost_usd >= 0 and unit_cost_usd >= 0 and billable_units >= 0)
);

create unique index if not exists ai_cost_ledger_provider_prediction_uidx
  on public.ai_cost_ledger (provider, prediction_id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ai_cost_ledger_provider_prediction_key'
  ) then
    alter table public.ai_cost_ledger
      add constraint ai_cost_ledger_provider_prediction_key
      unique using index ai_cost_ledger_provider_prediction_uidx;
  end if;
end
$$;

create index if not exists ai_cost_ledger_order_idx
  on public.ai_cost_ledger (pet_order_id, occurred_at desc);

create index if not exists ai_cost_ledger_occurred_idx
  on public.ai_cost_ledger (provider, product_family, occurred_at desc);

create index if not exists ai_cost_ledger_model_idx
  on public.ai_cost_ledger (model_name, provider_status);

drop trigger if exists ai_model_pricing_touch_updated_at on public.ai_model_pricing;
create trigger ai_model_pricing_touch_updated_at
before update on public.ai_model_pricing
for each row execute function public.pet_touch_updated_at();

drop trigger if exists ai_cost_ledger_touch_updated_at on public.ai_cost_ledger;
create trigger ai_cost_ledger_touch_updated_at
before update on public.ai_cost_ledger
for each row execute function public.pet_touch_updated_at();

insert into public.ai_model_pricing (
  provider,
  model_name,
  model_version,
  pricing_method,
  unit_cost_usd,
  currency,
  effective_from,
  is_active,
  source,
  notes
)
select
  'replicate',
  'black-forest-labs/flux-kontext-pro',
  null,
  'per_successful_output',
  0.04,
  'usd',
  timestamptz '2026-08-01 00:00:00+00',
  true,
  'server_owned',
  'Kontext Pro per successful output. Snapshot this row onto each prediction.'
where not exists (
  select 1
  from public.ai_model_pricing
  where provider = 'replicate'
    and model_name = 'black-forest-labs/flux-kontext-pro'
    and model_version is null
    and is_active = true
);

alter table public.ai_model_pricing enable row level security;
alter table public.ai_cost_ledger enable row level security;

drop policy if exists ai_model_pricing_admin_read on public.ai_model_pricing;
create policy ai_model_pricing_admin_read
  on public.ai_model_pricing for select
  using (public.is_admin());

drop policy if exists ai_cost_ledger_admin_read on public.ai_cost_ledger;
create policy ai_cost_ledger_admin_read
  on public.ai_cost_ledger for select
  using (public.is_admin());

revoke all on table public.ai_model_pricing from anon, public;
revoke all on table public.ai_cost_ledger from anon, public;
revoke all on table public.ai_model_pricing from authenticated;
revoke all on table public.ai_cost_ledger from authenticated;

grant select on table public.ai_model_pricing to authenticated;
grant select on table public.ai_cost_ledger to authenticated;
grant all on table public.ai_model_pricing to service_role;
grant all on table public.ai_cost_ledger to service_role;

create or replace function public.ai_cost_lookup_tariff(
  p_provider text,
  p_model_name text,
  p_model_version text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  pricing_row public.ai_model_pricing%rowtype;
begin
  select *
  into pricing_row
  from public.ai_model_pricing
  where provider = trim(p_provider)
    and model_name = trim(p_model_name)
    and is_active = true
    and (effective_to is null or effective_to > now())
    and effective_from <= now()
    and (model_version is not distinct from nullif(trim(coalesce(p_model_version, '')), '') or model_version is null)
  order by (model_version is not null) desc, effective_from desc
  limit 1;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'provider', pricing_row.provider,
    'model', pricing_row.model_name,
    'modelVersion', pricing_row.model_version,
    'pricingMethod', pricing_row.pricing_method,
    'unitCostUsd', pricing_row.unit_cost_usd,
    'currency', pricing_row.currency,
    'source', 'ai_model_pricing',
    'pricingRowId', pricing_row.id,
    'capturedAt', now(),
    'notes', pricing_row.notes
  );
end;
$$;

create or replace function public.ai_cost_compute_from_snapshot(
  p_provider_status text,
  p_is_mock boolean,
  p_create_failed boolean,
  p_tariff jsonb
)
returns jsonb
language plpgsql
immutable
set search_path = public
as $$
declare
  unit_cost numeric(12,6);
  method text;
  status text := coalesce(nullif(trim(p_provider_status), ''), 'starting');
begin
  unit_cost := coalesce((p_tariff->>'unitCostUsd')::numeric, 0);
  method := coalesce(p_tariff->>'pricingMethod', 'none');

  if coalesce(p_is_mock, false) then
    return jsonb_build_object(
      'cost_usd', 0,
      'billable_units', 0,
      'cost_state', 'exact',
      'provider_status', 'mock'
    );
  end if;

  if coalesce(p_create_failed, false) or status = 'create_failed' then
    return jsonb_build_object(
      'cost_usd', 0,
      'billable_units', 0,
      'cost_state', 'exact',
      'provider_status', 'create_failed'
    );
  end if;

  if status = 'succeeded' then
    return jsonb_build_object(
      'cost_usd', case when method = 'per_successful_output' then unit_cost else 0 end,
      'billable_units', case when method = 'per_successful_output' then 1 else 0 end,
      'cost_state', 'exact',
      'provider_status', 'succeeded'
    );
  end if;

  if status = 'failed' then
    return jsonb_build_object(
      'cost_usd', 0,
      'billable_units', 0,
      'cost_state', 'exact',
      'provider_status', 'failed'
    );
  end if;

  if status = 'canceled' then
    return jsonb_build_object(
      'cost_usd', unit_cost,
      'billable_units', case when method = 'per_successful_output' then 1 else 0 end,
      'cost_state', 'estimated',
      'provider_status', 'canceled'
    );
  end if;

  return jsonb_build_object(
    'cost_usd', 0,
    'billable_units', 0,
    'cost_state', 'pending',
    'provider_status', status
  );
end;
$$;

create or replace function public.ai_cost_ledger_record_attempt(
  p_provider text,
  p_prediction_id text,
  p_pet_order_id uuid,
  p_scene_id uuid,
  p_scene_key text,
  p_attempt_number integer,
  p_product_sku text,
  p_model_name text,
  p_model_version text,
  p_is_mock boolean default false,
  p_create_failed boolean default false,
  p_cost_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prediction_id text := nullif(trim(coalesce(p_prediction_id, '')), '');
  tariff jsonb;
  computed jsonb;
  v_attempt_number integer := greatest(coalesce(p_attempt_number, 1), 1);
  v_model_name text := coalesce(nullif(trim(p_model_name), ''), 'black-forest-labs/flux-kontext-pro');
  ledger_row public.ai_cost_ledger%rowtype;
  notes text := nullif(trim(coalesce(p_cost_notes, '')), '');
begin
  if coalesce(p_is_mock, false) and v_prediction_id is null then
    v_prediction_id := 'mock:' || coalesce(p_pet_order_id::text, 'unknown') || ':' || coalesce(p_scene_key, 'unknown') || ':' || v_attempt_number;
  end if;

  if coalesce(p_create_failed, false) and v_prediction_id is null then
    v_prediction_id := 'create-failed:' || gen_random_uuid()::text;
    notes := coalesce(notes, 'create_failed_no_prediction_id');
  end if;

  if v_prediction_id is null then
    raise exception 'prediction_id required';
  end if;

  if coalesce(p_is_mock, false) then
    notes := coalesce(notes, 'mock_generation');
  end if;

  tariff := public.ai_cost_lookup_tariff(p_provider, v_model_name, p_model_version);
  if tariff is null then
    tariff := jsonb_build_object(
      'provider', coalesce(nullif(trim(p_provider), ''), 'replicate'),
      'model', v_model_name,
      'modelVersion', nullif(trim(coalesce(p_model_version, '')), ''),
      'pricingMethod', 'none',
      'unitCostUsd', 0,
      'currency', 'usd',
      'source', 'unknown',
      'pricingRowId', null,
      'capturedAt', now(),
      'notes', 'No active tariff; recorded without inventing a unit cost'
    );
  end if;

  computed := public.ai_cost_compute_from_snapshot(
    case
      when coalesce(p_is_mock, false) then 'mock'
      when coalesce(p_create_failed, false) then 'create_failed'
      else 'starting'
    end,
    coalesce(p_is_mock, false),
    coalesce(p_create_failed, false),
    tariff
  );

  insert into public.ai_cost_ledger (
    provider,
    prediction_id,
    product_family,
    pet_order_id,
    scene_id,
    scene_key,
    attempt_number,
    is_retry,
    is_mock,
    product_sku,
    model_name,
    model_version,
    provider_status,
    pricing_method,
    unit_cost_usd,
    billable_units,
    cost_usd,
    cost_state,
    pricing_source,
    tariff_snapshot,
    currency,
    started_at,
    completed_at,
    cost_notes
  )
  values (
    coalesce(nullif(trim(p_provider), ''), 'replicate'),
    v_prediction_id,
    'pet_funnel',
    p_pet_order_id,
    p_scene_id,
    nullif(trim(coalesce(p_scene_key, '')), ''),
    v_attempt_number,
    v_attempt_number > 1,
    coalesce(p_is_mock, false),
    coalesce(nullif(trim(p_product_sku), ''), 'pet-secret-life-12'),
    v_model_name,
    nullif(trim(coalesce(p_model_version, '')), ''),
    computed->>'provider_status',
    coalesce(tariff->>'pricingMethod', 'none'),
    coalesce((tariff->>'unitCostUsd')::numeric, 0),
    case
      when computed->>'cost_state' = 'pending' then 0
      else coalesce((computed->>'billable_units')::numeric, 0)
    end,
    case
      when computed->>'cost_state' = 'pending' then 0
      else coalesce((computed->>'cost_usd')::numeric, 0)
    end,
    computed->>'cost_state',
    coalesce(tariff->>'source', 'unknown'),
    tariff,
    'usd',
    now(),
    case when computed->>'cost_state' = 'pending' then null else now() end,
    notes
  )
  on conflict on constraint ai_cost_ledger_provider_prediction_key do nothing
  returning * into ledger_row;

  if ledger_row.id is null then
    select * into ledger_row
    from public.ai_cost_ledger as ledger
    where ledger.provider = coalesce(nullif(trim(p_provider), ''), 'replicate')
      and ledger.prediction_id = v_prediction_id;
  end if;

  return to_jsonb(ledger_row);
end;
$$;

create or replace function public.ai_cost_ledger_finalize_prediction(
  p_provider text,
  p_prediction_id text,
  p_provider_status text,
  p_model_name text default null,
  p_model_version text default null,
  p_pet_order_id uuid default null,
  p_scene_id uuid default null,
  p_scene_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prediction_id text := nullif(trim(coalesce(p_prediction_id, '')), '');
  ledger_row public.ai_cost_ledger%rowtype;
  computed jsonb;
  tariff jsonb;
begin
  if v_prediction_id is null then
    raise exception 'prediction_id required';
  end if;

  select * into ledger_row
  from public.ai_cost_ledger as ledger
  where ledger.provider = coalesce(nullif(trim(p_provider), ''), 'replicate')
    and ledger.prediction_id = v_prediction_id
  for update;

  if not found then
    perform public.ai_cost_ledger_record_attempt(
      coalesce(nullif(trim(p_provider), ''), 'replicate'),
      v_prediction_id,
      p_pet_order_id,
      p_scene_id,
      p_scene_key,
      1,
      'pet-secret-life-12',
      coalesce(nullif(trim(p_model_name), ''), 'black-forest-labs/flux-kontext-pro'),
      p_model_version,
      false,
      false,
      'webhook_without_pending'
    );

    select * into ledger_row
    from public.ai_cost_ledger as ledger
    where ledger.provider = coalesce(nullif(trim(p_provider), ''), 'replicate')
      and ledger.prediction_id = v_prediction_id
    for update;
  end if;

  if ledger_row.cost_state in ('exact', 'estimated', 'reconciled') then
    return to_jsonb(ledger_row) || jsonb_build_object('applied', false, 'reason', 'already_finalized');
  end if;

  tariff := ledger_row.tariff_snapshot;
  computed := public.ai_cost_compute_from_snapshot(
    p_provider_status,
    ledger_row.is_mock,
    false,
    tariff
  );

  update public.ai_cost_ledger
  set
    provider_status = computed->>'provider_status',
    billable_units = coalesce((computed->>'billable_units')::numeric, 0),
    cost_usd = coalesce((computed->>'cost_usd')::numeric, 0),
    cost_state = computed->>'cost_state',
    completed_at = now(),
    model_name = coalesce(nullif(trim(p_model_name), ''), model_name),
    model_version = coalesce(nullif(trim(p_model_version), ''), model_version),
    pet_order_id = coalesce(p_pet_order_id, pet_order_id),
    scene_id = coalesce(p_scene_id, scene_id),
    scene_key = coalesce(nullif(trim(coalesce(p_scene_key, '')), ''), scene_key)
  where id = ledger_row.id
  returning * into ledger_row;

  return to_jsonb(ledger_row) || jsonb_build_object('applied', true);
end;
$$;

-- Backfill only rows that already have a real prediction id, model, and final status.
insert into public.ai_cost_ledger (
  provider,
  prediction_id,
  product_family,
  pet_order_id,
  scene_id,
  scene_key,
  attempt_number,
  is_retry,
  is_mock,
  product_sku,
  model_name,
  model_version,
  provider_status,
  pricing_method,
  unit_cost_usd,
  billable_units,
  cost_usd,
  cost_state,
  pricing_source,
  tariff_snapshot,
  currency,
  started_at,
  completed_at,
  cost_notes
)
select
  'replicate',
  trim(s.replicate_prediction_id),
  'pet_funnel',
  s.order_id,
  s.id,
  s.scene_key,
  greatest(coalesce(s.attempts, 1), 1),
  coalesce(s.attempts, 1) > 1,
  false,
  o.sku,
  s.model_name,
  s.model_version,
  e.event_status,
  'per_successful_output',
  0.04,
  case when e.event_status in ('succeeded', 'canceled') then 1 else 0 end,
  case when e.event_status in ('succeeded', 'canceled') then 0.04 else 0 end,
  case when e.event_status = 'canceled' then 'estimated' else 'exact' end,
  'ai_model_pricing.historical_backfill',
  jsonb_build_object(
    'provider', 'replicate',
    'model', s.model_name,
    'modelVersion', s.model_version,
    'pricingMethod', 'per_successful_output',
    'unitCostUsd', 0.04,
    'currency', 'usd',
    'source', 'ai_model_pricing.historical_backfill',
    'pricingRowId', null,
    'capturedAt', coalesce(s.completed_at, e.created_at, s.created_at),
    'notes', 'Backfilled only because prediction id, model, and final status already existed'
  ),
  'usd',
  coalesce(s.started_at, e.created_at, s.created_at),
  coalesce(s.completed_at, e.created_at),
  'historical_backfill'
from public.pet_order_scenes s
join public.pet_orders o on o.id = s.order_id
join public.pet_processed_replicate_events e
  on e.prediction_id = s.replicate_prediction_id
 and e.event_status in ('succeeded', 'failed', 'canceled')
where s.replicate_prediction_id is not null
  and length(trim(s.replicate_prediction_id)) > 0
  and s.replicate_prediction_id not like 'mock:%'
  and s.replicate_prediction_id not like 'create-failed:%'
  and s.model_name is not null
  and length(trim(s.model_name)) > 0
  and s.model_name = 'black-forest-labs/flux-kontext-pro'
on conflict (provider, prediction_id) do nothing;

revoke all on function public.ai_cost_lookup_tariff(text, text, text) from anon, authenticated, public;
revoke all on function public.ai_cost_compute_from_snapshot(text, boolean, boolean, jsonb) from anon, authenticated, public;
revoke all on function public.ai_cost_ledger_record_attempt(text, text, uuid, uuid, text, integer, text, text, text, boolean, boolean, text) from anon, authenticated, public;
revoke all on function public.ai_cost_ledger_finalize_prediction(text, text, text, text, text, uuid, uuid, text) from anon, authenticated, public;

grant execute on function public.ai_cost_lookup_tariff(text, text, text) to service_role;
grant execute on function public.ai_cost_compute_from_snapshot(text, boolean, boolean, jsonb) to service_role;
grant execute on function public.ai_cost_ledger_record_attempt(text, text, uuid, uuid, text, integer, text, text, text, boolean, boolean, text) to service_role;
grant execute on function public.ai_cost_ledger_finalize_prediction(text, text, text, text, text, uuid, uuid, text) to service_role;

commit;
