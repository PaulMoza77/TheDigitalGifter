/**
 * Path classification for the Mozas TDG origin.
 * /api/* never falls through to the SPA index.html.
 */

export const API_MODULES = {
  "/api/pet/funnel-event": "pet-funnel-event.ts",
  "/api/pet-funnel-event": "pet-funnel-event.ts",
  "/api/pet-v2/funnel-event": "pet-v2-funnel-event.ts",
  "/api/pet-v2/funnel-event": "pet-v2-funnel-event.ts",
  "/api/pet-v3/funnel-event": "pet-v3-funnel-event.ts",
  "/api/pet-v3-funnel-event": "pet-v3-funnel-event.ts",
  "/api/pet-v4/funnel-event": "pet-v4-funnel-event.ts",
  "/api/pet-v4-funnel-event": "pet-v4-funnel-event.ts",
  "/api/pet-v3/internal-test-status": "pet-v3-internal-test-status.ts",
  "/api/pet-v3-internal-test-status": "pet-v3-internal-test-status.ts",
  "/api/pet-provider-status": "pet-provider-status.ts",
  "/api/christmas-funnel": "christmas-funnel.ts",
  "/api/christmas-santa-compose": "christmas-santa-compose.ts",
  "/api/christmas/funnel-event": "christmas-funnel-event.ts",
  "/api/christmas-funnel-event": "christmas-funnel-event.ts",
  "/api/christmas/gift-tree": "christmas-gift-tree.ts",
  "/api/christmas-gift-tree": "christmas-gift-tree.ts",
  "/api/christmas/club-signup": "christmas-club-signup.ts",
  "/api/christmas-club-signup": "christmas-club-signup.ts",
  "/api/christmas-v2/funnel-event": "christmas-v2-funnel-event.ts",
  "/api/christmas-v2-funnel-event": "christmas-v2-funnel-event.ts",
  "/sitemap.xml": "sitemap.xml.ts",
  "/api/sitemap.xml": "sitemap.xml.ts",
  "/api/christmas-seo": "christmas-seo.ts",
};

const CHRISTMAS_SEO_PATH =
  /^\/(?:ro\/)?christmas\/(?:gifts-for-[a-z0-9-]+|messages-for-[a-z0-9-]+|funny-christmas-messages|romantic-christmas-messages|professional-christmas-messages|short-christmas-wishes|christmas-messages-for-family)$/;

export const APPLE_PAY_PATH = "/.well-known/apple-developer-merchantid-domain-association";

/**
 * @param {string} pathname
 * @returns {{ kind: "health" | "apple" | "api" | "api-miss" | "static", module?: string }}
 */
export function classifyPath(pathname) {
  const path = String(pathname || "/").split("?")[0] || "/";
  if (path === "/healthz") return { kind: "health" };
  if (path === APPLE_PAY_PATH) return { kind: "apple" };
  if (Object.prototype.hasOwnProperty.call(API_MODULES, path)) {
    return { kind: "api", module: API_MODULES[path] };
  }
  if (CHRISTMAS_SEO_PATH.test(path)) {
    return { kind: "api", module: "christmas-seo.ts" };
  }
  if (path === "/api" || path.startsWith("/api/")) {
    return { kind: "api-miss" };
  }
  return { kind: "static" };
}
