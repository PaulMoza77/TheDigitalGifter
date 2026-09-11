#!/usr/bin/env node
/**
 * Christmas P0 SEO smoke test — verifies SSR HTML shells for scoped routes.
 *
 * Modes:
 *   1) Registry self-check (always)
 *   2) Inject against a provided index.html (or dist/index.html)
 *   3) Optional live base URL: CHRISTMAS_SEO_BASE=https://… node scripts/christmas-seo-smoke.mjs
 */
import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyChristmasSeo,
  CHRISTMAS_SEO_ROUTES,
  getChristmasSeo,
  listChristmasSeoPaths,
  SITE_ORIGIN,
} from "../server/christmasSeo.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const GENERIC_TITLE = "TheDigitalGifter — Custom AI Holiday Cards & Memories";

const failures = [];

function fail(msg) {
  failures.push(msg);
  console.error(`FAIL: ${msg}`);
}

function ok(msg) {
  console.log(`OK: ${msg}`);
}

function assert(cond, msg) {
  if (!cond) fail(msg);
  else ok(msg);
}

function decodeEntities(value) {
  return String(value)
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function extractTitle(html) {
  const m = html.match(/<title>([^<]*)<\/title>/i);
  return m ? decodeEntities(m[1].trim()) : "";
}

function extractMeta(html, name) {
  const re = new RegExp(
    `<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']*)["']`,
    "i",
  );
  const re2 = new RegExp(
    `<meta[^>]+content=["']([^"']*)["'][^>]+name=["']${name}["']`,
    "i",
  );
  const raw = (html.match(re) || html.match(re2) || [])[1] || "";
  return decodeEntities(raw);
}

function extractCanonical(html) {
  const m = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']*)["']/i)
    || html.match(/<link[^>]+href=["']([^"']*)["'][^>]+rel=["']canonical["']/i);
  return m ? decodeEntities(m[1]) : "";
}

function extractH1(html) {
  const m = html.match(/<h1[^>]*>([^<]*)<\/h1>/i);
  return m ? decodeEntities(m[1].trim()) : "";
}

function hasLink(html, href) {
  return new RegExp(`<a[^>]+href=["']${href.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']`, "i").test(
    html,
  );
}

// —— 1) Registry uniqueness ——
const paths = listChristmasSeoPaths();
assert(paths.length >= 17, `expected ≥17 Christmas SEO routes, got ${paths.length}`);

const titles = CHRISTMAS_SEO_ROUTES.map((r) => r.title);
const descs = CHRISTMAS_SEO_ROUTES.map((r) => r.description);
const uniqueTitles = new Set(titles);
const uniqueDescs = new Set(descs);
assert(uniqueTitles.size === titles.length, `duplicate titles: ${titles.length - uniqueTitles.size}`);
assert(uniqueDescs.size === descs.length, `duplicate descriptions: ${descs.length - uniqueDescs.size}`);
assert(
  !titles.includes(GENERIC_TITLE),
  "registry must not use generic homepage title",
);

for (const route of CHRISTMAS_SEO_ROUTES) {
  assert(Boolean(route.h1), `${route.path} has H1`);
  assert(Boolean(route.lede), `${route.path} has lede`);
  assert(route.links.length > 0, `${route.path} has internal links`);
  assert(route.canonicalPath.startsWith("/"), `${route.path} canonical path`);
}

// —— 2) Injection against HTML template ——
const distIndex = join(root, "dist", "index.html");
const srcIndex = join(root, "index.html");
const templatePath = existsSync(distIndex) ? distIndex : srcIndex;
const template = readFileSync(templatePath, "utf8");
ok(`using HTML template: ${templatePath.replace(root, "")}`);

const titleSeen = new Map();

for (const route of CHRISTMAS_SEO_ROUTES) {
  const html = applyChristmasSeo(template, route.path);
  const title = extractTitle(html);
  const desc = extractMeta(html, "description");
  const canonical = extractCanonical(html);
  const h1 = extractH1(html);
  const expectedCanonical = `${SITE_ORIGIN}${route.canonicalPath}`;

  assert(title === route.title, `${route.path} title matches registry`);
  assert(title !== GENERIC_TITLE, `${route.path} not generic title`);
  assert(Boolean(desc) && desc === route.description, `${route.path} description`);
  assert(canonical === expectedCanonical, `${route.path} canonical → ${expectedCanonical}`);
  assert(h1 === route.h1, `${route.path} H1 in HTML`);
  assert(html.includes(route.lede.slice(0, 40)), `${route.path} lede present`);
  assert(/og:title/i.test(html) && html.includes(route.title), `${route.path} og:title`);
  assert(/twitter:title/i.test(html), `${route.path} twitter:title`);
  assert(html.includes("BreadcrumbList"), `${route.path} BreadcrumbList JSON-LD`);
  assert(html.includes('id="tdg-christmas-seo"'), `${route.path} SEO shell`);

  for (const link of route.links.slice(0, 3)) {
    assert(hasLink(html, link.href), `${route.path} link ${link.href}`);
  }

  if (titleSeen.has(title)) {
    fail(`duplicate injected title "${title}" on ${titleSeen.get(title)} and ${route.path}`);
  } else {
    titleSeen.set(title, route.path);
  }
}

// Spot-check /christmas hub links required by the brief
const hub = applyChristmasSeo(template, "/christmas");
for (const href of [
  "/christmas/gift-finder",
  "/christmas/wishlist",
  "/christmas/photo-generator",
  "/christmas/santa-video",
  "/christmas/tree",
  "/christmas/advent",
  "/christmas/cards",
  "/christmas/messages",
]) {
  assert(hasLink(hub, href), `/christmas crawlable link ${href}`);
}

const photo = applyChristmasSeo(template, "/christmas/photo-generator");
for (const href of [
  "/christmas/family",
  "/christmas/couples",
  "/christmas/pets",
  "/christmas/dogs",
  "/christmas/cats",
]) {
  assert(hasLink(photo, href), `photo-generator hierarchy link ${href}`);
}

// —— 3) Optional live fetch ——
const liveBase = String(process.env.CHRISTMAS_SEO_BASE || "").replace(/\/$/, "");
if (liveBase) {
  console.log(`\nLive checks against ${liveBase}`);
  for (const route of CHRISTMAS_SEO_ROUTES) {
    const url = `${liveBase}${route.path}`;
    try {
      const res = await fetch(url, {
        redirect: "follow",
        headers: { "user-agent": "TDG-Christmas-SEO-Smoke/1.0" },
      });
      assert(res.ok, `HTTP ${res.status} for ${route.path}`);
      const html = await res.text();
      assert(extractTitle(html) === route.title, `live title ${route.path}`);
      assert(extractCanonical(html) === `${SITE_ORIGIN}${route.canonicalPath}`, `live canonical ${route.path}`);
      assert(extractH1(html) === route.h1, `live H1 ${route.path}`);
      assert(!html.includes(GENERIC_TITLE) || extractTitle(html) !== GENERIC_TITLE, `live not generic ${route.path}`);
    } catch (err) {
      fail(`live fetch ${route.path}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
} else {
  console.log("\n(skip live fetch — set CHRISTMAS_SEO_BASE to enable)");
}

// Write a small artifact summary for CI
const outDir = join(root, "output");
mkdirSync(outDir, { recursive: true });
writeFileSync(
  join(outDir, "christmas-seo-smoke.json"),
  JSON.stringify(
    {
      ok: failures.length === 0,
      routes: paths.length,
      uniqueTitles: uniqueTitles.size,
      uniqueDescriptions: uniqueDescs.size,
      failures,
      checkedAt: new Date().toISOString(),
    },
    null,
    2,
  ),
);

console.log("\n—— summary ——");
console.log(`routes: ${paths.length}`);
console.log(`unique titles: ${uniqueTitles.size}/${titles.length}`);
console.log(`unique descriptions: ${uniqueDescs.size}/${descs.length}`);
console.log(`failures: ${failures.length}`);

if (failures.length) {
  process.exit(1);
}

console.log("Christmas SEO smoke passed.");
void getChristmasSeo;
