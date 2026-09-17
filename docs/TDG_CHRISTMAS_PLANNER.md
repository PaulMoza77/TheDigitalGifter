# Christmas Planner V1

**Route (product):** `/account/christmas` (noindex)  
**Route (acquisition):** `/christmas/planner` (indexable)

Does **not** replace Gift Finder, Wishlist, cards, messages, tree, or Christmas checkout.

## Entitlements

Feature keys (never gate only on `isPremium`):

- `planner_core`, `gift_planner`, `budget`, `food_planner`, `recipes`, `hosting`, `travel`, `advanced_planning`, `rescue_mode`, `premium_content`

Packages on existing `christmas_products` / `christmas_packages` / `christmas_orders`:

- `christmas_planner` `core` | `complete`
- add-ons: food, recipes, hosting, travel

Paid access is resolved by `get_christmas_planner_access()` from grants + paid orders. Guest purchases claim via `claim_christmas_planner_grants_for_user()`.

Fulfillment: `grant_christmas_planner_entitlements(order_id)` from Stripe (no photo generate).

## Data

Owner RLS via `christmas_planner_owns_profile`. Recipes catalog is public-read for published rows.
