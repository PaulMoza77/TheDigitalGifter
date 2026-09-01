#!/usr/bin/env node
/**
 * Vercel Ignore Command.
 * Exit 0 = skip this deployment. Exit 1 = continue building.
 *
 * Preview and Development deploys always build.
 * Production on Hobby is often paused/blocked for commercial sites — skip it here
 * so CI stays green while static deploy runs via GitHub Pages / VPS workflows.
 * Set ENABLE_PRODUCTION_DEPLOY=1 on Vercel when account is unpaused and you want prod again.
 */

const vercelEnv = String(process.env.VERCEL_ENV || "").toLowerCase();
const allowProduction = process.env.ENABLE_PRODUCTION_DEPLOY === "1";
const commitMessage = String(process.env.VERCEL_GIT_COMMIT_MESSAGE || "");
const allowMarkedPublish = commitMessage.includes("[prod-publish]");

if (vercelEnv === "production" && !allowProduction && !allowMarkedPublish) {
  console.log(
    "[release-control] Skipping production deploy. Set ENABLE_PRODUCTION_DEPLOY=1 on the Vercel Production environment, or include [prod-publish] in the commit message, when you are ready to publish.",
  );
  process.exit(0);
}

console.log(
  `[release-control] Continuing ${vercelEnv || "unknown"} deploy.`,
);
process.exit(1);
