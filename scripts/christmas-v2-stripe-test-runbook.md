# Christmas V2 Stripe test-mode runbook (operator)

**Cloud Agent status (reverified):** `STRIPE_SECRET_KEY` / publishable / webhook secret **UNSET**.  
Stripe MCP auth **timed out / unavailable**. Live Stripe integration remains **BLOCKED** here.

**Never** use production keys (`sk_live_…`, `pk_live_…`, production `whsec_…`).  
Use `sk_test_…` / `pk_test_…` / test-endpoint `whsec_…` only.  
**Never** paste secrets into chat, commits, PR bodies, or logs.

## Secure credential supply (operator)

1. In Stripe Dashboard → **Test mode** → Developers → API keys, copy `sk_test_` / `pk_test_`.
2. Create a **test-mode** webhook endpoint (or `stripe listen`) and copy its `whsec_`.
3. Inject into the **isolated** agent/staging environment only via the platform secret manager / env panel (not `.env` committed to git):
   - `STRIPE_SECRET_KEY=sk_test_…`
   - `STRIPE_PUBLISHABLE_KEY=pk_test_…`
   - `STRIPE_WEBHOOK_SECRET=whsec_…`
4. Confirm prefix classification before any call: must start with `sk_test_` / `pk_test_`. Abort if `sk_live_`.
5. Pair with disposable DB (`christmas_v2_iso` harness) + `CHRISTMAS_GENERATION_MOCK=true`.

## Preconditions

1. Isolated non-production DB with `20261011140000_christmas_v2_eur_offers_and_finalize.sql` applied.
2. Same SHA for Edge + VPS (or local Node API).
3. Mock generation: `CHRISTMAS_GENERATION_MOCK=true` (no paid Higgsfield).

## Session matrix (expected)

| Pack | amount_cents | currency | images | videos |
|------|--------------|----------|--------|--------|
| starter | 700 | eur | 3 | 0 |
| magic | 1700 | eur | 5 | 1 |
| ultimate | 2700 | eur | 10 | 3 |

Checkout must use server pack amounts (`CHRISTMAS_PACKS`), `mode=payment`, description “No subscription.”  
**VAT/tax:** Christmas checkout does **not** set `automatic_tax` today — legal/business configuration still required; do not invent rates.

## Operator commands

```bash
# Local webhook forward (test mode)
stripe listen --forward-to http://127.0.0.1:54321/functions/v1/stripe-webhook

# Funnel: createOrder → upload → createCheckout for each pack
# Pay with 4242… (success), 4000…0002 (decline)
# Cancel hosted checkout; abandon Elements return
# Refresh success URL (confirmStripePayment + webhook race)
# Replay event_id; out-of-order async_payment_succeeded
```

## Negative cases

1. Amount mismatch → RPC `amount mismatch`, no `paid_at`
2. Currency mismatch → RPC `currency mismatch`
3. Forged/missing `stripe-signature` → HTTP 400
4. Replay same `event_id` → `already_processed` / no second job
5. Unpaid / cancelled → no enqueue
6. Concurrent webhook + `confirmStripePayment` → one paid row, one job

## Offline proofs already automated (no sk_test)

```bash
npx vitest run src/features/christmas-v2/stripeWebhookContract.test.ts \
  src/features/christmas-v2/generateEndpointSecurity.test.ts \
  src/features/christmas-v2/mockFulfillmentLifecycle.test.ts \
  src/features/christmas-v2/metaPurchaseAndCostLedger.test.ts

PGPASSWORD=tdg_test_local psql -h 127.0.0.1 -U tdg_test -d christmas_v2_iso \
  -f scripts/christmas-v2-iso-sql-assertions.sql
PGPASSWORD=tdg_test_local psql -h 127.0.0.1 -U tdg_test -d christmas_v2_iso \
  -f scripts/christmas-v2-iso-mock-e2e.sql

# Meta Purchase + AI cost ledger (stubs first on disposable DBs without pet cost stack)
PGPASSWORD=tdg_test_local psql -h 127.0.0.1 -U tdg_test -d christmas_v2_iso \
  -f scripts/christmas-v2-iso-meta-cost-stubs.sql
PGPASSWORD=tdg_test_local psql -h 127.0.0.1 -U tdg_test -d christmas_v2_iso \
  -f supabase/migrations/20261011180000_christmas_v2_meta_purchase_and_cost_ledger.sql
PGPASSWORD=tdg_test_local psql -h 127.0.0.1 -U tdg_test -d christmas_v2_iso \
  -f scripts/christmas-v2-iso-meta-cost-assertions.sql
```

**Meta CAPI safety:** live Ads dataset writes require `CHRISTMAS_META_CAPI_LIVE=true` **or** `META_TEST_EVENT_CODE`. Token stays server-side (`META_CAPI_ACCESS_TOKEN`). Never send mock conversions to production Pixel datasets from agent/staging.

## Exit criteria to unblock GO

- [ ] Test-mode Sessions for 700 / 1700 / 2700 EUR cents paid
- [ ] Exactly one fulfill + one generate enqueue per success
- [ ] Decline / cancel / abandon / refresh / replay observed
- [ ] Signature forgery rejected in live webhook path
- [ ] Mock fulfillment tied to those three paid sessions
- [ ] Pet payment hardening suite green
- [ ] VAT/tax business decision recorded
