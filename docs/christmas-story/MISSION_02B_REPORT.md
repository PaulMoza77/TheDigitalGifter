# Mission 02B — Durable Gift Orders + Private Access + Stripe TEST

**Date:** 2026-11-23  
**Branch:** `feature/christmas-story-02b-backend`  
**Baseline:** `feature/christmas-story-mvp` @ `396aef2`  
**Workspace:** `/Users/paul/tdg-christmas-story-02b`  
**Deployment:** **Not deployed.** Migrations **not applied** to production.  
**Payments:** LIVE charges **disabled**. Checkout kill-switch default **ON**.

---

## Architecture

```
Browser (Christmas Story UI)
  ├─ localStorage draft/order mirror (offline / kill-switch path)
  └─ supabase.functions.invoke("christmas-story")
        ├─ drafts / buyer ownership (buyer_access_token → SHA-256 at rest)
        ├─ Stripe TEST checkout session (sk_test_* only)
        ├─ recipient grants (token_hash only; enabled after SENT)
        ├─ signed media URLs
        └─ status transitions via security definer RPCs

Stripe TEST → christmas-story-stripe-test-webhook
  ├─ verifies STRIPE_TEST_WEBHOOK_SECRET only
  ├─ rejects livemode
  ├─ idempotent via processed_stripe_events
  └─ christmas_story_fulfill_payment → CONTENT_PENDING → GENERATING → REVIEW_REQUIRED
```

Santa Call commerce, `santaStripe.ts`, and `santa-call-stripe-test-webhook` are **unchanged**.

---

## Tables and RLS

Migration: `supabase/migrations/20261123010000_christmas_story_durable_orders.sql`

| Table | Purpose |
| --- | --- |
| `christmas_story_drafts` | Guest drafts; `buyer_access_token_hash` |
| `christmas_story_orders` | Durable orders + payment/status |
| `christmas_story_content_versions` | Content version history |
| `christmas_story_assets` | Photos/song/film paths |
| `christmas_story_jobs` | mock / manual / ffmpeg jobs |
| `christmas_story_access_grants` | Recipient + recovery grants (hash-only) |
| `christmas_story_audit_events` | Scrubbed audit log |
| `christmas_story_deletion_requests` | Privacy deletion workflow |

**RLS:** enabled on all tables; `anon`/`authenticated`/`public` revoked for writes/secrets. Service role used by Edge. Authenticated owners may `SELECT` their own non-deleted orders.

**Storage buckets (private):** `christmas-story-source`, `christmas-story-generated` — signed URLs only.

**RPCs:** `christmas_story_assert_transition`, `christmas_story_transition_order`, `christmas_story_fulfill_payment`.

---

## Endpoints

### `christmas-story` (verify_jwt = false; rate-limited)

| Action | Notes |
| --- | --- |
| `saveDraft` / `getDraft` | Guest ownership via buyer token |
| `createCheckout` | Stripe TEST only; server amount $57; kill-switch gated |
| `getBuyerOrder` / `listBuyerOrders` | Buyer token gate |
| `buyerPreview` | **Does not** mark OPENED |
| `approveOrder` / `markSent` / `scheduleDelivery` | Lifecycle |
| `revokeRecipientAccess` / `rotateRecipientToken` | Revocable access |
| `getRecipientGift` | Cross-device; requires enabled grant + SENT/OPENED |
| `enqueueGeneration` / `attachManualSong` | Manual song + ffmpeg queue stubs |
| `createUploadUrl` / `signMedia` | Private uploads / signed reads |
| `requestDeletion` | Soft-delete + revoke |
| `health` | Kill-switch / mode probe |

### `christmas-story-stripe-test-webhook`

- `STRIPE_TEST_WEBHOOK_SECRET` only  
- Rejects `livemode=true`  
- Requires `product_family=christmas_story` + `stripe_mode=test`  
- Duplicate event protection via `processed_stripe_events`

---

## Exact files changed (high level)

