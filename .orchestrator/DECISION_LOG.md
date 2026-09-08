# Decision log

- 2026-09-06: Resume Send-a-Gift on feat/send-a-gift-admin-observability (was == main). No prior product commits found after claimed 075 PASS.
- 2026-09-06: Extend christmas_* commerce; packages starter/classic/premium at price_cents=0 purchasable=false.
- 2026-09-06: Activation via activate_christmas_send_a_gift; redemption via redeem_christmas_gift_entitlement.
- 2026-09-06: 093 — share UX + allowlisted Resend + admin redemptions/resend + GA4/Meta purchase contract helpers + admin nav smoke.
- 2026-09-06: 094 — applied 20260906010000 to prod; fixed activate RPC (extensions.gen_random_bytes + ambiguous service_key); deployed christmas-send-a-gift + stripe-webhook; browser QA 375/390/430 + admin unauth matrix PASS; entitlement fixture PASS; fixed missing ChristmasPortraitFunnelPage lazy import (SPA boot).
- 2026-09-06: 095 — re-verified prod packages; wired Send-a-Gift Meta CAPI Purchase into christmas stripeFulfill with Pixel-matching event_id + metadata dedupe; adminMetaTestPurchase (Admin-only); Funnel Analytics conversion metric depth for christmas_send_a_gift; redeployed edge; browser QA re-PASS.
