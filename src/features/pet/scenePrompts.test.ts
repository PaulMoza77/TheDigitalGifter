import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const scenesSrc = readFileSync(
  resolve(process.cwd(), "supabase/functions/_shared/pet/scenes.ts"),
  "utf8",
);

describe("pet scene prompts", () => {
  it("locks identity and uses edit-style instructions for Kontext", () => {
    expect(scenesSrc).toContain("authoritative identity reference");
    expect(scenesSrc).toContain("Do not swap breeds");
    expect(scenesSrc).toContain("visor open");
    expect(scenesSrc).toContain("Change only background, clothing, props, and lighting");
    expect(scenesSrc).toContain("no human driver");
    expect(scenesSrc).not.toContain("Formal original court portrait of this exact pet");
  });

  it("keeps helmet scenes face-visible", () => {
    expect(scenesSrc).toContain("helmet visor open");
    expect(scenesSrc).toContain("visor raised");
  });
});
