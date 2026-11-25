# Christmas Story — cost model & price proposal (NOT approved)

Checkout remains **disabled** (`STORY_OFFER.checkoutEnabled = false`). Planned `$57` is **not** an approved live price.

## Technical readiness (code state)

| Stage | Status |
| --- | --- |
| Landing / demo / create preview | Ready (honesty copy) |
| Personalization draft (local) | Ready |
| Checkout LIVE | **Disabled** by kill switch |
| Stripe modes | `resolveStoryStripeMode` refuses LIVE without enable |
| Generation | Mock lyrics/music + mock film; **manual music** path for licensed attach |
| FFmpeg film worker | Present under `server/christmas-story-media/` |
| Private media / signed URLs | Migrations 02F present |
| Delivery / recipient | Recipient page + buyer dashboard exist |
| Resend | Wired for transactional when keys present; Story LIVE send not activated |
| Retry / refund | Durable orders + recovery challenges; refund handling via Stripe/admin path |

## Estimated COGS per fulfilled gift (USD)

Assumes authorized commercial music (manual attach or licensed API), local FFmpeg film, private object storage, 1 retry allowance.

| Line | Low | Expected | High | Notes |
| --- | --- | --- | --- | --- |
| AI text / story edit | 0.05 | 0.15 | 0.40 | LLM copy + QA |
| Song (licensed / manual ops) | 1.50 | 3.00 | 6.00 | Dominant cost; mock = $0 (not sellable) |
| Image normalize | 0.00 | 0.02 | 0.10 | Local canvas |
| Video / FFmpeg film | 0.05 | 0.25 | 1.00 | VPS CPU + encode |
| Private storage + signed media | 0.02 | 0.08 | 0.25 | First 30–90 days |
| Stripe fees (~2.9%+$0.30) | 1.10 | 1.40 | 1.80 | At $34–$45 ticket |
| Retry allowance (20%) | 0.50 | 1.00 | 1.80 | Regen song/film |
| Support / ops amortization | 0.50 | 1.25 | 2.50 | Manual music attach |
| **Total COGS** | **~3.70** | **~7.15** | **~13.85** |

## Margin targets

- Target contribution margin after COGS: **≥ 65%** at Expected COGS.
- Do not launch below Expected COGS × 2.5 if manual song ops stay in the loop.

## Proposed commercial prices (for owner approval)

| Market | Proposed price | Approx USD | Expected margin @ $7.15 COGS |
| --- | --- | --- | --- |
| **US** | **$34.99** | $34.99 | ~80% |
| **RO** | **149 RON** | ~$32–33 | ~78% |

### Alternatives (if owner wants premium positioning)

| Market | Alt | When to use |
| --- | --- | --- |
| US | $39.00 | If licensed song COGS routinely > $4 |
| RO | 179 RON | If RO willingness-to-pay supports; still below planned $57 |

### Explicitly rejected for now

- **$57** — not cost-validated; above competitive “digital Christmas gift” band without proven delivery SLAs.
- Any LIVE checkout before: (1) owner price approval, (2) end-to-end paid TEST order with real media attach, (3) Resend delivery proof.

## Owner decision needed

Approve one of: **US $34.99 / RO 149 RON** (recommended) · US $39 / RO 179 RON · custom.
