# Santa Call V3 — Commercial Launch Checklist

**Do not execute until explicit approval.**

## Identity
- Branch: `feature/santa-voice-call`
- Deployment SHA: _(fill after commit completes)_
- Private preview: `https://www.thedigitalgifter.com/_qa/santa-private/christmas/santa-call`
- Public URL (post-launch): `https://www.thedigitalgifter.com/christmas/santa-call`

## Rollback
1. Mozas SPA: restore `/app/dist/_qa/santa-private.bak.v3` (or previous release image).
2. Contabo edge: restore `/opt/supabase/tdg/volumes/functions` from pre-change backup; `docker restart tdg-supabase-edge-functions`.
3. Remove `christmas_santa_voice_call` from `CHRISTMAS_LIVE_PRODUCTS` if set.
4. Set `VITE_SANTA_CALL_LANDING_PUBLIC=false` and redeploy SPA.
5. Keep `CHRISTMAS_SANTA_CALL_ENABLED=false` for kill switch.

## LIVE Stripe (only after approval)
- Confirm LIVE `STRIPE_SECRET_KEY` / publishable / webhook secret already on Contabo commerce path.
- Do **not** point Santa TEST webhook at LIVE endpoint.
- Verify LIVE Checkout amounts: RO 5900 RON / 4900 RON; US 1299 USD / 999 USD (server map, no FX).
- Distinct presentment by `santa_call_market` on order metadata.

## Product activation flags
1. `CHRISTMAS_CHECKOUT_ENABLED=true` (already used by other products).
2. Add `christmas_santa_voice_call` to `CHRISTMAS_LIVE_PRODUCTS`.
3. `CHRISTMAS_SANTA_CALL_ENABLED=true`.
4. SPA build: `VITE_SANTA_CALL_LANDING_PUBLIC=true`.
5. SEO: set `noindex: false` on `/christmas/santa-call` in `server/christmasSeoCore.mjs`.

## Price verification
| Market | Initial | Extension |
|--------|---------|-----------|
| RO | 59.00 RON (5900) | 49.00 RON (4900) |
| US | $12.99 (1299) | $9.99 (999) |

## SEO activation
- Clear `noindex` on santa-call entry.
- Confirm hreflang en + ro only.
- Confirm OG image: north_pole_santa_reel_hq.jpg.

## Meta Pixel
- Consent-aware ViewContent / InitiateCheckout / Purchase.
- Purchase only after confirmed payment; dedupe by order id.
- No child PII / call tokens in events.

## First-order monitoring
- Watch Contabo logs for `christmas-santa-call` + stripe fulfill.
- Confirm first RO + US paid orders: entitlement, EN/RO email, private link, 180s, optional extension.
- OpenAI Realtime cost sample for 180s + 300s.

## Emergency disable
1. Remove product from `CHRISTMAS_LIVE_PRODUCTS`.
2. `CHRISTMAS_SANTA_CALL_ENABLED=false`.
3. Optionally set landing public flag false and redeploy.
