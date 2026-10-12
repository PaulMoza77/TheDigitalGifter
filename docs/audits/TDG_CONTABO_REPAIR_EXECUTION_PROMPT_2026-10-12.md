# Contabo repair execution prompt (authorized human / next agent)

Copy-paste when Contabo **exec** SSH is available. Default to read-only inventory first; apply only after explicit owner authorization for writes.

```text
ROLE: Contabo Supabase Security + Edge Repair
TARGET: root@62.171.191.209 (vmi3646115)
AUTH: Contabo exec SSH key (NOT tunnel-key; must allow remote command execution)
HARD STOP UNTIL OWNER SAYS APPLY: start READ-ONLY. No Caddy/DNS/Mozas tunnel edits. No live Stripe charges.

PHASE 0 — IDENTITY (read-only)
- hostname; docker ps
- Confirm ~11 Supabase containers healthy
- Locate compose file + functions container name + Mounts HostSource

PHASE 1 — SECURITY VERIFY (read-only)
- psql: pg_get_functiondef('public.is_admin()'::regprocedure)
- List triggers on public.profiles
- Column privileges on profiles.role / is_volocar_admin for authenticated
- Count: profiles.role='admin' emails not in admin_users (expect 0)
- Check whether 20261012130000 appears in supabase_migrations.schema_migrations (or equivalent)

PHASE 1b — SECURITY APPLY (only if owner authorizes)
- Backup schema/function/grants as in docs/audits/TDG_CONTABO_READONLY_P0_INSPECT_2026-10-12.md
- Apply ONLY: supabase/migrations/20261012130000_hotfix_admin_role_escalation.sql (PR #356)
- Re-verify is_admin body = admin_users only; trigger present; grants revoked
- Preserve admin_users allowlist (5 emails already present)

PHASE 2 — EDGE (read-only then repair)
- ls HostSource for stripe-webhook, christmas-funnel, delete-my-account, create-checkout-session, pet-funnel
- docker logs functions --tail 200
- env | cut -d= -f1 | grep -iE 'STRIPE|WEBHOOK'   # NAMES ONLY

PHASE 2b — EDGE APPLY (only if owner authorizes)
- Remount/sync full supabase/functions tree so every slug has index.ts
- Restart ONLY functions/edge worker
- Ensure STRIPE_WEBHOOK_SECRET is set in Contabo Edge env (do not print)
- No-charge probes:
  - POST /functions/v1/delete-my-account {} → not 500 entrypoint
  - POST /functions/v1/stripe-webhook with bad signature → 400 (not 503)
  - POST /functions/v1/christmas-funnel {} → 400 unknown action (still OK)

PHASE 3 — REPORT
- Security SAFE/VULNERABLE with functiondef excerpt (redact secrets)
- Edge entrypoint matrix before/after
- Stripe webhook status
- Explicit: do NOT merge/deploy #353 until SAFE + webhook 400-on-badsig
```

---

## Ordering reminder

1. Contabo exec access  
2. #356 SQL apply + verify  
3. Edge remount + `STRIPE_WEBHOOK_SECRET`  
4. Optional #357  
5. Only then authorize #353 migrations/functions/frontend  
