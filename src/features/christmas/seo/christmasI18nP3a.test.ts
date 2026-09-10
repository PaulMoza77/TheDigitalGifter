import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { applyChristmasSeo } from "../../../../server/christmasSeo.mjs";
import {
  buildChristmasHreflangAlternates,
  christmasPathForLocale,
  englishPrefixRedirectTarget,
  parseChristmasLocalePath,
} from "../../../../server/christmasI18n.mjs";
import {
  isChristmasLocaleSeoIndexable,
  listEnabledChristmasLocales,
} from "../../../../server/christmasLocale.mjs";
import {
  christmasSitemapPaths,
  getChristmasPermanentRedirectTarget,
  shouldNoindexChristmasPath,
} from "../../../../server/christmasIndexing.mjs";
import {
  christmasPathForLocale as clientPathForLocale,
  cleanChristmasSearchForLocaleSwitch,
  parseChristmasLocalePath as clientParse,
  type ChristmasLocaleCode,
} from "./localeRouting";

const template = () => readFileSync(join(process.cwd(), "index.html"), "utf8");

describe("christmas P3A i18n foundation", () => {
  it("uses Strategy A: English unprefixed, RO prefixed", () => {
    expect(christmasPathForLocale("/christmas/cards", "en")).toBe("/christmas/cards");
    expect(christmasPathForLocale("/christmas/cards", "ro")).toBe("/ro/christmas/cards");
    expect(englishPrefixRedirectTarget("/en/christmas/cards")).toBe("/christmas/cards");
    expect(getChristmasPermanentRedirectTarget("/en/christmas")).toBe("/christmas");
  });

  it("parses locale paths consistently on server and client", () => {
    const server = parseChristmasLocalePath("/ro/christmas/santa-video");
    const client = clientParse("/ro/christmas/santa-video");
    expect(server.locale).toBe("ro");
    expect(server.basePath).toBe("/christmas/santa-video");
    expect(client.locale).toBe("ro");
    expect(client.basePath).toBe("/christmas/santa-video");
    expect(clientPathForLocale("/ro/christmas/cards", "en")).toBe("/christmas/cards");
  });

  it("marks complete RO routes indexable including P3B expansions", () => {
    expect(isChristmasLocaleSeoIndexable("ro", "/christmas")).toBe(true);
    expect(isChristmasLocaleSeoIndexable("ro", "/christmas/cards")).toBe(true);
    expect(isChristmasLocaleSeoIndexable("ro", "/christmas/santa-video")).toBe(true);
    expect(isChristmasLocaleSeoIndexable("ro", "/christmas/gift-finder")).toBe(true);
    expect(shouldNoindexChristmasPath("/ro/christmas/gift-finder")).toBe(false);
    expect(shouldNoindexChristmasPath("/ro/christmas/cards")).toBe(false);
  });

  it("emits reciprocal hreflang + x-default for pilot cluster", () => {
    const alts = buildChristmasHreflangAlternates("/christmas/cards");
    const byLang = Object.fromEntries(alts.map((a) => [a.hreflang, a.href]));
    expect(byLang.en).toContain("/christmas/cards");
    expect(byLang.ro).toContain("/ro/christmas/cards");
    expect(byLang["x-default"]).toBe(byLang.en);
    expect(byLang.en).not.toContain("/en/");
  });

  it("SSR RO pilot pages self-canonicalize and localize raw HTML", () => {
    const html = applyChristmasSeo(template(), "/ro/christmas/santa-video");
    expect(html).toMatch(/lang="ro"/);
    expect(html).toContain('rel="canonical" href="https://www.thedigitalgifter.com/ro/christmas/santa-video"');
    expect(html).toMatch(/Video [Pp]ersonalizat de la Moș Crăciun/);
    expect(html).toContain("Ce este un video personalizat de la Moș Crăciun?");
    expect(html).toContain('hreflang="en"');
    expect(html).toContain('hreflang="ro"');
    expect(html).toContain('hreflang="x-default"');
    expect(html).toMatch(/name="robots"[^>]*content="index,follow"/);
  });

  it("does not emit hreflang for product-gated incomplete locale pages", () => {
    const html = applyChristmasSeo(template(), "/de/christmas/santa-video");
    expect(html).toMatch(/name="robots"[^>]*content="noindex,follow"/);
    expect(html).not.toMatch(/hreflang=/);
  });
  it("keeps English SSR cluster intact with RO alternate", () => {
    const html = applyChristmasSeo(template(), "/christmas/cards");
    expect(html).toContain('hreflang="ro"');
    expect(html).toContain("https://www.thedigitalgifter.com/ro/christmas/cards");
    expect(html).toContain('rel="canonical" href="https://www.thedigitalgifter.com/christmas/cards"');
  });

  it("includes complete RO paths in sitemap list", () => {
    const paths = christmasSitemapPaths();
    expect(paths).toContain("/christmas");
    expect(paths).toContain("/ro/christmas");
    expect(paths).toContain("/ro/christmas/cards");
    expect(paths).toContain("/ro/christmas/gift-finder");
    expect(paths).not.toContain("/en/christmas");
  });

  it("registers Wave 1 locales as enabled after P3B", () => {
    const enabled = listEnabledChristmasLocales().map((l) => l.code).sort();
    expect(enabled).toEqual(["de", "en", "es", "fr", "it", "nl", "pl", "pt", "ro"]);
  });

  it("language switcher mapping preserves conceptual Christmas routes", () => {
    const pairs: Array<[string, ChristmasLocaleCode, string]> = [
      ["/christmas", "ro", "/ro/christmas"],
      ["/christmas/santa-video", "ro", "/ro/christmas/santa-video"],
      ["/christmas/photo-generator", "ro", "/ro/christmas/photo-generator"],
      ["/christmas/wishlist", "ro", "/ro/christmas/wishlist"],
      ["/christmas/cards", "ro", "/ro/christmas/cards"],
      ["/christmas/family", "ro", "/ro/christmas/family"],
      ["/christmas/dogs", "ro", "/ro/christmas/dogs"],
      ["/christmas/advent", "ro", "/ro/christmas/advent"],
      ["/christmas/messages", "ro", "/ro/christmas/messages"],
      ["/ro/christmas/cards", "en", "/christmas/cards"],
      ["/ro/christmas/santa-video", "en", "/christmas/santa-video"],
    ];
    for (const [from, locale, expected] of pairs) {
      expect(clientPathForLocale(from, locale)).toBe(expected);
    }
  });

  it("strips private personalization from locale-switch search", () => {
    expect(cleanChristmasSearchForLocaleSwitch("?name=John&theme=elegant")).toBe("?theme=elegant");
    expect(cleanChristmasSearchForLocaleSwitch("?name=John")).toBe("");
  });
});
