# The Digital Gifter · Self-Hosted Supabase Migration Verdict

**Date:** 2026-10-15  
**Repo:** `PaulMoza77/TheDigitalGifter`  
**PR:** #367 @ `05011f76`  
**Production image:** `mozas/thedigitalgifter:a63672e6` (matches `main` deploy SHA)  
**Mode:** read-only verification — no migrate, overwrite, delete, deploy, endpoint switch, or production mutation

---

## Verdict: **PARTIALLY MIGRATED**

Frontend + app runtime + Auth/DB row identity point at self-hosted `https://supabase.thedigitalgifter.com`.  
CI/deploy scripts, Stripe dual webhooks, Cloud Edge (quota-blocked), broken self-host Edge entrypoints, and storage object drift mean cutover is **not complete**.  
Do **not** treat Supabase Cloud Pro / paid Cloud upgrade as the production path.

---

## 1. Topology (production evidence)

| Layer | Evidence |
| --- | --- |
| App host | Mozas VPS `mozas-prod-01` · container `thedigitalgifter` · image `mozas/thedigitalgifter:a63672e6` · healthy |
| App secrets | `/opt/mozas/projects/thedigitalgifter/secrets/app.env` · `TDG_RELEASE=a63672e6` |
| Active Supabase URL | `VITE_SUPABASE_URL` / `SUPABASE_URL` = `https://supabase.thedigitalgifter.com` |
| Pre-cutover backup env | `app.env.pre-owner-cutover-20261010T080146Z` still pointed at `https://kjlsocejpmnzhhduyumy.supabase.co` (cutover ~2026-10-10) |
| Built frontend | Live `www.thedigitalgifter.com` JS bundles resolve **only** to `https://supabase.thedigitalgifter.com` (0 Cloud URL hits in shipped assets) |
| Edge proxy | Caddy `supabase.thedigitalgifter.com` → `172.18.0.1:19001` |
| Tunnel | systemd `tdg-staging-supabase-tunnel.service` · SSH `-L …:19000/19001 → 127.0.0.1:8000` on Contabo **`62.171.191.209`** |
| Contabo shell | Tunnel key is **port-forward only** (`command` + `permitopen`) — disk/docker inspect on Contabo not available without a shell-capable key |
| Cloud project | `kjlsocejpmnzhhduyumy` · org `thedigitalgifter` · **plan free** · region `eu-west-1` · `ACTIVE_HEALTHY` but Edge **402** `exceed_storage_size_quota` |

No credentials are reproduced in this document.

---

## 2. Cloud reference inventory (`kjlsocejpmnzhhduyumy` / `*.supabase.co`)

| Area | Status | Notes |
| --- | --- | --- |
| Live frontend (build-time) | **Self-hosted** | Bundles hardcode `supabase.thedigitalgifter.com` |
| Live app container runtime | **Self-hosted** | `SUPABASE_URL` / Vite URL match |
| GitHub Actions | **Cloud** | ≥13 workflows hardcode `SUPABASE_PROJECT_REF: kjlsocejpmnzhhduyumy` |
| Deploy/apply scripts | **Cloud** | ≥19 scripts under `scripts/` default/guard to Cloud ref |
| `deploy/nginx-thedigitalgifter.conf` | **Cloud (commented)** | Historical proxy to Cloud functions |
| Edge shared code | **Cloud hardcode** | `supabase/functions/_shared/higgsfieldImage.ts` public uploads base URL |
| Tests | **Cloud fixtures** | `src/domains/generator/higgsfieldImage.test.ts` |
| Docs | **Cloud-centric** | Prior audits assumed Cloud Free quota as blocker |
| Stripe live webhooks | **Dual** | Both Cloud and self-host endpoints **enabled** (see §4) |
| Cloud Edge | **Still reachable but restricted** | Christmas checkout → HTTP **402** storage quota |

Repo scan (approx): **147** lines matching `kjlsocejpmnzhhduyumy` / `supabase.co` outside lock/dist noise — concentrated in scripts + workflows.

---

## 3. Self-hosted vs Cloud (safe read-only)

### 3.1 Row / identity alignment

| Metric | Cloud | Self-hosted | Match? |
| --- | --- | --- | --- |
| Auth users | 24 | 24 | Yes |
| `christmas_orders` | 64 | 64 | Yes |
| Sample order IDs (first 5) | identical | identical | Yes |
| `christmas_generation_jobs` | 7 | 7 | Yes |
| `pet_orders` | 90 | 90 | Yes |
| `christmas_email_deliveries` | 0 | 0 | Yes |
| `pet_email_deliveries` | 2 | 2 | Yes |
| Public tables (count) | — | 186 | — |
| Public RLS policies | 183 | 183 | Yes |
| Storage RLS policies | **16** | **4** | **No** |
| `supabase_migrations.schema_migrations` | present (Cloud MCP list) | **missing schema** | **No** |
| `pg_cron` / `cron.job` | n/a | **missing** | — |

