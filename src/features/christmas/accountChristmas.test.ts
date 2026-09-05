import { describe, expect, it } from "vitest";
import { CHRISTMAS_CATALOG_SEED } from "./catalog";
import {
  ACCOUNT_CHRISTMAS_KIDS_NOTE,
  accountChristmasLinks,
} from "./accountChristmas";

describe("account Christmas hub", () => {
  it("lists live suite links and never includes send-a-gift", () => {
    const links = accountChristmasLinks(CHRISTMAS_CATALOG_SEED);
    expect(links.length).toBeGreaterThanOrEqual(8);
    expect(links.every((l) => l.to.startsWith("/christmas"))).toBe(true);
    expect(links.some((l) => l.to.includes("send-a-gift"))).toBe(false);
    expect(links.some((l) => l.productKey === "christmas_photo")).toBe(true);
    expect(links.some((l) => l.productKey === "christmas_card")).toBe(true);
    expect(ACCOUNT_CHRISTMAS_KIDS_NOTE.toLowerCase()).toContain("privacy");
  });
});
