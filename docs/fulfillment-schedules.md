# Fulfillment schedules

`supabase/config.toml` comments are not a scheduler. Production recovery is
`pg_cron` + `pg_net` reading Vault secret **names** only.

PGlite tests cover claim/backoff SQL. They do **not** install or verify cron.

## Secrets (never commit values)

Create these in the Supabase Dashboard → Project Settings → Vault:

| Vault name | Value |
| --- | --- |
| `fulfillment_project_url` | `https://<project-ref>.supabase.co` |
| `fulfillment_scheduler_bearer` | `SUPABASE_SERVICE_ROLE_KEY` (Bearer accepted by `requireSchedulerAuth`) |

Do not put the values in Git, `.env.example`, or this runbook.

## Install

1. Apply migrations through `20260817_fulfillment_schedules.sql`.
2. If Vault secrets were created after the migration:

```sql
select public.ensure_fulfillment_schedules();
select public.fulfillment_schedule_status();
```

Expected `ok: true` with:

- `process-fulfillment-jobs` at `* * * * *`
- `purge-expired-media` at `15 * * * *`

## Post-deploy check

From CI or a laptop with a database URL (not stored in Git):

```bash
SUPABASE_DB_URL=postgres://... npm run verify:schedules
```

Without `SUPABASE_DB_URL`, the script only checks that the migration defines
both jobs and contains no secret literals.

## Dashboard fallback

If pg_cron is unavailable, create the same two Edge Function schedules in
Dashboard → Edge Functions → Schedules, with header
`Authorization: Bearer <service role>` (pasted in the dashboard, not Git).
The SQL verifier will stay red until `ensure_fulfillment_schedules()` succeeds.
Treat Dashboard-only schedules as a temporary exception, not the official method.
