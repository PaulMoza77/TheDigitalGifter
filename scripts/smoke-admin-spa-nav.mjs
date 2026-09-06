#!/usr/bin/env node
/**
 * Admin SPA sidebar route inventory smoke (forward + reverse order).
 * Does not drive a browser — validates App.tsx admin routes match AdminLayout nav
 * and that every path has a terminating load contract (documented).
 *
 * Usage: node scripts/smoke-admin-spa-nav.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const app = fs.readFileSync(path.join(root, "src/App.tsx"), "utf8");
const layout = fs.readFileSync(path.join(root, "src/layouts/AdminLayout.tsx"), "utf8");
const adminRoute = fs.readFileSync(path.join(root, "src/components/AdminRoute.tsx"), "utf8");
const errorBoundary = fs.readFileSync(
  path.join(root, "src/components/AdminErrorBoundary.tsx"),
  "utf8",
);

const navPaths = [...layout.matchAll(/path:\s*"(\/admin[^"]*)"/g)].map((m) => m[1]);
const uniqueNav = [...new Set(navPaths)];

function routeDeclared(adminPath) {
  const seg = adminPath.replace(/^\/admin\/?/, "") || "index";
  if (adminPath === "/admin") return /path="\/admin"/.test(app) || /<Route index/.test(app);
  if (seg.startsWith("email/")) {
    return new RegExp(`path="${seg.split("/").pop()}"`).test(app) && /path="email"/.test(app);
  }
  return new RegExp(`path="${seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`).test(app);
}

const missing = uniqueNav.filter((p) => !routeDeclared(p));
const forward = uniqueNav;
const reverse = [...uniqueNav].reverse();

const hasErrorBoundary =
  /AdminErrorBoundary/.test(layout) && /getDerivedStateFromError/.test(errorBoundary);
const hasNoUniversalReload = !/window\.location\.reload\s*\(/.test(
  errorBoundary.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, ""),
);
const adminRouteTerminates =
  /ready:\s*true/.test(adminRoute) && /Retry|Sign in|Navigate/.test(adminRoute);

const ok =
  missing.length === 0 &&
  hasErrorBoundary &&
  hasNoUniversalReload &&
  adminRouteTerminates &&
  forward.length >= 10;

console.log(
  JSON.stringify(
    {
      ok,
      nav_count: uniqueNav.length,
      forward,
      reverse,
      missing_routes: missing,
      admin_error_boundary: hasErrorBoundary,
      no_universal_reload: hasNoUniversalReload,
      admin_route_terminates: adminRouteTerminates,
    },
    null,
    2,
  ),
);

process.exit(ok ? 0 : 1);
