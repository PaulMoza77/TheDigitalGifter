import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const SITE_URL = "https://thedigitalgifter.com";

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!supabaseUrl || !supabaseAnonKey) {
    res.status(500).send("Missing Supabase env vars");
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const staticUrls = [
    "/",
    "/templates",
    "/generator",
    "/categories/occasions",
    "/categories/personal",
    "/categories/spiritual",
    "/categories/pets",
    "/blog",
    "/privacy",
    "/terms",
    "/refunds",
  ];

  const { data: seoPages } = await supabase
    .from("seo_pages")
    .select("page_type, slug, updated_at, created_at")
    .eq("is_active", true);

  const { data: blogPosts } = await supabase
    .from("blog_posts")
    .select("slug, updated_at, published_at, created_at")
    .eq("is_published", true);

  const urls: string[] = [];

  for (const path of staticUrls) {
    urls.push(`
      <url>
        <loc>${escapeXml(`${SITE_URL}${path}`)}</loc>
        <changefreq>weekly</changefreq>
        <priority>0.7</priority>
      </url>
    `);
  }

  for (const page of seoPages ?? []) {
    urls.push(`
      <url>
        <loc>${escapeXml(`${SITE_URL}/${page.page_type}/${page.slug}`)}</loc>
        <lastmod>${new Date(
          page.updated_at ?? page.created_at ?? Date.now()
        ).toISOString()}</lastmod>
        <changefreq>weekly</changefreq>
        <priority>0.8</priority>
      </url>
    `);
  }

  for (const post of blogPosts ?? []) {
    urls.push(`
      <url>
        <loc>${escapeXml(`${SITE_URL}/blog/${post.slug}`)}</loc>
        <lastmod>${new Date(
          post.updated_at ?? post.published_at ?? post.created_at ?? Date.now()
        ).toISOString()}</lastmod>
        <changefreq>monthly</changefreq>
        <priority>0.6</priority>
      </url>
    `);
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>`;

  res.setHeader("Content-Type", "application/xml");
  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate");
  res.status(200).send(xml);
}