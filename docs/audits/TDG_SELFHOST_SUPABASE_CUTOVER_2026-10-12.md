# TDG Self-Hosted Supabase Cutover — Evidence Pack (2026-10-12)

**Scope:** PaulMoza77/TheDigitalGifter only (not Mozas).  
**Mode:** Read-only verification. No DNS changes, secret edits, migrations, merges, deploys, or restarts were performed.  
**Verdict:** **NO-GO** for production cutover until P0 blockers below are cleared.

---

## 1. Stack health (self-hosted Contabo `62.171.191.209`)

Access path used: Mozas `tdg-staging-supabase-tunnel` → `127.0.0.1:19000` → Contabo Kong `:8000` (localhost-only on Contabo; port 8000 closed publicly). Contabo SSH key is **port-forward only** (remote exec returns exit 1), so Docker/`psql` inventory on Contabo was **not** re-verified in this pass.

| Component | Evidence | Status |
|-----------|----------|--------|
| Auth (GoTrue) | `GET /auth/v1/health` → **200**, `version=v2.196.0` | **PASS** |
| REST (PostgREST) | Service-role counts + anon `templates` (73) → **200**; OpenAPI definitions **181** / paths **307** | **PASS** (API) |
| Storage | Version **1.74.0**; 15 buckets; sample public object HEAD **200** | **PASS** (API) / **FAIL** (completeness — §2) |
| Realtime | WebSocket upgrade → **101** with anon JWT | **PASS** |
| Edge Functions | Gateway responds; many functions **500** `InvalidWorkerCreation` / missing entrypoint; `stripe-webhook` → **503** `STRIPE_WEBHOOK_SECRET is not configured` | **FAIL** |
| PostgreSQL / Docker inventory | Tunnel key cannot exec; prior claim PG 17.6 / 177 tables not re-proven via `psql` this pass | **PARTIAL** |

Auth settings (self-host): email + Google enabled; `mailer_autoconfirm=true`; signup enabled.

---

## 2. Cloud vs self-host data compare (legacy `kjlsocejpmnzhhduyumy` READ-ONLY)

### 2.1 Cloud project state

- Project **ACTIVE_HEALTHY** in MCP; Postgres engine **17**.
- **Public Data API is locked:** Auth/REST/Storage over `https://kjlsocejpmnzhhduyumy.supabase.co` return **402** `exceed_storage_size_quota` (~**1157 MB** object metadata vs Free **1 GB**).
- MCP `execute_sql` still works for read comparison (management path, not app Data API).

### 2.2 Row / auth / bucket parity

| Metric | Cloud (SQL) | Self-host (Kong/REST) | Notes |
|--------|-------------|------------------------|-------|
| `auth.users` | 24 | 24 | Match; newest Cloud create `2026-09-21` |
| `occasions` | 23 | 23 | Match |
| `templates` | 73 | 73 | Match |
| `profiles` | 17 | 17 | Match |
| `orders` | 9 | 9 | Match |
| `admin_users` | **3** | **5** | SH has 3 Cloud emails + **2** `@example.invalid` extras |
| `blog_posts` | 1 | 1 | Match |
| `affiliate_profiles` | 2 | 2 | Match |
| `christmas_events` | 0 | 0 | Match |
| `clip_factory_jobs` | 19 | 19 | Match |
| `seo_pages` | **4** | **40** | **SH ahead** |
| `publisher_publications` | **1566** | **1630** | **SH ahead** |
| `storage.buckets` | 15 | 15 | Same names |
| `storage.objects` | **717** | **~492 listed** | **SH incomplete** |
| `public` base tables | **177** | OpenAPI ~181 defs | Schema present via API; exact 177 not re-counted via `psql` |

Cloud max activity timestamps (SQL): users `2026-09-21`, profiles `2026-09-27`, orders `2026-09-26`, storage objects `2026-09-26`. No evidence of Cloud Data API writes after quota lock (API returns 402).

### 2.3 Storage delta (P0)

| Bucket | Cloud objs | Self-host listed | Delta |
|--------|------------|------------------|-------|
| `templates` | **274** (previews **267** + ai-previews **7**) | **29** (ai-previews **7** + `previews/from-convex` **22**) | **−245** (missing bulk `templates/previews/**`) |
| `tdg-library` | 1 | 20 | SH **+19** (staging media recovery) |
| `clip-factory` | 96 | 97 | ≈ match |
| Others sampled | match or empty | match or empty | — |
| **Total** | **717** | **~492** | **≈ −225** |

