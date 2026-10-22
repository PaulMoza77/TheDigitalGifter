# Contabo owner console steps — restore SSH exec (tunnel safe)

**Date:** 2026-10-12  
**Agent access status:** **ACCESS BLOCKED**  
**Tunnel:** Leave `tdg-staging-supabase-tunnel` / `tunnel-key` **unchanged**.

---

## Confirmed target identity (from Mozas; no Contabo shell)

| Field | Value |
|-------|--------|
| Contabo host IP | `62.171.191.209` |
| Contabo PTR / label | `vmi3646115.contaboserver.net` |
| SSH user in tunnel unit | `root` |
| Mozas edge host | `mozas-prod-01` (tunnel + Caddy only) |
| Tunnel unit | `tdg-staging-supabase-tunnel.service` — **active**; `-L 127.0.0.1:19000` + `-L 172.18.0.1:19001` → Contabo `127.0.0.1:8000` |
| Tunnel key (forward-only) | `/opt/mozas/projects/thedigitalgifter-staging/tunnel-key` |
| Tunnel key fingerprint | `SHA256:7ZIvApAFNt8H9AfArknBH0I/7X4gGfcsH+Fa8c6UBtQ` (ed25519, comment `root@mozas-prod-01`) |
| Tunnel-key remote exec | Exit **1** (restrict / port-forward only) — **unchanged** |
| Public API | GoTrue `v2.196.0` — `https://supabase.thedigitalgifter.com/auth/v1/health` **200** |
| Agent Contabo exec key / panel token | **None** (secrets: Mozas SSH + `SUPABASE_SERVICE_ROLE_KEY_mozas` only) |

`tunnel-key` authenticates for port-forward only; remote `whoami`/`hostname` via that key does **not** return a shell. Do **not** edit that key’s `authorized_keys` line. Do **not** retry denied keys (`casahub_deploy`, etc.).

---

## ACCESS: **BLOCKED**

No owner-authorized Contabo shell is available to this agent. Server-side security/Edge inspection **stopped**.

---

## Minimal Contabo panel steps (owner)

Do this in Contabo **Customer Control Panel** (not via the tunnel-key):

### Option A — VNC / browser console (fastest for one-time inventory)

1. Log in to Contabo Customer Control Panel.  
2. Open **VPS** → select the instance whose **primary IP is `62.171.191.209`**.  
3. Confirm hostname/label matches the TDG self-hosted Supabase server (not Mozas).  
4. Open **VNC** / **Console** / **Browser terminal** for that VPS.  
5. Log in as `root` (or the sudo admin you use for this box).  
6. Run **read-only** checks (paste results back to the agent or authorize a follow-up):

```bash
whoami
hostname
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}'
# locate compose / functions mount
docker ps -a --format '{{.Names}}' | grep -iE 'function|edge|supabase|kong|db|auth|rest|storage|realtime'
# if a functions container exists:
# docker inspect <functions-name> --format '{{json .Mounts}}'
# docker logs <functions-name> --tail 100
# env NAMES only:
# docker exec <functions-name> sh -c 'env | cut -d= -f1 | sort | grep -iE "STRIPE|WEBHOOK|SUPABASE"'
# Postgres (container name may vary):
# docker exec <db-name> psql -U postgres -d postgres -c "\df+ public.is_admin"
# docker exec <db-name> psql -U postgres -d postgres -c "SELECT grantee, privilege_type FROM information_schema.column_privileges WHERE table_name='profiles' AND column_name='role';"
# docker exec <db-name> psql -U postgres -d postgres -c "SELECT tgname FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE c.relname='profiles';"
# docker exec <db-name> psql -U postgres -d postgres -c "SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 20;"
```

7. **Do not** restart containers, change secrets, or apply #356 SQL until a separate repair authorization.

### Option B — Add a temporary inventory SSH key (preferred for agent follow-up)

On Contabo (via VNC/console), **append a new line** to `/root/.ssh/authorized_keys` — **do not edit the existing tunnel-key line**:

