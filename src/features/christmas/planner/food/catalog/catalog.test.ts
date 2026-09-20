import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { validateCatalog, type CatalogRecipe } from "./validate";

describe("TDG recipe catalog", () => {
  it("validates the compiled production catalog without inflating counts", () => {
    const recipes = JSON.parse(
      readFileSync(resolve(process.cwd(), "src/features/christmas/planner/food/catalog/tdg-recipes.json"), "utf8"),
    ) as CatalogRecipe[];
    const report = validateCatalog(recipes);
    expect(report.issues.slice(0, 5)).toEqual([]);
    expect(report.ok).toBe(true);
    expect(report.count).toBe(recipes.length);
    expect(report.count).toBeGreaterThanOrEqual(390);
    expect(report.countries.length).toBeGreaterThanOrEqual(10);
    expect(new Set(recipes.map((r) => r.slug)).size).toBe(recipes.length);
  });
});
