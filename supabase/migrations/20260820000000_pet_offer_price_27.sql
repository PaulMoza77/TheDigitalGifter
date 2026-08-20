-- Drop My Pet's Secret Life from $59 to $27.
-- Stripe Checkout uses pet_orders.amount_cents as line_items unit_amount,
-- which is snapshotted from the active pet_offers row at order creation.

alter table public.pet_orders
  alter column amount_cents set default 2700;

update public.pet_offers
set active = false
where sku = 'pet-secret-life-12'
  and active = true
  and amount_cents <> 2700;

insert into public.pet_offers (
  sku,
  name,
  amount_cents,
  currency,
  image_count,
  video_count,
  subscription,
  active,
  version,
  delivery_estimate_label
)
select
  'pet-secret-life-12',
  coalesce(
    (select name from public.pet_offers where sku = 'pet-secret-life-12' order by version desc limit 1),
    'My Pet’s Secret Life'
  ),
  2700,
  'usd',
  12,
  2,
  false,
  true,
  coalesce(
    (select max(version) from public.pet_offers where sku = 'pet-secret-life-12'),
    0
  ) + 1,
  coalesce(
    (
      select delivery_estimate_label
      from public.pet_offers
      where sku = 'pet-secret-life-12'
      order by version desc
      limit 1
    ),
    'Usually ready in a few minutes after payment'
  )
where not exists (
  select 1
  from public.pet_offers
  where sku = 'pet-secret-life-12'
    and active = true
    and amount_cents = 2700
);

-- Unpaid carts without an open Stripe session pick up the new price.
-- Paid orders and in-flight checkouts keep their snapshotted $59 amount.
update public.pet_orders
set
  amount_cents = 2700,
  charged_amount_cents = 2700
where paid_at is null
  and stripe_checkout_session_id is null
  and amount_cents = 5900
  and status in ('draft', 'awaiting_upload', 'awaiting_payment');

update public.email_templates
set html = replace(html, '$59 one-time payment', '$27 one-time payment')
where html like '%$59 one-time payment%';