### 3.2 Storage

| Metric | Cloud | Self-hosted |
| --- | --- | --- |
| Objects | 717 | 493 |
| Total bytes | ~1.130 GB (quota exceeded on Free) | ~1.921 GB |
| Buckets | 16 (same IDs/names) | 16 (same IDs/names) |
| `templates` | 274 objs / ~543 MB | 29 objs / ~51 MB |
| `clip-factory` | 96 / ~314 MB | 97 / ~1.34 GB |
| `tdg-library` | 1 / ~0.5 MB | 20 / ~280 MB |
| Public object GET | — | `…/object/public/templates/…` → **HTTP 200** |
| Bucket listing API | — | **HTTP 200** |

**Conclusion:** Cloud 1 GB Free quota is a Cloud-side restriction only. Self-hosted storage already holds ~1.9 GB and serves public objects. Treat Cloud quota as irrelevant to self-host capacity **unless** traffic still hits Cloud (it still can via dual Stripe webhook + CI deploys).

Storage RLS on self-host is thinner (4 vs 16 policies) — private christmas/pet buckets rely more on signed URLs / service role; reconcile before relying on anon client uploads.

### 3.3 Auth

| Check | Self-hosted |
| --- | --- |
| GoTrue health | HTTP 200 · `v2.196.0` |
| Settings | email + Google enabled; `mailer_autoconfirm=true` |
| User count | 24 (= Cloud) |

### 3.4 Schema vs PR #367 (neither DB has refunds applied)

| PR #367 change | Cloud | Self-hosted |
| --- | --- | --- |
| `refunded_amount_cents` / `last_refund_id` | absent | absent |
| `payment_status` includes `partially_refunded` | no (draft/pending/paid/failed/refunded) | same |
| email kinds `portrait_ready` / `portrait_refunded` | no | no |
| `refund_christmas_commerce_order` RPC | not verified present | **absent** (only `refund_christmas_planner_order`) |

Migrations on branch are additive and compatible with self-host target once Edge + secrets are healthy. They must be applied **to Contabo Postgres via self-host path**, not via Cloud-linked `supabase db push` to `kjlsocejpmnzhhduyumy`.

### 3.5 Edge Functions

| Target | Result |
| --- | --- |
| Cloud Edge | HTTP **402** `exceed_storage_size_quota` on `christmas-checkout` |
| Self-host Edge (38 slugs probed) | **33** `InvalidWorkerCreation` (missing entrypoint) · **5** boot |

Self-host boots (application-level responses):

- `stripe-webhook` → **503** `STRIPE_WEBHOOK_SECRET is not configured`
- `christmas-funnel` → 400 invalid request (runtime OK)
- `christmas-generate` / `christmas-generate-video` → Forbidden (runtime OK)
- `christmas-v2-funnel-event` → invalid_event (runtime OK)

Critical Christmas path on self-host (**broken boot**):

- `christmas-checkout`
- `christmas-photo-funnel`
- `christmas-photo-generate`
- `christmas-commerce-config`, `christmas-admin`, `christmas-result-share`, most pet functions, etc.

### 3.6 Secrets / scheduled jobs / integrations

| Item | Evidence |
| --- | --- |
| Edge secrets on Contabo | Contabo shell not available via tunnel key; `STRIPE_WEBHOOK_SECRET` **missing** at runtime (proven by 503) |
| Vault | `vault.secrets` countable via SQL API (count not required for verdict) |
| `cron.job` | not installed on self-host |
| Mozas cron | `tdg-orphan-preview-cleanup` timer present (app-side, not Supabase cron) |
| Resend | `send.thedigitalgifter.com` = **failed** DNS; `volocar.eu` verified (brand fallback only with approval) |

---

## 4. Christmas flow · which backend each stage hits

Build-time: Vite embeds `VITE_SUPABASE_URL` → self-host.  
Runtime Edge calls: `${VITE_SUPABASE_URL}/functions/v1/…` (see `src/features/christmas/photoApi.ts`).

