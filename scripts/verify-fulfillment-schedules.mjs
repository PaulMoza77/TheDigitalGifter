#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const root = process.cwd();
const migrationRel = "supabase/migrations/20260817_fulfillment_schedules.sql";
const sql = readFileSync(join(root, migrationRel), "utf8");

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exitCode = 1;
}

function ok(message) {
  console.log(`ok: ${message}`);
}

const jobs = [
  { name: "process-fulfillment-jobs", schedule: "* * * * *" },
  { name: "purge-expired-media", schedule: "15 * * * *" },
];

for (const job of jobs) {
  if (!sql.includes(`'${job.name}'`) && !sql.includes(`"${job.name}"`)) {
    fail(`${migrationRel} must define job ${job.name}`);
  } else {
    ok(`migration names ${job.name}`);
  }
  if (!sql.includes(`'${job.schedule}'`)) {
    fail(`${migrationRel} must schedule ${job.name} at ${job.schedule}`);
  } else {
    ok(`migration schedule ${job.name} = ${job.schedule}`);
  }
}

if (!sql.includes("fulfillment_project_url") || !sql.includes("fulfillment_scheduler_bearer")) {
  fail("migration must reference Vault secret names only");
} else {
  ok("migration references Vault secret names");
}

const secretLiterals = [
  /sk_live_[A-Za-z0-9]+/,
  /sk_test_[A-Za-z0-9]+/,
  /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]+\./,
  /service_role['"]\s*:\s*['"][A-Za-z0-9]/,
];
for (const pattern of secretLiterals) {
  if (pattern.test(sql)) fail(`${migrationRel} must not contain secret literals (${pattern})`);
}
if (!process.exitCode) ok("migration has no secret literals");

const config = readFileSync(join(root, "supabase/config.toml"), "utf8");
if (!config.includes("docs/fulfillment-schedules.md")) {
  fail("config.toml must point at the official scheduler runbook");
} else {
  ok("config.toml points at the scheduler runbook");
}

const envExample = readFileSync(join(root, ".env.example"), "utf8");
if (!envExample.includes("20260817_fulfillment_schedules.sql")) {
  fail(".env.example must point at the official scheduler migration");
} else {
  ok(".env.example points at the scheduler migration");
}

const dbUrl = String(process.env.SUPABASE_DB_URL || "").trim();
if (!dbUrl) {
  ok("static schedule check only (set SUPABASE_DB_URL for the live post-deploy check)");
} else {
  const psql = spawnSync(
    "psql",
    [dbUrl, "-At", "-c", "select public.fulfillment_schedule_status();"],
    { encoding: "utf8" },
  );
  if (psql.status !== 0) {
    fail(`live schedule status failed: ${psql.stderr || psql.stdout}`);
  } else {
    const raw = String(psql.stdout || "").trim();
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      fail(`fulfillment_schedule_status returned non-JSON: ${raw}`);
      parsed = null;
    }
    if (parsed) {
      if (parsed.ok !== true) fail(`both schedules are required: ${raw}`);
      else ok("live fulfillment_schedule_status ok");
    }
  }
}

if (process.exitCode) process.exit(process.exitCode);
console.log("Fulfillment schedule verification passed.");
