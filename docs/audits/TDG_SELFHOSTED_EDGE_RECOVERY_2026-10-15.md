# Self-Hosted Edge Recovery · Status Report

**Date:** 2026-10-15  
**Repo / PR:** `PaulMoza77/TheDigitalGifter` · #367  
**Target:** `https://supabase.thedigitalgifter.com` → Contabo `62.171.191.209` (Kong `:8000`) via Mozas tunnel  
**Mode:** diagnosis + reversible prep only  

---

## Overall: **BLOCKED**

| Gate | Result |
| --- | --- |
| Host / prod verified | **PASS** |
| Root-cause ID for `InvalidWorkerCreation` | **PASS** (class identified; filesystem proof needs Contabo shell) |
| Config backup (Mozas) | **PASS** |
| Contabo disk / Edge volume inspect | **BLOCKED** (tunnel key is port-forward only) |
| Edge boot repair executed | **BLOCKED** (no Contabo shell) |
| `STRIPE_WEBHOOK_SECRET` on Contabo Edge | **FAIL** (missing at runtime); candidate exists on Mozas (not injected) |
| Non-payment Edge tests | **FAIL** for Christmas commerce functions |
| PR #367 migration dry-run | **PARTIAL** (ALTER OK via `/pg/query`; function bodies need `psql`; **not applied**) |
| Cloud webhook disabled | **Not done** (correctly deferred) |
| `CHRISTMAS_CHECKOUT_ENABLED` | Remains **`false`** |

No Cloud upgrade. No DB remigration/apply. No webhook disable. No checkout activation. No DNS changes. No customer data touched.

---

## 1. Authorized host & production

| Check | Evidence |
| --- | --- |
| Mozas host | `mozas-prod-01` |
| App container | `thedigitalgifter` · `mozas/thedigitalgifter:a63672e6` · **healthy** |
| Runtime URL | `SUPABASE_URL` / `VITE_SUPABASE_URL` = `https://supabase.thedigitalgifter.com` |
| Kill switch | `CHRISTMAS_CHECKOUT_ENABLED=false` |
| Tunnel | `tdg-staging-supabase-tunnel.service` **active** · `127.0.0.1:19000` + `172.18.0.1:19001` → Contabo `127.0.0.1:8000` |
| Contabo SSH | Key `/opt/mozas/projects/thedigitalgifter-staging/tunnel-key` · **port-forward only** (`command` + `permitopen`) — shell/docker/`df` denied |
| Mozas disk | `/` 193G · 152G used · **42G free** (79%) |
| Auth / REST | HTTP **200** via tunnel |

---

## 2. Root cause · `InvalidWorkerCreation`

### Symptom (live)

```text
{"msg":"InvalidWorkerCreation: worker boot error: failed to bootstrap runtime: could not find an appropriate entrypoint"}
```

Observed on Contabo Edge for **33/38** probed slugs (examples: `christmas-checkout`, `christmas-photo-funnel`, `christmas-photo-generate`, `pet-funnel`, `christmas-commerce-config`).

### Boots (application-level responses)

| Function | Response |
| --- | --- |
| `stripe-webhook` | **503** `STRIPE_WEBHOOK_SECRET is not configured` |
| `christmas-funnel` | 400 unknown action (runtime OK) |
| `christmas-generate` | 400 `order_id required` (runtime OK) |
| `christmas-generate-video` | Forbidden (runtime OK) |
| `christmas-v2-funnel-event` | 400 invalid_event (runtime OK) |

### Analysis

1. **Repo layout is fine** — broken and working functions both ship `supabase/functions/<slug>/index.ts` with no special `deno.json` differences that explain the split.  
2. **Failure is Contabo Edge mount/bundle state**, not Mozas app config: Envoy returns the worker error in **~2–8 ms** (`x-envoy-upstream-service-time`), consistent with missing entrypoint files rather than Deno compile of large sources.  
3. **Partial deploy / wrong directory layout** on the Contabo functions volume is the leading cause (empty slug dir, nested path without `index.ts`/`index.js`, or slug registered without files).  
4. **Cannot confirm volume contents** without Contabo shell (`docker exec` into `edge-runtime` / list `…/volumes/functions/<slug>`).

