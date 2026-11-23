# Mission 02C — Real Staging E2E, Security and Stripe TEST Checkout

**Date:** 2026-11-23  
**Branch:** `feature/christmas-story-02c-staging-e2e`  
**Baseline:** `integration/christmas-story-02a-02b` @ `addcfd60efabf925f0ad1b0dda0410f0f03bae3f` (Draft PR #381)  
**Implementation tip:** `5c86fd51b2def2070e8af36041cd93a982af0242`  
**Draft PR:** https://github.com/PaulMoza77/TheDigitalGifter/pull/382 (base: `integration/christmas-story-02a-02b`)  
**Workspace:** `/Users/paul/tdg-christmas-story-02c` (isolated worktree; sparse checkout excludes heavy christmas/santa media)  
**Deployment:** **Not deployed.** No production migration apply.  
**Payments:** LIVE **disabled**. Client `STORY_OFFER.checkoutEnabled=false`. Server requires `CHRISTMAS_STORY_CHECKOUT_ENABLED=true` + `STRIPE_TEST_*`.

---

## Database isolation

| Environment | Result |
| --- | --- |
| Remote Supabase org projects | Only `ueqwvulubkauushhbely` visible via CLI — **not** used (not a TDG story staging project). |
| Full `supabase db reset` on project `kjlsocejpmnzhhduyumy` | **Blocked** mid-chain by unrelated `christmas_planner` / product slug conflicts after a local type-cast fix. |
| Isolated Docker Postgres `tdg-story-02c-db` (`postgres:17-alpine`, host port **54332**) | **Used.** Bootstrap + Mission 02B + 02C hardening SQL applied. |

Isolation proof: E2E script targets only `docker://tdg-story-02c-db` and does not connect to production hosts.

### Migration audit (02B + 02C)

- SECURITY DEFINER RPCs (`christmas_story_transition_order`, `christmas_story_fulfill_payment`, `christmas_story_expire_checkout`) require `auth.role() = service_role`; EXECUTE revoked from `anon`/`authenticated`/`public`.
- RLS enabled; table privileges revoked from browser roles; private storage buckets `public=false` with no public object policies.
- Recipient / recovery tokens stored as SHA-256 only (`token_hash` length 64).
- 02C hardening: recovery challenges table; checkout expiry helper; reaffirm RPC grants.

---

## Isolated DB E2E evidence

Command: `node scripts/christmas-story-02c-db-e2e.mjs`

```text
PASS  draft created
PASS  order CHECKOUT_PENDING
PASS  anon cannot read orders
PASS  session create leaves unpaid
PASS  anon cannot fulfill payment
PASS  fulfill payment ok
PASS  order paid after webhook RPC
PASS  duplicate fulfill is already_paid
PASS  amount mismatch rejected
PASS  recipient disabled pre-send
PASS  recipient token hashed at rest
PASS  wrong recipient token misses
PASS  buyer preview does not OPEN
PASS  recipient open marks OPENED
PASS  revocation disables grant
PASS  old recipient hash gone
PASS  checkout expiry
PASS  recovery stores hashes only
PASS  invalid transition rejected
RESULT: all checks passed
```

Unauthorized access attempts (anon SELECT / anon fulfill) denied. Payment stays `pending` until service-role fulfill RPC (webhook stand-in). Buyer preview audit does not set OPENED.

---

## Stripe TEST checkout

### Implemented

- Hosted Stripe Checkout session (`checkoutUrl`); server amount **5700** USD authoritative.
- Browser sync (`syncCheckoutStatus`) may observe Stripe status / cancel / expire locally but **never** calls `christmas_story_fulfill_payment`.
- Dedicated webhook handles `checkout.session.completed`, `async_payment_succeeded`, `checkout.session.expired`, `async_payment_failed`; rejects livemode; TEST secret only; idempotent via `processed_stripe_events`.
- Frontend redirects to hosted Checkout; mirrors order as `CHECKOUT_PENDING` only (not PAID).
- Cancel return lands on order page and marks cancelled without inventing success.

### Verified vs blocked

| Check | Status |
| --- | --- |
| Kill-switch default ON | Verified (catalog + tests) |
| LIVE key refusal | Verified in `storyStripe.ts` + tests |
| Hosted session + webhook source-of-truth | Verified in code + unit tests |
| Real Stripe TEST card charge | **Blocked** — no `STRIPE_TEST_SECRET_KEY` / `whsec` in this environment; Stripe CLI authorized to **Volocar LIVE** account only (not used). |

Commercial switches left **OFF**.

---

## Buyer experience (02C)

- Order page loads via `getBuyerOrder` when API enabled; denied requests do **not** fall back to fake local success.
- Guest email recovery: `requestBuyerRecovery` / `redeemBuyerRecovery` (hash-at-rest challenges; staging may return token when `CHRISTMAS_STORY_RECOVERY_RETURN_TOKEN=true`).
- Approve / send are server-authoritative when API enabled; failures surface errors instead of optimistic local SENT/APPROVED.
- Buyer preview remains separate from recipient OPENED.
- Codex premium UI contracts preserved (additive wiring only).

---

## Automated verification

```text
vitest:
  christmasStory.test.ts     8
  mission02b.test.ts         9
  mission02c.test.ts         9
  santaCall.test.ts         14
  santaVideo.test.ts        14
  commercialOffers.test.ts  12
  TOTAL                      66 passed

tsc -p tsconfig.app.json --noEmit → exit 0
npm run build → success
isolated DB E2E → all checks passed
```

Santa Call commerce sources unchanged vs baseline `addcfd60`. PRs **#379** and **#380** were not modified.

---

## Security findings

1. Anon cannot read story orders or execute fulfill/transition RPCs (E2E proven).
2. Recipient grants disabled until send; wrong token hash misses; revocation rotates hash.
3. Recovery stores email/token hashes only.
4. Remaining: production email delivery for recovery not wired (staging token return flag only).
5. Full local Supabase API stack (Kong/Edge serve) still fragile due to unrelated migration chain failures — DB isolation path used instead.
6. Authenticated owner SELECT policy exists; token-hash column select revoked in hardening where applicable.

---

## Blockers

1. **No Stripe TEST credentials** in agent environment → cannot complete live TEST card + signed webhook E2E.
2. **No dedicated remote TDG staging Supabase project** provisioned → used local Docker isolation.
3. **FFmpeg worker / manual song admin** still out of scope (recommend Mission 02D).
4. Mobile Chrome device farm QA not run in this session (build + unit/DB E2E only).

---

## Exact files (high level)

- `supabase/migrations/20261123120000_christmas_story_02c_hardening.sql`
- `supabase/functions/christmas-story/index.ts` (hosted checkout, sync, recovery)
- `supabase/functions/christmas-story-stripe-test-webhook/index.ts` (expired/failed)
- `supabase/functions/_shared/christmas/storyStripe.ts` (`stripeTestGet`)
- `src/features/christmas-story/storyApi.ts`, `GiftCreator.tsx`, `BuyerDashboard.tsx`, `ChristmasStoryOrderPage.tsx`
- `src/features/christmas-story/mission02c.test.ts`
- `scripts/christmas-story-02c/*`, `scripts/christmas-story-02c-db-e2e.mjs`
- Local-only boot assist: `supabase/migrations/20260917120000_christmas_planner.sql` (`null::integer` cast)

---

## Next mission recommendation (02D)

1. VPS FFmpeg memory-film worker consuming `christmas_story_jobs`.
2. Admin UI for manual licensed-song attach + commercial rights checklist.
3. Premium demonstration media pack.
4. Provision dedicated remote staging Supabase + Stripe TEST keys; re-run full Edge + card E2E.
5. Keep LIVE checkout OFF until authorized.
