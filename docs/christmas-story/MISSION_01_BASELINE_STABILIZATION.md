# Mission 01 baseline stabilization (Cursor)

**Date:** 2026-11-22  
**Branch:** `feature/christmas-story-mvp`  
**Goal:** Unblock TypeScript/build so Draft PR #379 (Codex Mission 02A) can integrate cleanly.  
**Constraints:** No deploy, no merge, no live payments. Do not overwrite Codex UI work.

---

## 1. PR #378 scope audit

PR #378 (`feature/christmas-story-mvp` → `main`) contains **155 files** because the branch was cut from Santa Call work (`fix/santa-call-unlimited-extensions`), not from a clean `main` tip with only Mission 01.

### Legitimate Mission 01 (keep)

- `docs/DIGITAL_GIFTER_AUDIT.md`
- `docs/christmas-story/**`
- `src/features/christmas-story/**`
- `src/App.tsx` route wiring for `/christmas-story` and `/gift/:token`

### Santa Call lineage present in the same PR (do not delete; separate from Story MVP)

- `src/features/christmas/santa-call/**`, Santa landing/room pages
- Supabase Santa Call migrations / Edge paths already on this lineage
- `artifacts/santa-call-benchmark/**` (large QA evidence set)
- `.env.example` Santa Call keys
- Related admin / QA docs under `docs/qa/santa-call-*`

**Treatment:** Preserve Santa production behavior and migrations. Scope hygiene for merging Story to `main` should be a **follow-up rebase/split PR**, not a destructive rewrite of #378 while #379 is in flight.

### Local dirty tree (unrelated; not committed)

- Modified/deleted christmas-express / memories media under `public/assets/christmas/**`
- Local Santa QA JSON under `docs/qa/santa-call-unlimited-extensions/**`

These were left unstaged.

---

## 2. Build blockers repaired

| Issue | Fix |
| --- | --- |
| Malformed `CHRISTMAS_PRODUCT_TYPES` (`"santa_video" \| "santa_voice_call"`) | Split into two string literals |
| Stray `"christmas_santa_voice_call",` inside santa_video product object | Removed |
| Missing `SantaVoiceBenchmarkPage` import target | Added admin shell page (no payments/pricing changes) |
| `ChristmasSantaCallPage` TS2367 vs `catalogFromRows` keys | Read Santa offer from raw `pricing_items` via `readSantaCallOfferFromPricingRows` (Santa stays outside the 3-key commercial catalog) |
| Duplicate `event` in story analytics `dataLayer.push` | Spread payload first, set `event: story_*` last |
| Hub CTA for Santa Call experience | Added `christmas_santa_voice_call` to `EXPERIENCE_OPEN_KEYS` (navigation only; purchasable flags unchanged) |

**Not changed:** Santa Call prices, Stripe mode flags, migrations, Edge fulfill logic, LIVE payment activation.

---

## 3. Verification evidence

```text
npx tsc -p tsconfig.app.json --noEmit
→ exit 0

npm test -- src/features/christmas-story/christmasStory.test.ts \
  src/features/christmas/santa-call/santaCall.test.ts \
  src/features/christmas/christmasFoundation.test.ts \
  src/features/christmas/commercialOffers.test.ts
→ 4 files / 47 tests passed

npm run build
→ ✓ built in ~8s (+ Christmas SEO prerender shells)
```

---

## 4. PR #379 integration readiness

- Codex head: `codex/christmas-story-premium-ui` @ `b0f27c7`
- Base: Mission 01 tip `15691da` (before this stabilization commit)
- Codex touches **only** christmas-story UI/docs/QA scripts (16 files)
- Dry merge-tree against current HEAD: **no CONFLICT markers** observed
- After this stabilization commit, expected remaining risk is low (Codex did not edit `analytics.ts`, `catalog.ts`, or Santa Call sources)

**Recommendation:** Keep #379 as Draft. After this baseline commit is on `feature/christmas-story-mvp`, re-run merge / update #379 base, then review Codex UI visually. Do **not** squash Codex into Cursor work until that check passes.

---

## 5. Proposed next sequence (post UI integration)

1. **Supabase persistence** — `christmas_story_orders` (+ assets, recipient tokens hashed), capability-token recipient access modeled on result-share privacy.  
2. **Stripe TEST isolation** — copy Santa Call TEST credential pattern; keep `checkoutEnabled=false` until authorized; server-authoritative $5700.  
3. **FFmpeg memory film** — async VPS job from uploaded frames (long-form/Ken Burns patterns); never sync in request path.  
4. **Manual music ops queue** — admin upload of authorized masters; no Suno automation.  
5. **Legal/privacy + licensed demo media** — then staging authorization.
