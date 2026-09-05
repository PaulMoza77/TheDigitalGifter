# TDG Christmas Gap Loop (Secondary)

**Loop chat:** `577a` / Cursor `e6c1224b-ee03-4ffa-bbcb-a3ed58d37b4a`  
**Mission:** Christmas suite work **not** owned by the primary e6f4 send-a-gift / durable-continue loop  
**Repo:** `PaulMoza77/TheDigitalGifter`  
**PR foundation/i18n:** https://github.com/PaulMoza77/TheDigitalGifter/pull/97  
**PR lifecycle (stacked):** https://github.com/PaulMoza77/TheDigitalGifter/pull/98 (`cursor/christmas-gap-lifecycle-577a` → foundation)

---

## Isolation rules

| Loop | Owns |
| --- | --- |
| **Primary e6f4** | `/send-a-gift`, gift links, entitlements, `/christmas/gifts` Gift Tree |
| **Secondary 577a** | Suite gaps: account hub, i18n, lifecycle, admin KPIs, kids privacy, etc. |

---

## LOCALIZATION (DONE — `TDG-CHRISTMAS-GAP-LOCALIZATION-002`)

See prior section in git history / PR #97. Shared `src/features/christmas/i18n`, `?lang=` + localStorage, hub/account/portrait/shells wired.

---

## LIFECYCLE (DONE infrastructure — `TDG-CHRISTMAS-GAP-LIFECYCLE-003`)

Full product doc: `docs/TDG_CHRISTMAS_LIFECYCLE.md`

### Event matrix

| event | owner | implemented | live send | locale | trigger | idempotency | marketing_consent | tests |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| payment_confirmation | SECONDARY | yes | flag-gated | order.locale | Stripe fulfill paid | event_key unique | no | unit |
| generation_started | SECONDARY | yes (Santa only) | flag-gated | order.locale | after paid enqueue | event_key | no | unit |
| generation_ready | SECONDARY | yes | flag-gated | order.locale | photo-generate complete | event_key | no | unit |
| generation_failed | SECONDARY | copy+ledger ready | flag-gated | order.locale | terminal fail (wire on fail updates) | event_key | no | unit copy |
| abandoned_checkout | SECONDARY | yes engine | marketing+send flags | order.locale | cron aged pending | event_key + paid recheck | yes | unit |
| cross_sell | SECONDARY | yes engine | marketing+send + purchasable | order.locale | cron completed+24h | event_key+target | yes | unit |
| welcome | — | **blocked_by_lead_capture** | no | — | — | — | — | — |

### Flags

- `CHRISTMAS_LIFECYCLE_SEND_ENABLED` default off → dry_run ledger, **real_customer_emails_sent: NONE**
- `CHRISTMAS_LIFECYCLE_MARKETING_ENABLED` default off

### State machine

`payment_status`: draft|pending|paid|failed|refunded  
`fulfillment_status`: not_started|queued|processing|completed|failed

---

## Gap backlog (secondary queue)

| ID | Gap | Priority | Status |
| --- | --- | --- | --- |
| `TDG-CHRISTMAS-GAP-ACCOUNT-002` | `/account/christmas` | P1 | **DONE** |
| `TDG-CHRISTMAS-GAP-LOCALIZATION-002` | EN/RO i18n | P1 | **DONE** |
| `TDG-CHRISTMAS-GAP-LIFECYCLE-003` | Lifecycle emails + locale persist | P1 | **DONE** (infra; sends flag-gated) |
| `TDG-CHRISTMAS-GAP-ADMIN-KPIS-005` | Admin KPIs / lifecycle observability UI | P1 | **NEXT** |
| `TDG-CHRISTMAS-GAP-KIDS-PRIVACY-006` | Kids product | P0 | queued |
| `TDG-CHRISTMAS-GAP-CHECKOUT-READY-007` | Price go-live | P0 | founder-gated |
| `TDG-CHRISTMAS-GAP-CARDS-HARDEN-011` | Cards completion deepen | P1 | queued |
| `TDG-CHRISTMAS-GAP-SANTA-PROD-012` | Santa production hardening | P1 | queued |
| Localization deepen (tree/wishlist/…) | P2 | queued |

---

## Ownership (lifecycle)

| Surface | Classification |
| --- | --- |
| Commerce portrait/Santa transactional email | SECONDARY_OWNS |
| Abandoned/cross-sell Christmas commerce | SECONDARY_OWNS (marketing off) |
| `/send-a-gift` emails | PRIMARY_OWNS_FULLY |
| `/christmas/gifts` | PRIMARY_OWNS_FULLY |
| V2 pack delivery (`christmas_v2_email_deliveries`) | SECONDARY_OWNS (legacy; coexist) |
