# TDG Post-Gateway Recovery Status — 2026-10-12

**Hard stops honored:** No DNS/Caddy changes, billing, secret rotation, DB writes, Storage deletes, merges, deploys, container restarts, or payments.

---

## Updated checklist

| Item | Status | Evidence |
|------|--------|----------|
| Public TLS / Auth / REST / Storage / Realtime / CORS | **DONE** | Prior cutover; reconfirmed Auth/REST 200 |
| Shared sibling sites | **DONE** | Prior soak; not re-broken this pass |
| Production UX after gateway (guest menu/catalog) | **DONE** | Browser QA screenshots `prod_post_gateway_*` |
| Infinite skeletons (guest home) | **DONE** (gone) | Nav + Sign in + occasions render |
| Contabo SSH exec for Docker/`psql` | **BLOCKED** | `tunnel-key` exec exit 1 |
| Contabo `#356` `is_admin`/grants verify | **BLOCKED** | Needs Contabo exec |
| Edge Functions worker boot | **BLOCKED** | Public POST → `InvalidWorkerCreation` / missing entrypoint |
| Edge `STRIPE_WEBHOOK_SECRET` | **BLOCKED** | `stripe-webhook` → 503; not in Mozas `app.env` |
| Storage 245 “missing” previews | **PARTIAL** | Catalog impact **none** (intentional orphan prune); bytes not on Mozas |
| PR #356 merge/apply | **BLOCKED** (needs auth + Contabo) | Draft `a8e43f05`; Cloud still `VULNERABLE_OR_BRANCH` |
| PR #357 merge/deploy | **PARTIAL** readiness | Draft `694c5826`; UX already OK with live API; still valuable as resilience |
| PR #353 | **HOLD** | Do not integrate |
| Full production GO | **NO-GO** | Security + Edge still open |

---

## Phase 1 — Production UX (after gateway)

**Verdict: PASS** for guest home / menu / catalog.

| Check | Result |
|-------|--------|
| UX_MENU | **PASS** — Home/Create/Christmas Planner/Templates + Sign in rendered |
| UX_CATALOG | **PASS** — Occasions categories + cards with real imagery |
| SKELETONS | **Gone** on guest home (no infinite header/catalog skeletons) |
| API_HOST | `supabase.thedigitalgifter.com`; no `ERR_SSL_PROTOCOL_ERROR` in console |
| Auth monitor | `[useAuthStateMonitor] Auth changed: logged-out` |

Screenshots: `/opt/cursor/artifacts/screenshots/prod_post_gateway_01_homepage_desktop.webp` … `_05_console_clean.webp`.

### PR #357 integration readiness

- Head `694c5826` — timeouts + guest nav when Supabase unreachable.
- **With recovered API, guest UX already PASS on live `15d938c3`.**
- Still **recommended** after #356 as defense-in-depth if API/tunnel flaps.
- **Do not merge/deploy without authorization.**

---

## Phase 2 — Contabo access + security

### Exact SSH blocker

| Method tried | Result |
|--------------|--------|
| Mozas `tunnel-key` → `root@62.171.191.209` command exec | **exit 1**, no stdout (port-forward / forced-command style) |
| Agent env Contabo private key | **Absent** |
| Other Mozas keys pointing at Contabo | **Not found** |

**STOP Contabo security inspect.** Required access (pick one):

1. SSH key/user with **interactive/exec** on Contabo (not restrict/port-forward-only), **or**
2. Contabo panel/console session, **or**
3. Owner temporarily relaxes `authorized_keys` forced-command for an inventory principal.

### What we know without Contabo `psql`

| System | `is_admin` / grants |
|--------|---------------------|
| Legacy Cloud (MCP SQL) | Still **`VULNERABLE_OR_BRANCH`** (`profiles.role` path) |
| Contabo self-host | **Unknown** — prior OpenAPI exposes `/rpc/is_admin` only |

### Smallest safe security release (prepare only — not executed)

1. Apply Contabo-side migration from PR **#356**  
   `supabase/migrations/20261012130000_hotfix_admin_role_escalation.sql`  
   (`is_admin` → `admin_users` only; role trigger; revoke `UPDATE(role)`).
2. Deploy app half of #356 (`useAdminAuth` → `admin_users` only).
3. Then #357.
4. **Hold #353.**

Pre-apply check (on Contabo once exec available): orphan `profiles.role='admin'` not in `admin_users` must be **0** (or allowlist first).

---

## Phase 3 — Edge Functions

### Diagnosis (public API, no charges)

