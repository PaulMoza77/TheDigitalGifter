# TDG Self-Hosted API Recovery Preparation — 2026-10-12

**Mode:** Read-only. No live DNS edits, Caddyfile changes, firewall changes, DB writes, deletes, credential rotation, merges, deploys, restarts, payments, or Cloud upgrades.  
**Target:** Contabo self-hosted Supabase (not Cloud Pro).  
**Parent audit:** `docs/audits/TDG_SELFHOST_SUPABASE_CUTOVER_2026-10-12.md` (PR #358).  
**Verdict:** **NO-GO** for production cutover. Recovery design is ready for a separately authorized execute pass.

---

## 1. Host and service inventory

| Host / service | Role | Evidence |
|----------------|------|----------|
| **Mozas** `mozas-prod-01` | Production web + TLS for `www` / apex; staging tunnel + gateway | SSH OK; Caddy TLS subjects include `www.thedigitalgifter.com`, `thedigitalgifter.com` — **not** `supabase.` |
| **Prod app** `thedigitalgifter` image `15d938c3` | Vite SPA on `:8080` behind Caddy | Healthy; baked URL `https://supabase.thedigitalgifter.com` |
| **Staging tunnel** `tdg-staging-supabase-tunnel` | SSH `-L 127.0.0.1:19000→127.0.0.1:8000` to Contabo | **active**; Kong reachable privately |
| **Staging gateway** `thedigitalgifter-staging-gateway` `:18000` | Loopback-only policy proxy → tunnel | Origin locked to `http://127.0.0.1:8081`; blocks `/auth/v1/health`, RPC |
| **Staging app** `:8081` | Staging SPA | Present |
| **Contabo** `62.171.191.209` | Self-hosted Supabase / Kong | Public ports: **22 open**; **80/443/8000/5432 closed** |
| **Legacy Cloud** `kjlsocejpmnzhhduyumy` | Read-only compare only | Data API **402** quota; MCP SQL still readable |

### Contabo stack (via tunnel → Kong `:8000`)

| Component | Result |
|-----------|--------|
| Auth | **200** GoTrue `v2.196.0` |
| REST | **200** (anon templates; service-role counts) |
| Storage | **1.74.0**; public object HEAD OK; completeness **FAIL** (§3) |
| Realtime | WS upgrade **101** |
| Edge | Gateway up; most functions **500** worker boot; `stripe-webhook` **503** missing secret |
| PostgreSQL / Docker | **BLOCKED** — see permission gap |

### Contabo SSH permission gap (hard stop for host inventory / #356 SQL)

- Key in use: `/opt/mozas/projects/thedigitalgifter-staging/tunnel-key` (ed25519).
- Tunnel/port-forward works; **remote command execution returns exit 1** with empty stdout (forced-command / restrict style).
- **Permission needed to continue Docker/`psql`/Edge volume/`is_admin` verification on Contabo:**
  1. An SSH principal with **interactive/exec** (not port-forward-only), **or**
  2. Contabo panel / console session for inventory, **or**
  3. Temporary authorized addition of `command=`-unrestricted deploy key (owner-operated).

Until one of those is granted, Contabo Docker compose path, Postgres version, exact table count, function volume layout, and live `is_admin()` body remain **unverified on-host**.

---

## 2. Root cause of public DNS/TLS failure

1. `supabase.thedigitalgifter.com` **A record equals** `www.thedigitalgifter.com` (same IP hash; **not** Contabo).
2. Live Mozas Caddy TLS automation subjects **omit** `supabase.thedigitalgifter.com`.
3. Client TLS to that name → **`TLSV1_ALERT_INTERNAL_ERROR` (alert 80)** — no matching cert/site.
4. Contabo Kong listens on **localhost:8000 only** and is **not** publicly reachable on 443/8000.
5. Production browser bundle **already** calls `https://supabase.thedigitalgifter.com` with self-host anon JWT → catalog/auth fail in browsers.

**Not** a Vite bug and **not** a “wrong Cloud URL in bundle” issue anymore: the public API hostname never reaches Kong.

---

## 3. Recommended network architecture

### Recommendation: **Mozas TLS → private tunnel → Contabo Kong** (near-term)

Why safest **now**:

- Contabo exposes only **22**; opening 443 requires Contabo firewall + local TLS (not available without Contabo exec/firewall auth).
- Mozas already runs ACME for `*.thedigitalgifter.com` zone and owns the web edge.
- Staging already proves the path: Caddy/gateway pattern → `127.0.0.1:19000` → Kong.
- Postgres (`5432`), Kong direct (`8000`), Studio/meta stay **closed** on Contabo public interface.

```
Browser
  → https://supabase.thedigitalgifter.com (Mozas Caddy TLS)
    → reverse_proxy 127.0.0.1:19000  (or dedicated unix/TCP to tunnel)
      → SSH tunnel → Contabo 127.0.0.1:8000 (Kong)
        → Auth / REST / Storage / Realtime / Functions
```

**Do not** point `supabase.` at the `thedigitalgifter:8080` web upstream.

### Alternative (later): Direct Contabo HTTPS

Requires Contabo firewall allow **443 only**, TLS terminator on Contabo → Kong localhost, DNS A → Contabo, keep **5432/8000/meta** closed. Needs Contabo exec. Prefer after Mozas path restores production.

### Exposure controls (must hold)

| Surface | Public? |
|---------|---------|
| Kong via `supabase.` HTTPS | Yes (intended) |
| Postgres 5432 | **No** |
| Kong :8000 raw | **No** (localhost / tunnel only) |
| Studio / meta / analytics basic-auth ports | **No** |
| Service-role key | Server-only (already not in browser bundle) |

---

## 4. Staging connectivity test results

### 4a. Direct tunnel → Kong (`127.0.0.1:19000`)

| Check | Result |
|-------|--------|
| `/auth/v1/health` | **200** GoTrue v2.196.0 |
| `/rest/v1/templates` | **200** |
| `/storage/v1/bucket` | **200** |
| Realtime WS upgrade | **101** |

### 4b. Staging gateway (`127.0.0.1:18000`) — policy sandbox

| Check | Result |
|-------|--------|
| REST/Storage with Origin `http://127.0.0.1:8081` | **200** |
| OPTIONS CORS | **204** (origin locked to staging SPA) |
| Origin `https://www.thedigitalgifter.com` | **403** `staging_origin_disabled` |
| `/auth/v1/health` | **403** `staging_action_disabled` |
| `/rest/v1/rpc/*` | **403** |

Staging gateway is **not** a production API edge; it is intentionally narrower.

### 4c. Isolated HTTPS path validation (no live DNS, no prod Caddy edit)

Ephemeral loopback TLS terminator on Mozas `127.0.0.1:19443` → tunnel `:19000`, tested with  
`curl --resolve supabase.thedigitalgifter.com:19443:127.0.0.1`:

| Check | Result |
|-------|--------|
| TLS Auth health | **200** |
| TLS REST | **200** |
| TLS Storage | **200** |
| TLS Realtime | **101** |
| OPTIONS CORS for `Origin: https://www.thedigitalgifter.com` | **200** with `access-control-allow-origin: https://www.thedigitalgifter.com` |
| Unexpected redirect | None observed |

**Conclusion:** Kong + self-host JWTs work correctly when TLS is terminated in front of the tunnel. Remaining production gap is **edge routing/DNS/TLS ownership**, not Contabo Auth/REST core.

---

## 5. Smallest DNS/TLS/routing change (design only — not applied)

### Atomic change (Mozas-proxy architecture)

1. **DNS (Cloudflare):** Upsert **only** `supabase.thedigitalgifter.com` A (proxied or DNS-only) → **Mozas origin IP** (same as www today is fine for this architecture).  
   - Do **not** change apex/www.  
   - If record already points at Mozas, DNS may be a no-op; the missing piece is Caddy.
2. **Caddy (authorized later):** Add site block `supabase.thedigitalgifter.com` with:
   - ACME cert for that host  
   - `reverse_proxy 127.0.0.1:19000` (HTTP/1.1 + WebSocket; disable response compression for WS if needed)  
   - **No** redirect to www  
   - Optional: stricter rate limits; do not add security headers that break Supabase clients
3. **Tunnel:** Ensure `tdg-staging-supabase-tunnel` (or a prod-named clone) is **enabled at boot** and monitored.
4. **Validate:** public `https://supabase.thedigitalgifter.com/auth/v1/health` → 200.

### Rollback (atomic)

1. Remove/disable Caddy `supabase.` site block (reload).  
2. Optionally delete/repoint Cloudflare `supabase` record to prior state.  
3. Frontend already targets custom host — rollback of DNS alone without a working API leaves prod broken; keep tunnel+proxy healthy or temporarily route `supabase.` to a known-good Kong front.  
4. **Cloud rollback is NO-GO** while Data API returns 402.

### Mozas backup / rollback readiness

| Item | Status |
|------|--------|
| `app.env` pre-cutover backup | Present: `secrets/app.env.pre-owner-cutover-20261010T080146Z` |
| `backup-last.json` | `timestamp=20261012T001747Z`, `local=true`, `offsite=true` |
| Scripts | `run-tdg-backup-now.sh`, `run-tdg-backup-drill.sh` (restore drill restores `app.env` + Caddyfile into isolated dirs) |
| Contabo Postgres/storage snapshot | **Unknown** without Contabo exec — treat as **gap** before GO |

**Before authorized cutover:** run backup-now + restore drill; take Contabo volume/pg_dump once exec is available.

---

## 6. Storage gap (Phase 3)

Artifacts (this PR):

- `docs/audits/artifacts/templates_previews_cloud_manifest_2026-10-12.csv` — Cloud `templates/previews/**` metadata (**267** rows)
- `docs/audits/artifacts/templates_previews_present_on_selfhost_2026-10-12.csv` — SH present (**22**)
- `docs/audits/artifacts/templates_previews_missing_on_selfhost_2026-10-12.csv` — **245 missing**
- `docs/audits/artifacts/templates_previews_backfill_dryrun_2026-10-12.json` — dry-run plan

| Metric | Value |
|--------|-------|
| Cloud previews | 267 |
| Self-host previews | 22 (all under `previews/from-convex/` subset) |
| Missing | **245** |
| Missing bytes (metadata) | **~515 MB** |
| Missing root `previews/*` | 233 |
| Missing `previews/from-convex/*` | 12 |
| Extra on SH | 0 |

### Byte source / archive

- Cloud Data API download: **blocked (402)**.
- Migration archive on Mozas: **not found** under TDG media/staging logs for `templates/previews`.
- Contabo disk volumes: **requires Contabo SSH exec**.

**Unrecoverable until archive or Contabo volume access:** the 245 object **bytes** (metadata alone is inventoried). Do not mark storage GO without a byte source.

### Idempotent backfill (prepare only)

1. Destination first: isolated staging bucket prefix or Contabo staging project — **not** blind prod overwrite.  
2. For each missing path: HEAD/list; upload **only if absent**.  
3. Verify size + eTag vs Cloud manifest.  
4. Never delete existing SH objects.  
5. Re-count: expect SH templates objects → Cloud 274.

---

## 7. Edge Functions blockers (Phase 4)

Repo function dirs on Mozas: **40** (excl. `_shared`).

| Probe (POST `{}` via tunnel) | Result |
|-----------------------------|--------|
| `stripe-webhook` | **503** `STRIPE_WEBHOOK_SECRET is not configured` |
| `create-checkout-session`, `christmas-checkout`, `pet-funnel`, `social-publisher`, `generate-nano-banana`, `delete-my-account` | **500** `InvalidWorkerCreation` / missing entrypoint |

Env key names on Mozas prod/staging **do not** include `STRIPE_WEBHOOK_SECRET` (secrets for Edge live on Contabo function runtime — not readable without Contabo exec).

### No-charge verification plan (authorized later)

1. Inventory Contabo `docker compose` functions volume + `.env` **names only**.  
2. Fix entrypoint/bootstrap (mount `supabase/functions` correctly; Deno worker).  
3. Set `STRIPE_WEBHOOK_SECRET` on Contabo only (no print).  
4. Verify with:
   - `OPTIONS` / unsigned GET where safe  
   - `stripe-webhook` with **invalid** signature → expect 400 (proves secret loaded) — **no** live Stripe events  
   - Checkout functions: call with dry-run / disabled flags (`CHRISTMAS_CHECKOUT_ENABLED` already false-capable) — **no** payment creation  
5. Do not invoke live charge paths until Auth/Storage/API gates pass.

---

## 8. Security PR #356 vs Contabo (Phase 5)

| Check | Cloud (MCP SQL) | Contabo |
|-------|-----------------|---------|
| `is_admin()` uses `profiles.role` OR `admin_users` | **Still vulnerable pattern** (prior audit) | **NOT VERIFIED** — needs `psql` |
| `profiles.role` UPDATE grant to `authenticated` | **INSERT/SELECT/UPDATE present** | **NOT VERIFIED** |
| Triggers on `profiles` | Hotfix adds role-protection trigger | **NOT VERIFIED** |
| PR #356 migration applied | Not applied via this agent | **Cannot apply** (hard stop + no exec) |

**Finding:** Contabo security posture for admin escalation is **UNKNOWN**. Treat as **P0 gate**: apply/verify #356 on Contabo **before** public API GO.

Client half of #356 (`useAdminAuth` → `admin_users` only) ships with app deploy after merge — still requires DB half on Contabo.

---

## 9. PR #357 / browser config

| Item | Status |
|------|--------|
| PR #357 | Draft, head `694c5826`, menu timeout / guest nav when Supabase unreachable |
| Browser bundle | URL `https://supabase.thedigitalgifter.com`; anon self-host JWT (no Cloud `ref`); matches `app.env` |
| Integration note | #357 is a **resilience** fix; it does not restore API. Deploy **after** API TLS works, sequenced **after** #356 |

**Hold #353** until Auth/Storage/Edge/security gates pass.

---

## 10. Rollback readiness summary

| Layer | Ready? |
|-------|--------|
| Mozas `app.env` backup | Yes |
| Mozas restic local+offsite (2026-10-12) | Yes (snapshot reported) |
| Cloudflare DNS scripts | Present (`cutover-cloudflare-dns.sh`) — **do not run** yet; script today targets apex/www, not `supabase` alone |
| Contabo DB/storage backup | **Unknown** (exec gap) |
| Cloud Data API rollback | **NO-GO** (402) |

---

## 11. Exact next execution prompt (copy/paste for authorized run)

```
AUTHORIZED EXECUTE — TDG self-host API recovery (Mozas proxy path)
HARD ALLOW: (1) Cloudflare DNS upsert ONLY for supabase.thedigitalgifter.com → Mozas origin;
(2) add Caddy site supabase.thedigitalgifter.com reverse_proxy to 127.0.0.1:19000 with WS;
(3) ensure tdg-staging-supabase-tunnel enabled; (4) run backup-now before reload.
HARD DENY: no apex/www DNS changes; no Contabo firewall yet; no Cloud upgrade; no #353;
no payment side effects; no deleting storage objects.
ACCEPTANCE: public https://supabase.thedigitalgifter.com/auth/v1/health == 200;
REST templates 200; Storage public sample 200; Realtime 101; www still serves SPA.
THEN (separate auth): Contabo exec key for pg inventory + #356 apply + storage byte backfill.
```

---

## 12. GO / NO-GO

| Decision | **NO-GO** |
|----------|-----------|
| Why | Public `supabase.` TLS/routing not live; storage **245** objects (~515MB) without byte source; Edge worker/secrets broken; Contabo `#356` unverified; Contabo host backup/exec missing |
| Ready now | Tunnel health, isolated TLS proof, missing-object manifest, Mozas-proxy architecture, atomic change/rollback design |
| First authorized action | Mozas Caddy + (if needed) DNS for `supabase.` → tunnel → Kong — **not** Contabo public 443 yet |

---

## Evidence anchors

- Tunnel unit LocalForward Contabo Kong `:8000`  
- Caddy autosave subjects exclude `supabase.thedigitalgifter.com`  
- Isolated TLS proxy test: Auth/REST/Storage/Realtime/CORS PASS (ephemeral, torn down)  
- Storage manifests under `docs/audits/artifacts/`  
- PRs: #356 security, #357 skeleton, #353 hold, #358 audit parent  
