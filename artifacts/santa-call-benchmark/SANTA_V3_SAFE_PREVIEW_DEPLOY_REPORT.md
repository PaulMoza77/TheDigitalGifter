# Santa V3 — Safe Public Preview Deploy Report

**Date:** 2026-10-28  
**Verdict:** **GO** for public preview · **Commercial activation remains BLOCKED**

## 1. PUBLIC PREVIEW URL
https://www.thedigitalgifter.com/_qa/santa-preview/christmas/santa-call

Externally verified HTTPS `200` with `X-Robots-Tag: noindex, nofollow, noarchive`.  
No VPN / localhost / preview-token required to view landing.  
Purchase CTA disabled (`VITE_SANTA_CALL_ENABLE_CHECKOUT=false`).  
Commercial `/christmas/santa-call` remains `404`.

## 2. Deployment SHA
- Branch: `feature/santa-voice-call`
- Tip: `84524785b89f5e830513138bec8e27ae0fee27b8`
- Code: `7cda7acab4791ad73e0d2f9f7f38347bd6bc8423`
- Preview build: isolated Vite base `/_qa/santa-preview/`
- Flags in overlay only: `VITE_SANTA_CALL_LANDING_PUBLIC=true`, `VITE_SANTA_CALL_ENABLE_CHECKOUT=false`
- Commercial image untouched: `mozas/thedigitalgifter:home-occasions-20261024T070221Z`

## 3. Database migrations
| Migration | Status |
|-----------|--------|
| `20261024120000_christmas_santa_voice_call` | Already applied (recorded) |
| `20261024180000_christmas_santa_voice_call_v2` | Already applied |
| `20261024190000_santa_call_heartbeat_awaiting_extension` | Already applied (`awaiting_extension` live) |
| Newly applied | **None** |
| Skipped / blocked | **None** (no destructive pending work) |

Pricing verified: `xmas_santa_voice_call` 5900 RON / 180s; extension 4900 RON / 300s.  
Product `christmas_santa_voice_call` active, `public_discoverable=false`, `live_offer=false`.

## 4. Edge Functions
Hashes matched local ↔ Contabo (no redeploy required this run):

| Function | SHA256 (prefix) | Smoke |
|----------|-----------------|-------|
| `christmas-santa-call` | `9a511381…` | OPTIONS 200; QA checkout RO/US PASS |
| `santa-call-stripe-test-webhook` | `90d73ae1…` | Signed TEST fulfill PASS |
| `christmas-checkout` | `ec45b850…` | Unchanged; LIVE Christmas products healthy |
| Shared: `santaCallPricing`, `santaCallEmail`, `santaCallFulfill`, `santaStripe` | matched | Pricing map + email locale OK |

## 5. Production health
| Check | Before | After |
|-------|--------|-------|
| Home | 200 | 200 |
| Christmas hub | 200 | 200 |
| Santa video | 200 | 200 |
| Gift finder | 200 | 200 |
| Public santa-call | 404 | 404 |
| Private QA overlay | 200 | 200 |
| Contabo disk | 11% | 11% |
| Mozas disk | 78% | ~78% |
| Edge container | healthy | healthy |
| LIVE_PRODUCTS | empty | empty |
| Santa Stripe mode | test | test |

## 6. Stripe isolation
- `CHRISTMAS_SANTA_CALL_STRIPE_MODE=test`
- Dual-currency sessions: `livemode=false`, amounts 5900 ron / 1299 usd
- Full USD extension E2E: TEST PIs only; signed TEST webhook; duplicate → `already_processed`
- LIVE secret remains configured for other products; Santa path does not use it
- `CHRISTMAS_LIVE_PRODUCTS` empty → no public Santa purchase

## 7. RO/EN screenshots
- `SANTA_V3_PREVIEW_EN_DESKTOP.png` — EN / USD $12.99
- `SANTA_V3_PREVIEW_RO_DESKTOP.png` — RO / RON 59,00
- `SANTA_V3_PREVIEW_RO_MOBILE.png` — RO mobile + sticky CTA

## 8. Full QA results
| Area | Result |
|------|--------|
| Landing HTTP / noindex | PASS |
| RO/EN copy + selectors | PASS |
| RO 59/49 · US 12.99/9.99 | PASS |
| Video + poster 200 | PASS |
| Onboarding UI / FAQ / AI disclosure | PASS |
| Purchase disabled on preview | PASS (CTA disabled) |
| `?preview=1` not auth | PASS (public route still 404) |
| Dual-currency TEST checkout | PASS |
| USD full payment + extension E2E | PASS |
| Email locale EN | PASS |
| 180s → 300s · ash · no 2nd ext | PASS |
| Dup webhook / cancel / decline | PASS |
| Other Christmas products | PASS |

## 9. Rollback readiness
- Postgres backup: `/opt/supabase/tdg/backups/santa-v3-preview-deploy-20261028T140126Z/`
  - `postgres-full.dump`, `santa-v3-tables.dump`, `public-schema.sql`, `FINGERPRINTS.txt`
  - Restore verified into isolated DB `tdg_santa_restore_verify` (table data OK; policy deps expected on empty DB)
- Frontend rollback: remove `/app/dist/_qa/santa-preview`; restore `origin.mjs.bak-pre-santa-preview-*`
- Previous commercial image: `home-occasions-20261024T070221Z` (unchanged)
- Private QA backup remains under `/app/dist/_qa/santa-private.bak.v3.*`
- Do **not** reverse additive migrations blindly

## 10. Final verdict
**GO** — public HTTPS Santa V3 preview is live and isolated.  
**Commercial activation remains BLOCKED** until explicit approval (LIVE products flag, production SPA public flag, noindex clear, Meta, DNS unchanged here).