| Symptom | Meaning |
|---------|---------|
| Most functions **500** `InvalidWorkerCreation: … could not find an appropriate entrypoint` | Contabo Functions runtime **volume/mount/entrypoint** broken (empty/wrong `functions` dir or missing `index.ts` path). Repo on Mozas has **40** function dirs with `index.ts` — **not deployed correctly on Contabo**. |
| `stripe-webhook` **503** `STRIPE_WEBHOOK_SECRET is not configured` | That function **boots**; secret missing in Contabo function env. Not present in Mozas `app.env` / `staging.env` key names. |
| `OPTIONS stripe-webhook` **200** | Gateway routing OK |

### Minimal deploy + no-charge test plan (authorized later; needs Contabo exec)

1. Inventory Contabo `docker compose` / `functions` volume mount vs repo `supabase/functions`.  
2. Remount/redeploy function sources so each slug has `index.ts` entrypoint.  
3. Set Contabo secrets **names**: `STRIPE_WEBHOOK_SECRET`, Stripe keys as required — **no print**.  
4. Verify:
   - POST random function that should 401/400 without side effects  
   - `stripe-webhook` with **invalid** signature → expect 400 (proves secret loaded)  
   - Checkout functions with feature flags off / dry body — **no PaymentIntent create**  
5. Never send live Stripe events or charge cards.

---

## Phase 4 — Storage

### Recovery evidence (critical reinterpretation)

Mozas file  
`/opt/mozas/projects/thedigitalgifter/media/cleanup/orphan-previews-pruned-20261005.json`:

```json
{
  "completedAt": "2026-10-10T08:27:38.879Z",
  "deletedObjects": 245,
  "deletedBytes": 514924432,
  "preservedReferencedObjects": 22,
  "projectAccessRestored": true
}
```

| Finding | Evidence |
|---------|----------|
| 245 objects match prune job | deletedObjects=245, bytes=514924432 (= prior missing_bytes) |
| Intentional orphan cleanup | `preservedReferencedObjects=22` (= SH present previews) |
| Live template URLs | **26** unique public paths from 73 templates → **26/26 HEAD 200** |
| Sample missing root preview | `…/previews/1771876436287-b149da.png` → **400** (absent) |
| Bytes on Mozas disk | **0 hits** for sample filenames under TDG/backup trees |

### Customer-facing impact

- **Catalog/template cards: no P0 impact** — referenced previews are present.  
- Missing 245 are **unreferenced orphans** removed 2026-10-10.  
- Recovery is **archival/nice-to-have**, not required for guest browse UX.  
- Regeneration: only if product still needs historical unused assets; otherwise leave pruned.

### Checksum manifest / backfill

- Existing manifests in `docs/audits/artifacts/` remain valid as **historical orphan inventory**.  
- Idempotent backfill **not required for GO of browse UX**.  
- If archive later found on Contabo volumes: restore only paths absent; never delete/overwrite.

---

## Phase 5 — Release order (prepared, not executed)

| Order | PR | SHA | Gate |
|-------|-----|-----|------|
| 1 | **#356** security | `a8e43f05` | Contabo SQL apply + app deploy **after** exec + approval |
| 2 | **#357** skeleton resilience | `694c5826` | After #356; optional for current UX but recommended |
| — | **#353** Christmas V2 | `6504a33f` | **HOLD** until security + Edge (+ storage if needed) |

### Minimal production deploy package (when authorized)

| Field | Value |
|-------|-------|
| Current prod image | `mozas/thedigitalgifter:15d938c3` |
| Proposed next | Build from merge of #356 then #357 onto `main` (exact SHA TBD at merge time) |
| Rollback | Prior image tag + `app.env` bak; Caddy bak `…bak-pre-supabase-api-20261012T075525Z` |
| Browser QA | Guest home/menu/catalog + Sign in UI + one admin path after #356 |
| Sibling checks | www, apex, CasaHub, MCP, TheMozas healthz |

---

## Production GO / NO-GO

| Scope | Decision |
|-------|----------|
| Guest browse / public API gateway | **GO** (working now) |
| Full platform (admin security + Edge/payments) | **NO-GO** |

---

## Exact next actionable prompt

```
AUTHORIZED: Contabo SSH exec inventory + read-only security verify
1) Provide Contabo exec SSH (not port-forward-only) or console.
2) Read-only: docker ps, functions volume mount, pg_get_functiondef(is_admin),
   profiles.role grants/triggers, compare to PR #356.
3) Report Contabo #356 gap; DO NOT apply SQL until second authorization.
4) Separately authorize: Edge volume remount + STRIPE_WEBHOOK_SECRET set +
   no-charge probes only.
HARD DENY: merges, TDG deploy, DNS/Caddy, Storage deletes, live Stripe charges, #353.
```
