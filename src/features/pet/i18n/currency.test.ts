import { describe, expect, it } from "vitest";
import {
  currencyForPetLocale,
  detectBrowserPetCurrency,
  formatPetMoney,
  normalizePetCurrency,
  petV2CompareAmount,
  petV2SaleAmount,
} from "./currency";

describe("pet presentment currency", () => {
  it("maps locales and browser tags to presentment currencies", () => {
    expect(currencyForPetLocale("ro")).toBe("ron");
    expect(currencyForPetLocale("hu")).toBe("huf");
    expect(currencyForPetLocale("de")).toBe("eur");
    expect(currencyForPetLocale("en")).toBe("usd");
    expect(detectBrowserPetCurrency(["ro-RO", "en-US"])).toBe("ron");
    expect(detectBrowserPetCurrency(["hu-HU"])).toBe("huf");
    expect(detectBrowserPetCurrency(["de-DE"])).toBe("eur");
    expect(detectBrowserPetCurrency(["en-GB"])).toBe("gbp");
    expect(normalizePetCurrency("RON")).toBe("ron");
  });

  it("keeps fixed server-owned amounts per currency", () => {
    expect(petV2SaleAmount("usd")).toBe(299);
    expect(petV2SaleAmount("ron")).toBe(1499);
    expect(petV2SaleAmount("huf")).toBe(1190);
    expect(petV2CompareAmount("usd")).toBe(2700);
    expect(petV2CompareAmount("eur")).toBe(2499);
  });

  it("formats money with local symbols", () => {
    expect(formatPetMoney(299, "usd")).toMatch(/\$2\.99/);
    expect(formatPetMoney(299, "eur")).toMatch(/2[,.]99/);
    expect(formatPetMoney(1499, "ron")).toMatch(/14[,.]99/);
    expect(formatPetMoney(1190, "huf")).toMatch(/1[\s.]?190|1190/);
  });
});