Caddy access logs on Mozas show repeated **500** to `/functions/v1/social-publisher` (same worker-failure class) — production traffic already hits broken Edge.

---

## 3. Backups & rollback readiness

### Backups taken (Mozas — reversible)

Directory: `/opt/mozas/projects/thedigitalgifter/ops/edge-recovery-backups-20261015T203257Z/`

| File | Purpose |
| --- | --- |
| `app.env` | Prod app secrets/env |
| `env.providers` | Provider secrets incl. Stripe keys (mode `0600`) |
| `env.providers.inventory.txt` | Key names + lengths + sha256_8 only |
| `Caddyfile` | Active proxy routes |
| `tdg-staging-supabase-tunnel.service` | Tunnel unit |

### Rollback (when Contabo repair becomes possible)

1. Restore Contabo Edge function volume / compose from pre-change tarball (to be created **on Contabo** before any write).  
2. Restore Contabo `.env` / Edge secrets file from dated copy.  
3. `docker compose up -d` Edge/Kong only — do not touch Postgres data volume.  
4. Mozas: restore files from `edge-recovery-backups-20261015T203257Z` if proxy/env were changed (they were **not** modified this turn).  
5. Keep `CHRISTMAS_CHECKOUT_ENABLED=false` throughout.

**Contabo pre-change backup:** **NOT DONE** — blocked on shell.

---

## 4. `STRIPE_WEBHOOK_SECRET`

| Fact | Detail |
| --- | --- |
| Live Edge | **Missing** → `stripe-webhook` HTTP 503 |
| Mozas candidate | `/opt/mozas/projects/thedigitalgifter/.env.providers` key `STRIPE_WEBHOOK_SECRET` · present · `whsec_` · len 38 · sha256_8 `803ea665` |
| In `app.env`? | **No** |
| Self-host Stripe endpoint | `we_1UP7EnGD87aY9yHx…` · URL `https://supabase.thedigitalgifter.com/functions/v1/stripe-webhook` · enabled · checkout events only |
| Cloud Stripe endpoint | `we_1U5Aeo…` · `https://kjlsocejpmnzhhduyumy.supabase.co/functions/v1/stripe-webhook` · **still enabled** |
| Secret printed / injected? | **No** |
| Endpoint-specific proof | Stripe retrieve API does **not** return signing secrets. Candidate must be confirmed against Dashboard “Reveal” for `we_1UP7En…` (or a controlled signed test) **before** inject. Do **not** reuse the Cloud endpoint secret. |

**Authorized next step (founder):** Confirm Mozas `.env.providers` value matches self-host endpoint `we_1UP7En…`, then inject into **Contabo Edge** env (not only Mozas `app.env`), restart `edge-runtime` only.

---

## 5. Non-payment Edge tests (`CHRISTMAS_CHECKOUT_ENABLED=false`)

| Function | Request | HTTP | Result |
| --- | --- | --- | --- |
| `christmas-funnel` | `{"action":"health"}` | 400 | Boots (unknown action) |
| `christmas-v2-funnel-event` | probe event | 400 | Boots |
| `christmas-generate` | `{}` | 400 | Boots (`order_id required`) |
| `christmas-checkout` | probe JSON | 500 | **InvalidWorkerCreation** |
| `christmas-photo-funnel` | `{"action":"styles"}` | 500 | **InvalidWorkerCreation** |
| `christmas-photo-generate` | status | 500 | **InvalidWorkerCreation** |
| `christmas-commerce-config` | `{}` | 500 | **InvalidWorkerCreation** |
| `pet-funnel` | health | 500 | **InvalidWorkerCreation** |
| `stripe-webhook` | `{}` | 503 | Boots; secret missing |

No payment/checkout sessions created.

---

## 6. PR #367 migrations vs self-host (not applied)

| Check | Result |
| --- | --- |
| Preflight | No `refunded_amount_cents`; payment_chk lacks `partially_refunded`; email kinds lack `portrait_*`; no `refund_christmas_commerce_order` |
| `20261015193000_…email_kind.sql` dry-run `BEGIN…ROLLBACK` | **OK** (HTTP 200) |
| `20261015194500_…refunds.sql` ALTER section dry-run | **OK** |
| Function bodies via `/pg/query` | **API limitation** — dollar-quoted plpgsql not accepted by Kong `/pg/query` (false syntax at `if`); needs Contabo `psql` for full dry-run |
| Post-check | Schema **unchanged** (no columns/RPC added) |
| `supabase_migrations` schema | **Absent** on self-host — create before recording history (approval-gated) |

