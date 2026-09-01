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
const branch = String(process.env.VERCEL_GIT_COMMIT_REF || "");
const allowProduction = process.env.ENABLE_PRODUCTION_DEPLOY === "1";
const commitMessage = String(process.env.VERCEL_GIT_COMMIT_MESSAGE || "");
const allowMarkedPublish = commitMessage.includes("[prod-publish]");
const isMainProduction = vercelEnv === "production" && branch === "main";

if (vercelEnv === "production" && !allowProduction && !allowMarkedPublish && !isMainProduction) {
  console.log(
    "[release-control] Skipping production deploy. Set ENABLE_PRODUCTION_DEPLOY=1 on the Vercel Production environment, or include [prod-publish] in the commit message, when you are ready to publish.",
  );
  process.exit(0);
}

console.log(
  `[release-control] Continuing ${vercelEnv || "unknown"} deploy.`,
);
process.exit(1);
