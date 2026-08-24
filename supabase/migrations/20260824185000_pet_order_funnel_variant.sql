-- Persist which pet funnel created an order so V2 $12 checkout
-- is never repriced to the V1 flash sale.

alter table public.pet_orders
  add column if not exists funnel_variant text not null default 'v1';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'pet_orders_funnel_variant_chk'
  ) then
    alter table public.pet_orders
      add constraint pet_orders_funnel_variant_chk
      check (funnel_variant in ('v1', 'v2'));
  end if;
end
$$;

comment on column public.pet_orders.funnel_variant is
  'v1 is /pet/dog checkout. v2 is /pet/dog-v2 and keeps its own $12 amount.';
