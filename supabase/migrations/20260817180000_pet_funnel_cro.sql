-- Additive pet funnel CRO settings.
-- Delivery estimate is admin-configurable. Subtype is stored on other-pet orders.
-- Do not apply to production from this PR without a reviewed release.

alter table public.pet_offers
  add column if not exists delivery_estimate_label text not null default 'Usually ready within 24–48 hours';

alter table public.pet_orders
  add column if not exists subtype text,
  add column if not exists subtype_detail text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'pet_orders_subtype_chk'
  ) then
    alter table public.pet_orders
      add constraint pet_orders_subtype_chk
      check (
        subtype is null
        or subtype in ('rabbit', 'bird', 'small_pet', 'reptile', 'horse', 'other')
      );
  end if;
end
$$;

create or replace function public.get_public_pet_offer()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  offer_row public.pet_offers%rowtype;
begin
  select * into offer_row
  from public.pet_offers
  where active = true
    and sku = 'pet-secret-life-12'
    and subscription = false
  order by version desc
  limit 1;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'sku', offer_row.sku,
    'name', offer_row.name,
    'amountCents', offer_row.amount_cents,
    'currency', offer_row.currency,
    'imageCount', offer_row.image_count,
    'videoCount', offer_row.video_count,
    'subscription', false,
    'active', true,
    'version', offer_row.version,
    'deliveryEstimate', coalesce(offer_row.delivery_estimate_label, 'Usually ready within 24–48 hours')
  );
end;
$$;

grant execute on function public.get_public_pet_offer() to anon, authenticated, service_role;
