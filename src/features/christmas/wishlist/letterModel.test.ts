import { describe, expect, it } from "vitest";
import {
  DEFAULT_LETTER,
  extractUrlFromWishText,
  parseLetterDescription,
  serializeLetterDescription,
  signatureFromTitle,
} from "./letterModel";

describe("letterModel", () => {
  it("round-trips letter framing in description", () => {
    const framing = {
      ...DEFAULT_LETTER,
      intro: "A cozy weekend in the mountains.",
      signature: "Paul",
    };
    const packed = serializeLetterDescription(framing);
    expect(packed.length).toBeLessThanOrEqual(500);
    const parsed = parseLetterDescription(packed);
    expect(parsed.salutation).toBe(framing.salutation);
    expect(parsed.intro).toBe(framing.intro);
    expect(parsed.closing).toBe(framing.closing);
    expect(parsed.signature).toBe("Paul");
  });

  it("treats legacy plain description as intro", () => {
    const parsed = parseLetterDescription("Thanks for making Christmas magical");
    expect(parsed.intro).toContain("Thanks for making Christmas magical");
    expect(parsed.salutation).toBe(DEFAULT_LETTER.salutation);
  });

  it("extracts urls from wish text", () => {
    const hit = extractUrlFromWishText("Sony headphones https://example.com/sony");
    expect(hit.url).toBe("https://example.com/sony");
    expect(hit.title).toBe("Sony headphones");
  });

  it("guesses signature from titled wishlist", () => {
    expect(signatureFromTitle("Paul’s Christmas Wishlist")).toBe("Paul");
    expect(signatureFromTitle("My Christmas Wishlist")).toBe("");
  });
});
