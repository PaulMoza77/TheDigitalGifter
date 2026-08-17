import { describe, expect, it } from "vitest";
import { portraitFileName } from "./shareDownload";

describe("pet portrait share/download helpers", () => {
  it("builds a safe download filename from pet and scene names", () => {
    expect(portraitFileName("Akira", "Royal portrait")).toBe("akira-royal-portrait.jpg");
    expect(portraitFileName("Maple!!", "Head chef")).toBe("maple-head-chef.jpg");
  });
});
