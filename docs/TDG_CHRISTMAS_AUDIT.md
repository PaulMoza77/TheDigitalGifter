# TDG Christmas Product Suite — Current-State Audit

**Task ID:** `tdg-christmas-audit-001`  
**Audit date:** 2026-09-02  
**Repo:** `PaulMoza77/TheDigitalGifter` (local: `TheDigitalGifter-main`)  
**Branch:** `main`  
**Base / inspected HEAD SHA:** `b5aef6bc69914d1dbaa36543293d9b5d46627759`  
**Status basis:** No prior Christmas Cursor task completed. Existing Christmas surface is marketing-only.

**Production runtime:** NOT VERIFIED IN PRODUCTION (no production credentials exercised; no live charges/emails). Evidence is code, migrations, config, and local vitest.

**Orchestrator durable state:** `.orchestrator/SEO_TOC.md`, `SEO_MASTER_STATE.md`, `CURRENT_ACTION.md`, `DECISION_LOG.md` are **absent** from this worktree. Audit proceeds from this repository as ground truth.

---

## Executive summary

The Digital Gifter is a **Vite + React 19 SPA** on **Vercel**, with **Supabase** (Postgres, Auth, Storage, Edge Functions), **Stripe Checkout Elements** (embedded Payment Element + Apple Pay / Google Pay Express), **Replicate** image/video generation, **Resend** transactional email, and **Meta CAPI / GA4 / Clarity** analytics.

**Christmas today:** a single occasion marketing page at `/christmas` that deep-links into the generic `/generator?occasion=christmas` and `/templates?occasion=christmas`. There is **no** Christmas Hub, product family routes, Santa Video, Tree/Advent, Wishlist, Gift Finder, cards/messages factory, or `/account/christmas`.

The **Pet funnel (especially Dog V2 + Cat V3)** is the strongest reusable blueprint for Christmas revenue products: upload → (optional free Replicate preview + client watermark) → offer → embedded Stripe → webhook fulfillment → async Replicate pack generation → tokenized order page + email.

**Critical corrections vs assumed brief:** live pet prices are **$27 / $8 / $12**, not **$2.99**. Preview protection is **watermark**, not Gaussian blur. Species is **route/client-declared**, not ML-validated. `pet_orders.sku` is still **hard-constrained** to `pet-secret-life-12` — a multi-SKU Christmas blocker until schema/fulfillment are generalized.

**Recommended first implementation task:** Christmas shared product + route foundation that reuses pet checkout/generation patterns **without** shipping Santa/Tree yet.

---

## 1. Repositories / architecture

| Item | Evidence |
| --- | --- |
| Remote | `origin` → `https://github.com/PaulMoza77/TheDigitalGifter.git` |
| Branch | `main` |
| HEAD | `b5aef6bc69914d1dbaa36543293d9b5d46627759` |
| Frontend | React 19 + Vite 6 + react-router-dom 7 + Tailwind — `package.json`, `vite.config.ts`, `src/App.tsx` |
| Backend/runtime | Supabase Edge Functions (Deno) under `supabase/functions/*`; Vercel Node routes under `api/*` |
| Database | Supabase Postgres — `supabase/migrations/*` |
| Auth | Supabase Auth — `src/contexts/AuthContext`, `src/pages/AuthCallback.tsx` |
| Storage | Buckets incl. `pet-source-photos`, `pet-generated`, `seo-images` (migrations / constants) |
| Stripe | `@stripe/react-stripe-js` Checkout Elements — `src/features/pet/components/CustomStripeCheckout.tsx`; Edge: `stripe-webhook`, `pet-funnel`, `_shared/pet/checkout.ts`, `_shared/pet/stripeFulfill.ts` |
| AI | Replicate — `_shared/pet/replicate.ts`, `pet-generate`, `pet-generate-video`, `pet-v2-preview`, `generate-nano-banana` |
| LLM (non-image) | OpenAI / Anthropic for support chat, blog draft, style — `support-ai-chat`, `generate-blog-draft`, `generate-style` |
| Email | Resend — `_shared/pet/email.ts` (`RESEND_API_KEY`); admin templates in `email_templates` |
| Analytics | GA4 `G-YF2GRM2TL4` (`index.html`); Meta Pixel/CAPI (`lib/metaPixel`, `_shared/pet/meta.ts`); Clarity (`index.html`); pet funnel event tables + hybrid Meta Ads / GA4 sync |
| Admin | `/admin/*` SPA — `src/pages/admin/*`, `AdminRoute` |
| iOS / native | No iOS app in this repo. `delete-my-account` comments reference App Store guideline — NOT VERIFIED as shared Christmas backend for a native Christmas rebuild |
| Deploy | Vercel — `vercel.json`, `.vercel/`; SPA rewrite to `index.html`; cron hint for `api/pet-analytics-cron.ts` |
| Preview/staging | Vercel preview implied via `scripts/vercel-ignore.mjs`; exact staging URL **NOT VERIFIED IN PRODUCTION** |
| Env structure | `.env.example` — `VITE_SUPABASE_*` client; server `SUPABASE_*`; Stripe / Meta / GA4 as Edge/Vercel secrets (never `VITE_` for secrets) |

