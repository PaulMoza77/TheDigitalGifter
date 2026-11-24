# Santa V3 — Meta Ads Launch Gate (PREPARE ONLY)

**Status:** Ready to configure · **NOT activated**  
**Commit baseline:** see latest `feature/santa-voice-call` tip  
**Constraint:** Do not send TEST purchases as Meta Purchase. Do not flip LIVE without owner approval.

## Funnel events (consent-gated)

| Step | Pixel event | Dedup key | When |
|---|---|---|---|
| Landing view | `ViewContent` | session once | After cookie **Accept** |
| Checkout start | `InitiateCheckout` | `xmas_santa_call_ic_{orderId}` | Order created |
| Paid | `Purchase` | `xmas_santa_call_purchase_{orderId}` | Only after server-confirmed paid |

Implementation: `src/features/christmas/santa-call/santaCallMeta.ts`  
- Skips when cookie consent ≠ `granted`  
- Never sends child PII, access tokens, or emails  
- Currency/value from presentment amount (RON or USD)

## Public route activation checklist (owner approval)

1. Production SPA build with `VITE_SANTA_CALL_LANDING_PUBLIC=true` and `VITE_SANTA_CALL_ENABLE_CHECKOUT=true`
2. Add `christmas_santa_voice_call` to `CHRISTMAS_LIVE_PRODUCTS`
3. Set `CHRISTMAS_SANTA_CALL_STRIPE_MODE=live` only after LIVE webhook verified
4. Wire LIVE price IDs (see LIVE plan)
5. Clear `noindex` on public landing
6. Verify Meta Pixel + CAPI with **LIVE** smoke (not TEST)
7. Confirm UTM capture via existing `captureFunnelAttribution`

## Privacy / consent

- Cookie banner must not cover CTA (offset via `--tdg-cookie-offset`)
- Analytics/ads off until Accept
- Parental consent checkbox required before checkout
- AI disclosure + privacy/support links on landing

## Rollback

1. Remove product from `CHRISTMAS_LIVE_PRODUCTS`
2. Set SPA flags false / redeploy previous overlay
3. Keep Stripe LIVE prices intact (do not delete); stop traffic only
