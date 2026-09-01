/**
 * Path classification for the Mozas TDG origin.
 * /api/* never falls through to the SPA index.html.
 */

export const API_MODULES = {
  "/api/pet/funnel-event": "pet-funnel-event.ts",
  "/api/pet-funnel-event": "pet-funnel-event.ts",
  "/api/pet-v2/funnel-event": "pet-v2-funnel-event.ts",
  "/api/pet-v2-funnel-event": "pet-v2-funnel-event.ts",
  "/api/pet-v3/funnel-event": "pet-v3-funnel-event.ts",
  "/api/pet-v3-funnel-event": "pet-v3-funnel-event.ts",
  "/api/pet-v3/internal-test-status": "pet-v3-internal-test-status.ts",
  "/api/pet-v3-internal-test-status": "pet-v3-internal-test-status.ts",
  "/api/pet-provider-status": "pet-provider-status.ts",
  "/api/christmas-v2/funnel-event": "christmas-v2-funnel-event.ts",
  "/api/christmas-v2-funnel-event": "christmas-v2-funnel-event.ts",
  "/sitemap.xml": "sitemap.xml.ts",
  "/api/sitemap.xml": "sitemap.xml.ts",
};

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
  if (path === "/api" || path.startsWith("/api/")) {
    return { kind: "api-miss" };
  }
  return { kind: "static" };
}
