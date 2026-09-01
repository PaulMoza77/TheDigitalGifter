#!/usr/bin/env node
/**
 * Vercel Ignore Command for this repository only.
 * Exit 0 = skip this deployment. Exit 1 = continue building.
 *
 * Production is Mozas VPS. Skip all Vercel builds for
 * the-digital-gifter and the-digital-gifter-d5vu so GitHub pushes
 * do not republish those two projects. Existing Vercel deployments
 * stay as rollback until the founder confirms a live payment.
 */
const vercelEnv = String(process.env.VERCEL_ENV || "").toLowerCase();
console.log(`[release-control] Skipping Vercel ${vercelEnv || "unknown"} deploy — TDG origin is Mozas VPS.`);
process.exit(0);
