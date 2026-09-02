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

1. `20260902120000_christmas_commerce_foundation.sql`
2. `20260902140000_christmas_photo_generator.sql`

**Production apply status:** blocked in this worktree by remote migration history drift (remote has versions not present locally). Do not `db push` until local/remote migration history is repaired.

## Known limitations

- Real Stripe TEST payment and live Replicate generation require secrets + migration apply — not verified in this environment without Docker/local Supabase
- Multi-person identity quality depends on Kontext limits
- Abandoned upload TTL cleanup is configurable seam (manual/ops) — default: keep paid sources; unpaid uploads under `uploads/` should be purged by a later retention job
