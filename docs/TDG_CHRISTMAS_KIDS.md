# TDG Kids Christmas Generator (privacy-first)

**Task:** `tdg-kids-christmas-product-privacy-first`  
**Product key:** `christmas_kids`  
**Route:** `/christmas/kids`  
**Activation:** Real funnel live (upload → style → blur preview → offer). **production purchasable=false**; **checkout live=false**. No invented prices. Founder gate respected.

## What shipped

`/christmas/kids` is no longer a coming-soon shell. It uses the shared `ChristmasPortraitFunnelPage` with kids-specific styles, **required parent/guardian consent**, **noindex**, and **no public gallery**.

HARDEN-007 (token/media IDOR, ciphertext tokens) is a separate privacy harden — not this product launch.

## Consent

Required before upload and before checkout.

- Version: `kids_v1_2026_09`
- Label stored with `guardian_consent`, `consent_version`, `consented_at` on `christmas_orders`
- Server rejects kids `createUpload` and `christmas-checkout` without consent
- Generation refuses kids orders without recorded consent

No child names or free-text are collected on this product. Analytics use product/style/package/consent-version only.

## Private-by-default ACL

- Source + generated buckets remain **private** (signed URLs / service role only)
- Kids uploads land under `uploads/kids/`
- Kids orders have `visibility=private` (DB check: kids cannot be `token_share`)
- `public_gallery=false` on order/asset metadata
- Result page has no public share URL (file share only if the device supports it)
- Route is **noindex,nofollow** and `Disallow: /christmas/kids` in `robots.txt`
- Not listed in `sitemap.xml` static paths

Token-proof media access remains HARDEN-007 / existing order-token recovery — this launch does not reopen public galleries.

## Retention policy (decided for V1)

Not legal advice. Child-face media is retained **shorter** than Santa video (365d).

| Asset | Window | Notes |
| --- | --- | --- |
| Unpaid / abandoned source upload | **7 days** | `retention_delete_after` set at checkout draft |
| Paid source photo | **30 days** after payment / generation | Prefix `uploads/kids/` |
| Generated portrait | **90 days** from generation complete | Private download via order token |
| Consent / order audit fields | **24 months** | Version + timestamp only; no child name |

Cleanup cron can be layered later against `retention_delete_after`. Parent/guardian deletion requests go through support and must wipe source + generated objects.

Env overrides (optional, later): none required for V1; constants live in `kidsPrivacy.ts`.

## Commerce

Draft package `single`: `price_cents=0`, `purchasable=false`. Checkout remains gated by `CHRISTMAS_CHECKOUT_ENABLED` and package flags. Do not production-push prices from this task.

## Styles

Eight child-safe, age-preserving styles in `portraitStyles.ts` + server `portraitPromptRegistry.ts`. Browser never submits prompt text. Prompts forbid age-up, adult makeup, and sexualized styling.

## Admin

`/admin/christmas-orders` filter includes Kids (`christmas_kids`).

## Non-goals

- Live purchasable price
- Public marketing gallery
- HARDEN-007 token ciphertext migration
- Applying this migration to production from this agent
