#!/usr/bin/env node
/**
 * Christmas SEO smoke — P0 SSR shells + P1 indexing / redirects / sitemap.
 *
 * Modes:
 *   1) Registry + indexing policy (always)
 *   2) Inject against index.html / dist/index.html
 *   3) Optional live: CHRISTMAS_SEO_BASE=https://… node scripts/christmas-seo-smoke.mjs
 *   4) Optional origin: CHRISTMAS_SEO_ORIGIN=http://127.0.0.1:8765 (HTTP status checks)
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
import {
  applyChristmasNoindexShell,
  buildApexToWwwLocation,
  buildChristmasRedirectLocation,
  buildTrailingSlashRedirect,
  CHRISTMAS_INDEXABLE_PATHS,
  CHRISTMAS_NOINDEX_PATHS,
  christmasSitemapPaths,
  getChristmasPermanentRedirectTarget,
  isChristmasIndexablePath,
  should404UnknownChristmasPath,
  shouldNoindexChristmasPath,
} from "../server/christmasIndexing.mjs";
import {
  CONTENT_DEPTH_PATHS,
  getChristmasContentDepth,
} from "../server/christmasContentDepth.mjs";
import {
  buildChristmasHreflangAlternates,
  englishPrefixRedirectTarget,
} from "../server/christmasI18n.mjs";

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

function robotsIsNoindex(html) {
  const robots = extractMeta(html, "robots").toLowerCase();
  return robots.includes("noindex");
}

function robotsIsIndex(html) {
  const robots = extractMeta(html, "robots").toLowerCase();
  return robots.includes("index") && !robots.includes("noindex");
}

// —— 1) Registry uniqueness ——
const paths = listChristmasSeoPaths();
assert(paths.length >= 16, `expected ≥16 Christmas SEO routes, got ${paths.length}`);
assert(!paths.includes("/christmas/gifts"), "registry must not index /christmas/gifts alias");

const titles = CHRISTMAS_SEO_ROUTES.map((r) => r.title);
const descs = CHRISTMAS_SEO_ROUTES.map((r) => r.description);
const uniqueTitles = new Set(titles);
const uniqueDescs = new Set(descs);
assert(uniqueTitles.size === titles.length, `duplicate titles: ${titles.length - uniqueTitles.size}`);
assert(uniqueDescs.size === descs.length, `duplicate descriptions: ${descs.length - uniqueDescs.size}`);
assert(!titles.includes(GENERIC_TITLE), "registry must not use generic homepage title");

for (const route of CHRISTMAS_SEO_ROUTES) {
  assert(Boolean(route.h1), `${route.path} has H1`);
  assert(Boolean(route.lede), `${route.path} has lede`);
  assert(route.links.length > 0, `${route.path} has internal links`);
  assert(route.canonicalPath.startsWith("/"), `${route.path} canonical path`);
  assert(!route.canonicalPath.includes("?"), `${route.path} canonical has no query`);
}

// —— P1 indexing policy ——
assert(
  getChristmasPermanentRedirectTarget("/christmas/gifts") === "/christmas/gift-finder",
  "gifts → gift-finder permanent redirect",
);
assert(
  buildChristmasRedirectLocation("/christmas/gifts", "?utm_source=test") ===
    `${SITE_ORIGIN}/christmas/gift-finder?utm_source=test`,
  "gifts redirect preserves query",
);

for (const path of CHRISTMAS_INDEXABLE_PATHS) {
  assert(isChristmasIndexablePath(path), `${path} indexable`);
  assert(!shouldNoindexChristmasPath(path), `${path} not noindex`);
}

for (const path of CHRISTMAS_NOINDEX_PATHS) {
  assert(shouldNoindexChristmasPath(path), `${path} noindex policy`);
}
assert(shouldNoindexChristmasPath("/wishlist/abc123"), "wishlist share noindex");
assert(shouldNoindexChristmasPath("/christmas/tree/abc123"), "tree share noindex");
assert(shouldNoindexChristmasPath("/christmas/kids"), "kids noindex");
assert(shouldNoindexChristmasPath("/christmas-ai-photos"), "ai-photos funnel noindex");
assert(shouldNoindexChristmasPath("/christmas-ai-photos/order"), "ai-photos order noindex");

assert(
  buildApexToWwwLocation("thedigitalgifter.com", "/christmas", "?x=1") ===
    `${SITE_ORIGIN}/christmas?x=1`,
  "apex → www redirect",
);
assert(buildApexToWwwLocation("www.thedigitalgifter.com", "/christmas") === null, "www host no apex redirect");
assert(buildTrailingSlashRedirect("/christmas/") === "/christmas", "trailing slash strip");
assert(buildTrailingSlashRedirect("/christmas") === null, "no slash no redirect");
assert(should404UnknownChristmasPath("/christmas/not-a-real-product"), "unknown christmas 404");
assert(!should404UnknownChristmasPath("/christmas/family"), "known christmas not 404");
assert(!should404UnknownChristmasPath("/christmas/tree/share-id"), "tree share not 404");

// Sitemap source alignment (P3A: dynamic christmasSitemapPaths + hreflang)
const sitemapSrc = readFileSync(join(root, "api/sitemap.xml.ts"), "utf8");
assert(sitemapSrc.includes('SITE_URL = "https://www.thedigitalgifter.com"'), "sitemap uses www");
assert(sitemapSrc.includes("christmasSitemapPaths"), "sitemap uses christmasSitemapPaths()");
assert(sitemapSrc.includes("buildChristmasHreflangAlternates"), "sitemap emits xhtml hreflang");
const sitemapPaths = christmasSitemapPaths();
for (const path of CHRISTMAS_INDEXABLE_PATHS) {
  assert(sitemapPaths.includes(path), `sitemap includes ${path}`);
}
for (const includedRo of ["/ro/christmas", "/ro/christmas/cards", "/ro/christmas/santa-video", "/ro/christmas/gift-finder"]) {
  assert(sitemapPaths.includes(includedRo), `sitemap includes complete RO ${includedRo}`);
}
for (const excluded of [
  "/christmas/gifts",
  "/christmas/kids",
  "/christmas-ai-photos",
  "/christmas-ai-photos/order",
  "/christmas/suite",
  "/christmas/tree-gifts",
  "/de/christmas/santa-video",
  "/fr/christmas/messages",
  "/en/christmas",
  "/en/christmas/cards",
]) {
  assert(!sitemapPaths.includes(excluded), `sitemap excludes ${excluded}`);
}

const robotsTxt = readFileSync(join(root, "public/robots.txt"), "utf8");
assert(
  robotsTxt.includes("Sitemap: https://www.thedigitalgifter.com/sitemap.xml"),
  "robots.txt sitemap www",
);
assert(!/Disallow:\s*\/wishlist/i.test(robotsTxt), "robots does not block wishlist shares");
assert(!/Disallow:\s*\/christmas/i.test(robotsTxt), "robots does not blanket-block christmas");

const vercel = readFileSync(join(root, "vercel.json"), "utf8");
assert(vercel.includes('"/christmas/gifts"'), "vercel redirects gifts");
assert(vercel.includes('"/christmas/gift-finder"'), "vercel gifts target");

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

  if (route.noindex) {
    assert(robotsIsNoindex(html), `${route.path} SSR noindex`);
  } else if (isChristmasIndexablePath(route.path)) {
    assert(robotsIsIndex(html), `${route.path} SSR index`);
  }

  for (const link of route.links.slice(0, 3)) {
    assert(hasLink(html, link.href), `${route.path} link ${link.href}`);
  }

  if (titleSeen.has(title)) {
    fail(`duplicate injected title "${title}" on ${titleSeen.get(title)} and ${route.path}`);
  } else {
    titleSeen.set(title, route.path);
  }
}

// Query params must not enter canonical / SEO identity
const santaQuery = applyChristmasSeo(template, "/christmas/santa-video");
assert(
  extractCanonical(santaQuery) === `${SITE_ORIGIN}/christmas/santa-video`,
  "santa canonical ignores personalization query (path-only apply)",
);
assert(!santaQuery.includes("John"), "santa SSR shell has no personal name");

const cardsQuery = applyChristmasSeo(template, "/christmas/cards");
assert(extractCanonical(cardsQuery) === `${SITE_ORIGIN}/christmas/cards`, "cards clean canonical");

const shareHtml = applyChristmasNoindexShell(template, "/wishlist/demo-share");
assert(robotsIsNoindex(shareHtml), "wishlist share SSR noindex shell");
assert(
  extractCanonical(shareHtml) === `${SITE_ORIGIN}/christmas/wishlist`,
  "wishlist share canonical → product page",
);

const treeShareHtml = applyChristmasNoindexShell(template, "/christmas/tree/demo-share");
assert(robotsIsNoindex(treeShareHtml), "tree share SSR noindex shell");

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

// —— P2A content depth / GEO ——
const moneyPaths = [
  "/christmas",
  "/christmas/gift-finder",
  "/christmas/photo-generator",
  "/christmas/santa-video",
  "/christmas/wishlist",
  "/christmas/cards",
];
assert(
  moneyPaths.every((p) => getChristmasContentDepth(p)?.wave === "p2a"),
  "P2A money pages keep wave p2a",
);
assert(CONTENT_DEPTH_PATHS.length >= 14, `depth covers money+adjacent, got ${CONTENT_DEPTH_PATHS.length}`);
const geoQuestions = {
  "/christmas": "What can you create with TheDigitalGifter for Christmas?",
  "/christmas/gift-finder": "What is a Christmas Gift Finder?",
  "/christmas/photo-generator": "What is an AI Christmas photo generator?",
  "/christmas/santa-video": "What is a personalized Santa video?",
  "/christmas/wishlist": "What is an online Christmas wishlist?",
  "/christmas/cards": "What is an online Christmas card maker?",
};
for (const [path, question] of Object.entries(geoQuestions)) {
  const depth = getChristmasContentDepth(path);
  assert(Boolean(depth), `depth module has ${path}`);
  const html = applyChristmasSeo(template, path);
  assert(html.includes(question), `GEO H2 in SSR for ${path}`);
  assert(html.includes('data-tdg-depth="p2a"'), `depth marker for ${path}`);
  assert(html.includes("Frequently Asked Questions"), `FAQ section for ${path}`);
  assert(html.includes('"@type":"FAQPage"') || html.includes('"@type": "FAQPage"'), `FAQPage JSON-LD for ${path}`);
  for (const marker of depth.markers) {
    assert(html.includes(marker), `${path} marker: ${marker}`);
  }
  assert(depth.faqs.length >= 5, `${path} has at least 5 FAQs`);
  // Distinct intros — avoid cannibalization copies
  assert(depth.geo.body.length > 80, `${path} GEO body has useful length`);
}
assert(
  !applyChristmasSeo(template, "/christmas").includes("What is a Christmas Gift Finder?"),
  "hub does not steal gift-finder GEO question",
);
assert(
  hasLink(applyChristmasSeo(template, "/christmas/wishlist"), "/christmas/gift-finder"),
  "wishlist links to gift-finder",
);
assert(
  hasLink(applyChristmasSeo(template, "/christmas/cards"), "/christmas/photo-generator"),
  "cards links to photo-generator",
);
assert(
  hasLink(applyChristmasSeo(template, "/christmas/cards"), "/christmas/messages"),
  "cards links to messages",
);
assert(
  applyChristmasSeo(template, "/christmas/santa-video").includes("What Can Santa Mention?"),
  "santa SSR includes personalization fields section",
);
assert(
  applyChristmasSeo(template, "/christmas/gift-finder").includes("not connected yet") ||
    applyChristmasSeo(template, "/christmas/gift-finder").includes("Live retailer"),
  "gift-finder honesty about non-live inventory",
);
assert(
  !applyChristmasSeo(template, "/christmas").includes('"@type":"AggregateRating"'),
  "no fake AggregateRating on hub",
);

// —— P2B adjacent content depth / GEO ——
const adjacentGeo = {
  "/christmas/family": "What is a family Christmas photo generator?",
  "/christmas/couples": "What is a couple Christmas photo generator?",
  "/christmas/pets": "What is a Christmas pet photo generator?",
  "/christmas/dogs": "What is a Christmas dog photo generator?",
  "/christmas/cats": "What is a Christmas cat photo generator?",
  "/christmas/tree": "What is a digital Christmas tree?",
  "/christmas/advent": "What is an online Advent calendar?",
  "/christmas/messages": "What is a Christmas message generator?",
};
for (const [path, question] of Object.entries(adjacentGeo)) {
  const depth = getChristmasContentDepth(path);
  assert(Boolean(depth), `P2B depth module has ${path}`);
  assert(depth.wave === "p2b", `${path} wave p2b`);
  const html = applyChristmasSeo(template, path);
  assert(html.includes(question), `P2B GEO H2 in SSR for ${path}`);
  assert(html.includes('data-tdg-depth="p2b"'), `P2B depth marker for ${path}`);
  assert(html.includes("Frequently Asked Questions"), `P2B FAQ section for ${path}`);
  assert(html.includes('"@type":"FAQPage"') || html.includes('"@type": "FAQPage"'), `P2B FAQPage for ${path}`);
  for (const marker of depth.markers) {
    assert(html.includes(marker), `P2B ${path} marker: ${marker}`);
  }
  assert(depth.faqs.length >= 5, `P2B ${path} has at least 5 FAQs`);
  assert(depth.geo.body.length > 80, `P2B ${path} GEO body useful`);
}
assert(
  getChristmasContentDepth("/christmas/family").geo.h2 !==
    getChristmasContentDepth("/christmas/photo-generator").geo.h2,
  "family GEO distinct from photo-generator",
);
assert(
  getChristmasContentDepth("/christmas/dogs").geo.body !==
    getChristmasContentDepth("/christmas/cats").geo.body,
  "dogs GEO body distinct from cats",
);
assert(
  hasLink(applyChristmasSeo(template, "/christmas/pets"), "/christmas/dogs"),
  "pets links to dogs",
);
assert(
  hasLink(applyChristmasSeo(template, "/christmas/pets"), "/christmas/cats"),
  "pets links to cats",
);
assert(
  hasLink(applyChristmasSeo(template, "/christmas/family"), "/christmas/cards"),
  "family links to cards",
);
assert(
  hasLink(applyChristmasSeo(template, "/christmas/messages"), "/christmas/cards"),
  "messages links to cards",
);
assert(
  !getChristmasContentDepth("/christmas/kids"),
  "kids remains without P2B depth (still noindex product)",
);

// —— P3A international SEO foundation ——
assert(
  englishPrefixRedirectTarget("/en/christmas/cards") === "/christmas/cards",
  "P3A /en/* redirects to unprefixed English",
);
assert(
  getChristmasPermanentRedirectTarget("/en/christmas") === "/christmas",
  "P3A permanent redirect /en/christmas → /christmas",
);

const enCardsAlts = buildChristmasHreflangAlternates("/christmas/cards");
const enCardsByLang = Object.fromEntries(enCardsAlts.map((a) => [a.hreflang, a.href]));
assert(enCardsByLang.en === `${SITE_ORIGIN}/christmas/cards`, "P3A hreflang en self");
assert(enCardsByLang.ro === `${SITE_ORIGIN}/ro/christmas/cards`, "P3A hreflang ro reciprocal");
assert(enCardsByLang["x-default"] === enCardsByLang.en, "P3A x-default → English");

const enCardsHtml = applyChristmasSeo(template, "/christmas/cards");
assert(enCardsHtml.includes('hreflang="en"'), "P3A EN cards emit hreflang en");
assert(enCardsHtml.includes('hreflang="ro"'), "P3A EN cards emit hreflang ro");
assert(enCardsHtml.includes('hreflang="x-default"'), "P3A EN cards emit x-default");
assert(
  extractCanonical(enCardsHtml) === `${SITE_ORIGIN}/christmas/cards`,
  "P3A EN cards keep unprefixed canonical",
);

const roCardsHtml = applyChristmasSeo(template, "/ro/christmas/cards");
assert(/lang="ro"/.test(roCardsHtml), "P3A RO cards html lang=ro");
assert(roCardsHtml.includes("Crăciun"), "P3A RO cards Romanian copy in raw HTML");
assert(
  extractCanonical(roCardsHtml) === `${SITE_ORIGIN}/ro/christmas/cards`,
  "P3A RO cards self-canonical under /ro",
);
assert(roCardsHtml.includes('hreflang="en"'), "P3A RO→EN reciprocal hreflang");
assert(roCardsHtml.includes('hreflang="ro"'), "P3A RO self hreflang");
assert(roCardsHtml.includes('hreflang="x-default"'), "P3A RO x-default");
assert(robotsIsIndex(roCardsHtml), "P3A complete RO cards remain indexable");

const roSantaHtml = applyChristmasSeo(template, "/ro/christmas/santa-video");
assert(roSantaHtml.includes("Moș Crăciun"), "P3A RO santa raw HTML localized");
assert(
  extractCanonical(roSantaHtml) === `${SITE_ORIGIN}/ro/christmas/santa-video`,
  "P3A RO santa self-canonical",
);

const roIncompleteHtml = applyChristmasSeo(template, "/de/christmas/santa-video");
assert(robotsIsNoindex(roIncompleteHtml), "P3A/P3B product-gated DE santa noindex");
assert(!/hreflang=/i.test(roIncompleteHtml), "P3A/P3B product-gated DE santa must not emit hreflang");

// —— P3B Wave 1 spot checks ——
const deCards = applyChristmasSeo(template, "/de/christmas/cards");
assert(/lang="de"/.test(deCards), "P3B DE cards lang=de");
assert(robotsIsIndex(deCards), "P3B DE cards indexable");
assert(deCards.includes('hreflang="fr"'), "P3B DE cards hreflang includes FR");
assert(
  extractCanonical(deCards) === `${SITE_ORIGIN}/de/christmas/cards`,
  "P3B DE cards self-canonical",
);

const frHub = applyChristmasSeo(template, "/fr/christmas");
assert(/lang="fr"/.test(frHub), "P3B FR hub lang=fr");
assert(frHub.includes("/fr/christmas/cards"), "P3B FR hub locale-internal links");

const plWish = applyChristmasSeo(template, "/pl/christmas/wishlist");
assert(/lang="pl"/.test(plWish), "P3B PL wishlist lang=pl");
assert(/[ąćęłńóśźż]/i.test(plWish), "P3B PL diacritics present");

const ptSanta = applyChristmasSeo(template, "/pt/christmas/santa-video");
assert(/lang="pt-PT"/.test(ptSanta), "P3B PT santa lang=pt-PT");
assert(robotsIsNoindex(ptSanta), "P3B PT santa product-gated noindex");

assert(enCardsByLang.de === `${SITE_ORIGIN}/de/christmas/cards`, "P3B hreflang de reciprocal");
assert(enCardsByLang["pt-PT"] === `${SITE_ORIGIN}/pt/christmas/cards`, "P3B hreflang pt-PT");

const distRoCards = join(root, "dist", "ro", "christmas", "cards", "index.html");
if (existsSync(distRoCards)) {
  const prerenderRo = readFileSync(distRoCards, "utf8");
  assert(/lang="ro"/.test(prerenderRo), "P3A prerender RO cards lang=ro");
  assert(
    extractCanonical(prerenderRo) === `${SITE_ORIGIN}/ro/christmas/cards`,
    "P3A prerender RO cards canonical",
  );
  assert(prerenderRo.includes('hreflang="en"'), "P3A prerender reciprocal hreflang");
} else {
  ok("P3A prerender RO cards not in dist yet (run build first)");
}

const distDeCards = join(root, "dist", "de", "christmas", "cards", "index.html");
if (existsSync(distDeCards)) {
  const prerenderDe = readFileSync(distDeCards, "utf8");
  assert(/lang="de"/.test(prerenderDe), "P3B prerender DE cards lang=de");
  assert(robotsIsIndex(prerenderDe), "P3B prerender DE cards indexable");
} else {
  ok("P3B prerender DE cards not in dist yet (run build first)");
}

// —— 3) Optional live / origin fetch ——
const liveBase = String(process.env.CHRISTMAS_SEO_BASE || "").replace(/\/$/, "");
const originBase = String(process.env.CHRISTMAS_SEO_ORIGIN || "").replace(/\/$/, "");

async function checkOrigin(base) {
  console.log(`\nOrigin HTTP checks against ${base}`);
  // Wait briefly for origin boot when tests start immediately after spawn.
  for (let i = 0; i < 20; i++) {
    try {
      const health = await fetch(`${base}/healthz`);
      if (health.ok || health.status === 404) break;
    } catch {
      await new Promise((r) => setTimeout(r, 150));
    }
  }

  const gifts = await fetch(`${base}/christmas/gifts?utm_source=smoke`, { redirect: "manual" });
  assert([301, 308].includes(gifts.status), `gifts permanent redirect status ${gifts.status}`);
  const loc = gifts.headers.get("location") || "";
  assert(loc.includes("/christmas/gift-finder"), `gifts Location → gift-finder (${loc})`);
  assert(loc.includes("utm_source=smoke"), "gifts redirect keeps utm");

  const slash = await fetch(`${base}/christmas/`, { redirect: "manual" });
  assert([301, 308].includes(slash.status), `trailing slash redirect ${slash.status}`);

  const unknown = await fetch(`${base}/christmas/not-a-real-product`, { redirect: "manual" });
  assert(unknown.status === 404, `unknown christmas 404 got ${unknown.status}`);

  for (const path of CHRISTMAS_INDEXABLE_PATHS) {
    const res = await fetch(`${base}${path}`, { redirect: "follow" });
    assert(res.ok, `HTTP ${res.status} for ${path}`);
    const html = await res.text();
    assert(robotsIsIndex(html), `indexable robots ${path}`);
    assert(extractCanonical(html) === `${SITE_ORIGIN}${path}`, `origin canonical ${path}`);
    assert(!extractCanonical(html).includes("?"), `canonical no query ${path}`);
  }

  for (const path of ["/christmas/kids", "/christmas-ai-photos", "/christmas-ai-photos/order"]) {
    const res = await fetch(`${base}${path}`, { redirect: "follow" });
    assert(res.ok, `HTTP ${res.status} for noindex ${path}`);
    const html = await res.text();
    assert(robotsIsNoindex(html), `noindex robots ${path}`);
  }

  const santa = await fetch(`${base}/christmas/santa-video?name=John`, { redirect: "follow" });
  const santaHtml = await santa.text();
  assert(extractCanonical(santaHtml) === `${SITE_ORIGIN}/christmas/santa-video`, "santa query stripped from canonical");
  assert(!extractCanonical(santaHtml).includes("John"), "canonical has no John");
  assert(!extractTitle(santaHtml).includes("John"), "title has no John");

  const cards = await fetch(`${base}/christmas/cards?theme=elegant`, { redirect: "follow" });
  const cardsHtml = await cards.text();
  assert(extractCanonical(cardsHtml) === `${SITE_ORIGIN}/christmas/cards`, "cards theme query stripped");
}

if (originBase) {
  try {
    await checkOrigin(originBase);
  } catch (err) {
    fail(`origin checks: ${err instanceof Error ? err.message : String(err)}`);
  }
} else {
  console.log("\n(skip origin HTTP — set CHRISTMAS_SEO_ORIGIN to enable)");
}

if (liveBase) {
  console.log(`\nLive checks against ${liveBase}`);
  for (const path of CHRISTMAS_INDEXABLE_PATHS) {
    const route = getChristmasSeo(path);
    if (!route) continue;
    try {
      const res = await fetch(`${liveBase}${path}`, {
        redirect: "follow",
        headers: { "user-agent": "TDG-Christmas-SEO-Smoke/1.0" },
      });
      assert(res.ok, `HTTP ${res.status} for ${path}`);
      const html = await res.text();
      assert(extractTitle(html) === route.title, `live title ${path}`);
      assert(extractCanonical(html) === `${SITE_ORIGIN}${route.canonicalPath}`, `live canonical ${path}`);
    } catch (err) {
      fail(`live fetch ${path}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
} else {
  console.log("(skip live fetch — set CHRISTMAS_SEO_BASE to enable)");
}

const outDir = join(root, "output");
mkdirSync(outDir, { recursive: true });
writeFileSync(
  join(outDir, "christmas-seo-smoke.json"),
  JSON.stringify(
    {
      ok: failures.length === 0,
      routes: paths.length,
      indexable: CHRISTMAS_INDEXABLE_PATHS.length,
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
console.log(`indexable: ${CHRISTMAS_INDEXABLE_PATHS.length}`);
console.log(`unique titles: ${uniqueTitles.size}/${titles.length}`);
console.log(`unique descriptions: ${uniqueDescs.size}/${descs.length}`);
console.log(`failures: ${failures.length}`);

if (failures.length) {
  process.exit(1);
}

console.log("Christmas SEO smoke passed.");
