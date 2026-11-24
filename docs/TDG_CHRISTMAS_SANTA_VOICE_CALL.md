# Call Santa Claus — AI Voice Call

**Product keys:** `christmas_santa_voice_call` / `xmas_santa_voice_call`  
**Routes:** `/christmas/santa-call` (purchase), `/santa/call/:token` (private call)  
**Price seed (RO) V2:** 59.00 RON / 180s (`web_price_minor=5900`) + optional one-time extension 49.00 RON / 300s (`xmas_santa_voice_call_extension`, `4900`). Public sales remain gated by `CHRISTMAS_LIVE_PRODUCTS`.  
**Duration:** 180 seconds server-enforced  
**Default access TTL:** 30 days (commercial approval required before launch)

## Architecture

```
Customer → /christmas/santa-call → christmas-checkout (Stripe Custom)
  → stripe-webhook → fulfill_christmas_order_payment
  → fulfillSantaVoiceCallOrder (token hash + Resend email)
  → /santa/call/:token → christmas-santa-call (resolve/start/heartbeat/end)
  → OpenAI Realtime WebRTC (ephemeral client secret)
```

Provider adapters live in `supabase/functions/_shared/christmas/santaCallProviders.ts`.
Commerce does not depend on a single vendor.

## Feature flags / secrets

| Name | Role |
|------|------|
| `CHRISTMAS_CHECKOUT_ENABLED` | Global Christmas checkout |
| `CHRISTMAS_LIVE_PRODUCTS` | Must include `christmas_santa_voice_call` to sell |
| `CHRISTMAS_SANTA_CALL_ENABLED` | Kill switch (`false` disables mint/start) |
| `CHRISTMAS_SANTA_CALL_PROVIDER` | `openai_realtime` (default) \| `elevenlabs_agents` |
| `OPENAI_API_KEY` | Realtime ephemeral secrets |
| `CHRISTMAS_SANTA_CALL_OPENAI_MODEL` | default `gpt-realtime` |
| `CHRISTMAS_SANTA_CALL_OPENAI_VOICE` | default `ash` (human-approved from voice benchmark) |
| `ELEVENLABS_API_KEY` + `CHRISTMAS_SANTA_CALL_ELEVENLABS_AGENT_ID` | Optional alternate provider |
| `CHRISTMAS_SANTA_CALL_TTL_DAYS` | default `30` |
| `RESEND_API_KEY` + `CHRISTMAS_EMAIL_FROM` | Transactional email |

## Privacy

- Parent/guardian consent required at checkout.
- No child address / school / phone collected.
- Access token stored as SHA-256 hash only.
- No default transcript or audio retention.
- Profiles: retention target 90 days after activation.
- Compromised link does not expose extra profile fields beyond first name + language on resolve.

## Duration policy

- Timer starts after voice connection (server `connected_at` / heartbeat elapsed).
- At ≤20s remaining: wrap-up signal to model.
- At 0s: force end.
- Intentional hangup → entitlement `completed` (no residual time).
- Technical interrupt → remaining time kept (`keep_remaining`).
- Grace period default 45s for orphaned reconnect; single active session per entitlement.

## Cost target

Desired technical cost ≤ **3 RON / call**. Estimates (not measured live in this environment):

- OpenAI Realtime ~$0.10/min mixed → ~$0.30 / 3 min (~1.4 RON @ 4.6)
- ElevenLabs Agents ~$0.08/min + LLM → ~$0.30 / 3 min

Voice A/B (admin listen page): `/admin/christmas/santa-voice-benchmark`  
Artifacts: `public/santa-voice-benchmark/` + `artifacts/santa-voice-benchmark/`.  
Rebuild catalog: `node scripts/santa-voice-benchmark-meta.mjs`.  
Azure / ElevenLabs samples stay `BLOCKED_NO_CREDENTIALS` until keys are approved (no invented audio).

## Admin

`/admin/christmas/santa-call` — orders, durations, AI cost estimates, resend/revoke/reissue.  
`/admin/christmas/santa-voice-benchmark` — protected listen/compare for voice providers (not public SEO).

## Deploy checklist (controlled)

1. Apply migration `20261024120000_christmas_santa_voice_call.sql` (already applied on self-hosted DB in this mission).
2. Deploy Edge: `christmas-checkout`, `stripe-webhook` shared libs, `christmas-santa-call`.
3. Set secrets on Contabo Edge (TEST Stripe first).
4. Add `christmas_santa_voice_call` to `CHRISTMAS_LIVE_PRODUCTS` only when approved.
5. Deploy SPA (Mozas VPS) with new routes.
6. Stripe TEST end-to-end + Resend + one real 3-minute call proof.
7. Do **not** enable LIVE Stripe or production broadcast without explicit approval.
