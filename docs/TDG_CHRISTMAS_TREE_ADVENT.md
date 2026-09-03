# TDG Christmas Tree + Advent

Interactive Christmas engagement system: **Tree + Gifts + Secure Share + Advent + Free Gift**.

## Status (task `tdg-christmas-tree-advent-008`)

| Surface | Route | Live behavior |
|--------|-------|----------------|
| Tree creator | `/christmas/tree` | Guest-friendly create / customize / gifts / share |
| Shared tree | `/christmas/tree/:shareId` | Read-only; `noindex`; 404 if share disabled |
| Advent | `/christmas/advent` | Calendar + claim engine; production claims gated |
| Free gift | Advent page section | Server-owned outcome; guest non-monetary only |

Feature flags (Edge / Deno env):

- `CHRISTMAS_ADVENT_ENABLED` — must be `true` for production claims
- `CHRISTMAS_ADVENT_CREDITS_ENABLED` — monetary ledger grants (default off)
- `CHRISTMAS_FREE_GIFT_ENABLED` — free gift claims (default off)

Defaults do **not** enable Advent monetary promotions.

## Architecture

### TREE

Table `christmas_trees`:

- `share_id` — high-entropy public **read** capability
- `owner_token_hash` (SHA-256) or `user_id` — **write** capability
- `share_enabled` default **false** (private until Share)
- `decoration_config` JSONB (semantic; not screenshots)
- moderation: `moderation_status` (`active` / `disabled` / `removed`)

Invariant: **shareId ≠ write auth**. Owner token is never returned on shared reads.

Guest flow:

1. Create tree → raw `owner_token` once + stored hashed
2. Local recovery via `tdg.christmas.tree.owner.v1`
3. Later `claimGuestTree` attaches `user_id` and clears guest hash

### GIFT

Table `christmas_tree_gifts`:

- `sort_order` (stable reorder)
- `gift_type`: `message` | `tdg_reward` | `product_link` | `cosmetic`
- unlock: `immediate` | `on_date` (server enforces unlock before reveal)
- Future paid seam: `linked_order_id`, `linked_product_key`, `reward_definition_id`

Opening tracked via `opened_at` + tree `open_count`.

### REWARD / ADVENT

- `christmas_advent_rewards` — catalog per `season_year` + `day` + `locale`
- `christmas_advent_claims` — unique `(user, season, day)` + `idempotency_key`
- `christmas_reward_entitlements` — **non-cash** cosmetics (not EUR purchase credits)
- `christmas_free_gifts` / `christmas_free_gift_claims` — one claim per identity per season

Timezone policy: **Europe/Bucharest** canonical day (documented; injectable `__test_date` for tests only).

## Credits decision

`credits_ledger` remains the EUR/purchase points ledger. Advent may write `event_type=christmas_advent` **only** when:

1. user authenticated
2. `CHRISTMAS_ADVENT_ENABLED` + `CHRISTMAS_ADVENT_CREDITS_ENABLED`
3. reward row `active` and type `credits`
4. unique `note` `christmas_advent:{year}:{day}:{user_id}`

Production seed keeps credit rewards **inactive**. Prefer cosmetics / surprise messages for season engagement.

See `docs/architecture/TDG_CHRISTMAS_REWARDS_ADR.md`.

## Analytics (no PII content)

Events include: `christmas_tree_view`, `tree_creation_started`, `tree_created`, `tree_customized`, `gift_added`, `gift_reordered`, `tree_share_enabled`, `tree_share`, `shared_tree_view`, `gift_opened`, `reward_claimed`, `free_gift_claimed`.

Never send tree/gift messages, names, or owner tokens.

Virality foundation: trees_created, share_rate, shared views, opens — via funnel events + tree counters (`view_count`, `share_count`, `open_count`).

## Admin

Christmas admin can inspect tree aggregates via service role / future RPC. Messages are not dumped into public dashboards. Moderators set `share_enabled=false` or `moderation_status=disabled`.

## Privacy / SEO

- Personal share pages: `noindex`
- No `/trees` directory
- OG copy for shares is generic (“A Christmas Tree is waiting for you”) — SPA limitation: no server-rendered per-tree OG image yet

## Edge function

`christmas-tree-funnel` actions: `createTree`, `getOwnerTree`, `updateTree`, `setShareEnabled`, `getSharedTree`, `addGift`, `reorderGifts`, `openGift`, `claimGuestTree`, `listMyTrees`, `adventStatus`, `claimAdvent`, `claimFreeGift`.

## Activation report

- `advent_engine_ready=true` (calendar + claim path implemented)
- `production_advent_claims_live=false` unless date in Dec 1–24 **and** `CHRISTMAS_ADVENT_ENABLED=true`
- Live charges: **NONE** (Tree V1 free; no checkout)
- Unsolicited customer emails: **NONE**
