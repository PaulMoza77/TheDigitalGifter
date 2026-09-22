import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  christmasHtmlLang,
  christmasPathForLocale,
  detectBrowserChristmasLocale,
  isChristmasAppPath,
  normalizeChristmasUiLocale,
  planChristmasBrowserLocaleRedirect,
} from "./localeRouting";

describe("christmas browser locale detector", () => {
  it("detects browser languages in preference order", () => {
    expect(detectBrowserChristmasLocale(["ro-RO", "en-US"])).toBe("ro");
    expect(detectBrowserChristmasLocale(["de"])).toBe("de");
    expect(detectBrowserChristmasLocale(["pt-PT"])).toBe("pt");
    expect(detectBrowserChristmasLocale(["pt-BR"])).toBe("pt");
    expect(detectBrowserChristmasLocale(["sv-SE"])).toBe("en");
    expect(detectBrowserChristmasLocale(["hu"])).toBe("en");
  });

  it("normalizes locale tags and html lang", () => {
    expect(normalizeChristmasUiLocale("RO")).toBe("ro");
    expect(normalizeChristmasUiLocale("pt-PT")).toBe("pt");
    expect(normalizeChristmasUiLocale("xx")).toBe("en");
    expect(christmasHtmlLang("pt")).toBe("pt-PT");
    expect(christmasHtmlLang("ro")).toBe("ro");
  });

  it("recognizes Christmas app paths including locale prefixes", () => {
    expect(isChristmasAppPath("/christmas")).toBe(true);
    expect(isChristmasAppPath("/ro/christmas")).toBe(true);
    expect(isChristmasAppPath("/pet/dog-v2")).toBe(false);
  });
});

describe("christmas locale redirect planner", () => {
  it("applies a first-visit browser detection immediately", () => {
    expect(
      planChristmasBrowserLocaleRedirect({
        pathname: "/christmas",
        preference: null,
        autoAlreadyRan: false,
        detected: "ro",
      }),
    ).toEqual({ kind: "redirect", locale: "ro", path: "/ro/christmas" });
  });

  it("keeps English when the detector falls back", () => {
    expect(
      planChristmasBrowserLocaleRedirect({
        pathname: "/christmas",
        search: "?utm_source=ig",
        preference: null,
        autoAlreadyRan: false,
        detected: "en",
      }),
    ).toEqual({ kind: "stay", locale: "en" });
  });

  it("honors an explicit stored preference over the detector", () => {
    expect(
      planChristmasBrowserLocaleRedirect({
        pathname: "/christmas",
        preference: "de",
        autoAlreadyRan: true,
        detected: "ro",
      }),
    ).toEqual({ kind: "redirect", locale: "de", path: "/de/christmas" });
  });

  it("does not bounce away from a prefixed URL", () => {
    expect(
      planChristmasBrowserLocaleRedirect({
        pathname: "/fr/christmas",
        preference: "ro",
        autoAlreadyRan: true,
        detected: "ro",
      }),
    ).toEqual({ kind: "stay", locale: "fr" });
  });

  it("preserves a clean query string on the redirect", () => {
    expect(
      planChristmasBrowserLocaleRedirect({
        pathname: "/christmas/cards",
        search: "?theme=elegant",
        preference: null,
        autoAlreadyRan: false,
        detected: "it",
      }),
    ).toEqual({
      kind: "redirect",
      locale: "it",
      path: "/it/christmas/cards?theme=elegant",
    });
  });

  it("builds switcher destinations that apply the locale immediately", () => {
    expect(christmasPathForLocale("/christmas", "pl")).toBe("/pl/christmas");
    expect(christmasPathForLocale("/ro/christmas", "en")).toBe("/christmas");
  });
});

describe("christmas compact language switcher", () => {
  it("renders a compact select instead of wrapping native-name links", () => {
    const src = readFileSync(
      resolve(process.cwd(), "src/features/christmas/seo/ChristmasLanguageSwitcher.tsx"),
      "utf8",
    );
    expect(src).toContain("<select");
    expect(src).toContain("useChristmasBrowserLocaleRedirect");
    expect(src).toContain("writeChristmasLocalePreference");
    expect(src).not.toContain("flexWrap");
    expect(src).not.toContain("item.nativeName}</Link>");
  });
});
