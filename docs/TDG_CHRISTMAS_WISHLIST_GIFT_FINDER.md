# TDG Christmas Wishlist + Gift Finder

Paired acquisition loop: **Gift Finder → Wishlist → Share → Reserve → viral return**.

## Status

| Surface | Route | Behavior |
|--------|-------|----------|
| Wishlist create | `/christmas/wishlist` | Guest-first letter UX, ordered wishes, private-by-default share |
| Shared wishlist | `/wishlist/:shareId` | Read-only DTO + reserve/purchased, `noindex,follow` |
| Gift Finder | `/christmas/gift-finder` | Guided form → structured ideas → Add to Wishlist |

Paid Christmas checkout remains **off** for wishlist (`purchasable=false`).

## Product promise

**Create one Christmas wishlist. Add anything. Share it with everyone.**

Coordination without ruining the surprise: viewers can reserve gifts; owner DTOs omit reservation status/identity.

## Ownership / sharing

Same invariants as Christmas Tree:

- `share_id` = read capability (non-guessable ≥22 chars)
- `owner_token_hash` / `user_id` = write capability
- Private until Share enabled
- Guest claim-to-account via `claimGuestWishlist`
- No forced signup before create / first wish (guest token in `localStorage`)

## Reservation

Activated in V2:

- `reserveWishlistItem` — race-safe `WHERE reservation_status = 'none'`
- `markWishlistItemPurchased` / `releaseWishlistItemReservation` — require opaque `reservation_token`
- Shared DTO exposes `reservation_status` only (never token / identity)
- Owner DTO strips reservation status (anti-spoiler)

## URL import

`previewExternalUrl` best-effort OG scrape with SSRF host blocking. On failure UI keeps the URL and falls back to manual title/note.

## Languages

- Copy pack: `wishlist/copy.ts` (EN shipped; RO taxonomy labels ready)
- Locale-aware money formatting via `Intl.NumberFormat`
- RTL-ready structural CSS (logical flow / flexible chips)

## Analytics (first-party allowlist)

`wishlist_page_view`, `wishlist_creation_started`, `wishlist_created`, `wishlist_first_wish_added`, `wishlist_item_added`, `wishlist_link_added`, `wishlist_share*`, `shared_wishlist_view`, `wishlist_item_reserved`, `wishlist_item_purchased`, `wishlist_create_from_shared_clicked`, `wishlist_gift_finder_clicked`, …

No owner names, gift notes, or pasted URLs in Meta/GA4 payloads.

## Migrations

1. `20260903200000_christmas_wishlist_gift_finder.sql` — foundation
2. `20260909140000_christmas_wishlist_v2_reservations.sql` — priorities, media, audience, reservation timestamps

## Docs

See `docs/architecture/TDG_GIFT_FINDER_ADR.md` for provider/fallback/safety/cost.
