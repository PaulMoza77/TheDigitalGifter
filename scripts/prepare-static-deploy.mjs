#!/usr/bin/env node
/**
 * Build + prepare dist for static hosts (GitHub Pages, VPS nginx, Cloudflare Pages).
 * - SPA fallback via 404.html (GitHub Pages)
 * - CNAME for custom domain when present in public/
 */
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const dist = join(root, "dist");

console.log("Building production bundle…");
execSync("npm run build", { cwd: root, stdio: "inherit" });

if (!existsSync(dist)) {
  console.error("dist/ missing after build");
  process.exit(1);
}

const index = join(dist, "index.html");
if (!existsSync(index)) {
  console.error("dist/index.html missing");
  process.exit(1);
}

writeFileSync(join(dist, "404.html"), readFileSync(index));
console.log("Wrote dist/404.html for SPA routing.");

const applePayAssociation = String(process.env.STRIPE_APPLE_PAY_DOMAIN_ASSOCIATION || "").trim();
if (applePayAssociation && !applePayAssociation.includes("PLACEHOLDER_CONFIGURE")) {
  const wellKnownDir = join(dist, ".well-known");
  mkdirSync(wellKnownDir, { recursive: true });
  writeFileSync(
    join(wellKnownDir, "apple-developer-merchantid-domain-association"),
    applePayAssociation,
  );
  console.log("Wrote dist/.well-known/apple-developer-merchantid-domain-association for Apple Pay.");
}

const cnameSrc = join(root, "public", "CNAME");
if (existsSync(cnameSrc)) {
  cpSync(cnameSrc, join(dist, "CNAME"));
  console.log("Copied public/CNAME → dist/CNAME");
}

console.log("Static deploy bundle ready in dist/");
