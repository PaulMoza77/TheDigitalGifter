/**
 * Indexable Christmas URLs for /sitemap.xml.
 * Static inclusion only — programmatic SEO factory / SSR remains CHRISTMAS-033.
 * Private share routes are never listed.
 */

export const CHRISTMAS_INDEXABLE_SITEMAP_PATHS = [
  "/christmas",
  "/christmas-ai-photos",
  "/christmas/advent",
  "/christmas/cards",
  "/christmas/cats",
  "/christmas/couples",
  "/christmas/dogs",
  "/christmas/family",
  "/christmas/gift-finder",
  "/christmas/messages",
  "/christmas/pets",
  "/christmas/photo-generator",
  "/christmas/santa-video",
  "/christmas/tree",
  "/christmas/wishlist",
] as const;

/** Private share surfaces — never emit these (or any :shareId) into /sitemap.xml. */
export const CHRISTMAS_SITEMAP_PRIVATE_PREFIXES = [
  "/christmas/tree/",
  "/wishlist/",
] as const;

export function isChristmasPrivateSharePath(pathname: string): boolean {
  const path = pathname.split("?")[0];
  if (path.includes(":shareId")) return true;
  return CHRISTMAS_SITEMAP_PRIVATE_PREFIXES.some((prefix) => path.startsWith(prefix));
}

export function christmasIndexableSitemapPaths(): string[] {
  return CHRISTMAS_INDEXABLE_SITEMAP_PATHS.filter((path) => !isChristmasPrivateSharePath(path));
}

export function sitemapPathnameFromLoc(loc: string): string {
  if (!loc.startsWith("http://") && !loc.startsWith("https://")) {
    return loc.split("?")[0];
  }
  try {
    return new URL(loc).pathname;
  } catch {
    return loc.split("?")[0];
  }
}

export function shouldOmitFromSitemap(locOrPath: string): boolean {
  return isChristmasPrivateSharePath(sitemapPathnameFromLoc(locOrPath));
}
