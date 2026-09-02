# TDG Christmas Photo Generator

**Task:** `tdg-christmas-photo-generator-003`  
**Route:** `/christmas/photo-generator`

## User flow

Intro → Upload → Style → **Blurred ORIGINAL preview** → Offer → Embedded checkout (when purchasable) → Paid webhook → Replicate generation → Result → Download / Share → Token recovery (+ email when configured)

## Preview architecture (critical)

- Implementation: `createBlurredOriginalPreview` in `src/features/christmas/photoPreview.ts`
- Source: user original upload only
- Method: canvas `blur()` + obscuring veil + “Preview · your photo” label
- **Replicate calls before payment: 0** (enforced in code + tests)
- Copy: “Your Christmas transformation is ready to create” — does not claim finished AI result

## Styles

Server-owned keys/prompts: `christmas_styles` + `src/features/christmas/styles.ts`  
V1: classic_christmas, winter_wonderland, santas_workshop, cozy_fireplace, elegant_christmas, north_pole, christmas_movie, vintage_christmas

## Order / payment

- Product: `christmas_photo` / package `single`
- Checkout: `christmas-checkout` Custom Checkout Elements (`ui_mode=custom`)
- Kill switch: `CHRISTMAS_CHECKOUT_ENABLED`
- Seed package **purchasable=false**, price unpublished → production checkout disabled until launch config
- Client `amount_cents` ignored

## Generation

- Edge: `christmas-generate` (service role only)
- Gate: `payment_status === paid` required (402 otherwise)
- Model default: `black-forest-labs/flux-kontext-pro`
- Mock: `CHRISTMAS_GENERATION_MOCK=true` copies source to result bucket for pipeline proof
- Cost: estimated `$0.04` tariff snapshot stored on order metadata (`cost_state: estimated`) — pet `ai_cost_ledger` remains pet-scoped

## Storage / privacy

- Buckets: `christmas-source`, `christmas-generated` (private)
- Results via short-lived signed URLs
- Default private; share uses Web Share API / file share (no public result page in V1)

## Recovery

- `?token=` public token → `christmas-funnel` `getOrder`
- Draft persisted in sessionStorage for in-progress unpaid flow

## Email

- Resend transactional after success when `RESEND_API_KEY` + from + email + token hint present
- No marketing content

## Analytics

Allowlisted events via `/api/christmas/funnel-event` including upload/style/preview/offer/checkout/purchase/generation/download/share

## Admin

`/admin/christmas-orders` shows style, model, generation timestamps, payment/fulfillment, Stripe ids

## Activation

| Flag | Production default |
| --- | --- |
| product discoverable | true |
| package purchasable | **false** |
| CHRISTMAS_CHECKOUT_ENABLED | unset/false |

## Migrations

1. Remote history alignment: `20260827180000`–`20260831190000` (fetched/quarantined)
2. `20260902105000_quarantine_legacy_christmas_v2_schema.sql` — renames conflicting V2 prototype tables to `christmas_v2_*` (5 test rows preserved; no paid customers)
3. `20260902120000_christmas_commerce_foundation.sql`
4. `20260902140000_christmas_photo_generator.sql`
5. `20260902150000_christmas_claim_requires_paid.sql` — claim RPC requires `payment_status=paid`

**Production apply status (project `kjlsocejpmnzhhduyumy`):** APPLIED — verified via `supabase migration list` (local=remote for all four `20260902*`) and table/catalog checks (`christmas_products`/`packages`/`styles`/`orders` commerce schema present; package `christmas_photo`/`single` remains `purchasable=false`, `price_cents=0`).

**Synthetic payment proof (no Stripe charge):** `fulfill_christmas_order_payment` → paid/queued; unpaid `claim_christmas_generation_job` → `payment_required`; paid claim once; replay claim `already_running`.

**Frontend deploy (Mozas VPS):** release `d382ab4` healthy on `mozas-prod-01` (image `mozas/thedigitalgifter:d382ab4`). Live bundle includes `ChristmasPhotoGenerator` / `/christmas/photo-generator`. Checkout remains killed (`christmas-checkout` → 403 `checkout_disabled`).

**Frontend (Mozas VPS):** deployed release `d382ab4` (`mozas/thedigitalgifter:d382ab4`); public `https://www.thedigitalgifter.com/christmas/photo-generator` 200; bundle includes `ChristmasPhotoGeneratorPage` + checkout-disabled copy; Pet routes 200.

**Generation proof (controlled):**
- Mock path: order `bf8d8cae-…` completed `mock:true` (~491ms)
- Real Replicate Kontext Pro: order `e30e6b9c-0879-4221-a636-013e7794a483` completed `mock:false`, `latency_ms≈9305`, `estimated_cost_usd=0.04`, `cost_state=estimated`
- Unpaid generate → HTTP 402 `payment_required`
- Token recovery → paid/completed + signed `resultUrl`; wrong token → 404

`CHRISTMAS_CHECKOUT_ENABLED=false` (secret). Production purchase remains disabled.

## Known limitations

- Stripe Custom Checkout Elements UI not exercised end-to-end (checkout kill-switched; no live/test charge). Payment entitlement proven via fulfill RPC + webhook code path deployed.
- Multi-person identity quality depends on Kontext limits
- Abandoned upload TTL cleanup is configurable seam (manual/ops) — default: keep paid sources; unpaid uploads under `uploads/` should be purged by a later retention job
- Legacy V2 tables remain as `christmas_v2_*` quarantine (not used by Photo Generator V1)
