# TDG Contabo Read-Only P0 Inspection — 2026-10-12 (session 2)

**Role:** Senior Supabase Self-Hosted SRE + PostgreSQL Security Engineer  
**Hard stops honored:** No SQL writes, migrations, Docker restarts/remounts, secrets changes, merges, deploys, billing, customer data changes, or Stripe operations.

---

## Access PASS / FAIL

| Check | Result | Evidence |
|-------|--------|----------|
| Agent has Contabo exec SSH key (`~/.ssh/id_ed25519` / `CONTABO_SSH_*`) | **FAIL** | Key absent in agent secrets; only `MOZAS_SSH_*` injected |
| `ssh root@62.171.191.209` from agent (Mozas key) | **FAIL** | `Permission denied (publickey,password)` |
| Contabo exec from Mozas host | **FAIL** | Same Permission denied (tunnel-key remains port-forward-only) |
| Mozas SSH (`MOZAS_SSH_*`) | **PASS** | Host `mozas-prod-01` |
| Contabo Kong via Mozas tunnel `tdg-staging-supabase-tunnel` | **PASS** | Unit active; `-L 127.0.0.1:19000:127.0.0.1:8000` → Auth health **200** GoTrue `v2.196.0` |
| Public API `https://supabase.thedigitalgifter.com` | **PASS** | Auth health **200** (`v2.196.0`); Storage status **200**; REST responds (401 without key / 200 with service role) |
| Production frontend image (Mozas) | **PASS** | `thedigitalgifter` → `mozas/thedigitalgifter:15d938c3` (running) |
| Contabo hostname / 11 containers via `docker ps` | **BLOCKED** | Needs Contabo exec (user claimed `vmi3646115` / 11 healthy — not re-verified this session) |

**Verified host identity (indirect):**

- Contabo target: `root@62.171.191.209` (user: `vmi3646115`)
- Tunnel service on Mozas points at that host and serves Contabo Kong on `127.0.0.1:19000` matching public GoTrue version
- Mozas: `mozas-prod-01`

**Owner action still required for full Phase A/B host inventory:** inject `CONTABO_SSH_PRIVATE_KEY` (exec-capable, not `restrict`/`port-forwarding`/`ForceCommand`) — requested via environment setup actions this session. Do **not** modify the existing tunnel-key line.

---

## Phase A — Security

### What was inspected (read-only API)

| Probe | Result |
|-------|--------|
| `POST /rest/v1/rpc/is_admin` (service_role) | **200** → `false` (expected; service JWT has no user email) |
| `admin_users` | **5** allowlist rows |
| `profiles?role=eq.admin` | **1** row (`content-range: 0-0/1`) |
| Orphan check (profile `role=admin` email ∉ `admin_users`) | **0 orphans** (that one admin email **is** on allowlist) |
| `profiles` OpenAPI columns | includes `role`, `is_volocar_admin` |
| `pg_get_functiondef(is_admin)` / triggers / column grants | **BLOCKED** — no Contabo `psql`; pg-meta Basic auth not available to agent |
| `schema_migrations` via REST | **404** (not exposed) — cannot prove #356 applied via API |
| PR #356 SQL present on Mozas staging/prod repo trees | **Not found** under `20261012*.sql` on sampled paths |

### Compare to PR #356 (`20261012130000_hotfix_admin_role_escalation.sql`)

Expected after apply:

1. `is_admin()` = `admin_users` email match **only** (no `profiles.role` OR-branch)
2. Trigger `profiles_prevent_role_escalation`
3. `authenticated` cannot `UPDATE` privilege columns (`role`, `is_volocar_admin`)

**Production Contabo status:** **UNVERIFIED → treat as VULNERABLE until proven SAFE**

Rationale:

- Function body / trigger / column privileges **cannot** be confirmed without Contabo exec.
- `profiles.role` still exists as a writable-shaped column in the live OpenAPI schema.
- #356 migration file not observed on Contabo/Mozas deploy trees; REST cannot show migration history.
- Prior Cloud MCP evidence was `VULNERABLE_OR_BRANCH`; Contabo cutover does **not** prove the hotfix was applied.

**Pre-apply readiness (partial PASS):** orphan `profiles.role='admin'` not in `admin_users` = **0** (safe to apply from allowlist standpoint once exec available).

### Safe SQL apply procedure (PREPARE ONLY — do not run)

1. **Backup (Contabo exec):**
   ```bash
   docker exec -t <db-container> pg_dump -U postgres -d postgres \
     --schema-only -t public.profiles -t public.admin_users \
     > /root/backup_admin_schema_$(date -u +%Y%m%dT%H%M%SZ).sql
   docker exec -t <db-container> psql -U postgres -d postgres -c \
     "select pg_get_functiondef('public.is_admin()'::regprocedure);" \
     > /root/backup_is_admin_def_$(date -u +%Y%m%dT%H%M%SZ).txt
   docker exec -t <db-container> psql -U postgres -d postgres -c \
     "\df+ public.profiles_prevent_role_escalation" \
     > /root/backup_triggers_$(date -u +%Y%m%dT%H%M%SZ).txt
   # grants
   docker exec -t <db-container> psql -U postgres -d postgres -c \
     "select grantee, privilege_type, column_name from information_schema.column_privileges
      where table_schema='public' and table_name='profiles' and column_name in ('role','is_volocar_admin');"
   ```
