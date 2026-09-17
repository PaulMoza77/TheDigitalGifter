# Christmas Planner funnel (Task 1)

**Product key:** `christmas_planner_2026`  
**Routes:** `/christmas/planner` · `/christmas/planner/welcome` · `/account/christmas`

## What this task shipped

Conversion funnel, Christmas commerce extension, entitlements, guest claim, transactional email, SEO, and analytics. The interactive Planner application is **not** in this task.

## Commerce

Reuses `christmas_products` / `christmas_packages` / `christmas_orders` / `christmas-checkout` Custom Checkout Elements / `fulfill_christmas_order_payment` / Stripe webhook.

Packages: `essentials`, `magic`, `all_in` plus standalone add-ons. Prices live in DB (seed is bootstrap only). Client `amount_cents` is ignored.

**Kill switches:**

- `CHRISTMAS_CHECKOUT_ENABLED` (global Christmas checkout)
- `CHRISTMAS_PLANNER_CHECKOUT_ENABLED` **or** product metadata `checkout_live=true`

Seed ships `checkout_live=false` so production cannot charge until intentionally enabled.

## Entitlements

Table `user_entitlements` with sources `stripe | apple | promo | admin`. Granted idempotently from the paid webhook. Guest orders claim via opaque public token after login — never by unverified email match.

## Guest recovery

Public token stored hashed on the order; raw token in localStorage + welcome email link. Closing the browser should not lose a paid purchase if the email or local recovery is kept.
