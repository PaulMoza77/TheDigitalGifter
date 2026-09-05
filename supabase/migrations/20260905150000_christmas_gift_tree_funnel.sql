-- Christmas Gift Tree funnel: durable opens ledger, email ownership, purchasable packs
-- Does NOT alter visual assets. Additive only.

begin;

-- Durable purchased / granted gift-open balance (server-authoritative)
create table if not exists public.christmas_gift_tree_opens (
  id uuid primary key default gen_random_uuid(),
  season_year int not null default 2026,
  user_id uuid null references auth.users (id) on delete set null,
  guest_token_hash text null,
  email_normalized text null,
  opens_granted int not null default 0 check (opens_granted >= 0),
  opens_consumed int not null default 0 check (opens_consumed >= 0),
  source text not null default 'purchase',
  source_ref text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint christmas_gift_tree_opens_balance_chk check (opens_consumed <= opens_granted)
);

create unique index if not exists christmas_gift_tree_opens_source_ref_uidx
  on public.christmas_gift_tree_opens (source_ref);

create index if not exists christmas_gift_tree_opens_user_idx
  on public.christmas_gift_tree_opens (user_id, season_year)
  where user_id is not null;

create index if not exists christmas_gift_tree_opens_guest_idx
  on public.christmas_gift_tree_opens (guest_token_hash, season_year)
  where guest_token_hash is not null;

create index if not exists christmas_gift_tree_opens_email_idx
  on public.christmas_gift_tree_opens (email_normalized, season_year)
  where email_normalized is not null;

alter table public.christmas_gift_tree_opens enable row level security;

drop policy if exists christmas_gift_tree_opens_own_select on public.christmas_gift_tree_opens;
create policy christmas_gift_tree_opens_own_select
  on public.christmas_gift_tree_opens for select
  using (user_id = auth.uid());

revoke all on table public.christmas_gift_tree_opens from anon, authenticated, public;
grant select on table public.christmas_gift_tree_opens to authenticated;
grant all on table public.christmas_gift_tree_opens to service_role;

-- Email ownership / claim linkage on existing entitlements table
alter table public.christmas_reward_entitlements
  add column if not exists email_normalized text,
  add column if not exists claimed_email_at timestamptz,
  add column if not exists claim_campaign text,
  add column if not exists expires_at timestamptz,
  add column if not exists redeemed_at timestamptz,
  add column if not exists status text default 'available',
  add column if not exists metadata jsonb default '{}'::jsonb;

create index if not exists christmas_reward_entitlements_email_idx
  on public.christmas_reward_entitlements (email_normalized)
  where email_normalized is not null;

create index if not exists christmas_reward_entitlements_user_source_idx
  on public.christmas_reward_entitlements (user_id, source)
  where user_id is not null;

-- Enable purchasable gift-open packages at $1.99 / $4.99
update public.christmas_packages cp
set
  price_cents = case
    when cp.package_key = 'open_another' then 199
    when cp.package_key in ('open_five', 'open_5') then 499
    else cp.price_cents
  end,
  purchasable = true,
  active = true,
  package_name = case
    when cp.package_key = 'open_another' then '1 more gift'
    when cp.package_key in ('open_five', 'open_5') then '5 more gifts'
    else cp.package_name
  end,
  description = case
    when cp.package_key = 'open_another' then 'Open one more present under the Christmas tree.'
    when cp.package_key in ('open_five', 'open_5') then 'Open five more presents under the Christmas tree.'
    else cp.description
  end,
  features = case
    when cp.package_key = 'open_another' then '["1 gift opening"]'::jsonb
    when cp.package_key in ('open_five', 'open_5') then '["5 gift openings","Best value"]'::jsonb
    else cp.features
  end,
  metadata = coalesce(cp.metadata, '{}'::jsonb) || '{"live_offer":true,"gift_tree_opens":true,"opens_granted":1}'::jsonb,
  updated_at = now()
from public.christmas_products p
where cp.product_id = p.id
  and p.product_key = 'christmas_gift_tree'
  and cp.package_key = 'open_another';

update public.christmas_packages cp
set
  price_cents = 499,
  purchasable = true,
  active = true,
  package_name = '5 more gifts',
  description = 'Open five more presents under the Christmas tree.',
  features = '["5 gift openings","Best value"]'::jsonb,
  metadata = coalesce(cp.metadata, '{}'::jsonb) || '{"live_offer":true,"gift_tree_opens":true,"opens_granted":5}'::jsonb,
  updated_at = now()
from public.christmas_products p
where cp.product_id = p.id
  and p.product_key = 'christmas_gift_tree'
  and cp.package_key in ('open_five', 'open_5');

insert into public.christmas_packages (
  product_id, package_key, package_name, description, currency, price_cents,
  compare_at_cents, active, purchasable, features, sort_order, locale_default, metadata
)
select
  p.id,
  'open_five',
  '5 more gifts',
  'Open five more presents under the Christmas tree.',
  'usd',
  499,
  null,
  true,
  true,
  '["5 gift openings","Best value"]'::jsonb,
  20,
  'en',
  '{"live_offer":true,"gift_tree_opens":true,"opens_granted":5}'::jsonb