**README note:** Root `README.md` still describes an obsolete Convex/Chef template and is **not** accurate for the current Supabase architecture.

---

## 2. Routing / page architecture

**Router:** `BrowserRouter` + declarative `<Routes>` in `src/App.tsx`.  
**Rendering:** CSR SPA. `vercel.json` rewrites non-API paths to `/index.html`.  
**Indexability without JS:** Homepage static meta/JSON-LD exists in `index.html`. Per-route `PageHead` / `SeoPage` meta are **client-set** after hydration — crawlers that do not execute JS see thin/generic HTML for most routes.

### Current page map (relevant)

| Category | Routes | Paths |
| --- | --- | --- |
| Homepage | `/` | `src/pages/website/HomePage.tsx` |
| Occasion marketing | `/christmas`, `/birthday`, … | `src/pages/website/ChristmasPage.tsx` etc. — mostly `MainPage` wrappers |
| Categories | `/categories/occasions|personal|spiritual|pets` | `src/pages/website/*CategoryPage.tsx` |
| Templates / generator | `/templates`, `/generator` | website pages + `src/domains/generator` |
| SEO data-driven | `/:pageType/:slug` (`occasion\|recipient\|style\|generator`) | `src/pages/seo/SeoPage.tsx` + `seo_pages` table |
| Blog | `/blog`, `/blog/:slug` | `src/pages/blog/*` |
| Funnel (generic) | `/funnel/*` | `src/components/funnelVersion/*` |
| Pet V1 | `/pet/dog\|cat\|other`, `/pet/create`, `/pet/checkout`, `/pet/order` | `src/features/pet/*` |
| Pet V2 | `/pet/dog-v2\|cat-v2\|other-v2` | `src/features/pet-v2/*` |
| Pet V3 | `/pet/cat-v3` | `src/features/pet-v3/*` |
| Account | `/account/dashboard`, `/account/affiliate` | `src/pages/account/*` |
| Admin | `/admin/*` | `src/pages/admin/*` |
| Legal | `/privacy`, `/terms`, `/refunds`, `/support`, `/unsubscribe` | website pages |

### Target Christmas routes vs today

| Target | Today |
| --- | --- |
| `/christmas` | Exists as occasion marketing only (`ChristmasPage` → generator) |
| `/christmas/photo-generator`, `/family`, `/couples`, `/kids`, `/pets`, `/dogs`, `/cats`, `/santa-video`, `/tree`, `/advent`, `/wishlist`, `/gift-finder`, `/cards`, `/messages`, SEO clusters, `/account/christmas`, `/tree/[shareId]`, `/wishlist/[shareId]`, `/share/[generationId]` | **Do not exist** |

**Occasion/style data model:** Templates and occasions are DB-backed (`templates`, `occasions`, `occasion_collections`). Marketing occasion pages are largely **hardcoded React pages**. SEO pages are **data-driven** via `seo_pages`.

---

## 3. Pet funnel trace (critical reuse)

### Product reality (verified in code)

| Variant | Route | Price | Preview |
| --- | --- | --- | --- |
| V1 | `/pet/dog` (also cat/other) | List **$27** (`PET_PRICE_CENTS = 2700`); expired $17 flash sale | No free Replicate preview; pay then generate |
| V2 | `/pet/dog-v2` (cat/other-v2) | **$8** (`PET_V2_PRICE_CENTS = 800`) | Free Replicate Kontext preview + **client watermark** |
| V3 | `/pet/cat-v3` | **$12** (`PET_V3_PRICE_CENTS = 1200`) | Same preview edge as V2; cat-only prompt/context |

**$2.99 is not configured anywhere in pet constants.** Do not plan Christmas pricing from that figure without a new config decision.

### End-to-end (V2 / V3 pattern — preferred Christmas template)

1. **Landing** — `PetV2FunnelPage` / `PetV3FunnelPage` + `LandingScreen`  
   - Analytics: `v2_landing_view` / `v3_landing_view` → `/api/pet-v2|v3/funnel-event`  
   - Attribution: `captureFunnelAttribution` (`src/features/pet/funnelAttribution.ts`)

