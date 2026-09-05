# TDG Christmas Gap Loop (Secondary)

**Loop chat:** `577a` / Cursor `e6c1224b-ee03-4ffa-bbcb-a3ed58d37b4a`  
**Mission:** Christmas suite work **not** owned by the primary e6f4 send-a-gift / durable-continue loop  
**Repo:** `PaulMoza77/TheDigitalGifter`  
**Foundation task:** `TDG-CHRISTMAS-GAP-LOOP-FOUNDATION-001`  
**Audit date:** 2026-09-05  
**PR base:** `origin/main` @ `8edd7316825c680db1802bc90e0565b8ee2170a4`  
**Note:** Local `main` may still hold unpushed SEO-factory commits; this gap PR intentionally does not include them.

---

## Isolation rules

| Loop | Chat | Owns |
| --- | --- | --- |
| **Primary** | e6f4 | `/send-a-gift`, gift links, prepaid entitlements/redemptions, send-a-gift admin observability, durable continue tasks |
| **Secondary (this)** | 577a | Remaining Christmas suite gaps from audit / prior 3bd9 build order |
| **Do not** | — | Modify `/christmas/gifts`, send-a-gift routes, or primary gift-tree funnel without Paul |

Primary loop may also touch shared Christmas checkout/webhook surfaces for send-a-gift. Prefer additive suite work; avoid concurrent edits to `christmas-checkout`, Stripe fulfill, or gift-tree files.

---

## Covered by prior suite build (NOT gap)

Evidence from commits + docs on this worktree (`docs/TDG_CHRISTMAS_*.md`).

| Task / capability | Status | Evidence |
| --- | --- | --- |
| Audit | Done | `docs/TDG_CHRISTMAS_AUDIT.md` |
| Commerce foundation | Done | `christmas_*` tables, ADR, kill switch |
| Photo generator | Done | `/christmas/photo-generator` |
| Portrait verticals (family/couples/pets/dogs/cats) | Done | Shared funnel pages |
| Santa Video V1 | Done | `/christmas/santa-video` |
| Tree + Advent + free-gift foundation | Done | `/christmas/tree`, `/christmas/advent` |
| Wishlist + Gift Finder | Done | `/christmas/wishlist`, `/christmas/gift-finder` |
| Cards + Messages | Done | `/christmas/cards`, `/christmas/messages` |
| SEO factory (EN + RO clusters) | Done | prerender + soft-404 |
| Christmas hub suite links | Done | `/christmas` catalog section |
| Admin Christmas orders (partial) | Done | `/admin/christmas-orders` |
| Christmas V2 AI photos (legacy pack) | Done | `/christmas-ai-photos` |

---

## Owned by primary loop (OUT OF SCOPE for 577a)

| Capability | Notes |
| --- | --- |
| `/send-a-gift` prepaid packages | Primary P0 product |
| Recipient gift redeem links | Primary |
| Gift entitlements / redemptions | Primary |
| Send-a-gift admin observability | Primary branch work |
| `/christmas/gifts` Gift Tree funnel | Protected; primary-adjacent — do not modify |

---

## Gap backlog (secondary loop)

Priorities from `docs/TDG_CHRISTMAS_AUDIT.md` gap matrix, filtered to remaining work.

| ID | Gap | Priority | Notes |
| --- | --- | --- | --- |
| `TDG-CHRISTMAS-GAP-ACCOUNT-002` | `/account/christmas` account hub | **P1** | First concrete gap in this foundation PR |
| `TDG-CHRISTMAS-GAP-LOCALIZATION-003` | EN/RO localization scaffolding beyond SEO/messages | P0–P1 | Was next after SEO factory (`…-013`) |
| `TDG-CHRISTMAS-GAP-LIFECYCLE-EMAIL-004` | Christmas lifecycle / receipt emails | P2 | Resend exists; journeys missing |
| `TDG-CHRISTMAS-GAP-ADMIN-KPIS-005` | Admin KPIs: AOV, funnel by SKU, SEO cluster health | P1 | Extend `ChristmasOrders` |
| `TDG-CHRISTMAS-GAP-KIDS-PRIVACY-006` | Kids product (privacy-gated) | P0 | Route is `coming_soon` shell; no generation until policy |
| `TDG-CHRISTMAS-GAP-CHECKOUT-READY-007` | Intentional price + purchasable flip | P0 | Requires founder price decision + GATE |
| `TDG-CHRISTMAS-GAP-ATTRIBUTION-008` | Attribution parity on all Christmas checkout paths | P0 | Coordinate with primary if shared checkout |
| `TDG-CHRISTMAS-GAP-RESULT-SHARE-009` | `/share/[generationId]` Christmas result share | P1 | Token share pattern exists on tree/wishlist |
| `TDG-CHRISTMAS-GAP-HUB-IA-010` | Hub IA polish (nav clarity, no checkout claims) | P2 | Suite links exist; refine later |

---

## First gap shipped with this foundation

**`TDG-CHRISTMAS-GAP-ACCOUNT-002`** — Account Christmas hub at `/account/christmas`:

- Suite navigation to live Christmas experiences (no send-a-gift)
- Link to Christmas V2 galleries / create CTAs
- Explicit kids privacy note (not launched)
- Account topbar + sidebar entry

---

## Next recommended gap task

**`TDG-CHRISTMAS-GAP-LOCALIZATION-003`** — Christmas EN/RO localization scaffolding for product UI (not only SEO pages / message locale), with RO copy seams and locale-aware PageHead where missing.
