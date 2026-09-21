import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readSrc(rel: string) {
  return readFileSync(resolve(process.cwd(), rel), "utf8");
}

describe("homepage occasion grid", () => {
  it("renders catalog occasions immediately instead of waiting on skeletons", () => {
    const src = readSrc("src/domains/Landing/components/OccasionGrid.tsx");
    expect(src).toContain("useState<OccasionRow[]>(FALLBACK_OCCASIONS)");
    expect(src).not.toContain("rows === null");
    expect(src).not.toContain("h-64 bg-white/10");
    expect(src).toContain("abortSignal(controller.signal)");
    expect(src).toContain("Promise.allSettled");
  });
});
