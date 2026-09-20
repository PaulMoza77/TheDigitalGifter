-- Privileged helper so catalog JSON can be upserted in batches (MCP / operators).
create or replace function public.ingest_tdg_catalog_recipes(payload jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  insert into public.christmas_recipes (
    slug, title, description, ingredients, steps, servings, prep_minutes, cook_minutes,
    category, tags, entitlement_key, teaser, published,
    cuisine_country, cuisine_region, course, difficulty, dietary, allergens, notes, cost_band, cuisine
  )
  select
    r->>'slug',
    left(r->>'title', 120),
    r->>'description',
    coalesce(r->'ingredients', '[]'::jsonb),
    coalesce(r->'steps', '[]'::jsonb),
    (r->>'servings')::int,
    (r->>'prepMinutes')::int,
    (r->>'cookMinutes')::int,
    r->>'category',
    coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(r->'tags', '[]'::jsonb)) as t(x)), '{}'::text[]),
    coalesce(nullif(r->>'entitlementKey', ''), 'recipes'),
    coalesce((r->>'teaser')::boolean, false),
    true,
    r->>'country',
    nullif(r->>'region', ''),
    r->>'course',
    r->>'difficulty',
    coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(r->'dietary', '[]'::jsonb)) as t(x)), '{}'::text[]),
    coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(r->'allergens', '[]'::jsonb)) as t(x)), '{}'::text[]),
    coalesce(r->>'notes', ''),
    r->>'costBand',
    r->>'cuisine'
  from jsonb_array_elements(payload) as r
  on conflict (slug) do update set
    title = excluded.title,
    description = excluded.description,
    ingredients = excluded.ingredients,
    steps = excluded.steps,
    servings = excluded.servings,
    prep_minutes = excluded.prep_minutes,
    cook_minutes = excluded.cook_minutes,
    category = excluded.category,
    tags = excluded.tags,
    entitlement_key = excluded.entitlement_key,
    teaser = excluded.teaser,
    published = true,
    cuisine_country = excluded.cuisine_country,
    cuisine_region = excluded.cuisine_region,
    course = excluded.course,
    difficulty = excluded.difficulty,
    dietary = excluded.dietary,
    allergens = excluded.allergens,
    notes = excluded.notes,
    cost_band = excluded.cost_band,
    cuisine = excluded.cuisine,
    updated_at = now();
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.ingest_tdg_catalog_recipes(jsonb) from public;
grant execute on function public.ingest_tdg_catalog_recipes(jsonb) to service_role;
