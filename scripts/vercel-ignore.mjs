#!/usr/bin/env node
/**
 * Vercel Ignore Command.
 * Exit 0 = skip this deployment. Exit 1 = continue building.
 *
 * Production deploys always build — checkout/Apple Pay fixes must reach www.
 */
const vercelEnv = String(process.env.VERCEL_ENV || "").toLowerCase();

console.log(`[release-control] Continuing ${vercelEnv || "unknown"} deploy.`);
process.exit(1);
