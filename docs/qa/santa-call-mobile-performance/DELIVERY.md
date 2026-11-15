# Santa Call — Mobile Performance & Conversion

**URL:** `https://www.thedigitalgifter.com/christmas/santa-call?lang=ro&market=ro`  
**Branch:** `cursor/santa-call-mobile-perf-646a`  
**Deploy:** not shipped to production (awaiting approval)

## Method

- **Baseline:** Lighthouse Mobile ×3 against **production CDN**, simulated mobile throttling (`npx lighthouse` 13.6 / Chrome headless).
- **After:** Lighthouse Mobile ×3 against **local `vite preview`** of this PR build (`VITE_SANTA_CALL_LANDING_PUBLIC=true`).
- Absolute Perf/LCP on local preview are **not CDN-comparable** (no edge cache, placeholder Supabase → console errors → Best Practices −4). Comparable signals: SEO, a11y, CLS, LCP element, resource composition, conversion layout checks.
- Production retest is required after deploy for Perf ≥90 / LCP ≤2.5s claims.

## Baseline (production, median of 3)

| Metric | Median |
| --- | --- |
| Performance | **82** |
| Accessibility | **97** |
| Best Practices | **100** |
| SEO | **66** |
| FCP | 1.15 s |
| LCP | **4.75 s** |
| Speed Index | 2.43 s |
| TBT | 65 ms |
| CLS | 0.003 |

**LCP element (prod):** `h1#santa-title` — “Îi spune pe nume…”  
**LCP breakdown:** TTFB ~0.33 s + **element render delay ~1.06 s** (SPA JS before H1).  
**SEO fail:** `<meta name="robots" content="noindex,follow" />` (`is-crawlable`).  
**Heavy first load:** `index-*.js` ~258 KB, `ChristmasPageHead-*.js` ~132 KB, `grace-poster.jpg` ~132 KB, Google Fonts ~158 KB, `vendor-supabase` ~58 KB, `vendor-motion` ~42 KB.  
**Unused JS:** ~205 KB est. (index / supabase / motion) → ~900 ms LCP opportunity.  
**Tracking:** GA4 / Meta / Clarity remain consent-gated; not removed.

Artifacts: `baseline/run-{1,2,3}.report.json`, `baseline/summary.json`, `screenshots/baseline-mobile.png`.

## After (local preview, median of 3)

| Metric | Median | vs baseline |
| --- | --- | --- |
| Performance | **77** | local-only; see note |
| Accessibility | **97** | = |
| Best Practices | **96** | −4 local console (fake Supabase) |
| SEO | **100** | **+34** |
| FCP | 2.76 s | local-only |
| LCP | 5.10 s | local-only |
| Speed Index | 2.76 s | local-only |
| TBT | **21 ms** | better |
| CLS | **0** | better |

**LCP element (after):** still `h1#santa-title` (correct).  
**No longer on first load:** `ChristmasPageHead` (~125–132 KB), `grace-poster.jpg` (~132 KB).  
**Fonts:** Inter skipped on Santa; Cormorant 600 + Source Sans 400/600/700 only.  
**Split chunks:** `CustomStripeCheckout`, `SantaSupportChat`, `SantaCallGatedHead` (SEO registry only on gated route).

Artifacts: `after/run-{1,2,3}.report.json`, `after/summary.json`, `screenshots/after-mobile.png`, `after-desktop.png`.

## Changes implemented

1. **HTML boot shell** (`index.html`) — paints RO/EN hero H1 + price + CTA before SPA JS; defers analytics on Santa like `/christmas`; skips Inter on Santa.
2. **SEO indexable** — `noindex: false` for `/christmas/santa-call`; route added to i18n bases; product gate EN/RO only; `PageHead` no longer hard-forces `noindex` when public.
3. **Code splitting** — lazy `CustomStripeCheckout`, `SantaSupportChat` (via `santaSupportOpen` bridge), gated SEO head in `SantaCallGatedHead` so the 539 KB registry is not preloaded on the public funnel.
4. **Images** — WebP Grace posters (480/720) + North Pole WebP; Grace demo is **tap-to-play** with CSS placeholder until mostly visible (no auto poster LCP theft).
5. **Fonts** — fewer weights; preload stylesheet for Santa stack.
6. **A11y** — dialogue label contrast `#65705b` → `#4d5648`.
7. **Conversion (mobile)** — tighter hero spacing; `min-height` on copy so price + primary CTA stay in the first screen; sticky CTA unchanged; no funnel/Stripe/extension changes.

## Bundle impact (public Santa landing, first navigation)

| Resource | Before (prod) | After (PR build) |
| --- | --- | --- |
| `ChristmasPageHead-*.js` | ~132 KB transferred | **not requested** |
| `grace-poster.jpg` | ~132 KB | **not requested** until play/scroll reveal |
| Grace WebP 480 | — | ~37 KB (only after reveal) |
| `CustomStripeCheckout` | in graph earlier | **deferred** until embedded checkout |
| `SantaSupportChat` | bundled/heavier | ~3 KB async chunk |
| `index-*.js` | ~258 KB | still ~248 KB (app shell; remaining bottleneck) |

## Functional checks

| Check | Result |
| --- | --- |
| Lighthouse Mobile ×3 baseline | **PASS** (recorded) |
| Lighthouse Mobile ×3 after | **PASS** (recorded; local host) |
| SEO `index,follow` on public landing | **PASS** (local after) |
| LCP element = hero H1 | **PASS** |
| Price `59 lei / 3 minute` in first viewport | **PASS** (Playwright mobile) |
| No horizontal overflow | **PASS** |
| Desktop layout still renders | **PASS** (`after-desktop.png`) |
| Form open via CTA | **FAIL locally** — offer API uses placeholder Supabase (shows availability state). Structure + unit tests cover form when purchasable. |
| Checkout 59 lei / Stripe / extensions | **Not exercised live** (per instructions; no live payments) |
| GA4 / Meta / Clarity still present + consent | **PASS** (code path kept; deferred on Santa) |
| Unit tests `santaLanding` + `SantaSupportChat` | **PASS** |
| Perf ≥90 / LCP ≤2.5s on production | **PENDING** — needs deploy + retest |

## Remaining issues

1. **App shell `index-*.js` (~250 KB gzip~)** still dominates LCP on throttled mobile; Santa-only splitting cannot remove the shared router/vendor graph.
2. **`vendor-motion` + `vendor-supabase`** still load with the landing (shared manualChunks / support chat). Further isolation needs broader Vite chunk surgery.
3. **Production Perf targets** must be re-validated on CDN after deploy; local preview understates FCP/LCP for cached static assets and over-penalizes Best Practices via missing API host.

## Preview

Local preview used for after runs: `http://127.0.0.1:4173/christmas/santa-call?lang=ro&market=ro`  
Production (unchanged until approve): https://www.thedigitalgifter.com/christmas/santa-call?lang=ro&market=ro
