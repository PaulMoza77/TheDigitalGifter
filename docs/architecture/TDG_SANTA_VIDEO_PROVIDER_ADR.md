# TDG Santa Video Provider ADR

**Task:** `tdg-christmas-santa-video-007`  
**Status:** Accepted for V1  
**Date:** 2026-09-03  
**Updated:** 2026-09-03 (compose fallback)

## Context

TDG needs a personalized 30–60s Santa video (EN + RO) where Santa speaks the child’s first name and selected details. Existing video infrastructure is **Pet Seedance** (~5s motion clips from a still) and Christmas V2 Seedance — **insufficient** for coherent speech-length video.

## Existing infrastructure

| Capability | Status |
|------------|--------|
| Replicate API (`REPLICATE_API_TOKEN`) | Present |
| OpenAI API (`OPENAI_API_KEY`) | Present (quota may exhaust; template/TTS fallbacks required) |
| ElevenLabs | **Not present** (no secret / no adapter) |
| Sync Labs API | **Not present** |
| Pet Seedance `bytedance/seedance-1-pro-fast` | ~5s clips; post-pay only |
| Christmas commerce orders / assets / claim RPC | Present |
| Christmas checkout kill switch | Present (`CHRISTMAS_CHECKOUT_ENABLED`) |
| Origin ffmpeg (`Dockerfile` apk) | Required for V1 compose path |

## Options considered

### A. Seedance-only extended clips
Reject for speech product: duration economics and architecture are short motion clips, not speaking Santa.

### B. ElevenLabs TTS + Sync Labs / HeyGen avatar
Reject for V1: credentials and adapters do not exist in production secrets. Do not invent provider support.

### C. OpenAI script + TTS + Replicate lipsync (**preferred when model available**)
- **Script:** `gpt-4o-mini` when billed; otherwise **server-owned EN/RO templates** (still personalized). Never accepts browser system prompts.
- **TTS:** OpenAI `tts-1-hd` when billed; **fallback** Replicate `minimax/speech-02-hd` (EN + Romanian `language_boost`). Synthetic character voice config only.
- **Santa still:** Template key → Flux still of classic Santa (cached under `christmas-source`).
- **Video:** Try Replicate talking-head models (`CHRISTMAS_SANTA_VIDEO_MODEL`, defaults including `cjwbw/sadtalker`). **Verified 2026-09-03:** current default slugs returned 404 “resource could not be found.”

### D. Pre-rendered licensed Santa plate + lip-sync only
Attractive later if we own plates; V1 generates the still via Flux to avoid licensing blockers.

### E. Still + full TTS mux via ffmpeg (**chosen V1 deliverable**)
When lipsync is unavailable, origin endpoint `/api/christmas-santa-compose` (service-role auth) downloads still + speech audio and muxes **one MP4** (`libx264` stillimage + AAC, `-shortest`). Duration equals TTS length (~30–40s in proofs). This is a coherent downloadable file with matched spoken content — **not** a 5s clip plus detached audio.

## Why E for V1 (with C as upgrade)

- Uses only providers already wired in TDG secrets for script/TTS/still.
- Produces a single downloadable MP4 synchronized to personalized speech.
- Async-friendly: Edge orchestrator stages (script → TTS → still → lipsync-or-compose → store).
- Honest limitation: **no lip motion** in mux mode; Santa is a warm still portrait while audio plays.
- Lip-sync remains the preferred upgrade when a working Replicate (or other) model slug is confirmed.

## Duration

Target spoken length **~30–55 seconds** (script word budget). Exact MP4 duration follows TTS audio. UX must not hard-promise “exactly 60 seconds.”

## Async / idempotency

- Paid webhook / synthetic fulfill enqueues `christmas-santa-generate`.
- Job row claimed once; stages advance with durable status.
- Duplicate webhooks do not create duplicate provider jobs (unique order_id on job; claim RPC / status gates).
- Compose uses order_id scoped storage paths.

## Cost (estimated labels)

| Stage | Provider | Cost state |
|-------|----------|------------|
| Script | OpenAI chat or templates | estimated / $0 templates |
| TTS | OpenAI TTS or Replicate MiniMax | estimated |
| Santa still | Replicate Flux (if cache miss) | estimated (~$0.003–0.04) |
| Lipsync video | Replicate (when available) | estimated |
| Compose mux | Origin ffmpeg | $0 compute on VPS |

Record into order/job metadata + cost_* fields; label `estimated` when exact invoice unavailable.

## Privacy / external data flow

| Provider | Data sent | Not sent |
|----------|-----------|----------|
| OpenAI / templates | Personalization fields for script only | Email, Stripe IDs, analytics |
| MiniMax / OpenAI TTS | Script text + voice/lang config | Email, Stripe, photos |
| Flux | Santa prompt (no child PII) | Child name not required in still prompt |
| Compose | Signed URLs of Santa still + TTS audio | Never child photo in V1 |

- Child photo **not required** in V1 and **not sent** to providers.
- Private buckets; no public gallery.
- Retention defaults configurable (see product doc).

## Fallback

- `CHRISTMAS_SANTA_GENERATION_MOCK=true`: stage through with placeholder MP4 for CI — **never** report as real video PASS.
- Lipsync 404 → compose mux.
- If compose endpoint unreachable: job `failed` at video stage; paid order remains paid; admin retry resumes from failed stage.

## Limitations (honest)

- V1 mux mode has **no lip-sync**; appearance is a static Santa portrait with full personalized audio.
- Romanian TTS accent quality depends on MiniMax/OpenAI, not a dedicated RO Santa talent.
- OpenAI billing may be exhausted → template script + Replicate TTS.
- No ElevenLabs / Sync Labs until credentials + adapters are added.
- SadTalker-class Replicate models were unavailable (404) at acceptance time.
