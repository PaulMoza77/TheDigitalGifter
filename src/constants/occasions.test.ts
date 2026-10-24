import { describe, expect, it } from "vitest";
import { occasionHref } from "./occasions";

describe("occasion destinations", () => {
  it("opens the Christmas generator with category filters from homepage cards", () => {
    expect(occasionHref("christmas")).toBe("/christmas/photo-generator");
    expect(occasionHref(" Christmas ")).toBe("/christmas/photo-generator");
  });

  it("preserves the other occasion and pet destinations", () => {
    expect(occasionHref("birthday")).toBe("/funnel/homepage/birthday");
    expect(occasionHref("wedding")).toBe("/funnel/homepage/wedding");
    expect(occasionHref("dogs")).toBe("/pet/dog");
    expect(occasionHref("pet-loss")).toBe("/pet-loss");
  });
});
