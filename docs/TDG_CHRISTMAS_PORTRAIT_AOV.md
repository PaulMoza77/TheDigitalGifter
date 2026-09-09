# TDG Christmas suite portrait AOV (CHRISTMAS-039)

**Products:** `christmas_photo` · `christmas_family` · `christmas_couple` · `christmas_pet`  
**Not in scope:** Christmas V2 packs (`starter` / `magic` / `ultimate`) — that is CHRISTMAS-037.

## Offers (server-owned)

| package_key | Fulfillment | Seed price |
| --- | --- | --- |
| `extra_images` | 2 extra portraits, same style | `price_cents=0`, `purchasable=false` |
| `extra_styles` | 2 extra portraits, other registry styles | `price_cents=0`, `purchasable=false` |
| `video` | 1 short motion clip (queued until a founder-approved video provider) | `price_cents=0`, `purchasable=false` |

Amounts live on `christmas_packages` only. Checkout ignores client `amount_cents`. No live price is invented in this task.

## Path

1. Paid parent portrait order (public token).
2. `christmas-checkout` with `parent_public_token` + AOV `package_key` → `christmas_order_upsells`.
3. Stripe metadata: `product_family=christmas`, `product_type=christmas_upsell`, `christmas_upsell_id`.
4. Webhook → `fulfill_christmas_upsell_payment` → `christmas-photo-generate` `{ upsell_id }`.
5. Extra images/styles attach to the parent via `christmas_order_assets`. Video is queued, not a V2 pack job.

## Analytics (already reserved)

- `upsell_viewed` — result panel
- `upsell_purchase` — Stripe fulfill (idempotent per upsell id)

## Founder gates

- `CHRISTMAS_CHECKOUT_ENABLED` still required
- Seed packages stay non-purchasable / $0 until a launch task sets price + `purchasable=true`
- Do not production-push prices from this change
