# V2 free-preview quotas

Authoritative enforcement: `supabase/functions/pet-v2-preview` + `pet_v2_preview_attempts`.

| Scope | Limit | Window | Resets |
| --- | --- | --- | --- |
| Session (`funnel_session_id`) | **2** successful live gens | Rolling **24h** | When the oldest counted success ages past 24h |
| IP (hashed) | **5** successful live gens | Rolling **24h** | Same |
| Image hash | **2** successful live gens | Rolling **24h** | Same |

**What consumes quota:** only rows with `live_generation=true` **and** `status=succeeded`.

**Does not consume quota:** validation failures, HEIC rejection, rate-limit rejects, `live_disabled`, provider errors before a succeeded live mark, or any pre-provider failure.

**Resume / retry:** the same `idempotency_key` bypasses quota checks and must not create a second Replicate prediction when one already exists (`acquire_pet_v2_preview_create` + resume).

Client `sessionStorage` previewCount is a UX hint only.
