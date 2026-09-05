-- Christmas Gift Tree: idempotent credit grants + product catalog row
-- Additive. Durable claims reuse christmas_reward_entitlements (source=christmas_tree).

begin;

create unique index if not exists credits_ledger_christmas_gift_tree_note_uidx
  on public.credits_ledger (note)
  where note like 'christmas_gift_tree:%';

insert into public.christmas_products (
  product_key, slug, product_type, name, description, active, public_discoverable,
  sort_order, route_path, locale_default, metadata
)
values (
  'christmas_gift_tree',
  'gifts',
  'tree',
  'Get Your Christmas Gift',
  'Pick a present under the tree and reveal a Christmas reward.',
  true,
  true,
  75,
  '/christmas/gifts',
  'en',
  '{"gift_tree_v1":true,"live_offer":false}'::jsonb
)
on conflict (product_key) do update set
  name = excluded.name,
  description = excluded.description,
  route_path = excluded.route_path,
  metadata = coalesce(public.christmas_products.metadata, '{}'::jsonb) || excluded.metadata,
  updated_at = now();

insert into public.christmas_packages (
  product_id, package_key, package_name, description, currency, price_cents,
  compare_at_cents, active, purchasable, features, sort_order, locale_default, metadata
)
select p.id, v.package_key, v.package_name, v.description, 'usd', 0, null, true, false,
       v.features::jsonb, v.sort_order, 'en', '{"live_offer":false}'::jsonb
from public.christmas_products p
cross join (
  values
    ('open_another', 'Open Another Gift', 'Future paid extra gift — not purchasable yet.',
     '["1 extra gift opening"]', 10),
    ('open_five', 'Open 5 Gifts', 'Future gift bundle — not purchasable yet.',
     '["5 gift openings"]', 20)
) as v(package_key, package_name, description, features, sort_order)
where p.product_key = 'christmas_gift_tree'
on conflict do nothing;

comment on index public.credits_ledger_christmas_gift_tree_note_uidx is
  'Idempotent Gift Tree credit grants: note christmas_gift_tree:{year}:{user_id}';

commit;
