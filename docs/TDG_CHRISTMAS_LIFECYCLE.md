# Christmas Lifecycle Emails

**Task:** `TDG-CHRISTMAS-GAP-LIFECYCLE-003`  
**Owner:** Secondary gap loop (577a) — not send-a-gift / gift-tree

## State machine (`christmas_orders`)

| Axis | Values |
| --- | --- |
| payment_status | `draft` → `pending` → `paid` \| `failed` \| `refunded` |
| fulfillment_status | `not_started` → `queued` → `processing` → `completed` \| `failed` |

Emails are **consequences** of these transitions (never source of truth).

## Locale authority

- Column: `christmas_orders.locale` (`en`\|`ro`, default `en`) — already existed
- Captured at checkout from client `locale` body (portrait funnel passes `useChristmasLocale`)
- Transactional templates use **persisted** order locale; webhook never uses `Accept-Language`

## Idempotency

Table: `christmas_lifecycle_events`  
Unique: `event_key` e.g. `order:<uuid>:payment_confirmation`  
RPC: `claim_christmas_lifecycle_event` (insert-or-return)

## Send flags (production safety)

| Env | Default | Effect |
| --- | --- | --- |
| `CHRISTMAS_LIFECYCLE_SEND_ENABLED` | unset/false | Ledger dry_run only — **no Resend** |
| `CHRISTMAS_LIFECYCLE_MARKETING_ENABLED` | unset/false | Abandoned + cross-sell suppressed |
| `CHRISTMAS_ABANDONED_CHECKOUT_DELAY_MS` | 2700000 (45m) | Abandoned eligibility window |
| `CHRISTMAS_LIFECYCLE_CRON_SECRET` / `CRON_SECRET` | required for cron | Auth header |

## Templates

| Template | Category | Trigger |
| --- | --- | --- |
| payment_confirmation | transactional | Stripe fulfill → `paid` |
| generation_started | transactional | Santa only (photo skipped — near-instant) |
| generation_ready | transactional | Photo generate completed + tokenized app URL |
| generation_failed | transactional | Terminal failure path (copy ready; wire on fail updates) |
| abandoned_checkout | marketing | Cron: pending+email+aged; recheck paid |
| cross_sell | marketing | Cron: paid+completed+24h; only purchasable targets |

## Welcome

**blocked_by_lead_capture** — no Christmas-specific authoritative lead source (generic `funnel_leads` is not Christmas-scoped). Do not fabricate welcome sends.

## Cron

`GET|POST /api/christmas-lifecycle-cron` (rewrite `/api/christmas/lifecycle-cron`)  
Header: `x-cron-secret: $CHRISTMAS_LIFECYCLE_CRON_SECRET`

## Marketing consent

Uses existing `email_preferences.marketing` + `unsubscribe_marketing`.  
Marketing templates suppressed when consent is false or marketing flag off.  
Transactional is not gated by marketing consent.
