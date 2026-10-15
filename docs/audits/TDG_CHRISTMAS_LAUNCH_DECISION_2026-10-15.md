# Christmas Launch Decision · Minimum Founder Intervention

**PR:** #367 @ `d16c7471`  
**Branch:** `cursor/christmas-funnel-audit-54fb`  
**Date:** 2026-10-15  
**Decision:** **BLOCKED** (not READY)

No production changes, DNS writes, upgrades, deletes, or webhook mutations were performed.

---

## Automated status (this agent)

| Check | Result |
| --- | --- |
| Code / migrations / refunds on PR | Ready for review |
| Christmas regression tests | **71 PASS** |
| DNS record validation (names/values vs Resend) | **VALIDATED** (not applied) |
| Cloudflare API access | **ABSENT** — cannot write DNS |
| Stripe TEST credentials / MCP sandbox | **ABSENT** — livemode only; no keys injected |
| Supabase Edge live | **BLOCKED** — storage 1.130 GB / free 1 GB |
| Production deploy / migration apply | Not done (needs approval) |

---

## 1. Supabase path (updated — self-hosted is the target)

**Superseded:** Do **not** upgrade to Supabase Cloud Pro for Christmas production.  
Production app already points at self-hosted `https://supabase.thedigitalgifter.com` (see `TDG_SELFHOSTED_SUPABASE_MIGRATION_VERDICT_2026-10-15.md`).

| Item | Value |
| --- | --- |
| Active runtime | Self-hosted via Mozas → Contabo tunnel |
| Cloud project | `kjlsocejpmnzhhduyumy` · still **free**; Edge **402** quota — residual dependency only |
| Self-host storage | ~1.9 GB objects (Cloud 1 GB Free quota is **not** the self-host blocker) |
| Primary blockers | Self-host Edge `InvalidWorkerCreation` for christmas-checkout/photo-*; missing `STRIPE_WEBHOOK_SECRET`; Resend DNS |

**Options requiring founder approval:**

1. **Repair/redeploy Edge on Contabo** + set webhook/secrets (preferred).  
2. Reconcile storage drift / RLS; disable Cloud Stripe webhook after self-host green.  
3. Optional Cloud Free cleanup later — not a Pro purchase.

---

## 2. Cloudflare / Resend DNS (prepared; approval required before write)

| Item | Result |
| --- | --- |
| Zone NS | Cloudflare (`bailey` / `rory`) |
| Agent Cloudflare token | **None** in environment secrets |
| Live dig | All four Resend records still missing |
| Record validation | **OK** against Resend domain `de3c341e-…` |

### Exact records to add (Cloudflare · zone `thedigitalgifter.com`)

Proxy status: **DNS only** for MX/CNAME/TXT (orange cloud off).

| Type | Name | Content | Priority | TTL |
| --- | --- | --- | --- | --- |
| TXT | `resend._domainkey.send` | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCqwvtNBlErz3L6Gdy9mXOsuzm7F9g/wzc7NmRBti88gBbN+8IEYTC1OE/n0Dfkfkzg1Oa+r3Xdp1UBc5m0+WQ0587JkK1WX7FSeaxU8VdmFvLrOmBaVIIk6+YFuxxzTsefwOd2v9eHBPGmrdV99tKY/iMxqsva42dBKnEpK/NwYwIDAQAB` | — | Auto |
| MX | `send.send` | `feedback-smtp.eu-west-1.amazonses.com` | **10** | Auto |
| TXT | `send.send` | `v=spf1 include:amazonses.com ~all` | — | Auto |
| CNAME | `rsend.send` | `send.forge.rmta.net` | — | Auto |

After add: Resend → Verify `send.thedigitalgifter.com`.  
Do **not** switch From to `volocar.eu` without explicit brand approval.

**To automate later:** inject `CLOUDFLARE_API_TOKEN` (Zone DNS Edit) and approve one DNS write turn.

---

## 3. Stripe TEST access (existing authorized config)

| Source | Result |
| --- | --- |
| Stripe MCP accounts | Only `acct_1R7edvGD87aY9yHx` · **livemode true** |
| Env secrets | No `STRIPE_*` / `sk_test` / `pk_test` / `whsec` injected |
| Authorized secrets present | Mozas SSH + Supabase service role + Replicate only |

**Conclusion:** No authorized test-mode path exists in this environment. Sandbox E2E remains blocked. Never use live charges.

---

## 4. Production change plan (approval-gated) + rollback

### Safety review

| Change | Risk | Notes |
| --- | --- | --- |
| Migration email kind | Low | Additive CHECK expand |
| Migration refunds | Medium | Additive columns + RPC; expands `payment_status`; replaces claim RPC body |
| Edge `stripe-webhook` | Medium | Shared with Pet; refund events only act when Christmas order resolved |
| Edge photo-generate / photo-funnel | Low–Med | Email ledger + download revoke on full refund |
| Webhook event subscribe | Medium | Must keep existing checkout events |

### Apply order (only after approval + storage unblock)

1. Apply SQL: `20261015193000_christmas_portrait_email_kind.sql`  
2. Apply SQL: `20261015194500_christmas_portrait_refunds.sql`  
3. Deploy Edge: `stripe-webhook`, `christmas-photo-generate`, `christmas-photo-funnel`  
4. Stripe Dashboard: on TDG webhook URL(s), **add** `charge.refunded`, `refund.created` (keep checkout events)  
5. Set `CHRISTMAS_CHECKOUT_ENABLED=true` only after sandbox E2E PASS  
6. Confirm Resend From uses verified `send.thedigitalgifter.com`

### Rollback

1. Set `CHRISTMAS_CHECKOUT_ENABLED=false` immediately (stops new purchases).  
2. Redeploy previous Edge bundles for the three functions from last known-good SHA.  
3. Stripe: remove refund events if they cause noise (checkout events stay).  
4. SQL: do **not** drop columns in panic; new statuses are additive. If claim RPC regresses, restore prior `claim_christmas_generation_job` definition from `20260902150000_…`.  
5. DNS: remove the four Resend records only if they conflict (unlikely).

---

## Founder actions that cannot be automated here

1. **Unblock self-hosted Edge** — Contabo shell access to fix function entrypoints + set `STRIPE_WEBHOOK_SECRET` (not Cloud Pro).  
2. **Add the four Resend DNS records** in Cloudflare (or inject Cloudflare token + approve agent write), then Verify in Resend.  
3. **Provide Stripe TEST access** — sandbox MCP auth or inject `sk_test` / `pk_test` / test `whsec` (never live).  
4. **Approve production apply** — two migrations + three Edge deploys + refund webhook event subscription.  
5. **Approve go-live flag** — `CHRISTMAS_CHECKOUT_ENABLED=true` only after sandbox E2E.

---

## Decision

**BLOCKED** — not READY for production Christmas purchase launch.