**Do not apply** until: Contabo shell + Edge boots + explicit approval.

---

## 7. Dual webhooks & CI · cutover sequence (do not execute disable yet)

### Dual webhooks (live)

1. Self-host `…/stripe-webhook` — enabled; secret missing on Edge → cannot process.  
2. Cloud `kjlsocej…/stripe-webhook` — enabled; Cloud Edge **402** quota → cannot process.

### CI / scripts still Cloud-bound

≥13 GitHub workflows + ≥19 `scripts/deploy-*.sh` / `apply-*.sh` hardcode `kjlsocejpmnzhhduyumy`.

### Safe cutover sequence (approval gates)

1. Contabo **shell** key + backup Edge volume + compose + env.  
2. Inspect `volumes/functions/<slug>` for broken vs working slugs; restore/redeploy missing entrypoints (`index.ts`).  
3. Inject confirmed self-host `STRIPE_WEBHOOK_SECRET` into Contabo Edge env; restart edge-runtime.  
4. Non-payment probes → christmas-photo-funnel / commerce-config / stripe-webhook (expect app-level errors, not InvalidWorkerCreation / missing secret).  
5. Sandbox webhook signed test → self-host 2xx + idempotent DB write.  
6. **Then** disable Cloud webhook `we_1U5Aeo…` (not before).  
7. Apply PR #367 SQL on self-host with backup + migration history.  
8. Retarget CI to self-host deploy path.  
9. Keep checkout kill switch false until full sandbox E2E.

---

## 8. Contabo shell runbook (ready to execute when authorized)

```bash
# On Contabo (shell-capable key required)
df -h /
cd /home/supabase/docker || cd /opt/supabase/docker   # locate real compose root
docker ps --format '{{.Names}}\t{{.Image}}\t{{.Status}}'
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
mkdir -p /root/tdg-edge-backup-$STAMP
cp -a .env docker-compose.yml /root/tdg-edge-backup-$STAMP/ 2>/dev/null || true
tar -C /var/lib/docker/volumes -czf /root/tdg-edge-backup-$STAMP/functions-vol.tgz \
  $(docker volume ls -q | grep -i functions | head -5) 2>/dev/null || \
  tar -czf /root/tdg-edge-backup-$STAMP/functions-dir.tgz ./volumes/functions

# Compare working vs broken slug trees
for s in stripe-webhook christmas-funnel christmas-checkout christmas-photo-funnel; do
  echo "== $s =="; find ./volumes/functions/$s -maxdepth 2 -type f 2>/dev/null | head
done

# After repair: copy index.ts bundles for broken slugs; restart edge-runtime only
# docker compose restart functions-edge  # actual service name TBD on host

# Secrets: set STRIPE_WEBHOOK_SECRET in Contabo Edge env (value from confirmed we_1UP7En…)
# Never log the secret.
```

---

## 9. Founder blockers (smallest path)

1. **Provide Contabo shell-capable SSH** (not port-forward-only) to `root@62.171.191.209` (or docker-exec equivalent).  
2. **Confirm** Mozas `.env.providers` `STRIPE_WEBHOOK_SECRET` is the signing secret for Stripe endpoint `we_1UP7En…` (self-host URL).  
3. Approve Contabo Edge volume repair + secret inject (still no checkout enable, no Cloud webhook disable until proven).

---

## Scorecard

| Item | Status |
| --- | --- |
| Diagnosis | **PASS** |
| Mozas backup | **PASS** |
| Contabo backup | **BLOCKED** |
| Edge repair | **BLOCKED** |
| Webhook secret on Edge | **FAIL** |
| Controlled Edge tests | **FAIL** (commerce path) |
| Migration validate | **PARTIAL** (not applied) |
| Rollback readiness | **PARTIAL** (Mozas yes · Contabo no) |
| **Mission** | **BLOCKED** |
