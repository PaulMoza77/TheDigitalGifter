# Santa V3 — Commercial Launch Activation Report

**Date:** 2026-10-28  
**Branch:** `feature/santa-voice-call`  
**Final Meta Ads verdict:** **NO-GO** (honest blockers below)

## 1. Stripe LIVE configuration status

| Check | Result | Evidence |
|---|---|---|
| RO initial price | PASS | `price_1UVXfHGD87aY9yHxPJcj9CIz` · 5900 ron · livemode true · prod `prod_VWaqrLDjt30GrT` |
| RO extension price | PASS | `price_1UVXfIGD87aY9yHxsPbf8lRt` · 4900 ron · livemode true |
| US initial price | PASS | `price_1UVXfIGD87aY9yHxuT9GYyyt` · 1299 usd · livemode true |
| US extension price | PASS | `price_1UVXfJGD87aY9yHx6nzxfXA1` · 999 usd · livemode true |
| Contabo mode | PASS | `CHRISTMAS_SANTA_CALL_STRIPE_MODE=live` |
| LIVE products allowlist | PASS | `CHRISTMAS_LIVE_PRODUCTS=christmas_santa_voice_call` |
| LIVE webhook endpoint | PASS | `https://supabase.thedigitalgifter.com/functions/v1/stripe-webhook` enabled |
| TEST isolation | PASS | LIVE webhook ignores Santa TEST (`ignored_santa_test_on_live_webhook`); QA TEST actions require mode=test |
| Catalog price wiring | PASS | christmas-checkout + LIVE extension use catalog Price IDs (not ad-hoc price_data) |
| Open LIVE sessions (unpaid) | PASS (no charge) | RO `cs_live_…` 5900 ron + US `cs_live_…` 1299 usd created; `payment_status=unpaid` |
| Controlled LIVE card charge | **BLOCKED** | Owner must confirm exact amount before charging (59.00 RON and/or $12.99). Never used TEST cards. |

Env backup: `/opt/supabase/tdg/backups/env-pre-santa-live-20261028T155435Z.env`

## 2. Public commercial URL

**https://www.thedigitalgifter.com/christmas/santa-call**

- HTTPS 200 (verified externally)
- Served via isolated overlay `/_qa/santa-live/` + origin bridge (commercial Docker image unchanged)
- Flags in overlay: `VITE_SANTA_CALL_LANDING_PUBLIC=true`, `VITE_SANTA_CALL_ENABLE_CHECKOUT=true`, root routes enabled
- Call room path also bridged: `/santa/call/:token` → 200
- Other TDG surfaces still 200: `/`, `/christmas`, `/christmas/santa-video`

## 3. Actual LIVE payment verification evidence

| Step | Status |
|---|---|
| LIVE Checkout Session create (RO 59.00 RON) | PASS — unpaid session uses `price_1UVXfHGD87aY9yHxPJcj9CIz` |
| LIVE Checkout Session create (US $12.99) | PASS — unpaid session uses `price_1UVXfIGD87aY9yHxuT9GYyyt` |
| Real card charge + webhook fulfill | **BLOCKED** — awaiting owner confirmation of exact smoke amount |
| confirm_commercial_checkout path | Deployed (server-side reconcile after return) |

## 4. Email delivery verification

| Check | Status |
|---|---|
| FROM domain | PASS — `Christmas <christmas@send.thedigitalgifter.com>` |
| Reply-To | PASS — `support@thedigitalgifter.com` |
| Child first name + duration + amount + CTA | PASS (template updated) |
| Idempotent delivery row | PASS |
| Resend API send to owner inbox | PASS — `provider_message_id=01a1833c-10c3-7ac1-9563-28ec5c73478c` · status `sent` · to `rentalcarsoradea@gmail.com` |
| Human inbox receipt confirmation | **PENDING owner** (do not invent PASS) |
| Call link from email path | Local file `/tmp/tdg-santa-live-email-call-url` (mode 600) |

## 5. Real iPhone call verification

**BLOCKED / NOT PASS** — no real iPhone Safari microphone/audio evidence collected in this activation run.

Automated Realtime mint was proven earlier in TEST QA; that is **not** a substitute for the required iPhone Safari mic pass.

## 6. Extension verification

| Mode | Status |
|---|---|
| TEST 180→300 (prior) | PASS (earlier E2E) |
| LIVE extension Price ID wiring | PASS in code (`santaCallLivePriceId(..., "extension")`) |
| LIVE paid extension smoke | **BLOCKED** — depends on controlled LIVE initial charge |

## 7. Meta tracking verification

| Check | Status |
|---|---|
| Pixel present on site / landing | PASS (fbq present) |
| Consent-gated ViewContent / InitiateCheckout / Purchase helpers | PASS (code) |
| Purchase only after LIVE server confirm | PASS (landing no longer fires Purchase from bare success URL; requires `confirm_commercial_checkout` + `livemode`) |
| Never Purchase for TEST | PASS (guard requires `stripe_mode=live` + `livemode`) |
| Paid campaign creation/activation | **NOT DONE** (requires separate owner approval) |
| End-to-end LIVE Purchase event with real charge | **BLOCKED** (no LIVE charge yet) |

## 8. Rollback instructions

1. Contabo env:
   - Restore `/opt/supabase/tdg/backups/env-pre-santa-live-20261028T155435Z.env` → `/opt/supabase/tdg/.env`
   - Or set `CHRISTMAS_LIVE_PRODUCTS=` and `CHRISTMAS_SANTA_CALL_STRIPE_MODE=test`
   - `docker compose up -d --force-recreate functions`
2. Frontend:
   - `docker exec thedigitalgifter rm -rf /app/dist/_qa/santa-live`
   - Restore `origin.mjs` / `christmasIndexing.mjs` from container backups if present, or redeploy prior origin
   - `docker restart thedigitalgifter`
3. Keep Stripe LIVE Prices; do not delete. Stop sell path only.
4. Optional: set `christmas_products.public_discoverable=false` / `live_offer=false` for Santa.

## 9. GitHub commit SHA

See git tip after commit in this run (also recorded in chat delivery). Baseline previously verified: `7ae5e30`.

## 10. Final GO/NO-GO for Meta Ads

# **NO-GO**

Blockers that must clear before Meta Ads GO:

1. Owner confirms exact LIVE smoke amount, then one real LIVE card purchase (no TEST cards)
2. Owner confirms transactional email landed in inbox
3. Real iPhone Safari mic/audio pass on production call URL
4. LIVE extension smoke after initial paid call
5. Separate explicit approval to create/activate paid Meta campaigns

## Notes

- While `CHRISTMAS_SANTA_CALL_STRIPE_MODE=live`, parent TEST QA checkout is intentionally disabled (`qa_requires_test_mode`).
- Open unpaid LIVE sessions were created for wiring proof only; they do not constitute payment verification.