Safe delta-sync plan (authorized execution later — **not** run now):

1. **Do not** use Cloud REST/Storage API (402). Prefer Contabo-side restore from the migration object archive, or one-shot `storage.objects` + file copy from a Cloud backup / management download path that bypasses the quota-locked Data API.
2. Reconcile `templates/previews/**` first (largest gap, catalog-critical).
3. After file sync, verify `count(storage.objects)` and byte checksums per bucket.
4. For SQL drift (`seo_pages`, `publisher_publications`, `admin_users`): treat self-host as **ahead** for publisher/seo — **do not** blindly overwrite SH with Cloud. Diff by primary key; only INSERT missing Cloud rows if still needed; remove or quarantine `@example.invalid` admin rows after review.
5. Freeze app writes to Cloud (already enforced by 402). Keep SH writes only on staging until public API gateway is live.

---

## 3. DNS / TLS / routing (`supabase.thedigitalgifter.com`)

| Check | Result |
|-------|--------|
| `supabase.` A record == `www.` A record | **YES** (same IP hash) |
| That IP == Contabo `62.171.191.209` | **NO** |
| Mozas Caddy hosts for TDG | `www.thedigitalgifter.com`, `thedigitalgifter.com` only — **no** `supabase.` site block |
| TLS `https://supabase.thedigitalgifter.com` | **FAIL** — `TLSV1_ALERT_INTERNAL_ERROR` (alert 80); no cert for that name on web VPS |
| Contabo Kong `:8000` public | **Closed** (only via SSH tunnel to localhost) |
| Intended target | Contabo API gateway (Kong), **not** the Vite web frontend |

**P0:** Public hostname points at the web VPS and has no TLS/API route. App already bakes this URL (see §4), so browsers cannot reach Supabase.

---

## 4. `app.env`, Docker build args, browser bundle

| Source | `VITE_SUPABASE_URL` | Anon JWT | Notes |
|--------|---------------------|----------|-------|
| Prod `secrets/app.env` | `https://supabase.thedigitalgifter.com` | len **169**, `role=anon`, **no `ref`**, sha12 `f4afd0416c1c` | Self-host style; matches staging |
| Prod backup `app.env.pre-owner-cutover-*` | `https://kjlsocejpmnzhhduyumy.supabase.co` | len **208**, `ref=kjlsocejpmnzhhduyumy` | Legacy Cloud |
| Staging `staging.env` | same as prod | same anon/service sha as prod | Intentional pre-cutover |
| Running container `thedigitalgifter` (`15d938c3`) | same URL | same anon sha | Runtime env matches `app.env` |
| **Browser / baked `/app/dist` bundle** | `https://supabase.thedigitalgifter.com` | anon sha `f4afd0416c1c`, no Cloud `ref` | **Already cut over in frontend** |
| `docker-compose.yml` | build `args` + runtime env for `VITE_*` / `SUPABASE_*` | Vite bakes at **image build** | Rebuild required whenever URL/keys change |
| Service-role in bundle | Not equal to prod service-role secret | Anon only in JS | **PASS** (no service-role leak observed) |

Keys are **internally consistent** for self-host (anon + service_role, HS256, `iss=supabase`, no `ref`). They are **wrong for the live public network** because the hostname does not terminate TLS to Contabo Kong.

---

## 5. Anon / service-role configuration (no secrets printed)

