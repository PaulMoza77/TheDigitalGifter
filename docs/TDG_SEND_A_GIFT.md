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

## Sharing / email

- Recovery share UI: `/send-a-gift?share={share_id}` — copy, native share, mailto
- Resend: edge `adminResendEmail` + allowlist (`SEND_A_GIFT_EMAIL_ALLOWLIST`); fail-closed when disabled/empty
- No QA emails to real customers without allowlist

## Analytics

- GA4 Purchase helper: `transaction_id`, `value`, `currency`, `items` (persistent once-key)
- Meta Pixel IC/Purchase event ids shared with CAPI Purchase builder
- Registry health remains `unverified` until external delivery evidence
- Pet Purchase path unchanged

## Schema

- `christmas_gift_shares` / `christmas_gift_entitlements` / `christmas_gift_redemptions`
- RPCs: activate / redeem / mark opened / disable

## Protected surfaces

Does **not** modify `/christmas/gifts` UI. Preserves `/christmas/tree` and `/christmas/tree/:shareId`.

## Admin

- `/admin/send-a-gift` — ops (copy URL, resend, redemptions, disable; no private message)
- `/admin/christmas-control` — suite control center
- `/admin/funnel-analytics` — unified registry
- Admin SPA nav smoke: `scripts/smoke-admin-spa-nav.mjs`

## Live charges

`live_charges=NONE` while `purchasable=false` / `price_cents=0`.
