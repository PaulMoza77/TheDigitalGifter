import { describe, expect, it } from "vitest";
import {
  christmasDeliveryEmailCopy,
  normalizeChristmasLocale,
  productName,
  resolveChristmasLocale,
  t,
} from "./index";
import { accountChristmasLinks } from "../accountChristmas";
import { CHRISTMAS_CATALOG_SEED } from "../catalog";

describe("christmas i18n", () => {
  it("resolves EN and RO from query / storage / navigator", () => {
    expect(resolveChristmasLocale({ search: "?lang=ro" })).toBe("ro");
    expect(resolveChristmasLocale({ search: "?lang=en" })).toBe("en");
    expect(resolveChristmasLocale({ search: "", stored: "ro" })).toBe("ro");
    expect(
      resolveChristmasLocale({
        search: "",
        stored: null,
        navigatorLanguage: "ro-RO",
      }),
    ).toBe("ro");
    expect(
      resolveChristmasLocale({
        search: "",
        stored: null,
        navigatorLanguage: "en-US",
      }),
    ).toBe("en");
    expect(normalizeChristmasLocale("xx")).toBe("en");
  });

  it("falls back to EN for missing keys without throwing", () => {
    expect(t("en", "account.heading")).toBe("My Christmas");
    expect(t("ro", "account.heading")).toBe("Crăciunul meu");
    expect(t("ro", "does.not.exist.as.key")).toBe("does.not.exist.as.key");
    expect(t("en", "hub.petSpeciesHint", { dogs: "Dogs", cats: "Cats" })).toContain(
      "Dogs",
    );
  });

  it("localizes account christmas product labels", () => {
    const links = accountChristmasLinks(CHRISTMAS_CATALOG_SEED);
    const photo = links.find((l) => l.productKey === "christmas_photo");
    expect(photo).toBeTruthy();
    expect(productName("en", "christmas_photo", photo!.title)).toMatch(/Photo/i);
    expect(productName("ro", "christmas_photo", photo!.title)).toMatch(/poze|Crăciun/i);
  });

  it("builds EN and RO delivery email copy without cross-locale leakage", () => {
    const en = christmasDeliveryEmailCopy("en", {
      packKey: "starter",
      packName: "Starter Pack",
      imageCount: 3,
      videoCount: 0,
    });
    const ro = christmasDeliveryEmailCopy("ro", {
      packKey: "starter",
      packName: "Starter Pack",
      imageCount: 3,
      videoCount: 0,
    });
    expect(en.subject).toMatch(/ready/i);
    expect(ro.subject).toMatch(/gata/i);
    expect(en.cta).not.toBe(ro.cta);
    expect(en.body).toContain("3");
    expect(ro.body).toContain("3");
  });
});
