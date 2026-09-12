import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  applyChristmasSeo,
  CHRISTMAS_SEO_ROUTES,
  getChristmasSeo,
  listChristmasSeoPaths,
  SITE_ORIGIN,
} from "../../../../server/christmasSeo.mjs";

const GENERIC = "TheDigitalGifter — Custom AI Holiday Cards & Memories";

describe("christmas SEO SSR registry", () => {
  it("covers every scoped Christmas route with unique titles", () => {
    const paths = listChristmasSeoPaths();
    expect(paths).toContain("/christmas");
    expect(paths).toContain("/christmas/send-a-gift");
    expect(paths).toContain("/christmas/family");
    expect(paths).toContain("/christmas/kids");
    expect(paths).toContain("/christmas-ai-photos");
    // P3B: includes EN registry paths + indexable localized prerender paths
    expect(paths.length).toBeGreaterThanOrEqual(CHRISTMAS_SEO_ROUTES.length);
    expect(paths).toContain("/de/christmas/cards");
    expect(paths).toContain("/ro/christmas");
    expect(paths).toContain("/ro/christmas/send-a-gift");
    expect(paths).toContain("/de/christmas/kids");

    const titles = CHRISTMAS_SEO_ROUTES.map((r) => r.title);
    expect(new Set(titles).size).toBe(titles.length);
    expect(titles).not.toContain(GENERIC);
  });

  it("injects route-specific HTML for crawlers", () => {
    const template = readFileSync(join(process.cwd(), "index.html"), "utf8");
    const html = applyChristmasSeo(template, "/christmas/family");
    expect(html).toContain("<title>Family Christmas Photo Generator | Christmas Family Portraits</title>");
    expect(html).toContain(`${SITE_ORIGIN}/christmas/family`);
    expect(html).toContain("Turn Your Family Photo Into a Magical Christmas Portrait");
    expect(html).toContain('href="/christmas/photo-generator"');
    expect(html).toContain("BreadcrumbList");
    expect(html).not.toContain(`<title>${GENERIC}</title>`);
  });

  it("marks paid photo funnel noindex while organic generator stays indexable", () => {
    const template = readFileSync(join(process.cwd(), "index.html"), "utf8");
    const organic = applyChristmasSeo(template, "/christmas/photo-generator");
    const paid = applyChristmasSeo(template, "/christmas-ai-photos");
    expect(organic).toMatch(/name="robots"[^>]+content="index,follow"/);
    expect(paid).toMatch(/name="robots"[^>]+content="noindex,follow"/);
    expect(getChristmasSeo("/christmas/gifts")).toBeNull();
  });

  it("ships kids as indexable privacy-first content", () => {
    const kids = getChristmasSeo("/christmas/kids");
    expect(kids?.noindex).not.toBe(true);
    const html = applyChristmasSeo(
      readFileSync(join(process.cwd(), "index.html"), "utf8"),
      "/christmas/kids",
    );
    expect(html).toMatch(/name="robots"[^>]+content="index,follow"/);
    expect(html).toContain("parent or guardian permission");
  });

  it("re-applying SEO onto a prerendered shell does not duplicate FAQ answers", () => {
    const template = readFileSync(join(process.cwd(), "index.html"), "utf8");
    const once = applyChristmasSeo(template, "/christmas");
    const twice = applyChristmasSeo(once, "/christmas");
    const questions = [...twice.matchAll(/<h3>([^<]+)<\/h3>/g)].map((m) => m[1]);
    expect(new Set(questions).size).toBe(questions.length);
    expect(questions).toContain("Is my family’s photo private?");
    expect(questions).toContain("How long does creating something take?");
    expect(twice).toContain("<article><h3>");
    expect(twice).not.toMatch(/<\/section><\/div><div><h3>/);
    expect(twice).not.toMatch(/<\/section><\/div><article><h3>/);
  });

  it("ships send-a-gift with its own canonical and localized SSR", () => {
    const template = readFileSync(join(process.cwd(), "index.html"), "utf8");
    const en = applyChristmasSeo(template, "/christmas/send-a-gift");
    expect(en).toContain("Send a Little Christmas Magic");
    expect(en).toContain(`${SITE_ORIGIN}/christmas/send-a-gift`);
    expect(en).toMatch(/name="robots"[^>]+content="index,follow"/);

    const ro = applyChristmasSeo(template, "/ro/christmas/send-a-gift");
    expect(ro).toContain("Trimite Puțină Magie de Crăciun");
    expect(ro).toContain(`${SITE_ORIGIN}/ro/christmas/send-a-gift`);
    expect(ro).toMatch(/name="robots"[^>]+content="index,follow"/);
  });
});
