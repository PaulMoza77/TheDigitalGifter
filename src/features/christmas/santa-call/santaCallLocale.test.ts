import { describe, expect, it } from "vitest";
import { resolveSantaCallUiLanguage } from "./santaCallLocale";

describe("resolveSantaCallUiLanguage", () => {
  it("prefers ?lang= over path and navigator", () => {
    expect(
      resolveSantaCallUiLanguage({
        pathname: "/ro/christmas/santa-call",
        search: "?lang=en",
        navigatorLanguage: "ro-RO",
      }),
    ).toBe("en");
  });

  it("uses /ro/ path when query is absent even if browser is English", () => {
    expect(
      resolveSantaCallUiLanguage({
        pathname: "/ro/christmas/santa-call",
        search: "",
        navigatorLanguage: "en-US",
      }),
    ).toBe("ro");
  });

  it("uses /en/ path when query is absent", () => {
    expect(
      resolveSantaCallUiLanguage({
        pathname: "/en/christmas/santa-call",
        search: "",
        navigatorLanguage: "ro-RO",
      }),
    ).toBe("en");
  });

  it("falls back to navigator on unprefixed paths", () => {
    expect(
      resolveSantaCallUiLanguage({
        pathname: "/christmas/santa-call",
        search: "",
        navigatorLanguage: "en-GB",
      }),
    ).toBe("en");
    expect(
      resolveSantaCallUiLanguage({
        pathname: "/christmas/santa-call",
        search: "",
        navigatorLanguage: "ro-RO",
      }),
    ).toBe("ro");
  });

  it("defaults to RO when nothing is known", () => {
    expect(resolveSantaCallUiLanguage({})).toBe("ro");
  });
});
