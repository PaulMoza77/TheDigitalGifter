# Christmas Cards + Message Generator

**Task:** `tdg-christmas-cards-messages-011`  
**Status:** Free acquisition/creation pair — checkout unchanged/off

## Product loop

need Christmas wording → **Message Generator** → choose/edit → **Card** with message → optional photo → style/layout → render PNG → download/share → Portrait / Wishlist / Tree

## Routes

| Route | Indexable | Notes |
|-------|-----------|-------|
| `/christmas/messages` | yes | Guided generator EN+RO |
| `/christmas/cards` | yes | Free digital card editor |

## Message Generator

- Guided inputs: recipient, tone, length, language (EN/RO), optional custom detail
- Returns **3** alternatives
- Actions: Copy · Use in Christmas Card · Generate different ideas
- Server-owned prompts/templates in `christmas-cards-messages-funnel`
- OpenAI when configured → **curated high-quality fallback** on quota/billing failure
- Persistence: `christmas_message_sessions` + `christmas_message_results`
- Guest token hashed; rate limit 10/hour/bucket
- Analytics never include message text or custom_detail

### Languages

- `message_languages: en, ro` (RO with diacritics)
- No DE/FR/etc in V1

### Taxonomy / SEO seam

Centralized in `src/features/christmas/cards/taxonomy.ts` (+ server mirror).  
Future factory can consume `seoSlug` / `MESSAGE_SEO_INTENT_SLUGS` — **factory not built**.

## Cards

- Photo optional; text-only supported
- Styles: classic, elegant gold, cozy, winter, minimal, vintage, playful, romantic
- Layouts: square 1080×1080, story 1080×1920, landscape 1600×900
- **Renderer:** client canvas → real PNG (`cardRenderer.ts`) — $0 AI cost
- Guest project ownership via hashed owner token
- Message → Card handoff via `sessionStorage` result id (not full message in query string)
- Download filename: `tdg-christmas-card-<project-ref>-<layout>.png`
- Share: Web Share file API with download fallback
- No public card gallery / share pages

## Commerce

- Cards/messages are free experiences
- Paid Christmas products remain `purchasable=false`
- `checkout_live=false`
- Live charges: NONE

## Security / privacy

- Message/card tables: RLS; anon revoked; service role via edge
- User message drawn as canvas text (not HTML)
- Photo validation: jpeg/png/webp ≤ 8MB
- Private storage bucket `christmas-cards` (optional persistence seam)
- Retention: documented as configurable; no infinite public gallery

## Analytics

Messages: `christmas_message_page_view`, `message_generator_*`, `message_copied`, `message_to_card`, `message_regenerated`  
Cards: `christmas_card_page_view`, `card_*` style/layout/photo/message/preview/generated/download/share/create_another

## Admin

Christmas admin aggregates for message sessions and card projects (no bodies/photos by default).

## Retention

| Artifact | Default | Notes |
|----------|---------|-------|
| Message sessions/results | Soft retention policy (configurable) | Guest hash only; no long-term custom_detail body |
| Card projects | Soft retention | Guest owner token hashed; message text for owner recovery |
| Source photos | Browser-local in V1 | Not uploaded/public by default |
| Rendered PNG | Client download; optional private `christmas-cards` bucket seam | No public gallery |
| Guest recovery tokens | Client localStorage | Server stores SHA-256 only |

No infinite public child/photo gallery. Destructive cleanup cron not required for V1; document + safe defaults.

## QA notes

- OpenAI quota → curated fallback is a **known limitation**, not a product failure when messages remain useful.
- Card render_cost = $0 (canvas composition).
- Paid Christmas products remain non-purchasable; checkout_live=false.

## Retention

| Asset | Default | Notes |
|-------|---------|-------|
| Message sessions/results | keep while useful for refresh/handoff; guest token hashed | No custom_detail body stored beyond length |
| Card projects | metadata + counts | Message text on project for owner recovery |
| Source photos | private; not public by default | Prefer client-only for V1 download when possible |
| Rendered PNGs | client download primary | Server asset rows track dimensions/counts |
| Guest projects | owner token hashed | Configurable purge later; no public gallery |

No destructive cleanup cron in V1 — document + safe private defaults.

## Activation

Deploy edge `christmas-cards-messages-funnel` + migration `20260904010000_christmas_cards_messages.sql` + Mozas frontend.
