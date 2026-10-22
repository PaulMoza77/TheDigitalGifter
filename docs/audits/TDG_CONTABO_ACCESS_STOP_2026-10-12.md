# TDG Contabo Access STOP + Edge/Security Status — 2026-10-12

**Hard stops honored:** No Docker/migration/deploy/secrets/merge/billing/storage/Stripe/Mozas/Caddy/DNS changes. Tunnel-key restrictions untouched.

> **Update (same day, session 2):** See `TDG_CONTABO_READONLY_P0_INSPECT_2026-10-12.md` for refreshed public Edge matrix (partial entrypoint recovery: `christmas-funnel` / generate workers boot; many slugs still 500) and Contabo API orphan-admin precheck (0 orphans). Contabo **exec SSH still BLOCKED** for agents without `CONTABO_SSH_PRIVATE_KEY`. Security remains **VULNERABLE until verified**. Repair prompt: `TDG_CONTABO_REPAIR_EXECUTION_PROMPT_2026-10-12.md`.

---

## Phase A — Access status: **BLOCKED**

### Authorized profiles inspected

| Profile / method | Result |
|------------------|--------|
| `tunnel-key` → `root@62.171.191.209` (`vmi3646115.contaboserver.net`) | Authenticates; **remote exec exit 1** (port-forward / restrict style). Tunnel unit still healthy. |
| `/root/.ssh/casahub_deploy` → Contabo | **Permission denied** (publickey) — **do not retry** |
| Mozas `/root/.ssh/config` Host aliases | Only `github.com` — **no Contabo host alias** |
| Agent injected secrets | `MOZAS_SSH_*` + `SUPABASE_SERVICE_ROLE_KEY_mozas` only — **no Contabo exec key** |
| Contabo panel / API token on Mozas | **Not found** under `/opt/mozas/secrets` |
| Ansible inventory for Contabo | **Not found** |
| SFTP subsystem via tunnel-key | Not usable for inventory (same restrict path) |
| Owner console steps | `docs/audits/TDG_CONTABO_OWNER_CONSOLE_STEPS_2026-10-12.md` |

### Inference

- `ssh -vvv` shows **Authenticated … publickey**, then immediate **exit-status** with no command output → Contabo `authorized_keys` almost certainly uses **`restrict,port-forwarding`** (and/or `ForceCommand`) for this key.
- Working tunnel must **not** be modified.

### Exact owner action required (STOP server-side work)

Provide **one** of:

```text
A) Contabo SSH principal with interactive/exec (not port-forward-only), e.g.:
   ssh -i <exec-key> root@62.171.191.209 'docker ps; hostname'

B) Contabo panel / VNC / rescue console with shell

C) Temporary authorized_keys line for inventory (owner-operated), e.g.:
   ssh-ed25519 AAAA… tdg-inventory@$(date +%Y%m%d)
   # WITHOUT restrict/port-forward-only/ForceCommand
   # Remove after inventory + repairs
```

Until then: **Phases B–C Contabo host inspection cannot run.**

---

## Phase B — Security (read-only without Contabo exec)

| Check | Result |
|-------|--------|
| Contabo `pg_get_functiondef(is_admin)` | **BLOCKED** (needs exec/`psql`) |
| Contabo `profiles.role` grants / triggers | **BLOCKED** |
| Contabo migration table for #356 | **BLOCKED** |
| Kong `/rpc/is_admin` (anon) | Returns `false` (expected logged-out) |
| OpenAPI RPCs | Has `/rpc/is_admin`, `/rpc/current_user_email`; **no** RPC named `profiles_before_role_escalation` (triggers are not exposed as RPCs — inconclusive) |
| Legacy Cloud (MCP, prior) | Still **`VULNERABLE_OR_BRANCH`** |

### Smallest hotfix plan (prepare only — **do not apply**)

1. **Backup:** Contabo `pg_dump` of `public.is_admin`, grants, triggers; Mozas already has app.env / Caddy baks.  
2. **Apply on Contabo** (authorized later): PR **#356** SQL  
   `supabase/migrations/20261012130000_hotfix_admin_role_escalation.sql`  
