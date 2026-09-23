import { supabase } from "@/lib/supabase";
import type { RecipeCatalogRow } from "./recipeCatalog";

/** List cards and menu suggestions. Ingredients and steps load when a recipe is opened or cooked into a grocery list. */
export const RECIPE_LIST_SELECT =
  "id,slug,title,description,teaser,entitlement_key,category,prep_minutes,cook_minutes,servings,image_path,tags,cuisine_country,cuisine_region,course,difficulty,dietary,allergens,notes";

const LIST_TTL_MS = 5 * 60_000;
let listCache: { at: number; rows: RecipeCatalogRow[] } | null = null;
let listFlight: Promise<RecipeCatalogRow[]> | null = null;
const bodies = new Map<string, { ingredients: unknown; steps: unknown }>();

export function loadPublishedRecipeList(): Promise<RecipeCatalogRow[]> {
  if (listCache && Date.now() - listCache.at < LIST_TTL_MS) return Promise.resolve(listCache.rows);
  if (listFlight) return listFlight;
  const request = supabase.from("christmas_recipes").select(RECIPE_LIST_SELECT).eq("published", true);
  listFlight = Promise.resolve(request)
    .then(({ data, error }) => {
      if (error) throw new Error(error.message);
      const rows = ((data as RecipeCatalogRow[]) || []).map((row) => ({ ...row, tags: row.tags || [] }));
      listCache = { at: Date.now(), rows };
      return rows;
    })
    .finally(() => {
      listFlight = null;
    });
  return listFlight;
}

export function recipeBody(id: string) {
  return bodies.get(id);
}

export function mergeRecipeBody(recipe: RecipeCatalogRow): RecipeCatalogRow {
  const body = bodies.get(recipe.id);
  if (!body) return recipe;
  return { ...recipe, ingredients: body.ingredients, steps: body.steps };
}

export async function loadRecipeBodies(ids: string[]): Promise<void> {
  const missing = [...new Set(ids.filter(Boolean))].filter((id) => !bodies.has(id));
  if (!missing.length) return;
  const { data, error } = await supabase.from("christmas_recipes").select("id,ingredients,steps").in("id", missing);
  if (error) throw new Error(error.message);
  for (const row of (data || []) as Array<{ id: string; ingredients: unknown; steps: unknown }>) {
    bodies.set(row.id, { ingredients: row.ingredients, steps: row.steps });
  }
}
