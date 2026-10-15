# Christmas Portrait Unblock · Founder Actions

**Date:** 2026-10-15  
**Repo / base:** `PaulMoza77/TheDigitalGifter` · `main` `a63672e6`  
**Branch:** `cursor/christmas-funnel-audit-54fb`  
**PR:** #367  
**Decision:** **NO-GO** until sandbox E2E completes (upload → generate → pay → DB → Resend → download)

No production migrations, DNS changes, webhook subscriptions, or deploys were performed.

---

## 1. Supabase storage quota — DIAGNOSED

| Fact | Value |
| --- | --- |
| Project | `kjlsocejpmnzhhduyumy` |
| Org plan | **free** (`tier_free`) |
| Free file-storage limit | **1 GB** |
| Measured usage | **1.130 GB** (717 objects) · ~130 MB over |
| DB size | 42 MB (not the quota issue) |
| Edge symptom | `exceed_storage_size_quota` on function invoke |

### Usage by bucket (largest first)

| Bucket | Objects | Size (MB) | Notes |
| --- | --- | --- | --- |
| `templates` | 274 | **542.5** | Catalog/media assets |
| `clip-factory` | 96 | **314.2** | Internal video source/renders (not customer portrait delivery) |
| `uploads` | 48 | 78.2 | Legacy public uploads |
| `pet-source-photos` | 84 | 74.8 | Customer pet sources — **do not delete** |
| `pet-generated` | 88 | 62.6 | Customer pet results — **do not delete** |
| `occasion-collections` | 16 | 31.2 | Marketing |
| `christmas-generated` | 25 | 16.3 | Customer Christmas results — **do not delete** |
| `christmas-source` | 18 | 8.3 | Customer Christmas sources — **do not delete** |
| others | — | <30 | — |

### Resolution path (updated)

Cloud Free quota explains Cloud Edge **402**, but production runtime already uses **self-hosted** Supabase (`supabase.thedigitalgifter.com`). Full evidence: `TDG_SELFHOSTED_SUPABASE_MIGRATION_VERDICT_2026-10-15.md`.

**Do not upgrade to Cloud Pro for production.** Prefer:

1. Repair Contabo Edge worker entrypoints for `christmas-checkout` / `christmas-photo-funnel` / `christmas-photo-generate`.  
2. Configure self-host `STRIPE_WEBHOOK_SECRET` (current self-host webhook returns 503).  
3. Reconcile storage/RLS drift; disable Cloud Stripe webhook only after self-host smoke passes.  
4. Optional: archive internal Cloud `clip-factory` later — not required to unblock self-host.

Until self-host Edge boots, live upload/checkout/generate remain **BLOCKED**.

---

## 2. Resend `send.thedigitalgifter.com` — DIAGNOSED

| Fact | Value |
| --- | --- |
| Domain ID | `de3c341e-1402-4aa4-9893-b099e73a3cb3` |
| Status | **failed** |
| DNS host | Cloudflare (`bailey.ns` / `rory.ns`) |
| Live dig | **All four records missing** (empty) |

### Exact DNS records to add (under `thedigitalgifter.com` in Cloudflare)

Resend returns host names relative to the **apex**. Create these exactly:

| Type | Name (Cloudflare host) | Value | Priority |
| --- | --- | --- | --- |
| TXT | `resend._domainkey.send` | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCqwvtNBlErz3L6Gdy9mXOsuzm7F9g/wzc7NmRBti88gBbN+8IEYTC1OE/n0Dfkfkzg1Oa+r3Xdp1UBc5m0+WQ0587JkK1WX7FSeaxU8VdmFvLrOmBaVIIk6+YFuxxzTsefwOd2v9eHBPGmrdV99tKY/iMxqsva42dBKnEpK/NwYwIDAQAB` | — |
| MX | `send.send` | `feedback-smtp.eu-west-1.amazonses.com` | **10** |
| TXT | `send.send` | `v=spf1 include:amazonses.com ~all` | — |
| CNAME | `rsend.send` | `send.forge.rmta.net` | — |

FQDNs: `resend._domainkey.send.thedigitalgifter.com`, `send.send.thedigitalgifter.com`, `rsend.send.thedigitalgifter.com`.

Then (founder approval): Resend → Verify domain → poll until `verified`.

### Verified alternative (evaluate only — do **not** silently change production identity)

| Domain | Status | Use? |
| --- | --- | --- |
| `volocar.eu` | **verified** | Technically usable as `TRANSACTIONAL_EMAIL_FROM` / `CHRISTMAS_EMAIL_FROM`, but changes brand/sender identity |
| `casahub.eu` | failed | Not usable |
| `send.thedigitalgifter.com` | failed | Intended TDG sender — **fix DNS first** |

Recommendation: keep TDG sender on `send.thedigitalgifter.com` after DNS fix. Only fall back to `volocar.eu` with explicit founder approval of From-address change.

---

## 3. Stripe TEST-mode — BLOCKED

| Fact | Value |
| --- | --- |
| Stripe MCP accounts | Only `acct_1R7edvGD87aY9yHx` · **livemode: true** (“Volocar”) |
| Sandbox/test account in session | **None** |
| Policy | No live charges; no live billing mutation to simulate sandbox |

### Prerequisites to unblock sandbox E2E

1. Create a Stripe **Sandbox** (or enable Test mode credentials) dedicated to TDG.  
2. Authorize Stripe MCP / agent access to that **test** account (`livemode: false`), **or** place test secrets only in a non-production Edge/env:  
   - `STRIPE_SECRET_KEY=sk_test_…`  
   - `STRIPE_PUBLISHABLE_KEY=pk_test_…`  
   - `STRIPE_WEBHOOK_SECRET=whsec_…` (from a **test** webhook endpoint)  
3. Create a **test** webhook endpoint pointing at the Stripe CLI or a staging functions URL with events listed in §4.  
4. Keep production live keys untouched.

Until then: Checkout + webhook live proof = **BLOCKED**.

---

## 4. Portrait refunds — IMPLEMENTED ON BRANCH (not deployed)

Code/migration on branch:

- `20261015194500_christmas_portrait_refunds.sql` — `partially_refunded`, `refunded_amount_cents`, RPC `refund_christmas_commerce_order`, claim allows partial  
- `stripeFulfill.handleChristmasRefund` — planner + portrait/santa; full/partial; idempotent via `last_refund_id` + `processed_stripe_events`  
- `getOrder` revokes signed download on full `refunded`  
- `portrait_refunded` Resend ledger email on full refund only  

Webhook signature validation remains in `stripe-webhook` (`STRIPE_WEBHOOK_SECRET`, 5‑minute skew) before any refund handler runs.

### Required Stripe webhook subscriptions (founder approval to change prod)

Subscribe on the **TDG** endpoint(s) currently used for Christmas:

- Existing (keep): `checkout.session.completed`, `checkout.session.async_payment_succeeded`  
- **Add:** `charge.refunded`, `refund.created`  
- Recommended: `charge.dispute.created`, `charge.dispute.funds_withdrawn`  

Current live TDG endpoints (read-only observation; not modified):

- `https://kjlsocejpmnzhhduyumy.supabase.co/functions/v1/stripe-webhook` — checkout + invoice only  
- `https://supabase.thedigitalgifter.com/functions/v1/stripe-webhook` — checkout completed/async only  

Neither currently includes refund events → even after deploy, refunds will not arrive until subscribed.

---

## 5. PR #367 validation + deployment plan (approval-gated)

### Already on branch / tests

```bash
npm test -- src/features/christmas/christmasPhotoGenerator.test.ts \
  src/features/christmas/christmasFoundation.test.ts \
  src/features/christmas/christmasPortraitVerticals.test.ts \
  src/features/christmas/commercialOffers.test.ts \
  src/features/christmas/christmasWiring.test.ts
```

### Migrations to apply (order; production only with approval)

1. `20261015193000_christmas_portrait_email_kind.sql`  
2. `20261015194500_christmas_portrait_refunds.sql`  

### Edge functions to deploy (after migration; approval)

1. `stripe-webhook`  
2. `christmas-photo-generate`  
3. `christmas-photo-funnel`  
(shared modules ship with those bundles: `stripeFulfill`, `portraitEmail`, `portraitRefundEmail`)

### Post-deploy smoke (sandbox only)

1. Storage quota cleared / plan upgraded  
2. Resend domain verified; send to `delivered@resend.dev` or controlled inbox  
3. Test Checkout with `sk_test` + test card `4242…`  
4. Confirm DB: order `paid` → job → asset → email ledger `portrait_ready`  
5. Issue test full refund → `payment_status=refunded`, download revoked, `portrait_refunded` email  
6. Issue test partial refund → `partially_refunded`, download still available  

---

## Stage evidence (this iteration)

| Item | Result |
| --- | --- |
| Storage diagnosis | **PASS** (cause known) · live Edge still **BLOCKED** until quota cleared |
| Resend DNS diagnosis | **PASS** (records known) · domain still **FAIL** until DNS added |
| Stripe TEST setup | **BLOCKED** (no test account in MCP) |
| Portrait refund code | **PASS** (implemented + tests) · live **BLOCKED** (no deploy/webhook sub) |
| Sandbox E2E | **BLOCKED** |
| **GO/NO-GO** | **NO-GO** |