```bash
# On Contabo as root — BACKUP first
cp -a /root/.ssh/authorized_keys /root/.ssh/authorized_keys.bak-$(date -u +%Y%m%dT%H%M%SZ)
# Append ONLY a new unrestricted key provided by the owner for inventory
# Example format (owner replaces with real pubkey):
# ssh-ed25519 AAAA… tdg-inventory-20261012
# MUST NOT include: restrict, port-forwarding, ForceCommand, no-pty-only without exec
echo 'ssh-ed25519 <OWNER_INVENTORY_PUBLIC_KEY> tdg-inventory-20261012' >> /root/.ssh/authorized_keys
chmod 600 /root/.ssh/authorized_keys
```

Then give the agent the **matching private key** as an injected secret (e.g. `CONTABO_SSH_PRIVATE_KEY`) and confirm:

```bash
ssh -i <inventory-key> -o BatchMode=yes root@62.171.191.209 'whoami; hostname; docker ps'
```

Remove the inventory key after repair is done. **Leave the tunnel-key entry intact.**

---

## What we already know (no Contabo shell)

| Area | State |
|------|--------|
| Security #356 on Contabo | **Unknown** — needs `psql` |
| Edge 500 entrypoint | Functions volume/discovery broken (Kong) |
| Edge 503 stripe-webhook | Secret name `STRIPE_WEBHOOK_SECRET` missing |
| Public API / guest UX | **GO** |

---

## Single execution plan — #356 + Edge (after ACCESS PASS)

Do **not** start until Contabo exec/console is available. Two gates; no Mozas/Caddy/DNS/#353/merges/live Stripe.

### Gate 1 — read-only inventory (PASS required before Gate 2)

1. `whoami`; `hostname`; `docker ps` (confirm Docker + Supabase stack).  
2. Inspect functions container mounts + `ls` host path for `index.ts` per slug; `docker logs --tail 200`.  
3. Env **names only**: `STRIPE_WEBHOOK_SECRET` present?  
4. Postgres read-only:  
   - `pg_get_functiondef('public.is_admin'::regproc)` — expect `admin_users` only after #356  
   - `profiles.role` column privileges for `authenticated`  
   - triggers on `profiles` (expect `profiles_before_role_escalation` after #356)  
   - `supabase_migrations.schema_migrations` for `20261012130000`  
5. Record findings; **stop** if anything unexpected — no writes.

### Gate 2 — repair (separate explicit authorization)

1. **Backup:** dump `is_admin` def, grants, triggers; note functions volume bind source.  
2. **#356 SQL:** apply `supabase/migrations/20261012130000_hotfix_admin_role_escalation.sql` from PR branch `cursor/tdg-admin-role-escalation-hotfix-7cbb` on Contabo Postgres only.  
3. **Verify:** `is_admin` = `admin_users` only; trigger present; `authenticated` lacks `UPDATE(role)`; optional iso-proof script.  
4. **Edge:** remount/sync `supabase/functions` so each slug has `index.ts`; restart **functions worker only**.  
5. **Secret:** set `STRIPE_WEBHOOK_SECRET` on Contabo functions env (never print).  
6. **No-charge probes:** known slug ≠ 500 entrypoint; `stripe-webhook` bad sig → **400**; no live charges.  
7. **App:** deploy #356 client (`useAdminAuth`) only after SQL verify. Hold #353; #357 optional after #356.

### Hard deny throughout

Tunnel-key `authorized_keys` edit · Contabo firewall · Mozas/Caddy/DNS · production SQL outside Gate 2 · secret disclosure · GitHub merges without evidence · live Stripe events.

---

## GO / NO-GO

| Scope | Decision |
|-------|----------|
| Contabo SSH exec for this agent | **BLOCKED** |
| Public browse / API gateway | **GO** |
| #356 Contabo verify/apply | **NO-GO** |
| Edge entrypoint + webhook secret | **NO-GO** |
| Combined platform | **NO-GO** until owner completes Option A or B |
