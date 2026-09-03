# Pet Funnel V2 Checkout Forensic (TDG-PET-FUNNEL-FORENSIC-005)

## Production evidence (read-only, 30d window ending 2026-09-03)

### Why "30 checkouts → 1 purchase"

**CONFIRMED**

1. **Admin "Checkout Opened" is NOT first-party begin_checkout.**  
   Hybrid KPI uses `backend.checkouts` = distinct customer Stripe checkout *orders* (`pet_checkout_sessions`), labeled in UI as "Production customer Stripe Checkout". Mid-funnel cards (Landing/Upload/Teaser/Offer) are first-party event unique sessions. Mixing systems makes Offer(24) → Checkout(30) look inverted even when each metric is locally correct.

2. **`pet_v2_funnel_events_name_chk` rejects new diagnostic events.**  
   Probed live: inserting `v2_teaser_viewed` / `v2_checkout_session_created` fails with check constraint `pet_v2_funnel_events_name_chk` (SQLSTATE 23514). Failures table shows `name_chk_outdated` + `rpc_error` for teaser/session/checkout_failed events.  
   Consequently Teaser KPI falls back to legacy `v2_preview_viewed` (9) while `v2_offer_viewed` (24) still lands → **9 → 24** inconsistency.

3. **Stripe sessions are LIVE and mostly unpaid.**  
   V2 orders in window: **34** with Stripe session IDs, **33** `awaiting_payment`, **1** `complete` / paid ($2.99). Only the paid order has `stripe_payment_intent_id` stored locally. Meta Purchase was sent for the paid order. First-party `v2_purchase` = 1. Revenue = 299¢.

4. **Price path is correct for V2.** Amount distribution: 33×299¢, 1×1200¢ (older). Live keys paired (`livemode: true`, matching account fingerprint).

**LIKELY**

5. Vast majority of Stripe checkouts never complete payment (abandonment / no attempt). No `payment_failed` order-event actions in DB; decline/3DS rates **cannot be proven** without Stripe PaymentIntent API access in this agent environment (`STRIPE_SECRET_KEY` not injected; edge `debugStripeCheckout` exists but was not redeployed with payment_status fields during this run).

6. Heavy preview-generation failures historically (`v2_preview_generation_failed` 59 events / 18 sessions) degrade trust before offer.

**NOT SUPPORTED BY EVIDENCE**

- Currency confusion / unexpected tax (all USD 299)
- Silent missing purchases (Stripe paid = FP purchase = Meta sent = 1)
- Broken publishable/secret key pairing on live sessions

**UNKNOWN**

- Exact decline / 3DS / Apple Pay availability per session (needs Stripe PI retrieve after edge deploy)
- Facebook/Instagram IAB share of the 34 (events table has no user_agent column; only device_type on some begin_checkout rows — 9 mobile begin events)

## Apply before relaunch

```bash
SUPABASE_DB_PASSWORD=… bash scripts/apply-pet-v2-forensic-migration.sh
# then deploy pet-funnel edge so server-side v2_checkout_session_created + debugStripeCheckout payment_status ship
```

Until migration applies, teaser/session/payment diagnostic events continue to fail ingest.