| Stage | Intended call | Live backend | Status |
| --- | --- | --- | --- |
| Page load / Supabase client | REST/Auth/Storage @ self-host | **Self-host** | OK for Auth/REST/Storage list |
| Upload source photo | Storage `christmas-source*` via client/Edge | **Self-host URL** | Edge funnel boot **broken** → upload path blocked at Edge |
| Blur / funnel actions | `christmas-photo-funnel` | Self-host | **BROKEN** (`InvalidWorkerCreation`) |
| Checkout session | `christmas-checkout` | Self-host | **BROKEN**; Cloud still returns **402** if called |
| Kill switch | `CHRISTMAS_CHECKOUT_ENABLED=false` in prod `app.env` | Mozas | New paid checkouts intentionally off |
| Stripe webhook | Dual endpoints enabled | **Both** | Self-host: 503 missing secret; Cloud: 402 quota |
| AI generate | `christmas-photo-generate` | Self-host | **BROKEN** |
| Orders / jobs DB | Postgres | Self-host (= Cloud IDs) | Data present; new writes depend on Edge |
| Resend email | Edge → Resend | Domain **failed** | Delivery blocked even if Edge fixed |
| Download / signed URL | Storage private buckets | Self-host | Public templates OK; private needs working Edge/signing |
| Refunds | PR #367 + `charge.refunded` | Not deployed; webhooks lack refund events | Blocked |
| Admin | `christmas-admin` etc. | Self-host | **BROKEN** boot |

### Stripe webhooks (live, read-only)

| Endpoint | Status | Events |
| --- | --- | --- |
| `https://supabase.thedigitalgifter.com/functions/v1/stripe-webhook` | **enabled** | `checkout.session.completed`, `checkout.session.async_payment_succeeded` |
| `https://kjlsocejpmnzhhduyumy.supabase.co/functions/v1/stripe-webhook` | **enabled** | `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `invoice.paid` |

Neither includes `charge.refunded` / `refund.created`. Dual delivery risk until Cloud endpoint is disabled **after** self-host webhook secret + smoke pass.

---

## 5. Storage / Edge capacity (self-host)

| Check | Result |
| --- | --- |
| Capacity vs Cloud 1 GB | Self-host already **~1.9 GB** objects — Cloud Free quota is **not** a self-host production blocker |
| Permissions / public URLs | Public `templates` object GET **200**; buckets API **200** |
| Upload limits | Bucket `file_size_limit` values match Cloud catalog (e.g. christmas-source 15 MB, generated 100 MB) |
| Edge availability | **Partial** — most Christmas/pet commerce functions fail worker bootstrap |
| Contabo disk free | **UNVERIFIED** (tunnel key cannot run `df` on Contabo) — obtain shell-capable access before large media sync |

---

## 6. Missing pieces + safe cutover plan (no silent changes)

### Gaps

1. Redeploy / repair Edge function bundles on Contabo (entrypoint layout) for Christmas + shared commerce.  
2. Set Edge secrets on self-host: at least `STRIPE_WEBHOOK_SECRET`, Stripe keys, Resend, Replicate/HF as required.  
3. Apply PR #367 SQL **on self-host** (not Cloud).  
4. Retarget CI/scripts from `kjlsocejpmnzhhduyumy` to self-host deploy path.  
5. Reconcile storage drift (`templates` missing on self-host; `clip-factory`/`tdg-library` heavier on self-host).  
6. Reconcile storage RLS (12 policies missing on self-host).  
7. Disable Cloud Stripe webhook only after self-host webhook green.  
8. Fix Resend DNS for `send.thedigitalgifter.com`.  
9. Contabo disk + Edge volume inspection (needs non–port-forward SSH).  
10. Optional: install migration history schema on self-host for future `supabase migration` tracking.

### Safe cutover sequence (approval-gated)

1. **Backup:** Contabo Postgres dump + storage volume snapshot; keep Mozas `app.env.pre-owner-cutover-*`; export Stripe webhook IDs.  
2. **Reconcile storage (read-only diff first):** object counts by bucket; copy missing `templates` Cloud → self-host if still needed for catalog; do not delete customer pet/christmas objects.  
3. **Fix Edge runtime** on Contabo; deploy christmas-checkout / photo-funnel / photo-generate / stripe-webhook (and pet if needed).  
4. **Configure secrets** including `STRIPE_WEBHOOK_SECRET` matching the **self-host** webhook signing secret.  
5. **Apply** `20261015193000_*` then `20261015194500_*` on self-host.  
6. **Smoke (sandbox/test keys only):** Auth → Storage upload → funnel → checkout → webhook → job → email ledger → download.  
7. **Webhook cutover:** confirm self-host deliveries; then disable Cloud `kjlsocej…/stripe-webhook` (founder approval).  
8. **Retarget CI** to self-host; leave Cloud project read-only / archived later.  
9. **Enable** `CHRISTMAS_CHECKOUT_ENABLED=true` only after sandbox E2E PASS + Resend verified.

### Rollback

1. Set `CHRISTMAS_CHECKOUT_ENABLED=false` on Mozas.  
2. Re-enable Cloud Stripe webhook only if intentionally falling back (Cloud Edge still quota-blocked — weak fallback).  
3. Restore previous Edge bundles on Contabo.  
4. Do not drop additive SQL columns in panic.  
5. Restore `app.env` from dated pre-cutover file if URL/keys were changed.

### Smoke checklist

- [ ] `GET https://supabase.thedigitalgifter.com/auth/v1/health`  
- [ ] Storage public object + signed private object  
- [ ] `POST …/christmas-photo-funnel` returns app JSON (not InvalidWorkerCreation)  
- [ ] `POST …/christmas-checkout` with kill-switch respected  
- [ ] Stripe CLI/test webhook → self-host 2xx; order `paid`  
- [ ] Generate job completes; asset in `christmas-generated`  
- [ ] Resend delivery to controlled inbox  
- [ ] Refund event path after PR migrate + event subscribe  

