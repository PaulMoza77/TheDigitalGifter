# TDG Christmas Wishlist + Gift Finder

Paired acquisition loop: **Gift Finder → Wishlist → Share → viral return**.

## Status (`tdg-christmas-wishlist-gift-finder-010`)

| Surface | Route | Behavior |
|--------|-------|----------|
| Wishlist create | `/christmas/wishlist` | Guest-first, ordered items, private-by-default share |
| Shared wishlist | `/wishlist/:shareId` | Read-only DTO, `noindex` |
| Gift Finder | `/christmas/gift-finder` | Guided form → structured ideas → Add to Wishlist |

Paid Christmas checkout remains **off** (`purchasable=false`).

## Ownership / sharing

Same invariants as Christmas Tree:

- `share_id` = read capability
- `owner_token_hash` / `user_id` = write capability
- Private until Share enabled
- Guest claim-to-account via `claimGuestWishlist`

## Gift Finder

- Server owns system prompt (`christmas-wishlist-funnel` + `_shared/christmas/giftFinder.ts`)
- Primary: OpenAI `gpt-4o-mini` (or `OPENAI_MODEL`)
- Fallback: deterministic curated catalog (`server_curated_v1`) when key/quota unavailable
- Rate limit: 8 generations / hour / rate bucket
- Results persist in `christmas_gift_finder_sessions` + `christmas_gift_finder_results`
- Refresh reloads same session; “Try different ideas” forces new attempt

## Affiliate

Existing `affiliate_*` tables are **inbound referral attribution** (codes, clicks, conversions).  
**Outbound merchant affiliate commerce: DEFERRED.** Gift ideas use generic search queries, not affiliate deep links.

## Reservation seam

`christmas_wishlist_items.reservation_status` exists for future “I’ll get this” without shipping a half-secure V1 UX.

## Languages

- Wishlist UI: EN (RO-ready taxonomy labels)
- Gift Finder UI: EN first; taxonomy + server prompts support RO
- Recommendations generated in selected locale

## Docs

See `docs/architecture/TDG_GIFT_FINDER_ADR.md` for provider/fallback/safety/cost.
