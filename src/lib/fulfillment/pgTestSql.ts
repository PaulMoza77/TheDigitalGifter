import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

export const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

export function resolvePgBin(name: string): string {
  const which = spawnSync("bash", ["-c", `command -v ${name}`], {
    encoding: "utf8",
    env: process.env,
  });
  if (which.status === 0) {
    const found = String(which.stdout || "").trim();
    if (found) return found;
  }
  const candidates = [
    `/opt/homebrew/opt/postgresql@16/bin/${name}`,
    `/usr/local/opt/postgresql@16/bin/${name}`,
    `/usr/lib/postgresql/16/bin/${name}`,
  ];
  return candidates.find((file) => existsSync(file)) || "";
}

/** Strip GRANT/POLICY/RLS so vanilla Postgres and PGlite can load the SQL. */
export function sqlForPglite(raw: string) {
  return raw
    .replace(/drop policy if exists [\w]+ on public\.\w+;/gi, "")
    .replace(/create policy [\w]+[\s\S]*?;/gi, "")
    .replace(/revoke all on (?:function|table)[\s\S]*?;/gi, "")
    .replace(/grant (?:execute on function|select, insert on table|all on table)[\s\S]*?;/gi, "")
    .replace(/alter table public\.\w+ enable row level security;/gi, "");
}

/** Claim/backoff/redeem SQL only. Does not install pg_cron or Vault schedules. */
export function fulfillmentSqlForUnitTests() {
  const harness = readFileSync(join(repoRoot, "supabase/tests/pg_harness.sql"), "utf8");
  const recovery = sqlForPglite(
    readFileSync(join(repoRoot, "supabase/migrations/20260815_scheduler_recovery.sql"), "utf8"),
  );
  const redeem = sqlForPglite(
    readFileSync(join(repoRoot, "supabase/migrations/20260816_redeem_and_email.sql"), "utf8"),
  );
  const blockers = sqlForPglite(
    readFileSync(join(repoRoot, "supabase/migrations/20260818_review_blockers.sql"), "utf8"),
  );
  const hardening = sqlForPglite(
    readFileSync(join(repoRoot, "supabase/migrations/20260819_fulfillment_hardening.sql"), "utf8"),
  );
  return `${harness}\n${recovery}\n${redeem}\n${blockers}\n${hardening}`;
}
