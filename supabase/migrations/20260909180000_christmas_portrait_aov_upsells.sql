-- Suite portrait AOV upsells (CHRISTMAS-039).
-- extra_images / extra_styles / video for christmas_photo|family|couple|pet.
-- Not V2 packs. price_cents remains 0; purchasable remains false. No price invented.

begin;

-- ---------------------------------------------------------------------------
-- Draft AOV packages (unpublished)
-- ---------------------------------------------------------------------------

insert into public.christmas_packages (
  product_id, package_key, package_name, description,
  currency, price_cents, compare_at_cents, active, purchasable, features, sort_order, metadata
)
select
  p.id,
  v.package_key,
  v.package_name,
  v.description,
  'usd',
  0,
  null,
  true,
  false,
  v.features,
  v.sort_order,
  v.metadata
from public.christmas_products p
cross join (
  values
    (
      'extra_images',
      'Extra portraits',
      'Two more portraits in the same Christmas style. Draft AOV offer — price unpublished.',
      '["2 extra Christmas portraits","Same style as your paid portrait"]'::jsonb,
      20,
      '{"live_offer":false,"kind":"upsell","upsell_key":"extra_images","extra_count":2,"fulfill_kind":"extra_images","v2_pack":false}'::jsonb
    ),
    (
      'extra_styles',
      'Extra styles',
      'Two more portraits in different Christmas styles. Draft AOV offer — price unpublished.',
      '["2 extra style variants","Server-owned styles only"]'::jsonb,
      30,
      '{"live_offer":false,"kind":"upsell","upsell_key":"extra_styles","extra_count":2,"fulfill_kind":"extra_styles","v2_pack":false}'::jsonb
    ),
    (
      'video',
      'Portrait video',
      'A short motion clip from your Christmas portrait. Draft AOV offer — price unpublished.',
      '["1 short Christmas motion clip"]'::jsonb,
      40,
      '{"live_offer":false,"kind":"upsell","upsell_key":"video","extra_count":1,"fulfill_kind":"video","v2_pack":false}'::jsonb
    )
) as v(package_key, package_name, description, features, sort_order, metadata)
where p.product_key in ('christmas_photo', 'christmas_family', 'christmas_couple', 'christmas_pet')
  and not exists (
    select 1 from public.christmas_packages pkg
    where pkg.product_id = p.id and pkg.package_key = v.package_key
  );

-- Keep unpublished even if a later edit drifted
update public.christmas_packages pkg
set purchasable = false,
    price_cents = 0,
    updated_at = now()
from public.christmas_products p
where pkg.product_id = p.id
  and p.product_key in ('christmas_photo', 'christmas_family', 'christmas_couple', 'christmas_pet')
  and pkg.package_key in ('extra_images', 'extra_styles', 'video');

-- ---------------------------------------------------------------------------
-- Upsell purchases (child of a paid portrait order)
-- ---------------------------------------------------------------------------

create table if not exists public.christmas_order_upsells (
  id uuid primary key default gen_random_uuid(),
  parent_order_id uuid not null references public.christmas_orders (id) on delete cascade,
  product_key text not null,
  package_key text not null,
  upsell_key text not null,
  sku text not null,
  currency text not null default 'usd',
  amount_cents integer not null,
  status text not null default 'pending',
  fulfillment_status text not null default 'not_started',
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  paid_at timestamptz,
  fulfilled_at timestamptz,
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint christmas_order_upsells_currency_chk check (currency in ('usd', 'eur', 'ron')),
  constraint christmas_order_upsells_amount_chk check (amount_cents >= 0),
  constraint christmas_order_upsells_status_chk check (
    status in ('pending', 'paid', 'failed', 'refunded', 'canceled')
  ),
  constraint christmas_order_upsells_fulfillment_chk check (
    fulfillment_status in ('not_started', 'queued', 'processing', 'completed', 'failed')
  ),
  constraint christmas_order_upsells_key_chk check (
    package_key in ('extra_images', 'extra_styles', 'video')
    and upsell_key in ('extra_images', 'extra_styles', 'video')
  ),
  constraint christmas_order_upsells_not_v2_chk check (
    package_key not in ('starter', 'magic', 'ultimate')
  )
);

create index if not exists christmas_order_upsells_parent_idx
  on public.christmas_order_upsells (parent_order_id, created_at desc);

