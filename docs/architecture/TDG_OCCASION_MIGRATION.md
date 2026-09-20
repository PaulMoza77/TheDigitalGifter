# Occasion tables — migration path

Christmas 2026 ships on existing `christmas_*` tables. Do **not** rename them in a launch window.

`src/features/occasions/` is the domain seam. New Recipes / Meals / Grocery logic takes `OccasionContext` (`src/features/occasions/types.ts`). Persistence helpers in `src/features/occasions/persistence.ts` currently map Christmas to:

| Domain concept | Current table |
|---|---|
| Occasion workspace | `christmas_planner_profiles` (season_year + implicit christmas) |
| Recipes | `christmas_recipes` |
| Recipe saves | `christmas_recipe_saves` |
| Meals | `christmas_meals` |
| Meal items | `christmas_meal_items` |
| Grocery | `christmas_grocery_items` |

Later occasions (Thanksgiving, birthday, …) should add generic tables (`occasion_plans`, `recipes`, `meal_plans`, `meal_plan_items`, `grocery_lists`, `grocery_items`) and a dual-write or copy job. Christmas rows stay readable. Gift Concierge and affiliate providers stay occasion-agnostic.

Additive columns on Christmas tables (ingredient_key, recipe metadata) are allowed. Big-bang table renames are not.
