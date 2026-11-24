# Santa V2 — Private iPhone Safari QA

Generated: 2026-10-24T18:51:39.596Z
Mode: Stripe TEST only (no LIVE charges)
Child profile: Maya / ro / hobbies + wish preloaded
Entitlement: ready, **180 seconds** remaining, extension available once

## Private URL
Open the file `/tmp/tdg-santa-safari-qa-url` on this machine (mode 0600).
Do **not** paste the token into chat, tickets, or public channels.
QR: `/tmp/tdg-santa-safari-qa-qr.png`

## UI / video expect (hard refresh once)
- Immersive scene uses **1080×1920** `north_pole_santa_reel_mobile.mp4` (not soft 540p).
- After 180s: modal „Mai vorbești 5 minute cu Moșul?” / 49 lei / Continuă / Încheie.
- Skip-wait upsell retest: `/tmp/tdg-santa-upsell-awaiting-url` (private, already awaiting_extension).

## Manual steps (physical iPhone + Safari)

1. Scan QR or open the private URL in **Safari** (not Chrome). Hard-refresh once.
2. Allow microphone when prompted.
3. Confirm audible Santa voice (**ash**), barge-in, and RO language.
4. Talk briefly; confirm child name/context without a long re-intro if reconnecting mid-call.
5. Stay until the **180s** timer ends (or force by waiting).

### At 180 seconds (expected)
- Call ends with duration limit.
- Extension upsell appears (49 RON / +5 min).
- No second free call; one extension max.

6. Tap pay / extend → real **Stripe TEST Checkout** hosted UI.
7. Pay with Stripe test card `4242 4242 4242 4242`, any future expiry, any CVC.
8. Safari must return to the private call URL (`?extension=return` or equivalent).

### After 49 RON TEST payment (expected)
- Entitlement becomes **300 seconds**.
- Same child profile + resume context.
- **No repeated introduction** / no full re-greet.
- Voice still ash; mic + barge-in still work.

9. Use the extra time; optionally background Safari and return (refresh/reconnect).
10. At end of the extra **300 seconds**, call ends permanently — no second extension offer that can charge again.

### Cancel / fail probes (optional)
- Start Checkout and tap Cancel → unpaid, no entitlement change.
- Use `4000 0000 0000 0002` → decline, no entitlement change.

## Isolation reminders
- Contabo `CHRISTMAS_SANTA_CALL_STRIPE_MODE=test` + `STRIPE_TEST_*` only for this path.
- `CHRISTMAS_LIVE_PRODUCTS` stays empty — no public Santa LIVE route.
- Do not use LIVE cards. Do not share QA tokens.

## Still MANUAL-only on device
Microphone, audible voice, barge-in, language switching, Safari payment return.