- Staging ≡ prod for URL, anon, and service-role (sha12 match).
- Anon: `role=anon`, len 169, no `ref` → self-hosted JWT shape.
- Service-role: `role=service_role`, len 180, no `ref`; used only server-side / tunnel probes.
- Cloud backup keys still present on disk for rollback reference; Cloud Data API currently unusable (402).
- `is_admin()` exists on Cloud as `admin_users` email **OR** `profiles.role = 'admin'` (security hotfix #356 target). Self-host exposes `/rpc/is_admin` (anon → `false`); Contabo function body / `profiles.role` grants **not** re-read via `psql` this pass → **verify on Contabo before GO**.

---

## 6. Production cutover plan (authorized later)

### 6.1 Release sequence (do **not** include #353)

1. **Infra (owner-authorized):** Point `supabase.thedigitalgifter.com` DNS to Contabo (or Mozas reverse-proxy → Contabo Kong). Issue TLS for that hostname only; **never** route it to the web app container.
2. **Expose Kong safely:** Public HTTPS → Kong `:8000` (or TLS-terminating proxy). Keep Postgres closed.
3. **Storage delta:** Restore missing `templates/previews/**` (+ verify all buckets vs 717).
4. **Secrets / Edge:** Configure Contabo function secrets (`STRIPE_WEBHOOK_SECRET`, etc.); fix function entrypoints / worker boot.
5. **Auth / RLS:** Confirm Google redirect URIs + Site URL on GoTrue; apply **#356** SQL/hotfix on **self-host** (not only Cloud); verify `is_admin` + column grants for `profiles.role`.
6. **App release:** Merge/deploy **#356** then **#357** (skeleton/timeouts). Rebuild image so baked `VITE_*` match live API (already pointing at custom host — rebuild after API is healthy).
7. **Hold #353** (Christmas V2) until post-cutover stability.
8. **Write acceptance:** Staging first (existing tunnel/gateway), then production: auth signup/login, anon catalog read, authenticated write, storage upload/download, one Edge invoke, Realtime subscribe.
9. **Backups:** Contabo Postgres dump + storage volume snapshot **before** DNS flip; retain Cloud SQL dump via MCP/management while 402 persists.
10. **Rollback:** DNS back to prior target is **not** enough — frontend already uses custom host + self-host JWT. Rollback options: (a) restore web VPS proxy to Contabo tunnel/gateway if Contabo fails after DNS, or (b) rebuild/redeploy image + `app.env` from `app.env.pre-owner-cutover-*` **only after** Cloud Data API is usable again (currently blocked by 402 — **Cloud rollback is currently NO-GO**).

### 6.2 Write / Auth / RLS / Storage / Edge acceptance checklist

- [ ] `https://supabase.thedigitalgifter.com/auth/v1/health` → 200 over public TLS  
- [ ] Anon REST catalog (`occasions`, `templates`) → 200  
- [ ] Storage public object + authenticated upload  
- [ ] Login (email + Google) and session refresh  
- [ ] `is_admin` / admin routes after #356 on SH  
- [ ] Edge: `stripe-webhook` configured; critical functions boot ≠ 500  
- [ ] Realtime WS 101 on public host  
- [ ] Production write (one non-destructive staging-like row) then delete  
- [ ] Menu/nav no infinite skeleton (#357) with live API  

---

## 7. P0 blockers (exact)

1. **Public API hostname broken:** `supabase.thedigitalgifter.com` resolves to web VPS (same as `www`), TLS alert 80, **not** Contabo Kong.  
2. **Production frontend already relies on that hostname** (baked anon + URL) → catalog/auth fail in browser (skeleton/empty menu).  
3. **Storage incomplete on self-host:** ~492 vs 717 objects; **245** missing under `templates/previews/**`.  
4. **Edge Functions not production-ready** on Contabo (worker boot / missing secrets).  
5. **Legacy Cloud Data API 402** — cannot serve prod and blocks easy Cloud rollback / REST-based delta pull.  
6. **#356 not verified applied on Contabo DB** (Cloud still has dual-path `is_admin`; SH `psql` not accessible with tunnel key).  
7. **Contabo host inventory gap:** Docker/Postgres version / exact 177-table count not re-confirmed (SSH exec denied).

---

## 8. Next authorized execution step

**Owner authorization required for the first mutating step:**

> Provision TLS + reverse-proxy (or DNS A/AAAA) so `https://supabase.thedigitalgifter.com` terminates on Contabo Kong (or Mozas proxy → Contabo `:8000`), **without** pointing that hostname at the TDG web frontend. In parallel, authorize storage backfill of `templates/previews/**` from the migration archive (not Cloud Data API).

Until that step is approved and completed: **NO-GO**.

---

## 9. GO / NO-GO

| Decision | **NO-GO** |
|----------|-----------|
| Reason | Public Supabase API endpoint is down; storage delta incomplete; Edge not ready; Cloud rollback path blocked by 402; security hotfix #356 unverified on self-host. |
| Safe now | Keep read-only; continue staging via SSH tunnel; merge preparation for **#356 → #357** only after API gateway plan is approved; **do not** merge/deploy **#353**. |

---

## Evidence anchors

- Tunnel unit: `tdg-staging-supabase-tunnel.service` → `root@62.171.191.209` LocalForward `19000→8000`  
- Prod image: `mozas/thedigitalgifter:15d938c3`  
- PRs: **#356** security hotfix (draft), **#357** menu skeleton (draft), **#353** Christmas V2 (**hold**)  
- Audit date: **2026-10-12** (read-only agent pass)
