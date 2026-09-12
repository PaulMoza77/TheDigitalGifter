import type { VercelRequest, VercelResponse } from "@vercel/node";
import { fetchChristmasSeoPageByPath } from "./_lib/christmas/seoPages";
import { parseChristmasSeoPath } from "../src/features/christmas/seo/factory";
import { renderChristmasSeoHtml, renderChristmasSeoNotFound } from "../src/features/christmas/seo/renderHtml";
import type { ChristmasSeoCluster, ChristmasSeoLocale } from "../src/features/christmas/seo/types";

function queryString(value: string | string[] | undefined): string {
  return Array.isArray(value) ? String(value[0] || "") : String(value || "");
}

function resolveFromQuery(req: VercelRequest): ReturnType<typeof parseChristmasSeoPath> {
  const cluster = queryString(req.query.cluster) as ChristmasSeoCluster;
  const slug = queryString(req.query.slug).trim().toLowerCase();
  const locale = (queryString(req.query.locale) === "ro" ? "ro" : "en") as ChristmasSeoLocale;
  if (!slug) return null;
  if (cluster === "gifts-for") {
    return { locale, cluster, slug, canonicalPath: `/christmas/gifts-for-${slug}` };
  }
  if (cluster === "messages-for") {
    return { locale, cluster, slug, canonicalPath: `/christmas/messages-for-${slug}` };
  }
  if (cluster === "messages-intent") {
    return { locale, cluster, slug, canonicalPath: `/christmas/${slug}` };
  }
  return null;
}

function sendHtml(res: VercelResponse, status: number, html: string) {
  res.status(status);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "s-maxage=120, stale-while-revalidate=600");
  res.send(html);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method && req.method !== "GET" && req.method !== "HEAD") {
    res.status(405).setHeader("Allow", "GET, HEAD").send("Method Not Allowed");
    return;
  }

  const host = String(req.headers.host || "thedigitalgifter.com");
  const url = new URL(req.url || "/", `https://${host}`);
  const parsed = parseChristmasSeoPath(url.pathname) || resolveFromQuery(req);
  const locale = parsed?.locale ?? "en";

  if (!parsed) {
    sendHtml(res, 404, renderChristmasSeoNotFound(locale));
    return;
  }

  try {
    const page = await fetchChristmasSeoPageByPath(parsed.canonicalPath, parsed.locale);
    if (!page) {
      sendHtml(res, 404, renderChristmasSeoNotFound(parsed.locale));
      return;
    }
    sendHtml(res, 200, renderChristmasSeoHtml(page, parsed.locale));
  } catch {
    sendHtml(res, 404, renderChristmasSeoNotFound(parsed.locale));
  }
}
