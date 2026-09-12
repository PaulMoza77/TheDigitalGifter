import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { SEO_RECIPIENT_SLUGS } from "../wishlist/taxonomy";
import {
  MESSAGE_SEO_INTENT_SLUGS,
  SEO_MESSAGE_INTENT_SLUGS,
} from "../cards/taxonomy";
import {
  buildClusterRows,
  christmasSeoAppRoutes,
  emitClusterSeedSql,
  findThinPageIssues,
  isChristmasSeoPath,
  parseChristmasSeoPath,
  requiredGiftSlugs,
  requiredMessageSlugs,
  sitemapEntriesForRows,
} from "./factory";
import { renderChristmasSeoHtml } from "./renderHtml";

function readSrc(rel: string) {
  return readFileSync(resolve(process.cwd(), rel), "utf8");
}

describe("Christmas SEO factory catalog", () => {
  const rows = buildClusterRows();

  it("covers gifts-for taxonomy slugs and message-intent slugs", () => {
    expect(requiredGiftSlugs().sort()).toEqual(Object.values(SEO_RECIPIENT_SLUGS).sort());
    expect(requiredMessageSlugs()).toEqual(
      expect.arrayContaining([
        "mom",
        "dad",
        "boyfriend",
        "girlfriend",
        "coworkers",
        "customers",
        SEO_MESSAGE_INTENT_SLUGS.funny,
        SEO_MESSAGE_INTENT_SLUGS.romantic,
        SEO_MESSAGE_INTENT_SLUGS.professional,
        SEO_MESSAGE_INTENT_SLUGS.short,
        SEO_MESSAGE_INTENT_SLUGS.family,
      ]),
    );
    expect(MESSAGE_SEO_INTENT_SLUGS).toEqual(
      expect.arrayContaining(["messages-for-mom", "funny-christmas-messages"]),
    );
  });

  it("rejects thin pages and duplicate titles", () => {
    expect(findThinPageIssues(rows)).toEqual([]);
    expect(rows).toHaveLength(36);
  });

  it("parses locale-aware cluster paths", () => {
    expect(parseChristmasSeoPath("/christmas/gifts-for-mom")).toMatchObject({
      locale: "en",
      cluster: "gifts-for",
      slug: "mom",
      canonicalPath: "/christmas/gifts-for-mom",
    });
    expect(parseChristmasSeoPath("/ro/christmas/messages-for-dad")).toMatchObject({
      locale: "ro",
      cluster: "messages-for",
      slug: "dad",
    });
    expect(parseChristmasSeoPath("/christmas/funny-christmas-messages")?.cluster).toBe(
      "messages-intent",
    );
    expect(isChristmasSeoPath("/christmas/gift-finder")).toBe(false);
    expect(isChristmasSeoPath("/christmas/gifts")).toBe(false);
    expect(isChristmasSeoPath("/christmas/kids")).toBe(false);
  });

  it("builds locale sitemap entries with hreflang", () => {
    const entries = sitemapEntriesForRows(rows);
    const momEn = entries.find((entry) => entry.loc.endsWith("/christmas/gifts-for-mom"));
    const momRo = entries.find((entry) => entry.loc.endsWith("/ro/christmas/gifts-for-mom"));
    expect(momEn?.alternates.some((alt) => alt.locale === "ro")).toBe(true);
    expect(momRo?.alternates.some((alt) => alt.locale === "x-default")).toBe(true);
    expect(entries.some((entry) => entry.loc.includes("/christmas/funny-christmas-messages"))).toBe(
      true,
    );
    expect(entries.some((entry) => entry.loc.includes("/christmas/messages-for-mom"))).toBe(true);
  });

  it("renders indexable HTML with locale metadata", () => {
    const row = rows.find(
      (item) => item.canonical_path === "/christmas/gifts-for-mom" && item.locale === "en",
    )!;
    const html = renderChristmasSeoHtml(row, "en");
    expect(html).toContain("<!doctype html>");
    expect(html).toContain(row.h1);
    expect(html).toContain(row.intro.slice(0, 40));
    expect(html).toContain('rel="canonical"');
    expect(html).toContain('hreflang="ro"');
    expect(html).toContain("application/ld+json");
    expect(html).toContain("/christmas/gift-finder?recipient=mom");
    expect(html).not.toContain("Apple Pay");
    expect(html).toContain("No checkout on this page");
  });
});

describe("Christmas SEO wiring", () => {
  it("registers cluster routes and SSR seams", () => {
    const app = readSrc("src/App.tsx");
    expect(app).toContain('path="/christmas/gifts-for-:slug"');
    expect(app).toContain('path="/christmas/messages-for-:slug"');
    expect(app).toContain('path="/christmas/funny-christmas-messages"');
    expect(app).toContain('path="/ro/christmas/gifts-for-:slug"');
    expect(app).toContain("ChristmasSeoClusterPage");
    expect(christmasSeoAppRoutes()).toEqual(
      expect.arrayContaining([
        "/christmas/gifts-for-:slug",
        "/ro/christmas/short-christmas-wishes",
      ]),
    );

    const vercel = readSrc("vercel.json");
    expect(vercel).toContain("/api/christmas-seo?cluster=gifts-for");
    expect(vercel).toContain("/api/christmas-seo?cluster=messages-intent");

    const sitemap = readSrc("api/sitemap.xml.ts");
    expect(sitemap).toContain("listChristmasSeoSitemapRows");
    expect(sitemap).toContain("sitemapEntriesForRows");
    expect(sitemap).toContain("xmlns:xhtml");

    const origin = readSrc("server/routes.mjs");
    expect(origin).toContain("christmas-seo.ts");
    expect(origin).toContain("gifts-for-[a-z0-9-]+");
  });

  it("seeds seo_pages from the factory and keeps checkout off", () => {
    const sql = readSrc("supabase/migrations/20260909200000_christmas_seo_factory.sql");
    expect(sql).toContain("alter table public.seo_pages");
    expect(sql).toContain("cluster");
    expect(sql).toContain("locale");
    expect(sql).toContain("canonical_path");
    expect(sql).toContain("seo_pages_page_type_slug_locale_key");
    for (const row of buildClusterRows()) {
      expect(sql).toContain(row.canonical_path);
      expect(sql).toContain(row.slug);
    }
    const seed = emitClusterSeedSql();
    expect(seed).toContain("/christmas/gifts-for-mom");
    expect(seed).toContain("/christmas/messages-for-coworkers");
    expect(readSrc("src/features/christmas/catalog.ts")).toContain("purchasable");
  });

  it("uses a service layer for Supabase and does not mock runtime rows", () => {
    const page = readSrc("src/features/christmas/seo/ChristmasSeoClusterPage.tsx");
    const service = readSrc("src/features/christmas/seo/seoPagesService.ts");
    const api = readSrc("api/_lib/christmas/seoPages.ts");
    expect(page).toContain("fetchChristmasSeoPage");
    expect(page).not.toContain("buildClusterRows");
    expect(service).toContain('.from("seo_pages")');
    expect(api).toContain("getServiceClient");
    expect(api).toContain('.from("seo_pages")');
  });
});
