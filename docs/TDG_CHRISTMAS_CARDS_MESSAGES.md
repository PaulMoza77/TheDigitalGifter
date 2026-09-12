# Christmas Cards + Message Generator

**Task:** `tdg-christmas-cards-messages-011`  
**Status:** Free acquisition/creation pair — Christmas checkout unchanged (`checkout_live=false`, paid packages `purchasable=false`)

## Product loop

need Christmas wording → **Message Generator** → choose/edit → **Card** with message → optional photo → style/layout → render PNG → download/share → Portrait / Wishlist / Tree

## Routes

| Route | Indexable | Notes |
|-------|-----------|-------|
| `/christmas/messages` | yes | Guided generator EN+RO |
| `/christmas/cards` | yes | Free digital card editor |

## Message Generator

- Guided inputs: recipient, tone, length, language (EN/RO), optional custom detail / relationship
- Returns **3** alternatives with `result_key`, text, tone, length, recipient, language
- Actions: Copy · Use in Christmas Card · Generate different ideas
- Server-owned prompts/templates: `supabase/functions/_shared/christmas/messageGenerator.ts`
- Edge: `christmas-cards-messages-funnel` (`runMessageGenerator`, session recovery, admin stats)
- OpenAI when `OPENAI_API_KEY` works → **curated high-quality fallback** on quota/billing/parse failure
- Never claim unique AI authorship when `used_fallback=true`
- Persistence: `christmas_message_sessions` + `christmas_message_results`
- Guest token hashed (SHA-256); rate limit **10 sessions / hour / rate_bucket**
- Refresh reuses completed session when `session_id` present and `force_new` is false
- Explicit regenerate sets `force_new` and creates a new attempt
- Analytics never include message text or custom_detail

### Languages

- `en`, `ro` (Romanian with proper diacritics in curated bank)
- No DE/FR/etc in V1

### Taxonomy / SEO seam

Centralized in `src/features/christmas/cards/taxonomy.ts` (+ server `messageTaxonomy.ts`).  
Stable recipient / tone / length keys + `seoSlug` / `SEO_MESSAGE_INTENT_SLUGS` for a future factory.  
**Programmatic SEO factory is NOT built in this task.**

### Safety

- Custom detail length capped (~180–200 chars)
- Injection / harassment / CSAM / self-harm / weapons patterns rejected server-side
- Custom detail treated as data appended carefully — never as system instructions
- No manipulative “Santa is watching” threats to children in templates

## Cards

- Photo optional; text-only supported
- Styles (8): `classic_christmas`, `elegant_gold`, `cozy_christmas`, `winter_wonderland`, `minimal_christmas`, `vintage_christmas`, `playful_christmas`, `romantic_christmas`
- Layouts: `square` 1080×1080 · `story` 1080×1920 · `landscape` 1600×900
- Renderer: client Canvas 2D → PNG (`cardRenderer.ts`) — **$0 AI**
- See ADR: `docs/architecture/TDG_CHRISTMAS_CARD_RENDERING_ADR.md`
- Persistence: `christmas_card_projects` (+ optional `christmas_card_assets` metadata rows)
- Guest owner token (opaque, hashed); logged-in users associate via `user_id`
- Download filename: `tdg-christmas-card-<project-ref>-<layout>.png` (no recipient names)
- Share: Web Share files API when available → download fallback
- No public card gallery / hosted share page in V1
- Source photos stay on-device for V1 render; not published anonymously

## Message → Card handoff

1. Message Generator writes sessionStorage handoff (`tdg.christmas.message.handoff.v1`) with result id + text + session
2. Navigates to `/christmas/cards?from_message=1` (message body **not** in query string)
3. Cards page prefills message; draft also persisted in `localStorage` for refresh recovery

## Analytics (privacy)

**Messages:** `christmas_message_page_view`, `message_generator_started|completed|failed`, `message_copied`, `message_to_card`, `message_regenerated`  
Dimensions: recipient/tone/length/language/provider/fallback — never free text.

**Cards:** `christmas_card_page_view`, `card_creation_started`, style/layout/photo/message/preview/generated/download/share/create_another  
Dimensions: style_key, layout, photo_present, message_source, guest/auth — never message/name/photo URL.

## Admin

Christmas admin loads aggregate `adminMessageStats` / `adminCardStats` (sessions, fallback, cost, card renders/downloads/shares). Private message bodies and photos are not shown by default.

## Cost

| Path | Cost |
|------|------|
| OpenAI message gen | recorded when tokens available; else `cost_state=unknown/estimated` |
| Curated fallback | `cost_usd=0`, `provider=server_curated` |
| Card PNG render | `render_cost_usd=0` |

## Retention

| Object | Default |
|--------|---------|
| Message sessions/results | Keep for product analytics; no indefinite PII — custom detail length only, not full free text on session |
| Card projects | Guest recovery via hashed token; configurable purge later |
| Client PNG / photo | Device-local for V1 download; server asset rows may store dimensions only |
| No destructive cleanup cron shipped | Documented; add cron when policy finalized |

## Commerce

- Free preview/generation V1
- Catalog metadata: `cards_v1` / `messages_v1`, `live_offer=false`, `checkout_live=false`
- No production price activation

## Migrations / functions

- `supabase/migrations/20260904010000_christmas_cards_messages.sql`
- `supabase/functions/christmas-cards-messages-funnel`
- `verify_jwt = false` in `supabase/config.toml` (auth optional; service role for writes)

## Non-goals (this task)

Full SEO factory · DE/ES/FR · print fulfillment · paid packs · checkout activation · public gallery · affiliate marketplace
