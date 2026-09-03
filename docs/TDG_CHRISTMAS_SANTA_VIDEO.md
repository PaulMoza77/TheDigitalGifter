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
→ lipsync (Replicate, if model available) **or** ffmpeg still+audio mux via `/api/christmas-santa-compose`  
→ private MP4 on `christmas-generated`  
→ result email (when configured; no customer emails in testing)

Browser may close; recovery via `?token=` on the product route.

## Admin

Filter `christmas_santa_video` on `/admin/christmas-orders`. Detail shows job stage/cost fields (no child free-text by default). Retry via `christmas-santa-funnel` `retryGeneration` (service role) — no re-charge.

## Retention

Defaults: final video ~365d (`CHRISTMAS_SANTA_RETENTION_DAYS`); personalization/intermediates shorter policy documented on job table comments. Cleanup cron can be layered later.

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

See `docs/architecture/TDG_SANTA_VIDEO_PROVIDER_ADR.md`. Lip-sync upgrade when a working model is confirmed.