---

## 7. PR #367 reassessment (self-host target)

| Item | Assessment |
| --- | --- |
| Migrations | Additive; safe for self-host once Edge healthy; **must not** be applied via Cloud-linked workflows as currently written |
| Refund webhook code | Correct direction; live webhooks lack refund events on **both** URLs |
| Email kinds | Requires self-host constraint update before `portrait_ready` ledger inserts |
| CI/deploy assumptions | Still Cloud-ref — **incompatible** with self-host-as-source-of-truth until retargeted |
| Prior “upgrade to Pro” guidance | **Superseded** — do not buy Cloud Pro for this cutover; fix self-host Edge + secrets + DNS instead |
| Launch readiness | Still **BLOCKED** on self-host Edge boot + webhook secret + Resend DNS + checkout kill switch |

---

## 8. Service scorecard

| Service | Verdict | Evidence |
| --- | --- | --- |
| Frontend config | Migrated | Live JS → self-host only |
| Mozas app runtime | Migrated | `app.env` + container env |
| Auth | Migrated (parity) | 24 users; GoTrue healthy |
| Postgres commerce data | Migrated (parity) | Matching order/job/pet counts + IDs |
| Storage buckets | Partial | Same bucket catalog; object/byte drift; RLS drift |
| Edge Functions | **Not migrated / broken** | 33/38 InvalidWorkerCreation; webhook secret missing |
| Stripe integration | Partial | Dual webhooks; self-host 503 |
| Resend | Not ready | Domain failed |
| CI/CD | Still Cloud | Workflows/scripts hardcode Cloud ref |
| Cloud project | Still live / restricted | Free plan; Edge 402 quota |

---

## Exact Cloud dependencies still active

1. Stripe webhook `…kjlsocejpmnzhhduyumy.supabase.co/functions/v1/stripe-webhook` (**enabled**).  
2. All GitHub deploy/apply workflows + `scripts/deploy-*.sh` / `apply-*.sh` targeting Cloud ref.  
3. Hardcoded Cloud storage base in `higgsfieldImage.ts`.  
4. Cloud project still holds divergent storage objects (notably `templates`).  
5. Historical docs/audits recommending Cloud Pro (outdated for this mission).

---

## Smallest safe next steps (no production writes without approval)

1. Obtain Contabo **shell** access (or docker exec path) and inventory Edge function volume / entrypoints.  
2. Repair + redeploy broken Edge bundles to self-host; set `STRIPE_WEBHOOK_SECRET`.  
3. Dry-run SQL of PR #367 against self-host (transaction + rollback) then apply with approval.  
4. Storage reconcile plan for `templates` (and RLS), read-only diff first.  
5. After self-host webhook 2xx: disable Cloud Stripe webhook.  
6. Retarget CI/scripts away from `kjlsocejpmnzhhduyumy`.  
7. Fix Resend DNS; keep Cloud Free project as cold backup until smoke passes — **no Pro upgrade**.

---

## What was not done (by design)

- No data migration, deletes, or overwrites  
- No endpoint switches or webhook mutations  
- No production deploys or secret writes  
- No Supabase Cloud plan changes  
- Contabo host disk free space: **UNVERIFIED** (tunnel-only key)