create unique index if not exists christmas_order_upsells_session_uidx
  on public.christmas_order_upsells (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null
    and length(trim(stripe_checkout_session_id)) > 0;

create unique index if not exists christmas_order_upsells_paid_key_uidx
  on public.christmas_order_upsells (parent_order_id, upsell_key)
  where status in ('paid');

drop trigger if exists christmas_order_upsells_touch_updated_at on public.christmas_order_upsells;
create trigger christmas_order_upsells_touch_updated_at
before update on public.christmas_order_upsells
for each row execute function public.christmas_touch_updated_at();

alter table public.christmas_order_upsells enable row level security;

drop policy if exists christmas_order_upsells_admin_read on public.christmas_order_upsells;
create policy christmas_order_upsells_admin_read
  on public.christmas_order_upsells for select
  using (public.is_admin());

revoke all on table public.christmas_order_upsells from anon, authenticated, public;
grant select on table public.christmas_order_upsells to authenticated;
grant all on table public.christmas_order_upsells to service_role;

-- ---------------------------------------------------------------------------
-- Idempotent upsell payment fulfill
-- ---------------------------------------------------------------------------

create or replace function public.fulfill_christmas_upsell_payment(
  p_upsell_id uuid,
  p_stripe_session_id text,
  p_stripe_payment_intent_id text default null,
  p_amount_cents integer default null,
  p_currency text default null,
  p_stripe_event_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  upsell_row public.christmas_order_upsells%rowtype;
  parent_row public.christmas_orders%rowtype;
begin
  if p_upsell_id is null then
    return jsonb_build_object('ok', false, 'reason', 'missing_upsell_id');
  end if;

  select * into upsell_row
  from public.christmas_order_upsells
  where id = p_upsell_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'upsell_not_found');
  end if;

  select * into parent_row
  from public.christmas_orders
  where id = upsell_row.parent_order_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'parent_not_found');
  end if;

  if parent_row.payment_status <> 'paid' then
    return jsonb_build_object('ok', false, 'reason', 'parent_not_paid');
  end if;

  if upsell_row.status = 'paid' then
    return jsonb_build_object(
      'ok', true,
      'status', 'already_paid',
      'upsell_id', upsell_row.id,
      'parent_order_id', upsell_row.parent_order_id,
      'upsell_key', upsell_row.upsell_key,
      'fulfillment_status', upsell_row.fulfillment_status,
      'should_enqueue', upsell_row.fulfillment_status in ('not_started', 'queued', 'failed')
    );
  end if;

  if upsell_row.status = 'refunded' then
    return jsonb_build_object('ok', false, 'reason', 'already_refunded');
  end if;

  if p_amount_cents is not null and p_amount_cents <> upsell_row.amount_cents then
    return jsonb_build_object(
      'ok', false,
      'reason', 'amount_mismatch',
      'expected_amount_cents', upsell_row.amount_cents,
      'got_amount_cents', p_amount_cents
    );
  end if;

  if p_currency is not null and lower(p_currency) <> lower(upsell_row.currency) then
    return jsonb_build_object(
      'ok', false,
      'reason', 'currency_mismatch',
      'expected_currency', upsell_row.currency,
      'got_currency', lower(p_currency)
    );
  end if;

  if p_stripe_session_id is not null
     and upsell_row.stripe_checkout_session_id is not null
     and upsell_row.stripe_checkout_session_id <> p_stripe_session_id then
    return jsonb_build_object('ok', false, 'reason', 'stripe_session_mismatch');
  end if;

  update public.christmas_order_upsells
  set
    status = 'paid',
    paid_at = coalesce(paid_at, now()),
    stripe_checkout_session_id = coalesce(nullif(trim(p_stripe_session_id), ''), stripe_checkout_session_id),
    stripe_payment_intent_id = coalesce(nullif(trim(p_stripe_payment_intent_id), ''), stripe_payment_intent_id),
    fulfillment_status = case
      when fulfillment_status in ('not_started', 'failed') then 'queued'
      else fulfillment_status
    end,
    last_error = null,
    metadata = metadata || jsonb_build_object(
      'last_stripe_event_id', nullif(trim(p_stripe_event_id), '')
    )
  where id = upsell_row.id
  returning * into upsell_row;

  return jsonb_build_object(
    'ok', true,
    'status', 'paid',
    'upsell_id', upsell_row.id,
    'parent_order_id', upsell_row.parent_order_id,
    'upsell_key', upsell_row.upsell_key,
    'package_key', upsell_row.package_key,
    'product_key', upsell_row.product_key,
    'fulfillment_status', upsell_row.fulfillment_status,
    'amount_cents', upsell_row.amount_cents,
    'currency', upsell_row.currency,
    'should_enqueue', true
  );
end;
$$;

revoke all on function public.fulfill_christmas_upsell_payment(uuid, text, text, integer, text, text)
  from anon, authenticated, public;
grant execute on function public.fulfill_christmas_upsell_payment(uuid, text, text, integer, text, text)
  to service_role;

commit;
