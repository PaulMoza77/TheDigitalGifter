# TDG Christmas Gap Loop (Secondary)

**Loop chat:** `577a` / Cursor `e6c1224b-ee03-4ffa-bbcb-a3ed58d37b4a`  
**Mission:** Christmas suite work **not** owned by the primary e6f4 send-a-gift / durable-continue loop  
**Repo:** `PaulMoza77/TheDigitalGifter`  
**PR foundation/i18n:** https://github.com/PaulMoza77/TheDigitalGifter/pull/97  
**PR lifecycle (stacked):** https://github.com/PaulMoza77/TheDigitalGifter/pull/98 (`cursor/christmas-gap-lifecycle-577a` → foundation)  
**PR kids privacy (stacked):** https://github.com/PaulMoza77/TheDigitalGifter/pull/99 (`cursor/christmas-gap-kids-privacy-577a` → lifecycle)  
**PR admin KPIs (stacked):** https://github.com/PaulMoza77/TheDigitalGifter/pull/101 (`cursor/christmas-gap-admin-kpis-577a` → kids privacy)

---

## ADMIN KPIs (DONE — `TDG-CHRISTMAS-GAP-ADMIN-KPIS-013`)

Route: `/admin/christmas-kpis` (AdminRoute only)  
Core: `src/features/christmas/adminKpis/kpiCore.ts`  
UI: `src/pages/admin/ChristmasKpisPage.tsx`

- Commercial truth: `christmas_orders` (paid / refunded / fulfillment / Stripe session)
- Funnel stages: `christmas_funnel_events` unique `funnel_session_id` (aggregate ratios, not cohort-exact)
- Lifecycle email: `christmas_lifecycle_events` template×status
- Excludes `is_test` events; no emails/media/tokens in UI select list
- Date presets: Today / 7d / 30d / All

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
| generation_ready | SECONDARY | yes | flag-gated | order.locale | photo + Santa complete | event_key | no | unit |
| generation_failed | SECONDARY | yes | flag-gated | order.locale | photo/Santa terminal fail (once/event_key) | event_key | no | unit |
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

## KIDS / PRIVATE MEDIA PRIVACY (DONE harden — `TDG-CHRISTMAS-GAP-KIDS-PRIVACY-HARDEN-007`)

**previous_006_work_found:** NONE (no branch/PR/commits for `-006`; only backlog queue)  
**PR:** kids-privacy stacked branch (see PR link after open)

### Privacy matrix

| surface | data type | private/public | authorization | storage | delivery | email | analytics | indexing | retention | tests | production |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Portrait upload | customer photo | private | signed upload URL | `christmas-source` private | N/A | none | categorical only | N/A | unpaid uploads ops seam | unit guards | buckets private |
| Portrait/Santa result | generated media | private | `public_token` hash (≥32 hex) + revoke flag | `christmas-generated` private | short-lived signed URL (15–30m) | app `?token=` route only | no URLs/tokens | funnel pages public; account/kids noindex | policy_pending_founder_legal | privacyCore + foundation | flag-gated checkout |
| Delivery token | capability secret | private | hash auth; ciphertext for server recovery | DB hash + ciphertext | never in metadata | decrypt server-side for mail | stripped | N/A | with order | scrub migration | scrub applied in code |
| Kids route | shell | N/A | coming_soon | none | none | none | page views only | **noindex** | N/A | foundation test | not production-active |
| Account Christmas | galleries | private | auth + email match (V2) / RLS user_id | signed | signed | none | none | **noindex** | V2 scoped | manual | V2 galleries only |
| Admin orders | metadata | admin | `is_admin` | refs only by default | explicit | none | none | noindex admin | — | — | ledger + metadata without token hints |

### privacy_gaps_before → after

| Before | After |
| --- | --- |
| Full token in `metadata.public_token_hint` | ciphertext column; hint scrubbed |
| `getOrder` echoed metadata | safe projection + Cache-Control private |
| `existing_order_id` update without token | requires matching `public_token` |
| Kids shell noindex race | `PageHead noindex={shell.noindex}` |
| Analytics metadata unsanitized | `sanitizeChristmasAnalyticsMetadata` |
| `resultAccessPath` fell back to `?order=` | token or resume only |

### remaining_policy_decisions

- Auto-purge duration for unpaid uploads / paid results → **policy_pending_founder_legal**
- Kids commercial product launch still blocked until product + consent UX exist

---

## Gap backlog (secondary queue)

| ID | Gap | Priority | Status |
| --- | --- | --- | --- |
| `TDG-CHRISTMAS-GAP-ACCOUNT-002` | `/account/christmas` | P1 | **DONE** |
| `TDG-CHRISTMAS-GAP-LOCALIZATION-002` | EN/RO i18n | P1 | **DONE** |
| `TDG-CHRISTMAS-GAP-LIFECYCLE-003` | Lifecycle emails + locale persist | P1 | **DONE** (infra; sends flag-gated) |
| `TDG-CHRISTMAS-GAP-KIDS-PRIVACY-006` | (superseded) | P0 | **ABSORBED** by HARDEN-007 (no prior impl) |
| `TDG-CHRISTMAS-GAP-KIDS-PRIVACY-HARDEN-007` | Kids/private media access harden | P0 | **DONE** |
| `TDG-CHRISTMAS-GAP-ADMIN-KPIS-013` | Founder Christmas KPI dashboard | P0 | **DONE** |
| `TDG-CHRISTMAS-GAP-ADMIN-KPIS-005` | (superseded numbering) | P1 | **ABSORBED** by ADMIN-KPIS-013 |
| `TDG-CHRISTMAS-GAP-CHECKOUT-READY-007` | Price go-live | P0 | founder-gated |
| `TDG-CHRISTMAS-GAP-CARDS-HARDEN-011` | Cards completion deepen | P1 | queued |
| `TDG-CHRISTMAS-GAP-SANTA-PROD-012` | Santa production hardening | P1 | **NEXT** |
| Conversion gaps (Apple Pay / scene-mobile.mp4 / +5 chances) | P0/P1 | audit next if not primary-owned |
| Localization deepen (tree/wishlist/…) | P2 | queued |

---

## Ownership (lifecycle)

| Surface | Classification |
| --- | --- |
| Commerce portrait/Santa transactional email | SECONDARY_OWNS |
| Abandoned/cross-sell Christmas commerce | SECONDARY_OWNS (marketing off) |
| Kids/private media access | SECONDARY_OWNS |
| `/send-a-gift` emails | PRIMARY_OWNS_FULLY |
| `/christmas/gifts` | PRIMARY_OWNS_FULLY |
| V2 pack delivery (`christmas_v2_email_deliveries`) | SECONDARY_OWNS (legacy; coexist) |
