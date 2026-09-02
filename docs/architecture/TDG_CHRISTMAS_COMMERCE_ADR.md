# ADR: Christmas Commerce Order Model

**Status:** Accepted  
**Date:** 2026-09-02  
**Task:** `tdg-christmas-foundation-002`  
**Context:** `docs/TDG_CHRISTMAS_AUDIT.md` (commits `268cb21`, `b7f66c9`)

## Current limitation

`pet_orders` is locked to SKU `pet-secret-life-12` (`pet_orders_sku_chk`), pet-specific columns (species, personality, pet_name, QC), and Stripe fulfill metadata gated by `isPetCheckoutMetadata`. Expanding it into Santa, cards, Tree, and photo products would force nullable pet fields, confusing webhook branching, and high regression risk.

Main-app `orders` + `pricing_items` are EUR credit-pack oriented and lack guest-token funnel semantics used by Pet V3.

## Options considered

| Option | Description | Verdict |
| --- | --- | --- |
| A — Generalize existing `orders` | Extend credit orders for Christmas SKUs | Rejected for guest funnel + separate payment/fulfillment needs |
| B — Dedicated `christmas_*` tables | Catalog + packages + orders + events | **Selected** |
| C — Widen `pet_orders` | Drop SKU check; add product_family | Rejected — Pet regression and schema pollution |

## Selected design (B)

- `christmas_products` / `christmas_packages` — multi-product catalog; server-authoritative price
- `christmas_orders` — guest-capable orders with **separate** `payment_status` and `fulfillment_status`
- `christmas_order_assets` — future result linkage (image/video/card) without JSON blobs on the order
- `christmas_funnel_events` — allowlisted analytics; attribution columns
- Stripe metadata `product_family=christmas` + `christmas_order_id`; Pet webhook path unchanged
- Checkout seam prefers V3 Custom Checkout Elements pattern

## Migration implications

Additive only. No changes to `pet_orders`, `pet_orders_sku_chk`, or Pet prices. RLS: admin read; service_role write; owners may read own rows by `user_id`; guest access via public token hash (service-mediated).

## Pet regression risk

**Low** if Pet code paths are not modified except a non-pet early-return branch in `stripe-webhook` that only runs when Christmas metadata is present.

## Future Santa / Tree / Wishlist

- Santa: same order row + `product_key=christmas_santa_video` + long-running fulfillment_status
- Tree/Advent: may be free; catalog allows `purchasable=false` products without Stripe
- Wishlist: separate domain; may reference `christmas_orders` / assets optionally later