- `supabase/migrations/20261123010000_christmas_story_durable_orders.sql`
- `supabase/functions/_shared/christmas/storyLifecycle.ts`
- `supabase/functions/_shared/christmas/storyStripe.ts`
- `supabase/functions/christmas-story/index.ts`
- `supabase/functions/christmas-story-stripe-test-webhook/index.ts`
- `supabase/config.toml`
- `.env.example`
- `src/features/christmas-story/storyApi.ts`
- `src/features/christmas-story/lifecycle.ts`
- `src/features/christmas-story/storyStripePolicy.ts`
- `src/features/christmas-story/mission02b.test.ts`
- `src/features/christmas-story/components/GiftCreator.tsx`
- `src/features/christmas-story/components/BuyerDashboard.tsx`
- `src/features/christmas-story/pages/GiftRecipientPage.tsx`
- `src/features/christmas-story/index.ts`
- `docs/christmas-story/MISSION_02B_REPORT.md`

---

## Test evidence

```text
vitest:
  christmasStory.test.ts          8 passed
  mission02b.test.ts              9 passed
  santa-call/santaCall.test.ts   14 passed
  commercialOffers.test.ts       12 passed
  TOTAL                            43 passed

tsc -p tsconfig.app.json --noEmit → exit 0
npm run build → success
```

Isolated DB E2E against a live Supabase project was **not** run in this mission (no production migration apply; no remote test DB credentials used). Contract/security tests cover hash-at-rest, transitions, Stripe TEST isolation, and Santa non-interference via source assertions.

---

## Stripe TEST verification

| Gate | Status |
| --- | --- |
| Client `STORY_OFFER.checkoutEnabled` | `false` (kill-switch ON) |
| Server `CHRISTMAS_STORY_CHECKOUT_ENABLED` | required for TEST sessions |
| Mode | `test` only; `live` refused |
| Keys | `STRIPE_TEST_*` only; no LIVE fallback |
| Webhook | dedicated function; rejects livemode |
| Amount | server `5700` usd; client amount mismatch rejected |
| Purchase analytics | no `purchase_completed` without `live_verified` (existing Mission 01 rule) |

**Verified in code + unit tests.** Live Stripe TEST session was **not** charged in this environment (kill-switch default off / no secrets used).

---

## Security findings

1. Recipient plaintext tokens returned once to buyer; only SHA-256 stored.  
2. Recipient grant `enabled=false` until `markSent` — no pre-approval access.  
3. `buyerPreview` audits separately and never transitions to OPENED.  
4. Audit metadata strips token/email/pin keys.  
5. Private buckets; no public storage policies.  
6. Rate limit per action+IP via `touch_edge_rate_limit`.  
7. Remaining: email magic-link recovery is schema-ready (`email_recovery` grant kind) but mint/send flow is not fully productized; PIN hash column present, enforced when set.

---

## Remaining FFmpeg / music blockers

- Film jobs enqueue as `provider=ffmpeg` / `queued` — **no VPS worker yet**.  
- Song jobs default to `manual` / `awaiting_manual` — **no Suno automation** (intentional).  
- Need admin UI for manual song upload + FFmpeg worker in next mission.

---

## Compatibility with PR #379

- Codex UI branch `codex/christmas-story-premium-ui` was **not** modified or merged.  
- Mission 02B keeps UI component APIs (`GiftCreator`, `BuyerDashboard`, `RecipientExperience`) and adds optional durable API behind `VITE_CHRISTMAS_STORY_API_ENABLED`.  
- Visual redesign from 02A remains Codex-owned; backend work is additive.  
- Re-run merge-tree after both PRs are ready; expect low conflict risk outside shared creator/dashboard files if 02A landed first — document any glue for Codex.

---

## Deployment status

- **No production deploy**  
- **No production migration apply**  
- **No LIVE Stripe**  
- Draft PR only

---

## Next mission recommendation

1. Apply migration to an isolated **staging/test** Supabase project; run true Edge E2E with Stripe TEST cards.  
2. Implement VPS FFmpeg memory-film worker consuming `christmas_story_jobs`.  
3. Admin queue UI for manual song attach + commercial rights checklist.  
4. Integrate Codex PR #379 UI onto backend-enabled branch.  
5. Email recovery + optional PIN UX.  
6. Only then consider kill-switch review for controlled TEST traffic — still no LIVE.
