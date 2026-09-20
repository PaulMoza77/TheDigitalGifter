import type { OccasionContext } from "./types";
import { occasionScope } from "./types";

/** Christmas 2026 physical tables. Later occasions get generic tables; do not rename these. */
export const CHRISTMAS_FOOD_TABLES = {
  recipes: "christmas_recipes",
  recipeSaves: "christmas_recipe_saves",
  meals: "christmas_meals",
  mealItems: "christmas_meal_items",
  groceryItems: "christmas_grocery_items",
  guests: "christmas_guests",
} as const;

export function foodTablesForOccasion(input?: Partial<OccasionContext> | null) {
  const occasion = occasionScope(input);
  if (occasion.key === "christmas") return CHRISTMAS_FOOD_TABLES;
  // Future: generic occasion_* tables. Until then, Christmas tables remain the only production store.
  return CHRISTMAS_FOOD_TABLES;
}

export function occasionMealSection(
  section: string,
  input?: Partial<OccasionContext> | null,
): string {
  const occasion = occasionScope(input);
  if (occasion.key !== "christmas") {
    if (section === "christmas_eve" || section === "christmas_day") return "other";
  }
  return section;
}
