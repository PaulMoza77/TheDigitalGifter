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
    expect(paths).toContain("/christmas/family");
    expect(paths).toContain("/christmas-ai-photos");
    expect(paths.length).toBe(CHRISTMAS_SEO_ROUTES.length);

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

  it("keeps kids noindex while still unique", () => {
    const kids = getChristmasSeo("/christmas/kids");
    expect(kids?.noindex).toBe(true);
    const html = applyChristmasSeo(
      readFileSync(join(process.cwd(), "index.html"), "utf8"),
      "/christmas/kids",
    );
    expect(html).toMatch(/name="robots"[^>]+content="noindex,follow"/);
  });
});
