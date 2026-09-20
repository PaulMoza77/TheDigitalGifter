-- Lock Christmas 2026 Founding Pass to $17.00 USD one-time.
-- Hide legacy planner packages from purchase. Checkout remains gated by env/flags.

begin;

update public.christmas_packages pkg
set
  package_name = 'Christmas 2026 Founding Pass',
  currency = 'usd',
  price_cents = 1700,
  compare_at_cents = 4900,
  active = true,
  purchasable = true,
  metadata = coalesce(pkg.metadata, '{}'::jsonb) || jsonb_build_object(
    'kind', 'package',
    'tier', 'founding_pass',
    'highlight', true,
    'badge', '$17 Founding Pass',
    'publicOffer', true,
    'launchOffer', true
  ),
  updated_at = now()
from public.christmas_products p
where pkg.product_id = p.id
  and p.product_key = 'christmas_planner_2026'
  and pkg.package_key = 'founding_pass';

update public.christmas_packages pkg
set
  purchasable = false,
  metadata = coalesce(pkg.metadata, '{}'::jsonb) || jsonb_build_object('publicOffer', false),
  updated_at = now()
from public.christmas_products p
where pkg.product_id = p.id
  and p.product_key = 'christmas_planner_2026'
  and pkg.package_key in ('essentials', 'magic', 'all_in');

commit;
