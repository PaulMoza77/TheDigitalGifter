# Christmas V2 Stripe test-mode runbook (operator)

**Status:** Live Stripe tests are **BLOCKED** in the Cloud Agent environment (`STRIPE_SECRET_KEY` unset).  
**Never** use production Stripe keys (`sk_live_…`). Use `sk_test_…` / `pk_test_…` only.

## Preconditions

1. Isolated non-production DB with `20261011140000_christmas_v2_eur_offers_and_finalize.sql` applied (see local `christmas_v2_iso` harness).
2. Staging/VPS + Edge deployed from the same PR SHA, or local Vite + Node API with mock generation:
   - `CHRISTMAS_GENERATION_MOCK=true`
   - `CHRISTMAS_GENERATION_ENABLED=true` (or mock alone)
3. Env: `STRIPE_SECRET_KEY=sk_test_…`, `STRIPE_PUBLISHABLE_KEY=pk_test_…`, `STRIPE_WEBHOOK_SECRET=whsec_…` (test endpoint).

## Session matrix (expected)

| Pack | amount_cents | currency | images | videos |
|------|--------------|----------|--------|--------|
| starter | 700 | eur | 3 | 0 |
| magic | 1700 | eur | 5 | 1 |
| ultimate | 2700 | eur | 10 | 3 |

Checkout must use server pack amounts (`CHRISTMAS_PACKS`), not client-supplied prices.

## Commands (operator machine)

```bash
# 1) Create hosted/elements session via funnel createCheckout (starter)
# 2) Complete payment with Stripe test card 4242…
# 3) Confirm webhook + confirmStripePayment both call fulfill_christmas_v2_order_payment once
# 4) Assert generation job enqueued exactly once (should_enqueue false on replay)
```

Stripe CLI (test mode):

```bash
stripe listen --forward-to localhost:54321/functions/v1/stripe-webhook
stripe trigger checkout.session.completed --add checkout_session:metadata.product_type=christmas_portrait_pack
```

## Negative cases

1. Tamper session amount → RPC raises `amount mismatch` (no `paid_at`).
2. Wrong currency (`usd` vs order `eur`) → `currency mismatch`.
3. Replay same `event_id` → `processed_stripe_events` unique; no second job row.
4. Cancel / unpaid session → order remains unpaid; no enqueue.

## Pet / subscription non-regression

After Christmas webhook changes, re-run:

```bash
npx vitest run src/features/pet-v3/paymentHardening.test.ts src/features/pet-v3/v3CheckoutSemantics.test.ts
```

Confirm `stripeFulfill` still routes `product_family=christmas` commerce separately from V2 `christmas_v2_*`.

## Exit criteria for unblocking GO

- [ ] Test-mode Sessions for 700 / 1700 / 2700 EUR cents created and paid
- [ ] Exactly one fulfill + one generate enqueue per successful payment
- [ ] Mismatch + replay cases observed in logs/DB
- [ ] Pet payment hardening suite green
