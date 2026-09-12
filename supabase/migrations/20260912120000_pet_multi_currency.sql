-- Allow pet funnel presentment currencies beyond USD (EUR, RON, HUF, PLN, GBP).
-- Stripe charges the order currency; amounts stay server-owned.

alter table public.pet_orders
  drop constraint if exists pet_orders_currency_chk;

alter table public.pet_orders
  add constraint pet_orders_currency_chk
  check (currency in ('usd', 'eur', 'ron', 'huf', 'pln', 'gbp'));

alter table public.pet_offers
  drop constraint if exists pet_offers_currency_chk;

alter table public.pet_offers
  add constraint pet_offers_currency_chk
  check (currency in ('usd', 'eur', 'ron', 'huf', 'pln', 'gbp'));
