import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { pickIdeasForTable, suggestMenu, type RecipeCatalogRow } from "./recipeCatalog";
import { dietFromGuestNotes, recipePhoto, suggestInputFromDiet } from "./mealVisuals";

function readSrc(rel: string) {
  return readFileSync(resolve(process.cwd(), rel), "utf8");
}

function recipe(partial: Partial<RecipeCatalogRow>): RecipeCatalogRow {
  return {
    id: "1",
    title: "Citrus honey roasted carrots",
    description: "A bright side for the Christmas table with honey and thyme.",
    teaser: true,
    entitlement_key: "free",
    category: "side_dishes",
    tags: ["easy", "vegetarian"],
    prep_minutes: 10,
    cook_minutes: 30,
    servings: 6,
    image_path: null,
    ingredients: ["800g carrots", "2 tbsp honey"],
    ...partial,
  };
}

describe("meals page visual contract", () => {
  it("rebuilds the real meals route with the reference copy and shared copilot", () => {
    const page = readSrc("src/features/christmas/planner/food/MealsPage.tsx");
    const visuals = readSrc("src/features/christmas/planner/food/mealVisuals.ts");
    const css = readSrc("src/features/christmas/planner/plannerApp.css");
    const food = readSrc("src/features/christmas/planner/food/FoodPages.tsx");
    expect(food).toContain('export { ChristmasPlannerFoodPage } from "./MealsPage"');
    expect(page).toContain("Plan every festive table, from breakfast to the big Christmas dinner.");
    expect(page).toContain("Your Christmas feast");
    expect(page).toContain("A beautiful menu, planned around your people.");
    expect(page).toContain("Build my menu");
    expect(page).toContain("Your Christmas menu");
    expect(visuals).toContain("Christmas Eve");
    expect(visuals).toContain("Christmas Day");
    expect(visuals).toContain("Christmas Breakfast");
    expect(visuals).toContain("Custom meal");
    expect(visuals).toContain("Starter");
    expect(visuals).toContain("Main");
    expect(visuals).toContain("Sides");
    expect(visuals).toContain("Dessert");
    expect(page).toContain("Ideas picked for your table");
    expect(page).toContain("View all recipes");
    expect(page).toContain("Dietary notes");
    expect(visuals).toContain("No restrictions");
    expect(visuals).toContain("Vegetarian");
    expect(visuals).toContain("Gluten-free");
    expect(visuals).toContain("Nut-free");
    expect(page).toContain("Manage guests");
    expect(page).toContain("Let Christmas Copilot create the first draft");
    expect(page).toContain("Tell us your preferences and we’ll build a balanced menu.");
    expect(page).toContain("Suggest my full menu");
    expect(page).toContain("Not calculated");
    expect(page).toContain("useCopilotUi");
    expect(page).toContain("pickIdeasForTable");
    expect(page).toContain("MEAL_HERO_SRC");
    expect(visuals).toContain("/christmas/planner/dinner-table.webp");
    expect(page).not.toContain("Herb-butter roast turkey");
    expect(page).not.toContain("avatar");
    expect(css).toContain(".tdg-meals-hero");
    expect(css).toContain("border-radius: 20px");
    expect(css).not.toContain('content: "🍽️"');
  });

  it("keeps paywall, grocery and recipe persistence on the real meals page", () => {
    const page = readSrc("src/features/christmas/planner/food/MealsPage.tsx");
    expect(page).toContain("PlannerLoading");
    expect(page).toContain('if (!hasFeature(access, "food_planner"))');
    expect(page).toContain("Get my Christmas Planner");
    expect(page).toContain("christmas_meals");
    expect(page).toContain("christmas_meal_items");
    expect(page).toContain("christmas_recipe_saves");
    expect(page).toContain("reloadGroceryDerived");
    expect(page).toContain('to="/account/christmas/grocery"');
    expect(page).toContain('to="/account/christmas/recipes"');
    expect(page).toContain('to="/account/christmas/hosting"');
  });
});

describe("meals helpers stay truthful", () => {
  it("maps guest notes onto existing diet chips without inventing a backend", () => {
    expect(dietFromGuestNotes([])).toBe("all");
    expect(dietFromGuestNotes(["Vegetarian"])).toBe("vegetarian");
    expect(dietFromGuestNotes(["gluten free"])).toBe("gluten-free");
    expect(dietFromGuestNotes(["nut allergy"])).toBe("nut-free");
    expect(dietFromGuestNotes(["vegetarian", "nuts"])).toBe("all");
    expect(suggestInputFromDiet("nut-free")).toEqual({ dietary: "all", allergen: "nuts" });
  });

  it("picks three real catalogue recipes and never invents titles", () => {
    const rows = [
      recipe({ id: "main", title: "Roast", category: "christmas_dinner", course: "main" }),
      recipe({ id: "dessert", title: "Pie", category: "desserts", course: "dessert" }),
      recipe({ id: "app", title: "Eggs", category: "easy", course: "appetizer" }),
      recipe({ id: "side", title: "Potatoes", category: "side_dishes", course: "side" }),
    ];
    const ideas = pickIdeasForTable(rows, { excludeIds: new Set(["main"]) });
    expect(ideas).toHaveLength(3);
    expect(ideas.map((r) => r.id)).not.toContain("main");
    expect(suggestMenu(rows, { guests: 8, sitting: "christmas_day", allergen: "nuts" }).length).toBeGreaterThan(0);
    expect(recipePhoto(rows[0], "main")).toContain("dinner-table.webp");
    expect(pickIdeasForTable([], {})).toEqual([]);
  });
});
