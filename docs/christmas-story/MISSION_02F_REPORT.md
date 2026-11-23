# Mission 02F — Secure Staging, Private Media Delivery & Commercial E2E

**Date:** 2026-11-23  
**Branch:** `feature/christmas-story-02f-staging`  
**Baseline (Mission 02E tip):** `faf274ac76bd5c9202ea75fb620b641ae5359651`  
**Parent Draft PR:** #384  
**Workspace:** `/Users/paul/tdg-christmas-story-02f`  
**Draft PR:** https://github.com/PaulMoza77/TheDigitalGifter/pull/385  
**Implementation tip:** `076120a999301bc904daa7e253324199826e78b5`  
**Exact final SHA:**   
**Deployment:** **Not deployed.** No production migrations. LIVE Stripe **OFF.** PRs #379–#384 untouched except new Draft PR #385.

---

## 1) Environment discovery & isolation

| Target | Result |
| --- | --- |
| Remote Supabase projects visible via CLI | Only `ueqwvulubkauushhbely` (“rentalcarscluj… Project”) — **not** a TDG Christmas Story staging project. **Not used.** |
| Creating a new paid staging project | **Not done** — would incur charges; requires owner approval. |
| Stripe CLI | Authorized to **Volocar LIVE** only. **No Stripe sandboxes found.** LIVE not used. |
| Stripe TEST secrets in agent env | **Missing** (`STRIPE_TEST_SECRET_KEY`, webhook `whsec`, `CHRISTMAS_STORY_CHECKOUT_ENABLED` not provisioned). |
| Isolated local DB | Reused `docker://tdg-story-02c-db` (Mission 02C) — local only. |
| Full local Supabase API stack for this repo | Still fragile / not linked; not claimed as remote staging. |

**Isolation rule followed:** never assume a connected project is safe for Digital Gifter.

---

## 2) Private media storage — code + verified

### Implemented
- Migration `20261125010000_christmas_story_02f_private_media.sql`: `christmas_story_media_sign_events`, worker upload receipts, reaffirm private buckets, drop public object policies.
- Edge hardening (`signMedia` / `renewMedia` / `listOrderAssets` / `createUploadUrl`):
  - Order-scoped path enforcement
  - Buyer or enabled non-revoked recipient only
  - Short TTL (2 min default, max 15)
  - Fail closed with `url: null` (no public fallback)
  - Sign-event audit rows
  - Anonymous uploads removed
- Local `PrivateMediaStore` + `authorizeMediaAccess` for isolated auth E2E (HMAC tokens).
- Frontend: `signMediaAsset`, `renewMedia`, `createPhotoUploadUrl`, `MemoryFilm` renewal path when durable API + asset id present.

### Actually verified (isolated)
Command: `node --experimental-strip-types scripts/christmas-story-02f/private-media-e2e.mjs`

```text
PASS  buyer A authorized
PASS  buyer B cross-order denied
PASS  recipient authorized when enabled
PASS  path escape denied
PASS  signed token issued / redeem
PASS  wrong-order redeem blocked
PASS  revoked recipient denied
PASS  garbage token rejected
PASS  idempotent film job key
PASS  sign event recorded
PASS  anon cannot read assets
RESULT: all private media checks passed
```

Evidence: `artifacts/christmas-story-02f/PRIVATE_MEDIA_E2E.txt`

**Not verified:** remote Supabase Storage signed URLs against a dedicated TDG staging project (project not provisioned).

---

## 3) Worker staging integration

### Implemented
- `scripts/christmas-story-02f/staging-film-worker.mjs`
  - Claims film jobs, renders `warm_cinematic_v2`, writes order-scoped private objects
  - Scrubbed structured logs
  - Optional remote upload only if `CS_STAGING_ALLOW_REMOTE=true` + explicit staging URL/key (refuses suspicious/prod-like hosts by default)
  - Graceful SIGTERM/SIGINT

### Actually verified
```text
enqueued → claimed → completed
checksum be0952f6…
remoteUploaded: false   # expected without staging credentials
```
Private object written under `artifacts/christmas-story-02f/private-store/…/film/*.mp4`.

**Not deployed** to any VPS / remote staging.

---

## 4) Stripe TEST & buyer lifecycle

| Check | Status |
| --- | --- |
| Hosted TEST checkout code path | Present (from 02C); kill-switch default OFF for LIVE |
| Real hosted Stripe TEST payment + webhook | **Blocked** — no TEST secrets; CLI is LIVE Volocar only |
| Isolated DB payment lifecycle | **Passed** via `scripts/christmas-story-02c-db-e2e.mjs` (pending→paid, duplicate, expiry, revoke, recovery hashes) |

Missing secrets/config (exact):
1. `STRIPE_TEST_SECRET_KEY` (sk_test_…)
2. Stripe TEST webhook signing secret (`whsec_…`) for `christmas-story-stripe-test-webhook`
3. `CHRISTMAS_STORY_CHECKOUT_ENABLED=true` on an isolated Edge runtime
4. Dedicated TDG staging Supabase project + service role (not the rentalcarscluj project)

---

## 5) Licensed song

- Checklist reviewed: `docs/christmas-story/DEMO_SONG_OPERATOR_CHECKLIST.md`
- No authorized commercial master supplied in this workspace
- Demo `audioUrl` remains **null** / status **pending**
- **Commercial product remains incomplete** without a licensed song master

---

## 6) Real mobile QA

Local Vite preview + Chrome screenshots:

- `artifacts/christmas-story-02f/qa/demo-closed-390.png`
- `artifacts/christmas-story-02f/qa/demo-film-375.png`
- `artifacts/christmas-story-02f/qa/demo-film-390.png`
- `artifacts/christmas-story-02f/qa/demo-film-430.png`
- `artifacts/christmas-story-02f/qa/landing-1440.png`

Observed:
- Explicit open (no autoplay)
- Film plays 0:33 sample; poster readable
- Song pending copy visible
- Honest stock-photo labeling
- Presentation fix: removed overclaiming “table set for us” frame; atmospheric captions only

---

## 7) Release gates

```text
private-media E2E     PASS
02C DB E2E            PASS
media E2E (02D)       PASS (15/15)
vitest                74 passed (02B–02F + Santa + mediaPipeline)
tsc --noEmit          exit 0
vite build            success
```

Santa Call sources not modified; Santa vitest regressions passed (28).

---

## Readiness matrix (do not overclaim)

| Layer | Status |
| --- | --- |
| **Code implemented** | Private media auth/signing, renew path, staging worker bridge, migration, presentation fixes |
| **E2E actually verified** | Isolated DB auth matrix + HMAC private store; local worker render→private object; 02C payment RPC lifecycle; media/ffmpeg regressions; mobile screenshots |
| **Credentials / infra missing** | Dedicated TDG staging Supabase; Stripe TEST keys + whsec; isolated Edge deploy; remote private bucket credentials |
| **Licensed music readiness** | **Not ready** |
| **Commercial launch readiness** | **Not ready** — full payment→media→recipient path on real staging **not** completed |
| **Santa Call regression** | Passed (unit) |

---

## Remaining owner actions

1. Approve creation/linking of a **dedicated** TDG staging Supabase project (charges).
2. Provide Stripe **TEST** secrets (never LIVE) and switch CLI to a sandbox.
3. Supply authorized demo song master via checklist.
4. Authorize isolated Edge + storage deploy for signed URL E2E against real Supabase Storage.

Until those land, **do not claim launch readiness**.
