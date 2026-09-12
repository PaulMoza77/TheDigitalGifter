import { describe, expect, it } from "vitest";
import { resolveGiftArtKey } from "./GiftFinderArt";

describe("resolveGiftArtKey", () => {
  it("maps TDG products to portrait art", () => {
    expect(
      resolveGiftArtKey({
        title: "Personalized Christmas Portrait",
        category: "digital",
        tdg_product_key: "christmas_photo",
      }),
    ).toBe("portrait");
  });

  it("maps title cues to illustrated motifs", () => {
    expect(resolveGiftArtKey({ title: "Indoor herb garden kit", category: "physical" })).toBe("garden");
    expect(resolveGiftArtKey({ title: "Pour-over coffee kit", category: "physical" })).toBe("coffee");
    expect(resolveGiftArtKey({ title: "Cozy throw blanket", category: "physical" })).toBe("cozy");
    expect(resolveGiftArtKey({ title: "Museum membership", category: "experience" })).toBe("experience");
  });
});
