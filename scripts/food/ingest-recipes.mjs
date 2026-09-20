import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

function sqlLiteral(value) {
  if (value == null) return "null";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlArray(values) {
  if (!values?.length) return `'{}'::text[]`;
  return `ARRAY[${values.map((v) => sqlLiteral(v)).join(", ")}]::text[]`;
}

export function recipesToUpsertSql(recipes) {
  const values = recipes.map((recipe) => {
    const ingredients = sqlLiteral(JSON.stringify(recipe.ingredients));
    const steps = sqlLiteral(JSON.stringify(recipe.steps));
    const tags = sqlArray(recipe.tags);
    const dietary = sqlArray(recipe.dietary);
    const allergens = sqlArray(recipe.allergens);
    return `(${[
      sqlLiteral(recipe.slug),
      sqlLiteral(recipe.title.slice(0, 120)),
      sqlLiteral(recipe.description),
      ingredients,
      steps,
      recipe.servings,
      recipe.prepMinutes,
      recipe.cookMinutes,
      sqlLiteral(recipe.category),
      tags,
      sqlLiteral(recipe.entitlementKey),
      recipe.teaser,
      true,
      sqlLiteral(recipe.country),
      sqlLiteral(recipe.region || null),
      sqlLiteral(recipe.course),
      sqlLiteral(recipe.difficulty),
      dietary,
      allergens,
      sqlLiteral(recipe.notes || ""),
      sqlLiteral(recipe.costBand),
      sqlLiteral(recipe.cuisine),
    ].join(", ")})`;
  });
  return `insert into public.christmas_recipes (
  slug, title, description, ingredients, steps, servings, prep_minutes, cook_minutes,
  category, tags, entitlement_key, teaser, published,
  cuisine_country, cuisine_region, course, difficulty, dietary, allergens, notes, cost_band, cuisine
) values
${values.join(",\n")}
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
  updated_at = now();`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const recipes = JSON.parse(readFileSync(resolve(ROOT, "src/features/christmas/planner/food/catalog/tdg-recipes.json"), "utf8"));
  const chunk = Number(process.argv[2] || 0);
  const size = 25;
  const slice = recipes.slice(chunk * size, chunk * size + size);
  if (!slice.length) {
    console.log("-- empty chunk");
    process.exit(0);
  }
  process.stdout.write(recipesToUpsertSql(slice));
}
