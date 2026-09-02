# TDG Christmas Foundation

**Task:** `tdg-christmas-foundation-002`  
**ADR:** `docs/architecture/TDG_CHRISTMAS_COMMERCE_ADR.md`

## Product model

Tables: `christmas_products`, `christmas_packages`  
Keys are language-independent (`christmas_photo`, …). Display strings live on rows with `locale_default` seam for later i18n.

Activation flags:

- product: `active`, `public_discoverable`
- package: `active`, `purchasable`

Seed marks `christmas_photo` discoverable but **not purchasable** (`price_cents=0`, `purchasable=false`). Live offers require a later launch task.

Offline/unit mirror: `src/features/christmas/catalog.ts`

## Order model

Table: `christmas_orders`

- Guest-capable (`user_id` nullable) with `public_token_hash`
- Separate `payment_status` and `fulfillment_status`
- Attribution columns (UTM, affiliate_ref, Meta ids, landing_path, funnel_session_id)
- Unique Stripe session when present

Assets: `christmas_order_assets` for future image/video/card outputs (optional `generation_id` / `job_id` links).

## Status contract

Payment: `draft | pending | paid | failed | refunded`  
Fulfillment: `not_started | queued | processing | completed | failed`

RPC: `fulfill_christmas_order_payment` — amount/currency/session checks + idempotent already-paid replay.

## Payment seam

Edge: `supabase/functions/christmas-checkout`  
- Kill switch: `CHRISTMAS_CHECKOUT_ENABLED`  
- Resolves price from DB only (ignores client `amount_cents`)  
- Stripe `ui_mode=custom` (V3-compatible Checkout Elements)  
- Metadata: `product_family=christmas`, `christmas_order_id`

Webhook: `handleChristmasStripeEvent` runs **before** Pet handlers; Pet unchanged.

## Event schema

Allowlist in `src/features/christmas/funnelEventContract.ts`  
Ingest: `POST /api/christmas/funnel-event` → `christmas_funnel_events`  
Idempotency key unique.

## Route activation

Hub `/christmas` keeps classic generator CTAs + catalog suite list (includes Photo Generator → `/christmas/photo-generator`).  
`/christmas/photo-generator` is a real funnel (not a shell). Other suite paths use `ChristmasFeatureShell` with `noindex` and **no checkout CTA**.

Admin: `/admin/christmas-orders`

## Future generator integration

Paid order → `fulfillment_status=queued` → webhook enqueues `christmas-generate` for `christmas_photo`.  
Pre-payment preview is **local blur of the original upload** (see `docs/TDG_CHRISTMAS_PHOTO_GENERATOR.md`) — never Replicate.

`enqueueChristmasFulfillment` registry remains available for non-webhook paths; photo V1 uses Stripe fulfill → generate.

## Future Santa integration

Same order + package rows (`christmas_santa_video`) + long-running fulfillment states + assets `kind=video`. Privacy/child-data work is a prerequisite before enabling purchasable Santa packages.

## Migration

`supabase/migrations/20260902120000_christmas_commerce_foundation.sql` — additive only; does not alter Pet schema.

## Rollback notes

Drop Christmas tables/functions only if needed (destructive). Prefer disabling via `purchasable=false` + `CHRISTMAS_CHECKOUT_ENABLED` unset.
