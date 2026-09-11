#!/usr/bin/env node
/**
 * Lightweight LIVE production SEO smoke for Christmas discovery/indexing.
 *
 * Does NOT hit paid APIs, submit sitemaps, generate content, or purchase.
 *
 * Usage:
 *   npm run seo:production-smoke
 *   SEO_BASE=https://www.thedigitalgifter.com npm run seo:production-smoke
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const BASE = (process.env.SEO_BASE || "https://www.thedigitalgifter.com").replace(/\/$/, "");
const EXPECTED_SHA = process.env.SEO_EXPECTED_SHA || ""; // optional advisory only

const HIGH_VALUE = [
  "/christmas",
  "/christmas/gift-finder",
  "/christmas/photo-generator",
  "/christmas/santa-video",
  "/christmas/cards",
  "/christmas/messages",
  "/christmas/wishlist",
  "/ro/christmas",
  "/ro/christmas/santa-video",
  "/de/christmas",
  "/de/christmas/gift-finder",
  "/de/christmas/santa-video",
  "/de/christmas/cards",
  "/fr/christmas/santa-video",
  "/es/christmas/santa-video",
  "/pt/christmas/santa-video",
  "/pl/christmas/wishlist",
];

const WAVE1_HREFLANG = ["en", "ro", "de", "fr", "es", "it", "pt-PT", "nl", "pl", "x-default"];

let failures = 0;
const results = [];

function fail(msg) {
  failures += 1;
  console.error(`FAIL: ${msg}`);
}

function ok(msg) {
  console.log(`OK: ${msg}`);
}

async function fetchText(path, init = {}) {
  const url = path.startsWith("http") ? path : `${BASE}${path}`;
  const res = await fetch(url, {
    redirect: "manual",
    headers: { "User-Agent": "TDG-seo-production-smoke/1.0", ...(init.headers || {}) },
    ...init,
  });
  const text = await res.text();
  return { url, status: res.status, headers: res.headers, text };
}

function meta(html, name) {
  const a = html.match(new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']*)["']`, "i"));
  if (a) return a[1];
  const b = html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+name=["']${name}["']`, "i"));
  return b ? b[1] : null;
}

function titleOf(html) {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? m[1].replace(/\s+/g, " ").trim() : null;
}

function canonicalOf(html) {
  const a = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i);
  if (a) return a[1];
  const b = html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i);
  return b ? b[1] : null;
}

function langOf(html) {
  const m = html.match(/<html[^>]+lang=["']([^"']+)["']/i);
  return m ? m[1] : null;
}

function hreflangs(html) {
  const out = [];
  const re =
    /<link[^>]+rel=["']alternate["'][^>]+hreflang=["']([^"']+)["'][^>]+href=["']([^"']+)["']/gi;
  let m;
  while ((m = re.exec(html))) out.push([m[1], m[2]]);
  if (!out.length) {
    const re2 =
      /<link[^>]+hreflang=["']([^"']+)["'][^>]+href=["']([^"']+)["'][^>]+rel=["']alternate["']/gi;
    while ((m = re2.exec(html))) out.push([m[1], m[2]]);
  }
  return out;
}

function pathOf(url) {
  try {
    return new URL(url).pathname.replace(/\/$/, "") || "/";
  } catch {
    return url;
  }
}

async function main() {
  console.log(`SEO production smoke against ${BASE}`);
  if (EXPECTED_SHA) console.log(`Expected SHA advisory: ${EXPECTED_SHA}`);

  // robots
  const robots = await fetchText("/robots.txt");
  if (robots.status !== 200) fail(`robots.txt status ${robots.status}`);
  else ok("robots.txt 200");
  if (!robots.text.includes("Sitemap: https://www.thedigitalgifter.com/sitemap.xml")) {
    fail("robots.txt missing www sitemap declaration");
  } else ok("robots.txt declares www sitemap");
  if (/^Disallow:\s*\/christmas/im.test(robots.text)) fail("robots.txt Disallow /christmas");
  else ok("robots.txt does not blanket-disallow /christmas");

  // sitemap
  const sm = await fetchText("/sitemap.xml");
  if (sm.status !== 200) fail(`sitemap.xml status ${sm.status}`);
  else ok("sitemap.xml 200");
  const locs = [...sm.text.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
  const unique = [...new Set(locs)];
  const christmas = unique.filter((u) => u.includes("/christmas"));
  ok(`sitemap urls=${unique.length} christmas=${christmas.length}`);
  if (unique.length < 100) fail(`sitemap unexpectedly small (${unique.length})`);
  if (unique.some((u) => u.includes("://thedigitalgifter.com/") && !u.includes("://www."))) {
    fail("sitemap contains apex-host URLs");
  } else ok("sitemap uses www host");
  for (const bad of ["/christmas/gifts", "/christmas/kids", "christmas-ai-photos"]) {
    if (unique.some((u) => u.includes(bad))) fail(`sitemap includes forbidden ${bad}`);
  }

  // 404 behavior
  for (const p of ["/christmas/this-route-does-not-exist", "/de/christmas/not-real"]) {
    const r = await fetchText(p);
    if (r.status !== 404) fail(`${p} expected 404 got ${r.status}`);
    else ok(`${p} 404`);
  }

  // high-value pages
  for (const path of HIGH_VALUE) {
    const r = await fetchText(path);
    const row = { path, status: r.status };
    if (r.status !== 200) {
      fail(`${path} status ${r.status}`);
      results.push(row);
      continue;
    }
    const title = titleOf(r.text);
    const canonical = canonicalOf(r.text);
    const robotsMeta = meta(r.text, "robots");
    const lang = langOf(r.text);
    const alts = hreflangs(r.text);
    row.title = title;
    row.canonical = canonical;
    row.robots = robotsMeta;
    row.lang = lang;
    row.hreflang_count = alts.length;
    results.push(row);

    if (!title) fail(`${path} missing title`);
    if (!canonical) fail(`${path} missing canonical`);
    else {
      const expect = `${BASE}${path}`.replace(/\/$/, "");
      if (canonical.replace(/\/$/, "") !== expect) {
        fail(`${path} canonical ${canonical} != ${expect}`);
      }
    }
    if (!robotsMeta || !/index\s*,\s*follow/i.test(robotsMeta)) {
      fail(`${path} robots=${robotsMeta}`);
    }
    if (!lang) fail(`${path} missing html lang`);
    const langs = new Set(alts.map(([l]) => l));
    for (const need of WAVE1_HREFLANG) {
      if (!langs.has(need)) fail(`${path} missing hreflang ${need}`);
    }
    ok(`${path} title/canonical/robots/lang/hreflang`);
  }

  // noindex routes must not be in sitemap and must be noindex
  for (const path of ["/christmas/kids", "/christmas-ai-photos"]) {
    const r = await fetchText(path);
    const robotsMeta = meta(r.text, "robots") || "";
    if (!/noindex/i.test(robotsMeta)) fail(`${path} expected noindex got ${robotsMeta}`);
    else ok(`${path} noindex`);
    if (unique.some((u) => pathOf(u) === path)) fail(`${path} present in sitemap`);
    else ok(`${path} absent from sitemap`);
  }

  const summary = {
    base: BASE,
    checked_at: new Date().toISOString(),
    failures,
    sitemap_total: unique.length,
    sitemap_christmas: christmas.length,
    pages: results,
  };

  try {
    mkdirSync("/opt/cursor/artifacts/christmas-seo-p4", { recursive: true });
    writeFileSync(
      join("/opt/cursor/artifacts/christmas-seo-p4", "production-smoke-last.json"),
      JSON.stringify(summary, null, 2) + "\n",
    );
  } catch {
    /* artifact dir optional */
  }

  if (failures) {
    console.error(`\nseo:production-smoke FAILED (${failures})`);
    process.exit(1);
  }
  console.log("\nseo:production-smoke PASSED");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
