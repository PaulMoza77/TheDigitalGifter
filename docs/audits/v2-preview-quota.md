# V2 free-preview quotas & claim safety

Authoritative enforcement: `begin_pet_v2_preview_create` + `supabase/functions/pet-v2-preview`.

| Scope | Limit | Window | Counts toward limit |
| --- | --- | --- | --- |
| Session | **2** | Rolling **24h** | `succeeded`+`live_generation` **or** **active** `processing` within orphan lease |
| IP (hashed) | **5** | Rolling **24h** | same |
| Image hash | **2** | Rolling **24h** | same |

**Expired orphans** (`processing` past `p_orphan_seconds`, no verified provider state) do **not** reserve capacity. The same key still returns `orphan_timeout` (fail-closed). A **new** attempt is not blocked for 24h by that expired reservation.

**Retry-after:** earliest of (succeeded → `created_at+24h`, active processing → `started_at+orphan_lease`).

**Fail closed:** begin RPC missing/unavailable → `503 claim_unavailable`, zero Replicate creates.

**Persist gap:** if Replicate create succeeds but saving `prediction_id` fails → cancel prediction, `provider_state_persist_failed`, no polling, no auto second create.

**Deploy order:** migration first, then edge.

**DB concurrency tests:** require `PET_V2_CONCURRENCY_DATABASE_URL` **and** `PET_V2_CONCURRENCY_ALLOW_MUTATIONS=I_CONFIRM_NON_PRODUCTION` on authorized non-prod only (uses `pg.Pool` + distinct backend PIDs).