3. **Verify:**  
   - `is_admin` body = `admin_users` only  
   - trigger `profiles_before_role_escalation` present  
   - `authenticated` lacks `UPDATE(role)`  
   - iso-proof script against Contabo (or staging clone)  
4. **App deploy** #356 client (`useAdminAuth`) after SQL.  
5. **Rollback:** keep trigger/revokes; do not restore `profiles.role` OR-branch without incident lead.

---

## Phase C — Edge root cause (from public Kong + prior evidence)

| Observation | Interpretation |
|-------------|----------------|
| Most functions → **500** `InvalidWorkerCreation: … could not find an appropriate entrypoint` | Edge runtime cannot resolve `index.ts` (empty/wrong functions volume mount, or slugs not synced to Contabo). Response via **envoy** then Caddy. |
| `stripe-webhook` → **503** `STRIPE_WEBHOOK_SECRET is not configured` | That slug **boots**; Deno code runs; **secret name missing** in Contabo function env. |
| Mozas `app.env` / `staging.env` | **No** `STRIPE_*` key names present (secrets expected on Contabo, not Mozas web env). |
| Repo on Mozas | **40** function dirs with `index.ts` — sources exist; Contabo discovery fails for most slugs. |

### Contabo inspect checklist (when exec granted — still read-only first)

```bash
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}'
find / -maxdepth 4 -name 'docker-compose.yml' 2>/dev/null | head
# compose: functions volume → host path
docker inspect <functions-container> --format '{{json .Mounts}}'
ls -la <functions-mount> | head
ls <functions-mount>/stripe-webhook <functions-mount>/christmas-checkout 2>&1 | head
docker logs <functions-container> --tail 200
# env NAMES only:
docker exec <functions-container> sh -c 'env | cut -d= -f1 | sort | grep -iE "STRIPE|SUPABASE|WEBHOOK"'
```

### Safe Edge repair procedure (authorized later — not executed now)

1. Remount/sync `supabase/functions` so each slug has entrypoint `index.ts`.  
2. Restart **only** functions worker (authorized); do not touch Caddy/Mozas.  
3. Set `STRIPE_WEBHOOK_SECRET` on Contabo (no print).  
4. No-charge probes:  
   - POST known slug → not 500 entrypoint  
   - `stripe-webhook` invalid signature → **400** (secret loaded)  
   - No live Stripe events / charges  
5. Hold #353.

---

## Phase D — Checklist

| Item | Status |
|------|--------|
| Gateway TLS/Auth/REST/Storage/Realtime/CORS | **DONE** |
| Guest UX / catalog | **DONE** |
| Storage 245 orphans (catalog OK) | **DONE** (non-P0) |
| Contabo SSH exec | **BLOCKED** |
| #356 Contabo verify / apply | **BLOCKED** |
| Edge entrypoint repair | **BLOCKED** (needs Contabo) |
| Stripe webhook secret | **BLOCKED** (needs Contabo) |
| #357 | Optional resilience — not live outage |
| #353 | **HOLD** |
| Merges / deploys | **Not authorized** |

---

## GO / NO-GO

| Scope | Decision |
|-------|----------|
| Public browse / API gateway | **GO** (unchanged) |
| Admin security hardening (#356) | **NO-GO** until Contabo exec + apply |
| Edge / payments webhooks | **NO-GO** until Contabo volume + secret repair |
| Combined production platform | **NO-GO** |

---

## Precise next step (owner)

Deliver Contabo **exec** access (option A/B/C above). Then run:

```text
AUTHORIZED READ-ONLY then REPAIR (two gates)
GATE1 READ-ONLY:
  Contabo: docker ps, functions mounts/logs, pg_get_functiondef(is_admin),
  profiles grants/triggers, schema_migrations for 20261012130000.
GATE2 REPAIR (separate yes):
  Apply #356 SQL with backup; fix functions volume entrypoints;
  set STRIPE_WEBHOOK_SECRET; no-charge probes only.
HARD DENY: Mozas/Caddy/DNS, #353, merges until evidence, live Stripe charges.
```
