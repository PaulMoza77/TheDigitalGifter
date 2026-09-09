# TDG Christmas media retention (ops TTL)

**Task:** `CHRISTMAS-044` / unpaid-upload + result retention purge  
**Job:** `christmas-retention-purge` (service role / cron secret)  
**Schedule:** GitHub Actions `christmas-retention-purge.yml` daily `17 4 * * *` (UTC) + `workflow_dispatch`

This is an **ops** retention seam. It is **not** legal advice and does **not** decide product-promise copy.

## Founder / legal gate

| Decision | Status |
| --- | --- |
| Legal TTL for paid results, Santa video, kids media | **`policy_pending_founder_legal`** (GAP privacy branch) |
| Auto-delete paid outputs | **Blocked** until founder + legal set a duration |
| Production apply of deletes | **Off** until Edge secret `CHRISTMAS_RETENTION_PURGE_APPLY=true` |

Do not claim a public retention period in UI or marketing until the legal row is decided.

## Documented TTLs

| Surface | Ops TTL | Purge job | Legal TTL |
| --- | --- | --- | --- |
| Unpaid portrait uploads under `christmas-source` / `uploads/` | **7 days** (`CHRISTMAS_UNPAID_UPLOAD_TTL_DAYS`, clamp 1–365) | Delete after TTL if **not** referenced by a `payment_status=paid` order | pending |
| Paid portrait **sources** (same `uploads/` path once purchased) | **Retain** | Never delete | pending |
| Paid portrait / Santa **results** (`christmas-generated`) | **Retain** | Never delete | pending |
| Santa final video | **365d documented** (`CHRISTMAS_SANTA_RETENTION_DAYS`); `retention_delete_after` on job row | Not auto-purged | pending |
| Santa personalization | **90d documented** | Not auto-purged | pending |
| Santa intermediates | **14d documented** | Not auto-purged | pending |
| Kids Christmas media | Same ops rule as portrait (unpaid `uploads/` purge; paid retain) | No kids-specific extra delete | pending — kids commercial launch still founder-gated |

## Job contract

1. Auth: `x-cron-secret` / `CRON_SECRET` / `CHRISTMAS_RETENTION_CRON_SECRET`, or service-role bearer.
2. Service client only — lists `christmas-source` prefix `uploads/`, loads paid `christmas_orders.source_path`.
3. Classifier (`retentionPolicy.ts`): keep paid sources; purge expired unpaid `uploads/` objects.
4. Default **dry-run**. Live `storage.remove` only when `CHRISTMAS_RETENTION_PURGE_APPLY=true` **and** the request sets `apply: true`.
5. Does **not** mock runtime data. Does **not** deploy itself. Does **not** apply migrations.

Classifier (no I/O): `src/features/christmas/retention/retentionPolicy.ts`  
Edge copy: `supabase/functions/_shared/christmas/retentionPolicy.ts`

## Enablement (founder)

1. Deploy Edge function `christmas-retention-purge` when ready (not done by this workflow).
2. Set `CHRISTMAS_RETENTION_CRON_SECRET` (or reuse `CRON_SECRET`).
3. Optionally set `CHRISTMAS_UNPAID_UPLOAD_TTL_DAYS`.
4. To actually delete: set `CHRISTMAS_RETENTION_PURGE_APPLY=true`, then `workflow_dispatch` with apply, or POST `{ "action": "purge", "apply": true }`.
5. Legal TTL for paid/Santa/kids still requires an explicit founder decision on the GAP privacy track.

## Related

- Photo funnel signed uploads: `christmas-photo-funnel` `createUpload` → `uploads/{uuid}.{ext}`
- Santa defaults: `docs/TDG_CHRISTMAS_SANTA_VIDEO.md`, job table comment on `christmas_santa_video_jobs`
- Privacy access harden (tokens, not TTL): PR `#99` / `cursor/christmas-gap-kids-privacy-577a`
