# TDG Christmas Gap Loop (Secondary)

**Loop chat:** `577a` / Cursor `e6c1224b-ee03-4ffa-bbcb-a3ed58d37b4a`  
**Mission:** Christmas suite work **not** owned by the primary e6f4 send-a-gift / durable-continue loop  
**Repo:** `PaulMoza77/TheDigitalGifter`  
**Foundation task:** `TDG-CHRISTMAS-GAP-LOOP-FOUNDATION-001`  
**Localization task:** `TDG-CHRISTMAS-GAP-LOCALIZATION-002`  
**Audit date:** 2026-09-05  
**PR:** https://github.com/PaulMoza77/TheDigitalGifter/pull/97  
**Branch:** `cursor/christmas-gap-loop-foundation-577a`

---

## Isolation rules

| Loop | Chat | Owns |
| --- | --- | --- |
| **Primary** | e6f4 | `/send-a-gift`, gift links, prepaid entitlements/redemptions, send-a-gift admin observability, durable continue tasks |
| **Secondary (this)** | 577a | Remaining Christmas suite gaps from audit / prior 3bd9 build order |
| **Do not** | — | Modify `/christmas/gifts`, send-a-gift routes, or primary gift-tree funnel without Paul |

---

## LOCALIZATION

| Field | Value |
| --- | --- |
| coverage_before | Messages/Santa had ad-hoc EN/RO ternaries; hub/account/portrait/shells hardcoded English |
| coverage_after | Shared `src/features/christmas/i18n` dictionaries (`en`/`ro`) + `useChristmasLocale` wired into hub, account, kids shell, portrait funnel chrome/meta |
| primary_overlap | None for product UI i18n (`feat/send-a-gift-admin-observability` == `origin/main` at audit; gift-tree branches untouched) |
| secondary_owned | Hub, account Christmas, kids shell, portrait funnels, V2 delivery email copy seam |
| EN status | Complete for wired surfaces |
| RO status | Complete for wired surfaces |
| remaining locales | None planned (EN+RO only) |
| email localization status | V2 delivery email EN/RO copy wired (`locale?` arg); order locale persistence → lifecycle task |
| URL policy | No new `/en` or `/ro` product URL scheme. Use `?lang=en\|ro` + `localStorage` (`tdg.christmas.locale.v1`). SEO `/ro/christmas/*` (when present) remains SEO-factory owned — do not duplicate. |
| fallback_locale | `en` (missing keys → EN string or key; never throw) |

### Route matrix (customer-visible)

| Route | EN | RO | Notes |
| --- | --- | --- | --- |
| `/christmas` | wired | wired | Suite + PageHead via dictionary |
| `/christmas/photo-generator` (+ family/couples/pets/dogs/cats) | wired | wired | Portrait chrome + vertical meta |
| `/christmas/kids` | wired | wired | Shell via dictionary |
| `/account/christmas` | wired | wired | Hub + galleries empty states |
| `/christmas/messages` | mixed (pre-existing) | mixed | In-page EN/RO ternaries — leave until migrate |
| `/christmas/santa-video` | mixed | mixed | Generation language EN/RO; UI chrome still mostly EN |
| `/christmas/tree`, `/advent`, `/wishlist`, `/gift-finder`, `/cards` | hardcoded EN | not yet | Follow-up localization pass |
| `/christmas/gifts`, `/send-a-gift` | — | — | PRIMARY — out of scope |
| `/christmas-ai-photos` | hardcoded EN | not yet | Legacy V2 pack funnel |

---

## LIFECYCLE

| Journey | Status |
| --- | --- |
| welcome | MISSING |
| abandoned_checkout | MISSING (pet has abandon events; Christmas journey not built) |
| payment_confirmation | PARTIAL (Stripe receipt only) |
| generation_started | MISSING |
| generation_ready / delivery | EXISTS — V2 `sendChristmasDeliveryEmail` (now EN/RO copy; locale persistence still needed) |
| generation_failed | PARTIAL (order `last_error`; no customer email) |
| cross_sell | MISSING |
| primary_owned | send-a-gift transactional emails (when primary ships them) |
| secondary_owned | Christmas suite lifecycle journeys |
| recommended_next_task | `TDG-CHRISTMAS-GAP-LIFECYCLE-003` |

---

## Covered by prior suite build (NOT gap)

| Task / capability | Status |
| --- | --- |
| Audit → SEO factory suite products | Done on `origin/main` through cards/messages |
| Account Christmas hub | Done (`TDG-CHRISTMAS-GAP-ACCOUNT-002` in foundation PR) |
| EN/RO localization infrastructure | Done (`TDG-CHRISTMAS-GAP-LOCALIZATION-002`) |

---

## Gap backlog (secondary queue)

| ID | Gap | Priority | Status |
| --- | --- | --- | --- |
| `TDG-CHRISTMAS-GAP-ACCOUNT-002` | `/account/christmas` | P1 | **DONE** |
| `TDG-CHRISTMAS-GAP-LOCALIZATION-002` | EN/RO Christmas UI i18n | P1 | **DONE** (this task; renumbered from prior `-003`) |
| `TDG-CHRISTMAS-GAP-LIFECYCLE-003` | Christmas lifecycle emails + order locale persistence | P2 | **NEXT** |
| `TDG-CHRISTMAS-GAP-ADMIN-KPIS-005` | Admin KPIs | P1 | queued |
| `TDG-CHRISTMAS-GAP-KIDS-PRIVACY-006` | Kids product (privacy) | P0 | queued (shell only) |
| `TDG-CHRISTMAS-GAP-CHECKOUT-READY-007` | Price + purchasable flip | P0 | blocked on founder |
| `TDG-CHRISTMAS-GAP-ATTRIBUTION-008` | Attribution parity | P0 | coordinate with primary |
| `TDG-CHRISTMAS-GAP-RESULT-SHARE-009` | Result share route | P1 | queued |
| `TDG-CHRISTMAS-GAP-HUB-IA-010` | Hub IA polish | P2 | queued |
| Localization deepen (tree/cards/santa chrome) | Remaining EN pages | P2 | after lifecycle |

---

## Ownership classifications (localization)

| Surface | Classification |
| --- | --- |
| `/send-a-gift` | PRIMARY_OWNS_FULLY |
| `/christmas/gifts` Gift Tree | PRIMARY_OWNS_FULLY (protected) |
| Hub / account / portrait / kids shell i18n | SECONDARY_OWNS |
| Messages in-page EN/RO | SECONDARY_OWNS (pre-existing; not absorbed) |
| SEO `/ro/christmas/*` factory | SECONDARY_OWNS when present on branch; not duplicated here |
| V2 delivery email copy | SECONDARY_OWNS |
| send-a-gift emails | PRIMARY_OWNS_FULLY (future) |
