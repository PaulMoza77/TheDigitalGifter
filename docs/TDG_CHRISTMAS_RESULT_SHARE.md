# TDG Christmas durable result share

**Route:** `/share/{generation_id}?token={share_token}`

Optional hosted share for completed Christmas generation results. The result is private by default and a public read requires both an unguessable generation UUID and a high-entropy capability token.

## Privacy contract

- `share_enabled=false` by default.
- The database stores **only SHA-256 of the share token**. No plaintext, Base64, reversible ciphertext, email, owner token, media URL, or storage path is returned by the public read contract.
- Enabling/rotating returns a new plaintext token once to the owner client; refreshing owner state never recovers it from the database.
- Revocation disables the row and rotates the stored hash, invalidating the previous link.
- Public reads require paid + completed order state and the shared asset must equal the order result asset and belong to that order.
- Only assets in the private `christmas-generated` bucket are signed, for 15 minutes.
- Browser roles have no direct table access; all reads/writes are service-mediated by `christmas-result-share`.
- `/share` pages are `noindex,follow`.
- Before GA, Clarity, or Meta boot, the production origin stores the capability token in `sessionStorage` and removes the query string with `history.replaceState`; a `no-referrer` policy is injected as well.
- Share analytics use the existing `share` funnel event with an action field and explicitly omit query strings, media URLs, and capability tokens.

## Owner actions

`getOwnerShare`, `enableShare`, and `revokeShare` authenticate with the existing Christmas order `public_token`. `enableShare` creates or rotates the share capability. `revokeShare` invalidates the old capability immediately.

## Public action

`getSharedResult` accepts `generation_id` + share token and returns only product/style/asset kind plus a short-lived signed result URL.

## Activation

Migration: `20260909190000_christmas_generation_result_share.sql`.
Edge function: `christmas-result-share`.
No checkout flags or purchasable catalog values are changed by this feature.