2. **Upload** — `PhotoScreen` + `validateV2PhotoFile` / HEIC rejection  
   - Events: `*_upload_started|completed|failed`  
   - Local draft in `sessionStorage` / draft keys (`PET_V2_DRAFT_STORAGE_KEY`, `PET_V3_DRAFT_STORAGE_KEY`)

3. **Validation** — content-type JPEG/PNG/WebP, size ≤15MB, max edge 768 for preview  
   - **Species:** taken from route / body (`resolvePreviewContext`). V3 rejects non-cat. **No CV wrong-species detector found.**

4. **Preview** — `POST` Supabase Edge `pet-v2-preview`  
   - Provider: Replicate `black-forest-labs/flux-kontext-pro`  
   - Caps: 2/session, 5/IP/day; idempotent attempt tables `pet_v2_preview_attempts` / `pet_v3_preview_attempts`  
   - Client: `watermarkPreviewDataUrl` (PREVIEW overlay) — **not blur**  
   - Failure: mock framed photo / error categories; timeout resume via same attempt id

5. **Offer** — `OfferScreen` / pack UI (`V2PackOffer`, `V3PackOffer`)  
   - Events: `*_offer_viewed`, `*_unlock_clicked`

6. **Checkout session** — `pet-funnel` Edge actions via `petFunnelApi` / `useV3EmbeddedCheckout`  
   - Creates/reuses Stripe Checkout Session (`ui_mode` embedded/custom)  
   - Idempotency: `stripeCheckoutIdempotencyKey` in `_shared/pet/checkout.ts`  
   - Contact update: `updateOrderContact`

7. **Payment UI** — `CustomStripeCheckout.tsx`  
   - `CheckoutElementsProvider` + `PaymentElement` + `ExpressCheckoutElement` (Apple Pay / Google Pay)  
   - Custom `ApplePayButton` fallback UX  
   - Return → `/pet/order?token=…`

8. **Webhook fulfillment** — `stripe-webhook` → `handlePetStripeEvent` (`stripeFulfill.ts`)  
   - Metadata gate: SKU `pet-secret-life-12` / `product_type` pet  
   - Marks paid, records purchase events / Meta CAPI, **`enqueuePetGenerate`**

9. **Paid generation** — `pet-generate` (+ optional `pet-generate-video`)  
   - 12 scenes (`pet_order_scenes`) + up to 2 clips (`pet_order_video_clips`)  
   - Models: Flux Kontext Pro images; Seedance video when enabled  
   - Cost: `ai_cost_ledger`  
   - Retries / rate limits: `_shared/pet/replicateRateLimit.ts`

10. **Result** — `PetOrderPage` polling `orderStatusPolling`  
    - Tokenized access (no login required for order URL)  
    - Share/download: Web Share API helpers (`shareDownload.ts`) — **not** durable `/share/[id]` routes

11. **Email** — `sendPetDeliveryEmail` (Resend) when gallery ready / partial failure  
    - Deduped via `pet_email_deliveries`

### V1 differences

Landing → create (name/photo/personality) → checkout page → same Stripe/webhook/generate/order path. No free live preview step.

### Failure / retry (verified patterns)

- Preview: regenerate, timeout resume, rate-limit errors, live-disabled mock  
- Checkout: session reload, key fingerprint checks, sanitize customer errors  
- Generation: job statuses queued/running/held/failed; stalled re-enqueue from fulfill path  
- Safari Apple Pay: Express Checkout + dedicated button path in `CustomStripeCheckout` / `ApplePayButton`  
- FB/Instagram in-app browser: **no dedicated IAB payment handling code found** (only Meta UTM/source classification)

---

## 4. Payment architecture

| Topic | Finding | Evidence |
| --- | --- | --- |
| Mode | Stripe **Checkout Sessions** with **embedded/custom** UI (Payment Element + Express Checkout), not classic hosted-only redirect for V2/V3 | `CustomStripeCheckout.tsx`, `_shared/pet/checkout.ts` |
| Apple Pay / Google Pay | ExpressCheckoutElement `applePay`/`googlePay` always | `CustomStripeCheckout.tsx` |
| Card | PaymentElement | same |
| Success | `/pet/order?token=` | V3 OfferScreen / checkout hook |
| Webhook | Signature-verified `stripe-webhook` | `supabase/functions/stripe-webhook/index.ts` |
| Idempotency | Checkout keys + `processed_stripe_events` / fulfill guards | `checkout.ts`, `stripeFulfill.ts`, migrations |
| Currency | Pet USD; main credit packs EUR in `pricing_items` | constants / baseline |
| Persistence | `pet_orders`, `pet_checkout_sessions`, charged amounts / promos | migrations |
| Post-pay trigger | `enqueuePetGenerate` | `stripeFulfill.ts` |
| Upsells | Separate upsell Stripe fulfill path | `stripeUpsellFulfill.ts`, `pet_upsells` migration |
| Refund | `refunded` status on pet orders; admin tooling partial | schema / `pet-admin` |
| Abandoned checkout | Session expiry + reuse/create logic; no dedicated lifecycle email found for abandon | `checkout.ts` |

