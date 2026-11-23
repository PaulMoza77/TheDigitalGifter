# Mission 02E — Premium Demo Experience + Real Media Visual QA

**Date:** 2026-11-23  
**Branch:** `feature/christmas-story-02e-demo`  
**Baseline (Mission 02D tip):** `ea75639a3516ddb4b2a131d10a817c92ab1a0136`  
**Workspace:** `/Users/paul/tdg-christmas-story-02e`  
**Implementation commit:** `12480bf274a67b56cbd7e6ec1bf05c2842acb0f9`
**Branch tip:** `b918d3f25885cb765b8bc7ad2ad9e2954acb3b59`
**Draft PR:** https://github.com/PaulMoza77/TheDigitalGifter/pull/384
**Deployment:** **Not deployed.** LIVE payments **OFF.** PRs #379–#383 untouched.

---

## Phase 1 — Demo audit (before)

Inspected Emma demo MP4 independently via ffprobe + decoded frames + contact sheet.

| Metric | Before (02D plate demo) |
| --- | --- |
| Path | `public/assets/christmas-story-demo/emma-memory-film.mp4` |
| Duration | 15.2 s |
| Size | **42,013 bytes** |
| Bitrate | ~22 kb/s |
| Visual | Near-uniform brown plates + text captions |
| Frame luminance stdev | ~7–12 (empty of photographic detail) |
| Contact sheet | `artifacts/christmas-story-02e/before/contact-sheet.jpg` |

**Verdict:** Technically valid H.264/yuv420p, **not** a commercially impressive gift example. Middle sections were blank color fields with caption bars — not memories.

---

## Phase 2 — Premium memory film (after)

### Approach
1. Replaced plate stills with **8 Unsplash-licensed photographic stills** (commercial-ok Unsplash License), provenance in `public/assets/christmas-story-demo/stills/MANIFEST.json`.
2. Upgraded renderer template **`warm_cinematic_v2`**: soft `xfade` transitions, Christmas color grade + vignette, longer title/end plates, CRF 18, mid-film poster.
3. Honest product copy: stock demo imagery, not customer photos.
4. Operator import workflow: `scripts/christmas-story-02e/import-demo-photos.mjs` for future licensed packs.

### After metrics (nontrivial photographic inputs)

| Metric | After |
| --- | --- |
| Path | `public/assets/christmas-story-demo/emma-memory-film.mp4` |
| Duration | **33.7 s** |
| Size | **8,840,768 bytes (~8.4 MB)** |
| Bitrate | ~2.1 Mb/s |
| Codec | H.264 / yuvj420p / 1280×720 / +faststart (`moov` before `mdat`) |
| Photos | 8 unique stills |
| Render wall | **35,838 ms** |
| Peak RSS | **~91 MB** |
| Checksum | `e12495c68024841b24e88fda35a9a47dc131cb23f0c1fcb36c8999d1c8f6e0b6` |
| Contact sheet | `artifacts/christmas-story-02e/after/contact-sheet.jpg` |
| Poster | `public/assets/christmas-story-demo/emma-poster.jpg` |

Middle-frame luminance stdev rose to **~45–74** (photographic detail present). Title/end cards remain intentionally dark typography beats.

---

## Phase 3 — Demo song

- **No** authorized commercial song master exists in-repo.
- Demo `audioUrl` remains **null**; status **pending**.
- Player shows lyrics-only status — **no** fake/synthesized playback.
- Operator checklist: `docs/christmas-story/DEMO_SONG_OPERATOR_CHECKLIST.md`

---

## Phase 4 — Mobile gift experience (Chrome QA)

Vite local preview with placeholder Supabase public env (not production).

Captured screenshots:

- `artifacts/christmas-story-02e/qa/landing-375.png`
- `artifacts/christmas-story-02e/qa/landing-390.png`
- `artifacts/christmas-story-02e/qa/landing-430.png`
- `artifacts/christmas-story-02e/qa/landing-768.png`
- `artifacts/christmas-story-02e/qa/landing-1440.png`
- `artifacts/christmas-story-02e/qa/demo-film-390.png`

Observed:
- Landing shows film poster + play affordance (not text-only card).
- Honest labels: “Stock photos · Song pending license”.
- Recipient unboxing requires explicit “Open your gift” (no unintended autoplay).
- Demo film `<video controls preload="metadata" autoplay=false>` loads 1280×720, duration 33s, poster set.
- Song section states master not attached.

---

## Phase 5 — Media quality gates

- H.264 + yuv420p family (yuvj420p accepted) ✓  
- Fast-start ✓  
- No prolonged empty brown middles ✓ (photographic stills)  
- Readable title/dedication text ✓  
- Duration ~34s within premium 30–45s target ✓  
- Reasonable bitrate/size for 8 photo moments ✓  
- Poster from mid photo beat ✓  
- Labels not misleading ✓  

Pipeline still supports real buyer uploads (portrait + landscape) via existing `validatePhotoList` / zoompan path.

---

## Phase 6 — Worker packaging (not deployed)

`server/christmas-story-media/worker/`

- Dockerfile + compose reference
- Healthcheck, entrypoint, graceful signal trap
- ENV contract (`ENV_CONTRACT.md`)
- Resource limit suggestions
- Private local storage mode only

**Do not deploy** from this PR.

---

## Phase 7 — Verification

```text
node --experimental-strip-types scripts/christmas-story-02d/e2e-media.mjs
  → all media E2E checks passed (15/15)

vitest: 41 passed (02E/02D/02C/02B + christmasStory + mediaPipeline)
vitest santa: 28 passed (santaCall + santaVideo)
tsc -p tsconfig.app.json --noEmit → exit 0
vite build → success
```

---

## Readiness matrix (precise)

| Layer | Status |
| --- | --- |
| **1. Technical media rendering readiness** | **Ready** — FFmpeg argv-only pipeline, durable jobs, v2 cinematic template, quality gates. |
| **2. Actual premium demo readiness** | **Mostly ready for fictional demo** — 33.7s photographic film with transitions/grade; clearly labeled stock sample. Still not a *personal* customer film (by design). |
| **3. Licensed song readiness** | **Not ready** — no commercial master; checklist prepared. |
| **4. Commercial launch readiness** | **Not ready** — no staging signed delivery, no LIVE Stripe, no production deploy, song missing, VPS worker not deployed. |

---

## Remaining blockers

1. Authorized first-party/licensed **demo song** master.
2. Optional: replace Unsplash stock with a curated first-party illustrated or private licensed photo pack via import workflow.
3. Staging private storage + signed URLs for real buyer media.
4. Deploy worker package to isolated VPS when authorized.
5. Playwright browser binaries were unavailable in this sandbox; Chrome QA used Cursor browser + multi-width screenshots (full Playwright install optional later).

---

## Next mission recommendation

**Mission 02F — Staging signed media + authorized demo song:** attach one commercial song master through the checklist, wire private storage signed playback, and run device-lab QA on real buyer photo uploads — LIVE checkout still OFF.
