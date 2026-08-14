import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

/** Strip GRANT/POLICY/RLS so vanilla Postgres and PGlite can load the SQL. */
export function sqlForPglite(raw: string) {
  return raw
    .replace(/drop policy if exists access_redeem_codes_no_direct_access on public.access_redeem_codes;/gi, "")
    .replace(/create policy access_redeem_codes_no_direct_access[\s\S]*?;/gi, "")
    .replace(/revoke all on function[\s\S]*?;/gi, "")
    .replace(/grant execute on function[\s\S]*?;/gi, "")
    .replace(/alter table public.access_redeem_codes enable row level security;/gi, "");
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
  return `${harness}\n${recovery}\n${redeem}`;
}