### Christmas reuse verdict

**YES, safely reusable as a pattern** for Christmas paid generators **if**:

1. New SKUs / product_types are allowed (see blocker below).  
2. Amounts are order-snapshot based (already loosened from hard 5900 → `amount_cents > 0`).  
3. Metadata + fulfill routing become product-family aware (today pet-gated).  
4. Prices live in config/DB (`pet_offers` / `pricing_items` pattern), not only TS constants.

### Explicit multi-SKU blocker

`pet_orders` still has `constraint pet_orders_sku_chk check (sku = 'pet-secret-life-12')` in `20260816160000_pet_funnel.sql` and **no later migration drops it**. Christmas products cannot share that table as-is without migration **or** a parallel `christmas_orders` table.

Main-app credit checkout (`create-checkout-session` / `create-checkout`) is a separate EUR credits path — reusable for credit packs, not ideal as the Christmas portrait SKU path without adaptation.

---

## 5. Generation pipeline

```
Upload (client / signed storage)
  → optional free preview (pet-v2-preview, Replicate Kontext, watermarked)
  → payment
  → pet-generate job (service role)
  → N scene predictions (Replicate) + webhook/poll
  → optional video clips (pet-generate-video / Seedance)
  → storage pet-generated
  → QC / skip-QC release paths
  → order page + email
  → ai_cost_ledger rows
```

| Capability | Status |
| --- | --- |
| Different pet products/styles | Scene keys + personalities; still one SKU pack |
| Family/couple/person products | Main generator / templates path (`generate-nano-banana`, `generations` table) — **separate** from pet order machine |
| Post-payment-only expensive pack | **Yes** for 12+2 |
| Free pre-pay AI | **Yes** (V2/V3 preview only; capped) |
| Video jobs | **Yes** short clips (~5s Seedance); **not** 30–60s personalized Santa speech/lip-sync |
| Async long-running | Edge invoke + job tables + order polling; user can leave and return via token/email |

### Santa Video minimum extension (proposed, not implemented)

Reuse: order + Stripe fulfill + job queue + storage + email + cost ledger.  
**Must add:** long-form video provider/job type, script/TTS, lip-sync or template compositor, child-data fields, longer timeouts/queues, configurable templates/languages, privacy defaults. Pet Seedance path is **insufficient** alone.

---

## 6. Database / Supabase schema (relevant)

### Core (baseline `20260729120000_remote_baseline.sql`)

| Table | Purpose | Christmas reuse |
| --- | --- | --- |
| `profiles` / `user_profiles` / `app_users` | Auth-linked users | YES |
| `customers` | Subscription-ish customer rows | EXTEND |
| `orders` | Credit/pack purchases | EXTEND (or parallel Christmas orders) |
| `generations` | Main generator outputs | EXTEND for Christmas images/cards |
| `credits_ledger` | Credit in/out ledger | EXTEND for rewards (see §7) |
| `pricing_items` | Configurable packs/prices | YES / EXTEND |
| `templates` / `occasions` / `occasion_collections` | Catalog | EXTEND Christmas styles |
| `seo_pages` | Programmatic SEO | YES for Christmas SEO factory |
| `blog_posts` | Blog | YES (content) |
| `email_templates` / `email_offers` / `email_preferences` | Email | EXTEND |
| `funnel_leads` | Funnel emails | EXTEND |
| `affiliate_*` | Affiliate program | YES — preserve attribution |
| `jobs` | Legacy/async jobs | EXTEND or leave |
| `admin_users` | Admin ACL | YES |
| `support_tickets*` | Support | YES |
| `upgrade_fulfillments` | Upgrade grants | EXTEND |

### Pet (`20260816160000_pet_funnel.sql` + follow-ons)

| Table | Purpose | Christmas reuse |
| --- | --- | --- |
| `pet_orders` | Paid pet orders | EXTEND pattern / **NO share as-is** (SKU check) |
| `pet_checkout_sessions` | Stripe session link | EXTEND pattern |
| `pet_order_scenes` | Image results | EXTEND pattern |
| `pet_order_video_clips` | Short videos | EXTEND pattern (not Santa) |
| `pet_generation_jobs` | Job state | EXTEND pattern |
| `pet_order_events` | Order audit log | EXTEND pattern |
| `pet_email_deliveries` | Email dedupe | EXTEND pattern |
| `pet_offers` | Offer versions/prices | YES pattern for Christmas SKUs |
| `ai_cost_ledger` | Provider cost | YES |
| `pet_*_funnel_events` / V2/V3 tables | Analytics | EXTEND → christmas events |
| `pet_v2_preview_attempts` / `pet_v3_preview_attempts` | Preview idempotency | EXTEND pattern |