2. **Precheck:** orphan admin count = 0 (already true via API) + confirm all production operators in `admin_users`.
3. **Apply** PR #356 file only: `supabase/migrations/20261012130000_hotfix_admin_role_escalation.sql`
4. **Verify:**
   - `pg_get_functiondef` contains `admin_users` and **not** `p.role = 'admin'`
   - trigger exists on `profiles`
   - `authenticated` lacks UPDATE on `role` / `is_volocar_admin`
   - Run `scripts/admin-role-escalation-iso-proof.sql` / `scripts/run-admin-role-escalation-iso.sh` against a clone or Contabo with care
5. **Rollback:** keep trigger + revokes; do **not** restore `profiles.role` OR-branch without incident lead.

---

## Phase B — Edge

### Public function matrix (POST `{}`, no charges)

| Function | HTTP | Body / meaning |
|----------|------|----------------|
| `stripe-webhook` | **503** | `STRIPE_WEBHOOK_SECRET is not configured` → **boots**; secret name missing |
| `christmas-funnel` | **400** | `Unknown action` → **entrypoint OK** |
| `christmas-generate` | **403** | Forbidden (service-role gate) → **entrypoint OK** |
| `christmas-generate-video` | **403** | Forbidden → **entrypoint OK** |
| `christmas-checkout` | **500** | `InvalidWorkerCreation` / missing entrypoint |
| `create-checkout-session` | **500** | missing entrypoint |
| `delete-my-account` | **500** | missing entrypoint |
| `pet-funnel` | **500** | missing entrypoint |
| `pet-generate` | **500** | missing entrypoint |
| `long-form-studio` | **500** | missing entrypoint |

**Root cause (refined):** Contabo Edge functions volume is **partially** populated or selectively synced. Christmas V2 worker slugs that were remounted recently **boot**; many other slugs still lack discoverable `index.ts` → `InvalidWorkerCreation`.

**Mount paths (cannot re-verify without Contabo exec — use this checklist):**

```bash
# On Contabo when exec available (READ-ONLY first)
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}'
docker ps --format '{{.Names}}' | rg -i 'edge|functions|deno'
# Identify functions container, then:
docker inspect <functions-container> --format '{{json .Mounts}}'
# Expect a bind/volume whose Destination looks like /home/deno/functions or similar
ls -la <HostSource>/
ls <HostSource>/stripe-webhook/index.ts \
   <HostSource>/christmas-funnel/index.ts \
   <HostSource>/delete-my-account/index.ts \
   <HostSource>/create-checkout-session/index.ts
docker logs <functions-container> --tail 200
# Env NAMES only (never values):
docker exec <functions-container> sh -c 'env | cut -d= -f1 | sort | grep -iE "STRIPE|WEBHOOK|SUPABASE"'
```

### Stripe webhook blocker

- **Confirmed:** function runs; returns **503** `STRIPE_WEBHOOK_SECRET is not configured`
- Secret **not** in Mozas `app.env` key list (no `STRIPE_*` names) — Contabo Edge env must supply it
- **No-charge probe after secret set (authorized later):** POST with invalid Stripe signature → expect **400** (not 503)

### Smallest Edge repair (authorized later)

1. Sync/remount `supabase/functions` so **every** required slug has `index.ts` (repo-complete tree).
2. Restart **only** the functions/edge worker (not Caddy / not Mozas gateway).
3. Set Contabo Edge env name `STRIPE_WEBHOOK_SECRET` (and related Stripe keys as required) — never print.
4. Probes: entrypoint 500 gone; webhook invalid sig → 400; no live Stripe events.

**Rollback:** remount previous functions volume snapshot / revert compose bind source; restart functions worker only.

---

## Phase C — Release dependencies

| Item | Status |
|------|--------|
| Public gateway Auth/REST/Storage/Realtime | **Healthy** (reconfirmed) |
| Prod image `15d938c3` | **Running** on Mozas |
| PR **#356** security hotfix | **BLOCKED** — Contabo apply + verify |
| PR **#353** Christmas V2 | **HOLD** until #356 Contabo verify + Edge stripe-webhook + remaining entrypoints |
| PR **#358** audit trail | Continue evidence docs |
| Migration order | (1) #356 `20261012130000_*` on Contabo (2) then #353 EUR/Meta/CV2 migrations (3) skip duplicate `is_admin` from #353 `20261012120000_*` if #356 already applied; keep CV2 RLS |
| Backup readiness | **PARTIAL** — procedure written; Contabo dump not taken (no exec). Mozas has `app.env` pre-cutover bak. |

---

## GO / NO-GO

| Gate | Verdict |
|------|---------|
| Browse / public API gateway | **GO** (operational) |
| Contabo SSH exec inventory | **NO-GO** (blocked this agent) |
| Security (#356 prove SAFE) | **NO-GO** — **VULNERABLE until verified** |
| Edge completeness | **NO-GO** — many slugs still missing entrypoint |
| Stripe webhook | **NO-GO** — secret missing (503) |
| Christmas V2 (#353) production | **NO-GO / HOLD** |
| **Overall production platform repair** | **NO-GO** |

---

## One executable follow-up repair prompt

See `docs/audits/TDG_CONTABO_REPAIR_EXECUTION_PROMPT_2026-10-12.md`.
