# Mission 02C — Real Staging E2E, Security and Stripe TEST Checkout

**Date:** 2026-11-23  
**Branch:** `feature/christmas-story-02c-staging-e2e`  
**Tip:** `4d4e4ee8d691d4970e0db5bb6a1d852568a6f5c3`  
**Baseline:** `integration/christmas-story-02a-02b` @ `addcfd60efabf925f0ad1b0dda0410f0f03bae3f` (Draft PR #381)  
**Draft PR:** https://github.com/PaulMoza77/TheDigitalGifter/pull/382  
**Workspace:** `/Users/paul/tdg-christmas-story-02c` (sparse worktree; heavy media excluded)  
**Deployment:** **Not deployed.** No production migration. LIVE payments **OFF**.

---

## Database isolation

| Item | Value |
| --- | --- |
| Isolated DB | Docker `tdg-story-02c-db` · Postgres 16 · host port `54332` |
| Remote Supabase | **Not used.** Org only lists unrelated project `ueqwvulubkauushhbely` (not TDG staging) |
| Migrations applied (local only) | `20261123010000_christmas_story_durable_orders.sql` + `20261123120000_christmas_story_02c_hardening.sql` after bootstrap stubs |
| Production | Untouched |

Bootstrap: `scripts/christmas-story-02c/00_bootstrap_isolated.sql` (auth/storage/role stubs + `processed_stripe_events`).

### Security audit (verified on isolated DB)

- RLS enabled on all `christmas_story_*` tables; `anon` insert/select **denied**.
- SECURITY DEFINER RPCs (`transition_order`, `fulfill_payment`, `expire_checkout`) **service_role only**; `assert_transition` execute revoked from anon/authenticated.
- Private buckets `christmas-story-source` / `christmas-story-generated` with `public=false`; no public storage policies.
- Buyer/recipient/recovery tokens stored as SHA-256 only.
- `buyer_access_token_hash` select revoked from `authenticated`.

### Isolated DB E2E

```text
node scripts/christmas-story-02c-db-e2e.mjs
RESULT: all checks passed
```

Covers: unpaid after session-shaped insert, amount mismatch, fulfill idempotency, pre-send recipient denial, buyer preview ≠ OPENED, revoke/rotate, expiry, recovery hash-at-rest, invalid transitions, anon denial.

---

## Stripe TEST

| Gate | Status |
| --- | --- |
| Client `STORY_OFFER.checkoutEnabled` | `false` |
| Server kill-switch | `CHRISTMAS_STORY_CHECKOUT_ENABLED` required |
| Mode | TEST only; LIVE refused |
| Hosted Checkout | `createCheckout` returns `checkoutUrl` (no `ui_mode=custom`) |
| Server price | `5700` usd authoritative |
| Browser sync | `syncCheckoutStatus` reports Stripe status; **never** calls fulfill RPC |
| Webhook | `christmas-story-stripe-test-webhook` + expired/failed → not paid |
| Live card charge this mission | **Blocked** — no `STRIPE_TEST_*` credentials in environment |

---

## Buyer experience (02C)

- Hosted Stripe redirect on durable API success; local mirror stays `CHECKOUT_PENDING` (not fake PAID).
- Order page loads via `fetchBuyerOrder` / `syncCheckoutStatus`; cancel/success query handling.
- Guest recovery: `requestBuyerRecovery` / `redeemBuyerRecovery` with `email_hash` + `token_hash`.
- Approve / send remain server-authoritative when API enabled; denials do not invent local success.
- Recipient page still refuses local fallback when API enabled.
- Codex premium UI preserved (wiring only).

---

## Verification

```text
vitest: 66 passed (mission02b/02c, christmasStory, santa-call, santaVideo, commercialOffers)
tsc -p tsconfig.app.json --noEmit → exit 0
npm run build → success (exit 0)
isolated DB E2E → all checks passed
Santa Call commerce sources → not modified for payment paths
```

---

## Blockers

1. **No TDG remote staging Supabase project** available via CLI — only an unrelated rentalcars project; therefore Edge Function live invoke E2E against hosted Supabase was not run.
2. **No Stripe TEST secrets** (`STRIPE_TEST_SECRET_KEY` / webhook secret) in this environment — hosted Checkout session creation and card charge against Stripe API were not executed; kill-switches remain OFF.
3. **Email provider** not wired — recovery returns token only when `CHRISTMAS_STORY_RECOVERY_RETURN_TOKEN=true` (staging).
4. **Mobile Chrome device QA** / cross-device Stripe UI not run in this agent session (no secrets + no preview host).
5. FFmpeg worker + manual licensed-song admin remain Mission **02D**.

---

## Compatibility

- PR #379 / #380 / #381: not merged; this branch forks from #381 tip only.
- Santa Call payment functions untouched.
- Dry-merge with Codex UI already integrated on baseline #381.

---

## Next: Mission 02D

Recommend Mission 02D for the FFmpeg memory-film worker, manual licensed-song administration, and premium demonstration media — only after Stripe TEST credentials + isolated Supabase Edge deploy are available for a true card-paid loop.