**RLS:** Pet/admin/analytics tables generally service_role write; authenticated admin read policies in later migrations. Christmas tables must follow same least-privilege pattern (`20260816133000_security_least_privilege.sql`).

### Likely Christmas migrations (do not apply in this task)

- Product/SKU catalog + prices (or generalize `pet_offers`)  
- `christmas_orders` **or** drop/widen `pet_orders_sku_chk` + product_family column  
- Tree / Advent / reward claim tables  
- Wishlist + share tokens  
- Santa video jobs + PII fields  
- Christmas analytics event allowlists  
- Locale columns on SEO/products/emails

---

## 7. Credits / rewards audit

| Need | Current state |
| --- | --- |
| Credit balance | `user_profiles.credits` + ledger-derived views |
| Auditable ledger | `credits_ledger` (direction in/out, event_type, note, amounts) |
| Idempotent grant | Unique indexes on `note` for stripe/generation/invoice patterns |
| Expiry | **Not found** as first-class credit expiry |
| One-time claim protection | Not for Advent-style daily claims |
| Admin adjustment | Admin Credits page + RPCs |
| Fraud/abuse | Pet preview rate limits; not reward anti-farm |

**Verdict: EXTEND**

Tree/Advent need: reward catalog, claim ledger with unique `(user_or_device, reward_id, day)`, optional credit grant via existing ledger notes, share tokens, anti-abuse (IP/device), and **do not** overload pet order SKU.

---

## 8. Account area

| Capability | Exists? |
| --- | --- |
| Login / auth | Yes — Supabase Auth + `/auth/callback` |
| Generations | `AccountDashboard` + `RecentGenerations` + `PetsGenerations` |
| Purchase history | Partial via orders/credits; pet via order token + admin |
| Credit balance | Yes |
| Downloads / share | Generation cards + pet share helpers |
| Deletion | `delete-my-account` Edge (profiles/affiliate/credits cleanup; **not** full pet media purge evidence) |
| Affiliate UI | `/account/affiliate` |

**`/account/christmas`:** should be a tab/section under `ClientLayout` / `AccountDashboard`, composing Christmas generations, Santa videos, tree, wishlist, rewards — **new components**, reuse gallery patterns from `PetsGenerations`.

---

## 9. Admin audit + Christmas gap

**Exists:** dashboard, templates, blog, pricing, customers, orders, pet-orders, pet-funnel-analytics, credits, support tickets, email templates/offers/campaigns, funnel style admin, AI cost section.

**Christmas gaps:** product-family filters, Santa jobs, Tree/Advent claims, Gift Finder usage, locale, Christmas AOV/upsell, checkout-start funnel by Christmas SKU, SEO cluster status. Pet analytics is the closest dashboard to clone.

---

## 10. Analytics audit

### Existing event vocabularies

- V1: `landing_view`, `photo_upload_*`, `initiate_checkout`, `purchase`, … — `funnelEventContract.ts`  
- V2: `v2_landing_view` … `v2_purchase` — `pet-v2/types.ts`  
- V3: `v3_*` including `v3_checkout_viewed` — `pet-v3/types.ts`  
- Storage: Postgres funnel event tables + Meta CAPI purchase + GA4 pageviews + Clarity  
- Attribution fields: UTMs, fbclid, campaign/adset/ad ids — first-touch store `tdg.funnel.attribution.v1`

### Christmas target mapping (recommended)

Reuse pet ingest pattern (`/api/christmas/funnel-event` + allowlist + idempotency):

| Christmas event | Closest existing |
| --- | --- |
| `christmas_page_view` | `landing_view` / `v2_landing_view` |
| `upload_*` | `photo_upload_*` / `v2_upload_*` |
| `preview_seen` | `v2_preview_viewed` |
| `offer_seen` | `v2_offer_viewed` |
| `checkout_started` / `payment_sheet_opened` | `initiate_checkout` / `v2_begin_checkout` / `v3_checkout_viewed` |
| `purchase` | `purchase` / `v2_purchase` / `v3_purchase` |
| `generation_*` | preview + paid job events (extend) |
| `santa_*`, `tree_*`, `gift_finder_*` | **new** |

