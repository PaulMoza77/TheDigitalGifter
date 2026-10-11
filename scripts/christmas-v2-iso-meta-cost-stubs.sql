-- Minimal stubs so christmas_v2 meta/cost migration can apply on disposable iso DBs
-- that do not include the full pet ai_cost_ledger stack.
-- Safe to re-run. Never apply to production as a substitute for real migrations.

\set ON_ERROR_STOP on

create extension if not exists pgcrypto;

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$ select false $$;

create table if not exists public.ai_model_pricing (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  model_name text not null,
  model_version text,
  pricing_method text not null default 'per_successful_output',
  unit_cost_usd numeric(12,6) not null default 0,
  currency text not null default 'usd',
  effective_from timestamptz not null default now(),
  effective_to timestamptz,
  is_active boolean not null default true,
  source text not null default 'estimate_catalog',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ai_model_pricing_active_uidx
  on public.ai_model_pricing (provider, model_name, coalesce(model_version, ''))
  where is_active = true;

create table if not exists public.ai_cost_ledger (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  prediction_id text not null,
  product_family text not null default 'pet_funnel',
  pet_order_id uuid,
  scene_id uuid,
  scene_key text,
  attempt_number integer not null default 1,
  is_retry boolean not null default false,
  is_mock boolean not null default false,
  product_sku text,
  model_name text not null,
  model_version text,
  provider_status text not null,
  pricing_method text not null default 'per_successful_output',
  unit_cost_usd numeric(12,6) not null default 0,
  billable_units numeric(12,6) not null default 0,
  cost_usd numeric(12,6) not null default 0,
  cost_state text not null default 'pending',
  pricing_source text not null default 'estimate_catalog',
  tariff_snapshot jsonb not null default '{}'::jsonb,
  currency text not null default 'usd',
  media_type text not null default 'image',
  clip_id uuid,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  occurred_at timestamptz generated always as (coalesce(completed_at, started_at)) stored,
  cost_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_cost_ledger_provider_prediction_key unique (provider, prediction_id)
);

alter table public.ai_cost_ledger enable row level security;

create or replace function public.ai_cost_lookup_tariff(
  p_provider text,
  p_model_name text,
  p_model_version text default null
)
returns jsonb
language plpgsql
stable
as $$
declare
  row public.ai_model_pricing%rowtype;
begin
  select * into row
  from public.ai_model_pricing
  where provider = p_provider
    and model_name = p_model_name
    and is_active = true
  order by effective_from desc
  limit 1;

  if not found then
    return jsonb_build_object(
      'unitCostUsd', 0,
      'pricingMethod', 'per_successful_output',
      'source', 'estimate_catalog_missing'
    );
  end if;

  return jsonb_build_object(
    'unitCostUsd', row.unit_cost_usd,
    'pricingMethod', row.pricing_method,
    'source', row.source,
    'pricingRowId', row.id
  );
end;
$$;
