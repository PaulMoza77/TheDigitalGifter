# Santa Call — Controlled Device QA

See **PRIVATE_BROWSER_QA.md** for the current private HTTPS preview.

## Status
- Edge function: DEPLOYED on Contabo (`christmas-santa-call`)
- `CHRISTMAS_LIVE_PRODUCTS`: EMPTY (not public)
- Production `/christmas/santa-call`: 404 (commercial FE unchanged)
- Private HTTPS QA: `https://www.thedigitalgifter.com/_qa/santa-private`
- iPhone 15: NOT TESTED (not connected to agent)

## Secrets (local only)
- Token: `/tmp/tdg-santa-qa-token-live` (mode 600)
- Full call URL: `/tmp/tdg-santa-qa-call-url` (mode 600)
- Do NOT commit or paste into tickets.

## Manual Safari
1. Benchmark: `https://www.thedigitalgifter.com/_qa/santa-private/santa-voice-benchmark/`
2. Call: open `/tmp/tdg-santa-qa-call-url`
3. Mic → WebRTC → interrupt → 180s end
