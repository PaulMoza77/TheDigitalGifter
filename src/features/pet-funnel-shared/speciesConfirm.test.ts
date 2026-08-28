import { describe, expect, it } from "vitest";
import {
  canGenerateWithSpeciesConfirm,
  speciesConfirmLabel,
  speciesConfirmRequiredError,
} from "./speciesConfirm";

describe("speciesConfirm", () => {
  it("blocks generation until the funnel species is confirmed", () => {
    expect(
      canGenerateWithSpeciesConfirm({ hasPhoto: true, confirmed: false, kind: "cat" }),
    ).toEqual({
      ok: false,
      message: speciesConfirmRequiredError("cat"),
    });
    expect(
      canGenerateWithSpeciesConfirm({ hasPhoto: true, confirmed: true, kind: "cat" }),
    ).toEqual({ ok: true });
  });

  it("uses species-specific confirmation copy", () => {
    expect(speciesConfirmLabel("dog")).toMatch(/my dog/i);
    expect(speciesConfirmLabel("cat")).toMatch(/my cat/i);
    expect(speciesConfirmLabel("dog")).toMatch(/not a cat/i);
    expect(speciesConfirmLabel("cat")).toMatch(/not a dog/i);
  });
});
