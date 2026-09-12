import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { listChristmasSeoSitemapRows } from "./_lib/christmas/seoPages";
import { sitemapEntriesForRows } from "../src/features/christmas/seo/factory";
import { christmasSitemapPaths } from "../server/christmasIndexing.mjs";
import {
  buildChristmasHreflangAlternates,
  parseChristmasLocalePath,
} from "../server/christmasI18n.mjs";

/** Keep primary EN list in sync with server/christmasIndexing.mjs CHRISTMAS_INDEXABLE_PATHS. */
const SITE_URL = "https://www.thedigitalgifter.com";

const CHRISTMAS_SITEMAP_PATHS = christmasSitemapPaths();

type SeoPageRow = {
  page_type: string;
  slug: string;
  updated_at: string | null;
  created_at: string | null;
};

type BlogPostRow = {
  slug: string;
  updated_at: string | null;
  published_at: string | null;
  created_at: string | null;
};

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function getLastMod(...dates: Array<string | null | undefined>) {
  const validDate = dates.find((date) => Boolean(date));
  return new Date(validDate || Date.now()).toISOString();
}

function createUrlXml({
  loc,
  lastmod,
  changefreq,
  priority,
  alternates,
}: {
  loc: string;
  lastmod?: string;
  changefreq: "daily" | "weekly" | "monthly";
  priority: string;
  alternates?: Array<{ hreflang: string; href: string }>;
}) {
  const altXml =
    alternates && alternates.length
      ? alternates
          .map(
            (a) =>
              `    <xhtml:link rel="alternate" hreflang="${escapeXml(a.hreflang)}" href="${escapeXml(a.href)}" />`,
          )
          .join("\n")
      : "";
  return `
  <url>
    <loc>${escapeXml(loc)}</loc>
    ${lastmod ? `<lastmod>${escapeXml(lastmod)}</lastmod>` : ""}
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
${altXml}
  </url>`;
}

const NON_CHRISTMAS_STATIC_PATHS = [
  "/",
  "/templates",
  "/generator",
  "/categories/occasions",
  "/categories/personal",
  "/categories/spiritual",
  "/categories/pets",
  "/pet-loss",
  "/pet/dog",
  "/pet/cat",
  "/pet/other",
  "/blog",
  "/privacy",
  "/terms",
  "/refunds",
];

function staticUrlXml() {
  const christmas = CHRISTMAS_SITEMAP_PATHS.map((path) => {
    const { basePath } = parseChristmasLocalePath(path);
    const alternates = buildChristmasHreflangAlternates(basePath);
    return createUrlXml({
      loc: `${SITE_URL}${path}`,
      changefreq: "weekly",
      priority: basePath === "/christmas" ? "0.9" : "0.8",
      alternates: alternates.length ? alternates : undefined,
    });
  });
  const other = NON_CHRISTMAS_STATIC_PATHS.map((path) =>
    createUrlXml({
      loc: `${SITE_URL}${path}`,
      changefreq: "weekly",
      priority: path === "/" ? "1.0" : "0.7",
    }),
  );
  return [...other.slice(0, 1), ...christmas, ...other.slice(1)];
}

function sendSitemap(res: VercelResponse, urls: string[]) {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.join("\n")}
</urlset>`;
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
  res.status(200).send(xml);
}

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const fallback = staticUrlXml();
  try {
    const supabaseUrl = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").trim();
    const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
    if (!supabaseUrl || !serviceRoleKey) {
      sendSitemap(res, fallback);
      return;
    }
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: seoPages, error: seoPagesError } = await supabase
      .from("seo_pages")
      .select("page_type, slug, updated_at, created_at")
      .eq("is_active", true)
      .in("page_type", ["occasion", "recipient", "style", "generator"])
      .neq("slug", "_fallback")
      .order("page_type", { ascending: true })
      .order("slug", { ascending: true });

    if (seoPagesError) {
      throw seoPagesError;
    }

    const { data: blogPosts, error: blogPostsError } = await supabase
      .from("blog_posts")
      .select("slug, updated_at, published_at, created_at")
      .eq("is_published", true)
      .order("published_at", { ascending: false });

    if (blogPostsError) {
      throw blogPostsError;
    }

    const urls = [...fallback];

    try {
      const christmasRows = await listChristmasSeoSitemapRows();
      const lastmodByPath = new Map<string, string>();
      for (const row of christmasRows) {
        lastmodByPath.set(
          `${row.canonical_path}:${row.locale}`,
          getLastMod(row.updated_at, row.created_at),
        );
      }
      for (const entry of sitemapEntriesForRows(christmasRows)) {
        urls.push(
          createUrlXml({
            loc: entry.loc,
            lastmod: lastmodByPath.get(`${entry.canonicalPath}:${entry.locale}`),
            changefreq: "weekly",
            priority: entry.locale === "en" ? "0.8" : "0.7",
            alternates: entry.alternates.map((alt) => ({
              hreflang: alt.locale,
              href: alt.href,
            })),
          }),
        );
      }
    } catch (clusterError) {
      console.error(
        "[sitemap.xml] christmas cluster:",
        clusterError instanceof Error ? clusterError.name : "unknown",
      );
    }

    for (const page of (seoPages ?? []) as SeoPageRow[]) {
      if (!page.page_type || !page.slug || page.slug === "_fallback") continue;

      urls.push(
        createUrlXml({
          loc: `${SITE_URL}/${page.page_type}/${page.slug}`,
          lastmod: getLastMod(page.updated_at, page.created_at),
          changefreq: "weekly",
          priority: "0.8",
        }),
      );
    }

    for (const post of (blogPosts ?? []) as BlogPostRow[]) {
      if (!post.slug) continue;

      urls.push(
        createUrlXml({
          loc: `${SITE_URL}/blog/${post.slug}`,
          lastmod: getLastMod(post.updated_at, post.published_at, post.created_at),
          changefreq: "monthly",
          priority: "0.6",
        }),
      );
    }

    sendSitemap(res, urls);
  } catch (error) {
    console.error("[sitemap.xml] error:", error instanceof Error ? error.name : "unknown");
    sendSitemap(res, fallback);
  }
}

export { CHRISTMAS_SITEMAP_PATHS, SITE_URL };
