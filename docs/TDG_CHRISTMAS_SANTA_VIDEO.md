# Christmas Santa Video (V1)

**Task:** `tdg-christmas-santa-video-007`  
**Product key:** `christmas_santa_video`  
**Route:** `/christmas/santa-video`  
**Activation:** Preview funnel live; **production purchasable=false**; **checkout live=false** (no invented prices).

## Product

Personalized Santa video (~30–60s spoken length) addressed to a child by first name with optional personal details. Languages: **English** and **Romanian**. One extensible template key (`classic_santa` primary; more keys reserved).

## Form / privacy

**Required:** `child_first_name`, `language`, parent/guardian consent checkbox.  
**Optional:** age, something_good, hobby_or_interest, christmas_wish, custom_fact, sender_name.  
**Photo:** not required in V1 (architecture does not need child face).  
Consent version stored; assets private-by-default; no public gallery; no marketing use of child free-text by default.

## Data model

- `christmas_santa_personalization` — minimized fields + consent
- `christmas_santa_video_jobs` — stage statuses, providers, costs, assets, retention_delete_after
- Packages `basic` / `premium` / `deluxe` exist with **price_cents=0**, **purchasable=false**

## Pipeline

paid → `christmas-santa-generate` (async, service role)  
→ script (OpenAI or server templates)  
→ TTS (OpenAI or Replicate MiniMax)  
→ Santa still (Flux cache)  
→ **lipsync only when `CHRISTMAS_SANTA_VIDEO_MODEL` is set**; otherwise **mux-as-prod**  
→ ffmpeg still+audio mux via `/api/christmas-santa-compose` (production video provider)  
→ private MP4 on `christmas-generated`  
→ result email (when configured; no customer emails in testing)

Browser may close; recovery via `?token=` on the product route.

**Production video provider:** mux-as-prod (`ffmpeg_still_audio_mux`). This is the accepted live path, not a temporary stub. Lip-sync is an upgrade that runs when a working Replicate model slug is configured. Known-dead default slugs are not probed.

## Admin

Filter `christmas_santa_video` on `/admin/christmas-orders`. Detail shows job stage/cost fields (no child free-text by default). Retry via `christmas-santa-funnel` `retryGeneration` (admin or service role) — **no re-charge**, resets only failed stages, resumes generate.

## Retention

Policy (from completion):

| Class | Default | Env override | Action |
|-------|---------|--------------|--------|
| Intermediates (speech audio, order-scoped still, compose temp) | 14d | `CHRISTMAS_SANTA_INTERMEDIATE_RETENTION_DAYS` | Delete storage; keep shared `santa/templates/*` cache |
| Personalization free-text | 90d | `CHRISTMAS_SANTA_PERSONALIZATION_RETENTION_DAYS` | Redact in place (`child_first_name=redacted`) |
| Final MP4 | 365d | `CHRISTMAS_SANTA_RETENTION_DAYS` | Delete result + asset row |

Cron: Edge `christmas-santa-retention` (service role or `CHRISTMAS_SANTA_CRON_SECRET`). Origin shim `POST /api/christmas-santa-retention-cron` for VPS. Schedule daily, e.g. `0 5 * * *`. Supports `dry_run=1`.

## Analytics

Funnel events use language/template/package/order dimensions only — **no child free-text**.

## QA evidence (synthetic profiles)

| Lang | Name | Script | TTS | Final MP4 | Duration |
|------|------|--------|-----|-----------|----------|
| EN | Alex | templates after OpenAI quota | minimax/speech-02-hd | still+TTS mux | ~32.1s |
| RO | Andrei (diacritics) | templates | minimax/speech-02-hd | still+TTS mux | ~40.4s |

Orders: `c10fbb92-…`, `51153474-…`. QA: valid MP4, AAC audio present, mean volume non-silent, Santa still stable. **qa_result: PASS_WITH_LIMITATION** (no lip motion).

## Security

Service secrets server-side; paid entitlement gate; order token recovery; private buckets; prompt injection checks on custom fields; compose endpoint service-role only.

## Known limitations

See `docs/architecture/TDG_SANTA_VIDEO_PROVIDER_ADR.md`. Mux-as-prod is the live video provider. Lip-sync upgrade when `CHRISTMAS_SANTA_VIDEO_MODEL` is set to a working slug. Live purchase remains founder-gated (`purchasable=false`, `price_cents=0`).
