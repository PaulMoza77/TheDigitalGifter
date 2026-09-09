# TDG Christmas durable result share

**Task:** `TDG-CHRISTMAS-GAP-RESULT-SHARE-009`  
**Route:** `/share/:generationId?token=`

Optional hosted share for a completed Christmas generation. Results stay **private by default**. Public read is token-gated. Share pages are `noindex`.

## Contract

| Concern | Rule |
| --- | --- |
| Default | `share_enabled=false` (no public read) |
| Public URL | `/share/{generation_id}?token={share_token}` |
| Token | High-entropy; stored as SHA-256 hash (+ soft ciphertext for owner recovery) |
| Revoke | Owner sets `share_enabled=false`, rotates token hash so old links die |
| SEO | `noindex,follow` + `robots.txt` `Disallow: /share` |
| Analytics | `result_share_enabled`, `result_share_revoked`, `shared_result_view` — no media URLs or tokens |

`generationId` in the path is the share row id, not a guessable sequential key. Path alone is insufficient: missing/wrong token returns the same unavailable state as a disabled share.

Owner enable/revoke uses the existing Christmas order `public_token` (service-mediated). Shared reads never return the owner token, storage path, or email.

## Service

Edge: `christmas-result-share` (service role only for Supabase).

Actions: `getSharedResult`, `getOwnerShare`, `enableShare`, `revokeShare`.

Media stays in private buckets (`christmas-generated`). Public viewers receive a short-lived signed URL.

## Activation

No checkout or purchasable-flag changes. Founder checkout kill switch is untouched.

## Migration

`20260909190000_christmas_generation_result_share.sql` — additive `christmas_generation_shares`.
