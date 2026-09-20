-- Founding Pass offer + grocery/recipe additive columns.
-- Does not rename christmas_* tables. Checkout stays off (product metadata checkout_live).

begin;

alter table public.christmas_recipes
  add column if not exists cuisine_country text,
  add column if not exists cuisine_region text,
  add column if not exists course text,
  add column if not exists difficulty text,
  add column if not exists dietary text[] not null default '{}',
  add column if not exists allergens text[] not null default '{}';

alter table public.christmas_grocery_items
  add column if not exists ingredient_key text,
  add column if not exists source_recipe_id uuid references public.christmas_recipes (id) on delete set null;

create unique index if not exists christmas_grocery_items_profile_key_uidx
  on public.christmas_grocery_items (profile_id, ingredient_key)
  where ingredient_key is not null;

alter table public.christmas_meals
  add column if not exists guest_count integer;

insert into public.christmas_packages (
  product_id, package_key, package_name, description,
  currency, price_cents, compare_at_cents, active, purchasable, features, sort_order, metadata
)
select p.id,
  'founding_pass',
  'Christmas 2026 Founding Pass',
  'One-time access to the full Christmas Planner: tasks, calendar, budget, gifts, Gift Finder, recipes, meals, smart grocery, and Christmas Studio member benefits where economics allow.',
  'usd', 1700, 4900, true, true,
  '["Planner","Tasks and calendar","Budget","Gift Planner","Gift Finder","Recipes","Meal Planner","Smart Grocery List","Christmas Studio member benefit where economically valid"]'::jsonb,
  1,
  '{"kind":"package","tier":"founding_pass","highlight":true,"badge":"$17 Founding Pass","publicOffer":true,"launchOffer":true}'::jsonb
from public.christmas_products p
where p.product_key = 'christmas_planner_2026'
on conflict (product_id, package_key) do update
set
  package_name = excluded.package_name,
  description = excluded.description,
  price_cents = excluded.price_cents,
  compare_at_cents = excluded.compare_at_cents,
  features = excluded.features,
  sort_order = excluded.sort_order,
  metadata = coalesce(public.christmas_packages.metadata, '{}'::jsonb) || excluded.metadata,
  updated_at = now();

update public.christmas_packages pkg
set metadata = coalesce(pkg.metadata, '{}'::jsonb) || jsonb_build_object('publicOffer', false),
    updated_at = now()
from public.christmas_products p
where pkg.product_id = p.id
  and p.product_key = 'christmas_planner_2026'
  and pkg.package_key in ('essentials', 'magic', 'all_in');

update public.christmas_recipes
set
  cuisine_country = coalesce(cuisine_country, 'international'),
  course = coalesce(
    course,
    case category
      when 'christmas_dinner' then 'main'
      when 'side_dishes' then 'side'
      when 'desserts' then 'dessert'
      when 'cookies' then 'dessert'
      when 'drinks' then 'drink'
      when 'breakfast' then 'breakfast'
      else 'other'
    end
  ),
  difficulty = coalesce(difficulty, case when 'easy' = any(tags) then 'easy' else 'medium' end)
where published = true;

commit;
