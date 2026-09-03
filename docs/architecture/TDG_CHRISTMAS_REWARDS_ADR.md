# ADR: Christmas Rewards vs `credits_ledger`

## Status

Accepted for `tdg-christmas-tree-advent-008`.

## Context

TDG already has `public.credits_ledger`: integer purchase/generation points with optional EUR `amount`, used by Stripe packs and fulfillment. Confusing Advent “fun points” with cash-equivalent credits would create economic risk.

## Decision

1. **Reuse `credits_ledger` for any monetary Advent credit grant** — same ledger, distinct `event_type` / `category` = `christmas_advent`, idempotent `note` prefix `christmas_advent:`.
2. **Do not invent a second cash balance.**
3. **Non-cash rewards** (ornaments, toppers, surprise messages) live in `christmas_reward_entitlements` and Advent/free-gift catalogs — never labeled as “credits” in UX when they are not ledger credits.
4. **Guest / anonymous traffic cannot claim monetary credits.** Login required.
5. **Production defaults:** Advent reward rows `active=false`; `CHRISTMAS_ADVENT_CREDITS_ENABLED` off; free-gift monetary pool inactive.

## Consequences

- Engineering can prove claim + ledger idempotency with test fixtures / flags without launching a promo.
- Business must explicitly activate amounts and flags before any Advent credit campaign.
- Tree cosmetics unlocked via entitlements can decorate trees without touching purchase balances.

## Alternatives rejected

- Calling fun points “credits” in UI while storing them elsewhere — rejected (misleading).
- Granting EUR credits to anonymous free-gift traffic — rejected (abuse).
- Client-chosen reward amounts — rejected (server owns catalog).
