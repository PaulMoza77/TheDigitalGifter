import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readSrc(rel: string) {
  return readFileSync(resolve(process.cwd(), rel), "utf8");
}

describe("planner visual language is shared from My Planner", () => {
  const css = readSrc("src/features/christmas/planner/plannerApp.css");
  const ui = readSrc("src/features/christmas/planner/plannerUi.tsx");
  const gate = readSrc("src/routes/ProtectedClientRoute.tsx");

  it("keeps the cream token set as the private-app source of truth", () => {
    expect(css).toContain("--planner-cream: #f7f1e8");
    expect(css).toContain("--planner-parchment: #f3eadc");
    expect(css).toContain("--planner-ink: #1c1612");
    expect(css).toContain("--planner-burgundy: #b5232e");
    expect(css).toContain("--planner-gold: #c4a574");
    expect(css).toContain("--planner-surface: #fffdf9");
    expect(css).toContain("--planner-radius: 16px");
  });

  it("exports shared primitives used across modules", () => {
    for (const name of [
      "PlannerLoading",
      "PlannerPage",
      "PlannerPageHeader",
      "PlannerButton",
      "PlannerField",
      "PlannerCard",
      "PlannerSeg",
      "PlannerSheet",
      "PlannerEmptyState",
      "PlannerErrorState",
    ]) {
      expect(ui).toContain(`export function ${name}`);
    }
  });

  it("does not keep Gifts as a second oversized mockup system", () => {
    expect(css).not.toContain("clamp(2.8rem, 4.4vw, 3.75rem)");
    expect(css).not.toContain("font-size: 2.85rem");
    expect(css).not.toMatch(/\.tdg-gifts-head h1 \{[\s\S]*?3\.75rem/);
    expect(css).toContain(".tdg-gifts-head h1");
    expect(css).toContain("clamp(2.05rem, 4.2vw, 3rem)");
  });

  it("does not use the dark recipe art gradient", () => {
    expect(css).not.toContain("linear-gradient(135deg, #143328, #c4a574 55%, #7a2430)");
  });

  it("uses cream loading for planner auth instead of a black flash", () => {
    expect(gate).toContain("Opening your Christmas…");
    expect(gate).toContain("#f7f1e8");
  });

  it("loads every planner module with PlannerLoading", () => {
    const files = [
      "src/features/christmas/planner/ChristmasPlannerPages.tsx",
      "src/features/christmas/planner/ChristmasPlannerMoreModules.tsx",
      "src/features/christmas/planner/food/FoodPages.tsx",
      "src/features/christmas/planner/BudgetPage.tsx",
      "src/features/christmas/planner/gifts/GiftsPage.tsx",
    ];
    for (const file of files) {
      expect(readSrc(file)).toContain("PlannerLoading");
    }
  });
});
