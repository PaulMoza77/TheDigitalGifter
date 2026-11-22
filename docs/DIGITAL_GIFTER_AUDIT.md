# Digital Gifter — Mission 01 Repository Audit

**Date:** 2026-11-22  
**Workspace:** `/Users/paul/tdg-santa-recovery.DoJBcY` (symlink recovery of TheDigitalGifter)  
**Branch:** `feature/christmas-story-mvp`  
**Scope:** Full product audit before implementing the **Our Christmas Story** ($57) conversion-first MVP.

---

## 1. Existing architecture

| Layer | Stack |
| --- | --- |
| Frontend | React 19 + Vite 6 SPA (`src/`), React Router 7, Tailwind 3, Framer Motion, Radix |
| API (origin) | Node handlers under `api/` on Mozas VPS (analytics, compose, long-form, clip factory) |
| Backend | Supabase Auth + Postgres + Storage + Edge Functions |
| Payments | Stripe Custom Checkout Elements; Christmas commerce via `christmas-checkout`; Santa Call has isolated TEST/LIVE |
| Media | Replicate (portraits, Seedance), FFmpeg on VPS (Santa compose, long-form), no Remotion, **no Suno** |
| Deploy | Production is **VPS-only** (`thedigitalgifter.com`); North Star forbids alternate frontend hosts |

Working tree note: branch was cut from `fix/santa-call-unlimited-extensions` which had local Santa Call QA + christmas-express asset churn. Mission 01 commits **only** Christmas Story files; Santa Call dirt is left untouched.

---

## 2. Current working functionality (relevant)

- Christmas suite: photo generator, portrait verticals, Santa video, Santa Call, tree/advent, wishlist, gift finder, cards/messages, planner ($17 Founding Pass), send-a-gift helper.
- Commerce foundation: `christmas_orders`, packages, funnel events, kill-switched checkout.
- Private result share via capability tokens (`/share/:id`).
- Gift-tree unwrap ceremony UI (`GiftOpenCeremony`).
- Long-form Studio music **import** (admin), not customer song generation.
- Analytics allowlist + Meta/GA4 consent-aware wiring.

---

## 3. Missing functionality (Mission 01)

1. Premium offer **Our Christmas Story · $57** as a distinct SKU / product key.
2. Conversion landing with real interactive demo (not AI-tool listing).
3. Progressive 3-question creator → personalized preview → optional enrichment → guest checkout.
4. Full recipient gift experience (unwrap → dedication → song → film → surprise → downloads).
5. Buyer review/approve before send; schedule delivery; printable QR gift card.
6. Provider-independent generation adapters (story, lyrics, music, video, print) with mock + manual music.
7. Order lifecycle: `DRAFT → … → APPROVED → READY_TO_SEND → SENT → OPENED`.
8. Cost tracking per order; Mission 01 funnel events.
9. EU digital-content consent UX reviewed by legal (stub only until approved).

---

## 4. Technical risks

| Risk | Mitigation |
| --- | --- |
| Colliding with live Santa Call commerce | New routes under `/christmas-story` + `/gift/:token`; no shared Stripe mode flags |
| Accidental LIVE charges | Checkout kill-switched (`CHRISTMAS_STORY_CHECKOUT_ENABLED=false`); Stripe test-only stubs |
| Suno MCP ≠ production API | `MusicProvider` mock + manual admin upload only |
| Heavy video in request path | Async job interface; mock renderer until FFmpeg job wired |
| Dirty working tree / large binary assets | Do not commit unrelated Santa Call / mp4 churn |
| Catalog corruption notes in `catalog.ts` | Do not extend broken union literals; keep story catalog in own module |

---

## 5. Security and privacy risks

- Uploaded photos / memories / possible minors → private storage, signed URLs, no public gallery.
- Do not send photos or unnecessary PII to music providers.
- No voice cloning of third parties.
- Recipient pages: `noindex`, no pricing, no ads, no OG that leaks private content.
- Logs must not contain names, tokens, or photo URLs with secrets.
- Deletion / retention controls required before launch.

---

## 6. Reusable components

- Design tokens / editorial Christmas CSS: `src/features/christmas/landing/ChristmasLanding.css`
- Unwrap ceremony: `src/features/christmas/gifts/GiftOpenCeremony.tsx`
- Checkout UI pattern: `src/features/pet/components/CustomStripeCheckout.tsx` + `checkout.ts` (not activated for story MVP)
- Share privacy: `src/features/christmas/share/*`
- Funnel analytics contract pattern: `funnelEventContract.ts`
- FFmpeg patterns: `api/christmas-santa-compose.ts`, `api/_lib/long-form-studio/animate.ts`

---

## 7. Recommended MVP architecture

```
src/features/christmas-story/
  types, catalog, draftStore, analytics
  generation/* (adapters: mock / manual)
  data/demoGift.ts
  components + pages
  styles/christmasStory.css

Routes:
  /christmas-story              landing
  /christmas-story/demo         full sample recipient experience
  /christmas-story/create       progressive creator
  /christmas-story/order/:id    buyer dashboard (local/mock order)
  /gift/:token                  recipient experience
  /christmas/our-story          alias → /christmas-story

Data (MVP):
  localStorage drafts + in-browser mock orders
  Optional later: christmas_story_* tables + Edge fulfill

Music:
  MockProvider | ManualAdminProvider | (FutureAuthorizedApiProvider)

Video:
  MockFilmProvider → later VPS FFmpeg Ken Burns job
```

---

## 8. Blockers for live launch

1. **Commercial music rights** — Suno/enterprise or alternative licensed provider approved.
2. **Stripe LIVE** product price + tax/VAT/OSS configuration for $57 digital goods.
3. **Durable storage + jobs** for photos, song masters, MP4 films.
4. **Legal** — privacy policy updates, digital content withdrawal consent copy, minors safeguards.
5. **Ops** — admin production queue staffed for manual song QA.
6. **Real demo assets** — licensed sample song + sample memory film (not placeholders sold as real testimonials).
7. **Authorization** — explicit go-live for payments, customer email, and paid generations.

---

## Decision

Preserve the existing TDG repository. Implement Mission 01 as an isolated feature module on `feature/christmas-story-mvp` without modifying Santa Call production paths or enabling paid services.