Purchase↔acquisition join: pet hybrid analytics already joins funnel sessions + Meta campaign allowlist — **clone for Christmas** with separate allowlists.

---

## 11. SEO audit

| Feature | Status | Evidence |
| --- | --- | --- |
| Title/description/OG/Twitter/canonical | Client `PageHead` / `SeoPage` | `src/components/PageHead.tsx`, `SeoPage.tsx` |
| Structured data / FAQ | Homepage `index.html` JSON-LD; SeoPage FAQPage JSON-LD | same |
| Sitemap | Dynamic `/sitemap.xml` → `api/sitemap.xml.ts` (static + `seo_pages` + blog) | `/christmas` **not** in static list today |
| robots.txt | Allow `/`; disallow admin/account/funnel payment/result | `public/robots.txt` |
| Data-driven SEO | `seo_pages` by page_type+slug | Yes |
| Googlebot HTML | SPA shell — **weak** for deep Christmas programmatic pages without SSR/prerender | `vercel.json` rewrite |

**Christmas SEO factory recommendation:** extend `seo_pages` (or `christmas_seo_pages`) with `cluster` (`gifts-for`, `messages-for`), `locale`, template fields; add SSR/prerender or edge HTML for indexability; register routes under `/christmas/...` **or** map `page_type` carefully to avoid colliding with `/:pageType/:slug`; include in sitemap.

Do **not** mass-create pages in this task.

---

## 12. i18n audit

| Item | Finding |
| --- | --- |
| Library | **None** (no i18next/next-intl) |
| URL locale | **None** (`lang="en"` fixed in `index.html`) |
| Translation files | **None** |
| Language list | `src/data/languages.ts` + generator `LanguageSelector` — prompt language hint only |
| Localized metadata / email / hreflang | **Not implemented** |
| AI prompts | English hardcoded (pet preview prompts, etc.) |

**Before Christmas EN+RO:** introduce locale routing or subdomain strategy, message catalogs, localized SEO rows, localized emails, localized Santa/scripts, hreflang. Hardcoded English UI is a **refactor prerequisite** for RO launch quality — can ship EN-only hub first if product accepts sequenced i18n.

**Verdict:** EXTEND / introduce i18n layer; do not pretend RO exists.

---

## 13. Email audit

| Piece | Status |
| --- | --- |
| Provider | Resend |
| Pet gallery ready | `pet_gallery_ready` template + default HTML |
| Admin email CRM | templates / offers / campaigns UI |
| Preferences / unsubscribe | `email_preferences`, `/unsubscribe` |
| Purchase receipt / abandon / marketing lifecycle | Partial / gaps for Christmas-specific flows |

**Reusable:** Resend send path, template table, delivery dedupe table pattern.  
**Gaps:** Christmas purchase/gen/abandon/Advent/cross-sell templates; RO localization; consent rigor for marketing.

---

## 14. Privacy / child data gaps (product-security, not legal advice)

- Pet orders are email+token based; share is often **anyone with link/file**.  
- Default for future Kids/Santa must be **PRIVATE unless explicit share**.  
- `delete-my-account` does not evidence wiping `pet_orders` media / generations comprehensively.  
- No dedicated child-consent / parental gate found.  
- Moderation: content policy for intimate templates (`contentPolicy.ts`); not child-safety classifier.  
- Retention policies for uploads/results: operational defaults unclear in code — **NOT VERIFIED IN PRODUCTION**.  
- Santa/Kids need: private-by-default ACL, explicit share tokens, retention TTL, deletion covering media, minimized PII, admin access controls.

---

## 15. Christmas Tree / Advent feasibility

**Build later.** Minimum architecture on existing stack:

- Tables: `christmas_trees` (owner, share_id, visibility, state jsonb decorations), `advent_rewards`, `advent_claims` (unique claim), optional credit grant → `credits_ledger`  
- API: Edge functions with RLS/service role  
- Anti-abuse: auth or device binding + rate limit (`touch_edge_rate_limit` pattern)  
- Share: public route `/tree/[shareId]` (new) reusing token hash pattern from `pet_orders.public_token_hash`

**Credits infra:** EXTEND (sufficient ledger core; missing claim/reward domain).

---

## 16. Wishlist feasibility

Minimum model: `wishlists(id, owner_id, title, share_id, visibility)`, `wishlist_items(… note, url, priority, budget)`.  
Reuse: tokenized public read like pet order tokens; **no** existing wishlist/shareId tables found. Web Share helpers are insufficient alone.

---

## 17. Gift Finder feasibility

LLM already used (OpenAI/Anthropic) in Edge functions — **suitable** for suggestion JSON.  
Minimal: one Edge function + Zod schema + optional log table + CTA links into Christmas SKUs. No new vector DB required for v1.

