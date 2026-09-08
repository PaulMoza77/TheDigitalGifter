# ADR — Send a Gift on Christmas commerce

## Decision

Extend `christmas_products` / `christmas_packages` / `christmas_orders` with gift share + entitlement tables. Do not create a parallel payment engine.

## Why

Pet orders are SKU-constrained. Christmas commerce already separates payment vs fulfillment and supports multi-product catalogs.

## Exactly-once

1. Stripe webhook → `fulfill_christmas_order_payment` (idempotent paid)
2. `activate_christmas_send_a_gift` (unique on `order_id`; entitlements inserted once)
3. `redeem_christmas_gift_entitlement` (row lock + idempotency key)

## Non-goals

- Inventing founder pricing
- Changing `/christmas/gifts` Gift Tree UI
- Client entitlement minting
