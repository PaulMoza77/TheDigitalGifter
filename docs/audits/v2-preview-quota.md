# V2 free-preview quotas & claim safety

Authoritative enforcement: `begin_pet_v2_preview_create` + `supabase/functions/pet-v2-preview`.

| Scope | Limit | Window | Counts toward limit |
| --- | --- | --- | --- |
| Session | **2** | Rolling **24h** | `succeeded`+`live_generation` **or** `processing` reservation |
| IP (hashed) | **5** | Rolling **24h** | same |
| Image hash | **2** | Rolling **24h** | same |

**Retry-after:** `ceil((oldest_counted.created_at + 24h) - now)` — not a hardcoded 1h/6h.

**Fail closed:** if the RPC is missing/unavailable, the edge returns `503 claim_unavailable` and **never** calls Replicate.

**Orphans:** `processing` without `prediction_id` older than ~90s → `orphan_timeout` (no second create for that key).

**Deploy order:** apply migration first, then deploy the edge function.

Client `sessionStorage` previewCount is a UX hint only.
