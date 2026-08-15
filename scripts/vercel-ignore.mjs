#!/usr/bin/env node
/**
 * Vercel Ignore Command.
 * Exit 0 = skip this deployment. Exit 1 = continue building.
 *
 * Preview and Development deploys always build.
 * Production deploys are skipped unless ENABLE_PRODUCTION_DEPLOY=1 so a
 * merge to main cannot publish the site by accident.
 */

const vercelEnv = String(process.env.VERCEL_ENV || "").toLowerCase();
const allowProduction = process.env.ENABLE_PRODUCTION_DEPLOY === "1";

if (vercelEnv === "production" && !allowProduction) {
  console.log(
    "[release-control] Skipping production deploy. Set ENABLE_PRODUCTION_DEPLOY=1 on the Vercel Production environment when you are ready to publish.",
  );
  process.exit(0);
}

console.log(
  `[release-control] Continuing ${vercelEnv || "unknown"} deploy.`,
);
process.exit(1);
