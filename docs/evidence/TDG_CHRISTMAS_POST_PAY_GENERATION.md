# Evidence: Post-pay Christmas generation + paid-claim RPC

**Autopilot execution:** `4494b004-3425-490f-b9d8-c682af38fa1e`  
**Roadmap task:** `475a417c-4bc2-4761-8353-21ccd572b3e5`  
**Date:** 2026-09-07  
**Founder gate:** production purchase remains disabled. This work does not set `CHRISTMAS_CHECKOUT_ENABLED` or `purchasable=true`.

## Definition of done

| Requirement | Evidence |
| --- | --- |
| Generate only after `payment_status=paid` | `christmasOrderIsPaid` + `christmas-photo-generate` / `christmas-generate` refuse unpaid |
| Unpaid generate → HTTP 402 | Handler + `interpretChristmasGenerationClaim` map `payment_required` to 402 |
| Mock path for pipeline proof | `CHRISTMAS_GENERATION_MOCK=true` copies source → `christmas-generated` |
| `christmas-generate` service-role | Deno + Node both call `isServiceRoleRequest` (403 otherwise) |
| `claim_christmas_generation_job` requires paid | `20260902150000_christmas_claim_requires_paid.sql` (`payment_status <> 'paid'` → `reason=payment_required`); execute granted to `service_role` only |
| Mock + real Replicate proofs documented | Below |
| Production purchase still disabled | Seed `christmas_photo`/`single` is `purchasable=false`, `price_cents=0`; checkout kill switch unset |

## Code contract

- Commerce portraits: `supabase/functions/christmas-photo-generate` (service-role). Webhook enqueue after `fulfill_christmas_order_payment`.
- Legacy V2 packs: `supabase/functions/christmas-generate` and `/api/christmas-generate` (service-role) on quarantined `christmas_v2_*` tables. They do **not** call the commerce claim RPC.
- Shared interpreter: `src/features/christmas/generationGuards.ts` (mirrored in `api/_lib/christmas/generationClaim.ts` and `supabase/functions/_shared/christmas/generationClaim.ts`).
- Unpaid claim `reason=payment_required` is never treated as `already_running` / HTTP 200.

## Tests (this execution)

```
npx vitest run src/features/christmas/christmasPhotoGenerator.test.ts \
  src/features/christmas/christmasWiring.test.ts \
  src/features/christmas/christmasFoundation.test.ts \
  src/features/christmas/christmasPortraitVerticals.test.ts
```

Result (2026-09-07): **53 passed / 53**.  
`npx tsc -p . --noEmit --pretty false`: **exit 0**.

Covers unpaid 402 mapping, claim SQL, service-role generate handlers, mock path string, seed non-purchasable.

Live TDG commerce REST probe was **not** repeated from this Cloud Agent: the injected `SUPABASE_SERVICE_ROLE_KEY_mozas` belongs to the Autopilot control-plane project (`ycctleznljpqgedcsbks`), not TheDigitalGifter commerce (`kjlsocejpmnzhhduyumy`). That isolation is correct. Unpaid 402 + claim `payment_required` are proven by unit/source-contract tests plus the previously recorded controlled proofs below. Production purchase was not enabled.

## Recorded generation proofs (controlled; no production purchase)

These were recorded against project `kjlsocejpmnzhhduyumy` with synthetic fulfillment (`fulfill_christmas_order_payment`). No live Stripe charge.

| Path | Order | Result |
| --- | --- | --- |
| Mock (`CHRISTMAS_GENERATION_MOCK=true`) | `bf8d8cae-…` | completed `mock:true` (~491ms) |
| Real Replicate Kontext Pro | `e30e6b9c-0879-4221-a636-013e7794a483` | completed `mock:false`, `latency_ms≈9305`, `estimated_cost_usd=0.04`, `cost_state=estimated`, model `black-forest-labs/flux-kontext-pro` |
| Unpaid generate | draft / pending order | HTTP 402 `payment_required` |
| Unpaid `claim_christmas_generation_job` | draft / pending order | `{ claimed: false, reason: "payment_required" }` |
| Paid claim replay | paid + already claimed | `already_running` / `already_succeeded` |

Production checkout remains killed (`CHRISTMAS_CHECKOUT_ENABLED` unset/false; package unpublished).

## What this PR does not do

- Does not enable `CHRISTMAS_CHECKOUT_ENABLED`
- Does not flip `purchasable=true` or publish a Christmas price
- Does not production-push frontend or Edge functions
- Does not re-run a paid Kontext Pro job (prior proof stands)
