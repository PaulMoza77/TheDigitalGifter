-- Canonical Christmas Planner commerce: one product key, one entitlement store.
-- Keeps V1 christmas_planner row for historical orders but disables purchase.
-- Access continues via get_christmas_planner_access() → user_entitlements (180000).

begin;

-- Supersede V1 product key seeded by 20260917120000.
update public.christmas_products
set
  active = false,
  public_discoverable = false,
  metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
    'superseded_by', 'christmas_planner_2026',
    'canonical', false,
    'live_offer', false,
    'checkout_live', false
  ),
  updated_at = now()
where product_key = 'christmas_planner';

update public.christmas_packages pkg
set
  active = false,
  purchasable = false,
  updated_at = now()
from public.christmas_products p
where pkg.product_id = p.id
  and p.product_key = 'christmas_planner';

-- Ensure canonical 2026 product is the discoverable Planner offer (checkout still gated in app).
update public.christmas_products
set
  active = true,
  public_discoverable = true,
  metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
    'product_family', 'christmas_planner',
    'canonical', true,
    'season_year', 2026,
    'checkout_live', false,
    'live_offer', false
  ),
  updated_at = now()
where product_key = 'christmas_planner_2026';

-- Do not drop christmas_feature_grants · unused by canonical grant path but safe to retain.
-- Single-arg grant_christmas_planner_entitlements(uuid) remains for emergency/legacy only.

commit;
