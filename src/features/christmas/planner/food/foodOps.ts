import { supabase } from "@/lib/supabase";
import { planGroceryRegeneration } from "@/features/occasions/grocerySync";
import { CHRISTMAS_2026 } from "@/features/occasions/types";
import { ingredientsFromRecipe, invalidatePlannerSnapshot } from "../intelligence";
import { applyGroceryOps } from "./persistGrocery";
import type { RecipeCatalogRow } from "./recipeCatalog";

export const RECIPE_SELECT =
  "id,slug,title,description,teaser,entitlement_key,category,prep_minutes,cook_minutes,servings,image_path,ingredients,steps,tags,cuisine_country,cuisine_region,course,difficulty,dietary,allergens,notes";

export async function reloadGroceryDerived(profileId: string) {
  const [mealsRes, dishesRes, recipesRes, groceryRes] = await Promise.all([
    supabase.from("christmas_meals").select("id,section,title").eq("profile_id", profileId),
    supabase.from("christmas_meal_items").select("id,meal_id,recipe_id,dish_name,servings").eq("profile_id", profileId),
    supabase.from("christmas_recipes").select("id,title,servings,prep_minutes,cook_minutes,category,tags,ingredients").eq("published", true),
    supabase.from("christmas_grocery_items").select("id,name,quantity,status,source_type,meal_item_id,ingredient_key,source_notes").eq("profile_id", profileId),
  ]);
  const recipes = ((recipesRes.data || []) as Array<RecipeCatalogRow & { id: string }>).map((r) => ({
    id: r.id,
    title: r.title,
    servings: r.servings,
    prep_minutes: r.prep_minutes,
    cook_minutes: r.cook_minutes,
    category: r.category,
    tags: r.tags || [],
    ingredients: r.ingredients,
  }));
  const dishes = (dishesRes.data || []) as Array<{ id: string; meal_id: string; recipe_id: string | null; dish_name: string; servings: number }>;
  const derived = dishes.flatMap((dish) => {
    if (!dish.recipe_id) return [];
    const recipe = recipes.find((r) => r.id === dish.recipe_id);
    if (!recipe) return [];
    return ingredientsFromRecipe(recipe, dish.servings).map((item) => ({
      key: item.key,
      name: item.name,
      aisle: item.aisle,
      displayQuantity: item.displayQuantity,
      status: "need" as const,
      persistedId: null,
      derived: true,
      sources: item.sources,
    }));
  });
  const stored = (groceryRes.data || []) as Array<{
    id: string;
    name: string;
    quantity: string;
    status: "have" | "need" | "bought";
    source_type: string;
    meal_item_id: string | null;
    ingredient_key?: string | null;
  }>;
  const plan = planGroceryRegeneration({ derived, stored, occasion: CHRISTMAS_2026 });
  await applyGroceryOps(profileId, plan.ops);
  invalidatePlannerSnapshot(profileId);
}