from public.christmas_products p
where p.product_key = 'christmas_gift_tree'
  and not exists (
    select 1 from public.christmas_packages x
    where x.product_id = p.id and x.package_key = 'open_five'
  );

update public.christmas_products
set
  metadata = coalesce(metadata, '{}'::jsonb) || '{"gift_tree_v1":true,"live_offer":true}'::jsonb,
  updated_at = now()
where product_key = 'christmas_gift_tree';

-- Remaining opens helper
create or replace function public.christmas_gift_tree_remaining_opens(
  p_season_year int,
  p_user_id uuid default null,
  p_guest_token_hash text default null,
  p_email_normalized text default null
)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(greatest(opens_granted - opens_consumed, 0)), 0)::int
  from public.christmas_gift_tree_opens
  where season_year = p_season_year
    and (
      (p_user_id is not null and user_id = p_user_id)
      or (p_guest_token_hash is not null and guest_token_hash = p_guest_token_hash)
      or (p_email_normalized is not null and email_normalized = p_email_normalized)
    );
$$;

revoke all on function public.christmas_gift_tree_remaining_opens(int, uuid, text, text) from public;
grant execute on function public.christmas_gift_tree_remaining_opens(int, uuid, text, text) to service_role;

-- Idempotent grant of purchased/extra opens (webhook fulfillment)
create or replace function public.christmas_gift_tree_grant_opens(
  p_season_year int,
  p_opens int,
  p_source text,
  p_source_ref text,
  p_user_id uuid default null,
  p_guest_token_hash text default null,
  p_email_normalized text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  existing public.christmas_gift_tree_opens%rowtype;
  granted int := greatest(coalesce(p_opens, 0), 0);
begin
  if p_source_ref is null or length(trim(p_source_ref)) = 0 then
    return jsonb_build_object('ok', false, 'reason', 'missing_source_ref');
  end if;
  if granted <= 0 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_opens');
  end if;

  select * into existing
  from public.christmas_gift_tree_opens
  where source_ref = p_source_ref
  for update;

  if found then
    return jsonb_build_object(
      'ok', true,
      'already', true,
      'id', existing.id,
      'opens_granted', existing.opens_granted,
      'opens_consumed', existing.opens_consumed
    );
  end if;

  insert into public.christmas_gift_tree_opens (
    season_year, user_id, guest_token_hash, email_normalized,
    opens_granted, opens_consumed, source, source_ref, metadata
  ) values (
    p_season_year, p_user_id, p_guest_token_hash, p_email_normalized,
    granted, 0, coalesce(nullif(trim(p_source), ''), 'purchase'), p_source_ref,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning * into existing;

  return jsonb_build_object(
    'ok', true,
    'already', false,
    'id', existing.id,
    'opens_granted', existing.opens_granted,
    'opens_consumed', existing.opens_consumed
  );
exception
  when unique_violation then
    select * into existing from public.christmas_gift_tree_opens where source_ref = p_source_ref;
    return jsonb_build_object(
      'ok', true,
      'already', true,
      'id', existing.id,
      'opens_granted', existing.opens_granted,
      'opens_consumed', existing.opens_consumed
    );
end;
$$;

revoke all on function public.christmas_gift_tree_grant_opens(int, int, text, text, uuid, text, text, jsonb) from public;
grant execute on function public.christmas_gift_tree_grant_opens(int, int, text, text, uuid, text, text, jsonb) to service_role;

-- Atomically consume one open entitlement (prevents double-spend on concurrent taps)
create or replace function public.christmas_gift_tree_consume_open(
  p_season_year int,
  p_user_id uuid default null,
  p_guest_token_hash text default null,
  p_email_normalized text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  row_id uuid;
  remaining int;
begin
  select id into row_id
  from public.christmas_gift_tree_opens
  where season_year = p_season_year
    and opens_consumed < opens_granted
    and (
      (p_user_id is not null and user_id = p_user_id)
      or (p_guest_token_hash is not null and guest_token_hash = p_guest_token_hash)
      or (p_email_normalized is not null and email_normalized = p_email_normalized)
    )
  order by created_at asc
  for update skip locked
  limit 1;

  if row_id is null then
    return jsonb_build_object('ok', false, 'reason', 'no_opens_remaining');
  end if;

  update public.christmas_gift_tree_opens
  set opens_consumed = opens_consumed + 1,
      updated_at = now()
  where id = row_id
    and opens_consumed < opens_granted;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'race_lost');
  end if;

  remaining := public.christmas_gift_tree_remaining_opens(
    p_season_year, p_user_id, p_guest_token_hash, p_email_normalized
  );

  return jsonb_build_object(
    'ok', true,
    'consumed_row_id', row_id,
    'remaining_opens', remaining
  );
end;
$$;

revoke all on function public.christmas_gift_tree_consume_open(int, uuid, text, text) from public;
grant execute on function public.christmas_gift_tree_consume_open(int, uuid, text, text) to service_role;

comment on table public.christmas_gift_tree_opens is
  'Server-authoritative Christmas Gift Tree open entitlements (purchase / grant ledger).';

commit;