---

## 18. Santa Video feasibility (deep)

| Question | Answer |
| --- | --- |
| Personalized Santa pipeline? | **No** |
| Video today? | Pet short Seedance clips post-pay only |
| Speech / lip-sync? | **Not present** |
| Integration seams | New job type beside `pet-generate-video`; Stripe metadata product_type; storage bucket; email; account gallery |

**Proposed (not implemented) providers:** any async video/TTS/avatar vendor — choose in a later task.  
Pricing must be DB/config-driven like `pet_offers`, not hardcoded.

---

## 19. Product / pricing config

| Path | Role |
| --- | --- |
| `pricing_items` + admin pricing manager | Main credit packs (EUR) |
| `pet_offers` + TS constants + flash sale modules | Pet SKU amounts |
| Upsells | `pet` upsells module |

Christmas needs a **product catalog abstraction** (product, package, price, sale price, currency, included generations, styles, upsells, active, locale) — prefer extending `pricing_items` / offer tables rather than more hardcoded cents in React.

---

## 20. Performance (code-level only)

- Free preview: Replicate poll ~90s budget; client watermark after — **no measured 3–5s prod latency in repo**.  
- Paid pack: multi-scene async; user leaves OK with token/email.  
- SPA landing: Vite bundle; pet routes under FunnelLayout.  
Bottlenecks likely: Replicate queue, Edge wall-clock, large data URLs for preview — **NOT VERIFIED IN PRODUCTION**.

---

## 21. Attribution / affiliate

- Funnel UTMs/fbclid/campaign ids persisted client-side and ingested with events.  
- Affiliate: `?ref=` → `affiliate_clicks` / conversions on auth (`App.tsx`).  
- Christmas must pass attribution through checkout metadata like pet — **do not** wipe `affiliate_ref` or funnel attribution store.

---

## 22. Tests / CI / release

| Layer | Status |
| --- | --- |
| Unit | Vitest — **48 files / 360 tests passed** locally on audit machine |
| E2E | No Playwright/Cypress found |
| CI | **No `.github/workflows`** in repo |
| Deploy | Vercel |
| Rollback | Vercel deployment rollback — **NOT VERIFIED IN PRODUCTION** |

**Future Christmas gates:** A generator, B payment browsers, C Santa, D Tree, E SEO — as specified in the brief; automate unit/contract tests first (pet style), then manual GATE checklists.

---

## 23. Gap matrix

| Capability | Existing reusable | Gap | Risk | Dependency | Priority | Complexity | Task order |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Christmas Hub | `/christmas` MainPage | Suite IA + CTAs | Low | Routes + catalog | P0 | S | 1 |
| Shared product foundation | `pricing_items`, `pet_offers`, Stripe fulfill pattern | Multi-SKU schema, product_family | **High** | Migration | P0 | M | 1 |
| Photo generator | Pet V2/V3 + main generator | Christmas styles/prompts/routes | Med | Foundation | P0 | L | 2 |
| Family/Couples/Kids routes | Templates + generator | Dedicated funnels + privacy | Med/High kids | Photo gen | P0 | L | 3 |
| Pets/dogs/cats Christmas | Pet funnel | Christmas skins/SKU or deep-link pet | Low | Hub | P0 | S–M | 3 |
| Checkout/payment | Stripe Elements pet | Christmas metadata/SKU | High if SKU blocked | Foundation | P0 | M | 2 |
| Result/delivery | Order page + Resend | Christmas templates/URLs | Med | Payment | P0 | M | 2 |
| Analytics | Funnel ingest + Meta/GA4 | Christmas event schema | Med | Ingest clone | P0 | M | 2 |
| Admin observability | Pet orders/analytics | Christmas filters/KPIs | Med | Events | P0 | M | 4 |
| Santa Video | Short pet video + jobs | Full personalized video stack | **High** | Payment + privacy | P1 | XL | 5 |
| Tree / Advent | Credits ledger | Reward domain + share | Med | Credits EXTEND | P1 | L | 6 |
| Wishlist | Token share pattern | Data model + UI | Low | Share routes | P2 | M | 7 |
| Gift Finder | OpenAI/Anthropic Edge | Prompt+UX+logging | Low | LLM secrets | P2 | M | 7 |
| Cards / messages | Templates/generator | Productized flows | Med | Generator | P2 | L | 8 |
| SEO factory | `seo_pages` + sitemap | Clusters + indexable HTML + locales | High SEO | i18n/SSR decision | P2 | L | 8 |
| i18n EN+RO | Language list only | Full i18n architecture | High | Early decision | P0–P2 | L | 1b / parallel |
| Account Christmas | Account dashboard | Section composition | Low | Products exist | P1 | M | 4 |
| Lifecycle email | Resend + templates | Christmas journeys | Med | Products | P2 | M | 9 |
| Attribution harden | Funnel + affiliate | Christmas metadata parity | Med | Checkout | P0 | S | 2 |

