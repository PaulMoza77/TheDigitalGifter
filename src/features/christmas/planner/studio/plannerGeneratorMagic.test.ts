import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { PLANNER_GENERATOR_HREF } from "./PlannerGeneratorMagic";

function readSrc(rel: string) {
  return readFileSync(resolve(process.cwd(), rel), "utf8");
}

describe("planner generator discovery", () => {
  it("reuses the existing authenticated generator hub", () => {
    expect(PLANNER_GENERATOR_HREF).toBe("/generator?occasion=christmas");
    const app = readSrc("src/App.tsx");
    expect(app).toContain('<Route path="/generator" element={<GeneratorPage />} />');
    expect(app).not.toContain('path="/account/christmas/generator"');
    const card = readSrc("src/features/christmas/planner/studio/PlannerGeneratorMagic.tsx");
    expect(card).toContain("Create Christmas magic");
    expect(card).toContain("Create a memory →");
    expect(card).toContain("Start creating →");
    expect(card).not.toContain("Generate image");
    expect(card).not.toContain("AI Image Studio");
    const layout = readSrc("src/features/christmas/planner/ChristmasPlannerLayout.tsx");
    expect(layout).toContain("PlannerGeneratorMagicCard");
    const foot = layout.slice(layout.indexOf("tdg-planner-side-foot"));
    expect(foot.indexOf("PlannerGeneratorMagicCard")).toBeLessThan(foot.indexOf("AI Copilot"));
    const more = readSrc("src/features/christmas/planner/ChristmasPlannerPages.tsx");
    expect(more).toContain('<PlannerGeneratorMagicCard variant="more" />');
    const nav = readSrc("src/features/christmas/planner/ChristmasPlannerLayout.tsx");
    expect(nav).not.toContain('label: "Generator"');
    expect(nav.match(/tdg-planner-nav[\s\S]*?<\/nav>/)?.[0]).not.toContain("Create Christmas");
  });

  it("does not duplicate credits, Stripe, or generation logic", () => {
    const card = readSrc("src/features/christmas/planner/studio/PlannerGeneratorMagic.tsx");
    expect(card).not.toContain("stripe");
    expect(card).not.toContain("credits_ledger");
    expect(card).not.toContain("generate-nano-banana");
    expect(card).toContain("to={PLANNER_GENERATOR_HREF}");
  });
});
