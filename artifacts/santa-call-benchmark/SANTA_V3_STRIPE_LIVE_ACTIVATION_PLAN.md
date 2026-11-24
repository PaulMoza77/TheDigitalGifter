# Santa V3 — Stripe LIVE Activation Plan (NO AUTO-ACTIVATE)

## Prepared LIVE prices (already created)

| Offer | Amount | Price ID | Product |
|---|---|---|---|
| RO initial 180s | 59.00 RON | `price_1UVXfHGD87aY9yHxPJcj9CIz` | `prod_VWaqrLDjt30GrT` |
| RO extension 300s | 49.00 RON | `price_1UVXfIGD87aY9yHxsPbf8lRt` | `prod_VWaqU53EwpLVHg` |
| US initial 180s | $12.99 | `price_1UVXfIGD87aY9yHxuT9GYyyt` | `prod_VWaruUNqEKb26y` |
| US extension 300s | $9.99 | `price_1UVXfJGD87aY9yHx6nzxfXA1` | `prod_VWarCLewMSHllB` |

## Current isolation (must stay until approval)

- `CHRISTMAS_SANTA_CALL_STRIPE_MODE=test` on Contabo
- `CHRISTMAS_LIVE_PRODUCTS` empty (no Santa key)
- QA parent checkout uses TEST keys only
- TEST webhook: `stripe-webhook-test` (now fulfills Santa)
- LIVE webhook: `stripe-webhook` (must not process TEST)

## Activation steps (owner-supervised)

1. Confirm LIVE prices in Stripe Dashboard match table above.
2. Ensure LIVE webhook endpoint receives `checkout.session.completed` for Santa product keys and fulfills via `fulfillSantaVoiceCallOrder` / extension.
3. Map LIVE price IDs into production pricing / env (exact map TBD in deploy diff).
4. Set `CHRISTMAS_SANTA_CALL_STRIPE_MODE=live`.
5. Add `christmas_santa_voice_call` to `CHRISTMAS_LIVE_PRODUCTS`.
6. Owner smoke: **one** real LIVE charge on RO and US, then refund if needed.
7. Enable public SPA checkout flags + Meta Purchase (consent on).

## Rollback

1. Remove Santa from `CHRISTMAS_LIVE_PRODUCTS` immediately.
2. Revert `CHRISTMAS_SANTA_CALL_STRIPE_MODE=test` if needed for QA.
3. Keep price objects; disable sell path only.
4. Restore previous SPA overlay from `santa-preview.bak.*` / `santa-qa.bak.*` on casahub.

## Failure handling already required

- Server-side `confirm_checkout` reconcile
- Idempotent webhook + `processed_stripe_events`
- No double entitlement on duplicate confirm/webhook
- Bounded client polling + retry UI
