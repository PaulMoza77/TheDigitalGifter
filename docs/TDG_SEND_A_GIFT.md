# TDG Send a Gift

**Status:** pre-activation (`production_ready_pre_activation=true`, `production_purchasable=false`)  
**Funnel:** `christmas_send_a_gift`  
**Routes:** `/send-a-gift` (sender), `/gift/:shareId` (recipient)

## Contract

- Exactly 3 server-owned packages: `starter`, `classic`, `premium`
- One-time Stripe payment via existing `christmas-checkout` + `christmas_orders`
- Server owns price/currency/composition; client overrides rejected
- Authoritative payment → `activate_christmas_send_a_gift` exactly once → entitlements exactly once
- High-entropy `share_id` (≥32 hex chars)
- Recipient redeems included services without second payment; no subscription
- Live prices intentionally absent until founder activation

## Schema

- `christmas_gift_shares`
- `christmas_gift_entitlements`
- `christmas_gift_redemptions`
- RPCs: `activate_christmas_send_a_gift`, `redeem_christmas_gift_entitlement`, `mark_christmas_gift_opened`, `disable_christmas_gift_share`

## Protected surfaces

Does **not** modify `/christmas/gifts` UI. Preserves `/christmas/tree` and `/christmas/tree/:shareId`.

## Admin

- `/admin/send-a-gift` — ops (payment/share/email/entitlements; no private message by default)
- `/admin/christmas-control` — suite control center
- `/admin/funnel-analytics` — unified registry

## Live charges

`live_charges=NONE` while `purchasable=false` / `price_cents=0`.
