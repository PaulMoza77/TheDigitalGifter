import { describe, expect, it } from "vitest";
import {
  filterRecipes,
  formatMinutes,
  recipeCourse,
  recipeDifficulty,
  suggestMenu,
  type RecipeCatalogRow,
} from "./recipeCatalog";

function recipe(partial: Partial<RecipeCatalogRow>): RecipeCatalogRow {
  return {
    id: "1",
    title: "Citrus honey roasted carrots",
    description: "A bright side",
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

describe("recipe explorer filters", () => {
  it("filters by search, course, dietary, difficulty and prep", () => {
    const rows = [
      recipe({ id: "a" }),
      recipe({ id: "b", title: "Herb roast", category: "christmas_dinner", tags: ["christmas dinner"], prep_minutes: 20, cook_minutes: 75 }),
    ];
    expect(filterRecipes(rows, { query: "carrot" }).map((r) => r.id)).toEqual(["a"]);
    expect(filterRecipes(rows, { course: "side" }).every((r) => recipeCourse(r) === "side")).toBe(true);
    expect(filterRecipes(rows, { dietary: "vegetarian" })).toHaveLength(1);
    expect(recipeDifficulty(rows[0])).toBe("easy");
    expect(filterRecipes(rows, { maxPrepMinutes: 15 })).toHaveLength(1);
  });

  it("hides recipes that contain a selected allergen", () => {
    const rows = [recipe({ id: "n", ingredients: ["handful walnuts"] }), recipe({ id: "safe", ingredients: ["800g carrots"] })];
    expect(filterRecipes(rows, { allergen: "nuts" }).map((r) => r.id)).toEqual(["safe"]);
  });

  it("suggests a sit-down menu and formats time", () => {
    const rows = [
      recipe({ id: "main", title: "Roast", category: "christmas_dinner", course: "main", tags: ["christmas-dinner"] }),
      recipe({ id: "side", title: "Potatoes", category: "side_dishes", course: "side" }),
      recipe({ id: "dessert", title: "Pie", category: "desserts", course: "dessert" }),
      recipe({ id: "app", title: "Eggs", category: "easy", course: "appetizer" }),
    ];
    const menu = suggestMenu(rows, { guests: 12, sitting: "christmas_eve" });
    expect(menu.map((r) => r.id).sort()).toEqual(["app", "dessert", "main", "side"].sort());
    expect(formatMinutes(260)).toBe("4h 20m");
    const nutty = recipe({ id: "nuts", title: "Walnut tart", category: "desserts", course: "dessert", ingredients: ["handful walnuts"] });
    expect(suggestMenu([...rows, nutty], { guests: 8, sitting: "christmas_day", allergen: "nuts" }).map((r) => r.id)).not.toContain("nuts");
  });
});