---

## 24. Dependency graph

```
[Christmas product/SKU foundation + pricing]
        ├─→ [Hub routes IA]
        ├─→ [Photo generator funnel clone of Pet V2/V3]
        │         ├─→ [Family/Couples/Kids/Pet Christmas skins]
        │         ├─→ [Checkout metadata + fulfill]
        │         ├─→ [Result + email]
        │         └─→ [Analytics + admin]
        ├─→ [i18n EN+RO scaffolding] (parallel after foundation; hard-block for RO SEO/Santa copy)
        ├─→ [Santa Video jobs] (needs payment + privacy)
        ├─→ [Tree/Advent + credits claims]
        └─→ [Wishlist / Gift Finder / Cards / SEO factory / lifecycle]
```

**Reorder vs brief:** Insert **multi-SKU / product foundation before Hub polish** if Hub CTAs would otherwise hit non-existent products. Keep Santa after revenue photo core. Tree after credits claim design. SEO factory after route + locale decisions (indexability).

---

## 25. Recommended build order (verified)

1. **P0 foundation** — Christmas product catalog + order/SKU model (fix pet SKU check or parallel tables) + configurable prices  
2. **P0 Hub + Photo Generator** — routes under `/christmas/*`, reuse pet preview→pay→generate  
3. **P0 checkout/result/analytics/admin** — metadata, events, dashboards  
4. **P0 Family/Couple/Pet route reuse**  
5. **P1 Santa Video** (+ privacy)  
6. **P1 Tree/Advent**  
7. **P2 Gift Finder / Wishlist / Cards / Messages**  
8. **P2 SEO factory + multilingual SEO + lifecycle email**

---

## 26. Explicit blockers

1. `pet_orders_sku_chk` single-SKU constraint  
2. Pet fulfill metadata hard-gated to pet SKU/product_type  
3. No i18n framework for RO  
4. SPA SEO indexability gap for programmatic pages  
5. No Santa long-form video pipeline  
6. Credits lack Advent claim semantics  
7. Child/Kids privacy defaults and deletion gaps  
8. Orchestrator durable files missing in this worktree (process only)  
9. Production behavior **NOT VERIFIED IN PRODUCTION**

---

## 27. Exact next recommended implementation task

**Task ID:** `tdg-christmas-foundation-001`  

**Title:** Christmas shared product foundation (catalog + multi-SKU order model + route stubs)

**Scope:**

1. Design/add Christmas product + price config (DB and/or admin-managed), without enabling paid live generation yet.  
2. Resolve SKU storage: parallel `christmas_orders` **or** migration widening `pet_orders` product model — pick one with written ADR in docs.  
3. Add non-functional route stubs under `/christmas/*` matching the target IA (Hub + photo-generator placeholders) that do not regress `/christmas` marketing CTA until cutover.  
4. Define Christmas analytics event allowlist contract (mirror pet V3).  
5. No Santa/Tree/Wishlist implementation; no production price go-live without GATE A plan.

**Exit:** foundation merged with tests; orchestrator can issue `tdg-christmas-photo-generator-001`.

---

## 28. Non-goals (confirmed)

No marketplace, 20-language launch, native iOS Christmas rebuild, new CRM, dozens of Santa avatars, 100 styles, or infrastructure rewrite without dependency.

---

## Evidence index

- HEAD: `git rev-parse HEAD` → `b5aef6bc69914d1dbaa36543293d9b5d46627759`  
- Routes: `src/App.tsx`  
- Christmas page: `src/pages/website/ChristmasPage.tsx`  
- Pet prices: `src/features/pet/types.ts`, `pet-v2/types.ts`, `pet-v3/types.ts`, `supabase/functions/_shared/pet/constants.ts`  
- Checkout UI: `src/features/pet/components/CustomStripeCheckout.tsx`  
- Fulfill: `supabase/functions/_shared/pet/stripeFulfill.ts`  
- Preview: `supabase/functions/pet-v2-preview/index.ts`, `src/features/pet-v2/watermark.ts`  
- Schema: `supabase/migrations/20260729120000_remote_baseline.sql`, `20260816160000_pet_funnel.sql`  
- SEO: `src/pages/seo/SeoPage.tsx`, `api/sitemap.xml.ts`, `public/robots.txt`  
- Email: `supabase/functions/_shared/pet/email.ts`  
- Tests: `npm test` → 48 files, 360 passed (2026-09-02)
