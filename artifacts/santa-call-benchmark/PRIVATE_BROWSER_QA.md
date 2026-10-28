# Santa Call — Private Browser QA

## Verdict: NO-GO (commercial) / READY FOR HUMAN SAFARI

Commercial launch remains **NO-GO**. Private HTTPS preview is ready for your Safari test. iPhone 15 was **not** connected to this agent and is **not** claimed tested.

## Private HTTPS URLs

- Preview base: `https://www.thedigitalgifter.com/_qa/santa-private`
- Voice benchmark (5 OpenAI voices, RO/EN/DE embedded):  
  `https://www.thedigitalgifter.com/_qa/santa-private/santa-voice-benchmark/`
- Private call URL (token): file `/tmp/tdg-santa-qa-call-url` on this Mac (mode 600). Do not paste into tickets.

## Manual Safari steps (minimum)

1. Open the benchmark URL → play cedar/marin/ash/echo/verse (RO, then EN, then DE).
2. Open the call URL from `/tmp/tdg-santa-qa-call-url`.
3. Allow microphone.
4. Start call — expect Romanian Santa (`cedar`), WebRTC audio.
5. Interrupt Santa by speaking.
6. Confirm countdown; stay until auto-end at 180s or tap end.
7. Confirm a second concurrent tab cannot start another session.

## Verified by agent

| Check | Result |
|-------|--------|
| Repo routes `/christmas/santa-call`, `/santa/call/:token`, `/admin/christmas/santa-voice-benchmark` | Present |
| Prod `/christmas/santa-call` | Still 404 (unchanged commercial FE) |
| Contabo `christmas-santa-call` | Resolve OK for isolated QA entitlement |
| `CHRISTMAS_LIVE_PRODUCTS` | EMPTY |
| Language detect RO/EN/DE/FR/ES/IT/AR | Automated PASS |
| Benchmark WAV samples over HTTPS | 200 |
| QA SPA shell assets under `/_qa/santa-private/assets/*` | 200 |
| Mic / WebRTC / barge-in / 180s in Safari | Needs you |
| iPhone 15 | NOT TESTED |

## Guards

- No commercial deploy of the production image.
- No LIVE Stripe / no `CHRISTMAS_LIVE_PRODUCTS` activation.
- QA lives under `/_qa/santa-private` with `noindex`.
- Ephemeral overlay inside the running container (reverts on recreate).
