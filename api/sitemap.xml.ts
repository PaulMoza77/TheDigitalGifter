import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { listChristmasSeoSitemapRows } from "./_lib/christmas/seoPages";
import { sitemapEntriesForRows } from "../src/features/christmas/seo/factory";

const SITE_URL = "https://thedigitalgifter.com";

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
  alternates?: Array<{ locale: string; href: string }>;
}) {
  const links = (alternates ?? [])
    .map(
      (alt) =>
        `    <xhtml:link rel="alternate" hreflang="${escapeXml(alt.locale)}" href="${escapeXml(alt.href)}" />`,
    )
    .join("\n");
  return `
  <url>
    <loc>${escapeXml(loc)}</loc>
    ${lastmod ? `<lastmod>${escapeXml(lastmod)}</lastmod>` : ""}
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
${links}
  </url>`;
}

const STATIC_PATHS = [
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
  "/christmas",
  "/christmas/gift-finder",
  "/christmas/family",
  "/christmas/couples",
  "/christmas/pets",
  "/christmas/santa-video",
  "/christmas/wishlist",
  "/christmas/tree",
  "/christmas/advent",
  "/christmas/cards",
  "/christmas/messages",
  "/christmas-ai-photos",
  "/blog",
  "/privacy",
  "/terms",
  "/refunds",
];

function staticUrlXml() {
  return STATIC_PATHS.map((path) =>
    createUrlXml({
      loc: `${SITE_URL}${path}`,
      changefreq: "weekly",
      priority: path === "/" ? "1.0" : "0.7",
    }),
  );
}

function sendSitemap(res: VercelResponse, urls: string[]) {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
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
            alternates: entry.alternates,
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
      if (!page.page_type || !page.slug) continue;

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
