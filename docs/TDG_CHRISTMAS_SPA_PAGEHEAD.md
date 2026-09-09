# Christmas SPA PageHead SEO basics

**Task:** `CHRISTMAS-032` (`tdg-per-vertical-spa-pagehead-seo-basics`)  
**Status:** Live hub + verticals set unique client `PageHead` tags. Factory pages are **CHRISTMAS-033**.

## Decision

Reuse the existing SPA head manager (`src/components/PageHead.tsx`). Do not add a second helmet, prerender, or `seo_pages` factory in this task.

Contract: `src/features/christmas/seo/christmasPageHead.ts`.

## Live surfaces

| Route | Indexable | Notes |
|-------|-----------|-------|
| `/christmas` | yes | Hub — unique title/description/canonical/OG |
| `/christmas/photo-generator` | yes | Portrait vertical |
| `/christmas/family` | yes | Portrait vertical |
| `/christmas/couples` | yes | Portrait vertical |
| `/christmas/pets` | yes | Portrait vertical |
| `/christmas/dogs` | yes | Portrait vertical |
| `/christmas/cats` | yes | Portrait vertical |
| `/christmas/santa-video` | yes | Santa Video |
| `/christmas/tree` | yes | Creator |
| `/christmas/advent` | yes | Advent calendar |
| `/christmas/wishlist` | yes | Creator |
| `/christmas/gift-finder` | yes | `/christmas/gifts` aliases this canonical |
| `/christmas/cards` | yes | `indexable=true` |
| `/christmas/messages` | yes | `indexable=true` |
| `/christmas/kids` | no | Coming-soon shell |
| `/christmas/tree/:shareId` | no | Personal tree share |
| `/wishlist/:shareId` | no | Personal wishlist share |

Share/tree personal pages set `noindex,follow` so “create your own” links stay crawlable.

## Known SPA limitation

Client-updated tags are **not SSR HTML**. `PageHead` writes `title`, description, canonical, OG/Twitter, and robots after hydration. Crawlers that do not execute JavaScript see the generic `index.html` shell.

This task does **not** add prerender/SSR. Programmatic factory pages (`gifts-for-*`, `messages-for-*`) are **CHRISTMAS-033**.

## Sitemap

Indexable Christmas paths are listed in `api/sitemap.xml.ts` `STATIC_PATHS`. Share URLs and `/christmas/kids` are omitted.
