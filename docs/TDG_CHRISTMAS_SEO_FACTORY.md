# Christmas SEO factory (`gifts-for` / `messages-for`)

**Task:** `CHRISTMAS-033` / programmatic cluster pages  
**Status:** Data-driven cluster pages on `seo_pages`. Checkout unchanged (`purchasable=false`). No production push in this change.

## Goal

Indexable Christmas cluster pages with locale-aware metadata:

| Cluster | Paths | CTA |
| --- | --- | --- |
| `gifts-for` | `/christmas/gifts-for-{mom,dad,partner,friend,kids,coworkers,grandparents}` | Gift Finder |
| `messages-for` | `/christmas/messages-for-{mom,dad,boyfriend,girlfriend,coworkers,customers}` | Message generator |
| `messages-intent` | `/christmas/funny-christmas-messages`, `romantic-…`, `professional-…`, `short-christmas-wishes`, `christmas-messages-for-family` | Message generator |

Romanian alternates live under `/ro/christmas/...` with `hreflang`.

## Indexability

- **SSR HTML** from `api/christmas-seo.ts` (service-role read of `seo_pages`)
- Vercel rewrites those paths to the handler **before** the SPA catch-all
- Mozas origin classifies the same paths as `christmas-seo.ts` so refresh is not an empty shell
- Sitemap includes cluster URLs + xhtml hreflang when service role is present
- Client route still exists for in-app navigation and also reads `seo_pages` (no mock runtime catalog)

## Data

Migration `20260909200000_christmas_seo_factory.sql` extends `seo_pages` with `locale`, `cluster`, `canonical_path`, `sections`, `cta_href` and seeds 18 × 2 locale rows.

Runtime never falls back to the TypeScript copy corpus. The corpus is the seed source and the thin-page guard.

## Founder gates

- No checkout, Apple Pay, or purchasable SKUs on cluster pages
- Kids page stays a parent-facing guide; `/christmas/kids` remains coming-soon
- No “Santa is watching” copy
