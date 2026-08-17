import { describe, expect, it } from "vitest";
import { printPackEligibility, PRINT_DPI } from "./upsells";

describe("printPackEligibility", () => {
  it("requires known dimensions", () => {
    expect(printPackEligibility(null, null).eligible).toBe(false);
  });

  it("allows 5x7 at 150 DPI for a typical portrait", () => {
    const result = printPackEligibility(1024, 1365);
    expect(result.eligible).toBe(true);
    expect(result.maxSizeLabel).toBe("5×7″");
    expect(result.width).toBe(1024);
    expect(result.height).toBe(1365);
  });

  it("allows 8x10 when pixels are large enough", () => {
    const result = printPackEligibility(1200, 1500);
    expect(result.eligible).toBe(true);
    expect(result.maxSizeLabel).toBe("8×10″");
  });

  it("rejects tiny exports with an honest reason", () => {
    const result = printPackEligibility(512, 640);
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain(String(PRINT_DPI));
  });
});
