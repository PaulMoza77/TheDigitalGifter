# TDG Christmas Gift Tree chance funnel

**Route:** `/christmas/gifts`  
**Product key:** `christmas_gift_tree`  
**Task:** Christmas Gift Tree chance funnel (not kebab 001–011)

## What this is

A **chance tree**: identity-scoped free + paid gift opens that draw from a **server catalog**. Stripe packs buy additional opens. Webhook grants those opens. The browser never invents a prize.

This is **not**:

- the shareable decorator at `/christmas/tree` (`christmas_trees` / `christmas_tree_gifts`)
- Advent free-gift on `/christmas/advent`
- Gift Finder
- Send-a-Gift

## Status

| Item | State |
|------|--------|
| SPA route | Implemented |
| Identity-scoped opens | Implemented (user_id or guest token hash) |
| Catalog rewards | Seeded **inactive** |
| Stripe packs `open_1` / `open_3` / `open_5` | Seeded **not purchasable**, `price_cents=0` |
| Webhook grant | `grantPaidGiftTreeOpens` after `fulfill_christmas_order_payment` |
| Atomic consume / credit RPCs | `consume_christmas_gift_tree_open`, `credit_christmas_gift_tree_opens` |
| Pack email | Resend path exists; skipped if unconfigured |
| Apple Pay | Same `CustomStripeCheckout` / Express Checkout Elements as Pet |
| Production migration | **Not applied by this PR** (founder gate) |
| Live paid open + email proof | **Not claimed** (founder gate) |
| Physical Safari Apple Pay QA | **Remaining** (founder gate) |

Flags:

- `CHRISTMAS_GIFT_TREE_ENABLED` — free opens (default off)
- `CHRISTMAS_GIFT_TREE_CREDITS_ENABLED` — monetary ledger grants (default off)
- `CHRISTMAS_CHECKOUT_ENABLED` — existing checkout kill switch

Paid opens already granted by webhook still work when the free-open flag is off.

## Data

- `christmas_gift_tree_rewards` — weighted catalog
- `christmas_gift_tree_accounts` — unique `(user, season)` / `(guest_hash, season)`
- `christmas_gift_tree_opens` — one free open per identity per season; paid opens consume balance
- `christmas_gift_tree_grants` — unique `order_id` webhook grants

Credits reuse `credits_ledger` with note prefix `christmas_gift_tree:` and never grant to guests.

## Closeout / merge

**Not merge-ready** until:

1. Migration applied on the linked production project
2. Live pack confirmation email observed
3. Paid open proven end-to-end (Stripe webhook → grant → catalog draw)
4. Physical Safari Apple Pay device QA

Do not production-push from this task.
