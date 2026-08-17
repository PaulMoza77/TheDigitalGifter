-- Customer copy: Replicate starts immediately. Do not advertise 24-48 hour waits.

update public.pet_offers
set delivery_estimate_label = 'Usually ready in a few minutes after payment'
where delivery_estimate_label ~* '24';

alter table public.pet_offers
  alter column delivery_estimate_label set default 'Usually ready in a few minutes after payment';

create or replace function public.get_public_pet_offer()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  offer_row public.pet_offers%rowtype;
  estimate text;
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

  estimate := coalesce(offer_row.delivery_estimate_label, 'Usually ready in a few minutes after payment');
  if estimate ~* '24' then
    estimate := 'Usually ready in a few minutes after payment';
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
    'deliveryEstimate', estimate
  );
end;
$$;
