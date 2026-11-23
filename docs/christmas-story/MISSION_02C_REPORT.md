# Mission 02C — Real Staging E2E, Security and Stripe TEST Checkout

**Date:** 2026-11-23  
**Branch:** `feature/christmas-story-02c-staging-e2e`  
**Implementation tip:** `a90744c151481207c812b4f401148e6039f74760`  
**Baseline:** `integration/christmas-story-02a-02b` @ `addcfd60efabf925f0ad1b0dda0410f0f03bae3f` (Draft PR #381)  
**Draft PR:** (created after push — see GitHub PR for this branch)  
**Workspace:** `/Users/paul/tdg-christmas-story-02c`  
**Deployment:** **Not deployed.** No production migration. LIVE payments remain OFF.

---

## Database isolation

| Environment | Used? | Notes |
| --- | --- | --- |
| Production / remote Supabase | **No** | Only org-visible remote project was CasaHub (`ueqwvulubkauushhbely`) — **not touched** |
| Shared local Supabase (`kjlsocejpmnzhhduyumy`) | **No** for migrations | `supabase start` failed on unrelated `christmas_packages` migration; not used for 02C apply |
| Isolated Docker Postgres `tdg-story-02c-db` | **Yes** | `127.0.0.1:54332`, disposable container, story migrations only |

Migrations applied **only** to `tdg-story-02c-db`:

1. `20261123010000_christmas_story_durable_orders.sql` (audited)
2. `20261123120000_christmas_story_02c_hardening.sql` (EXECUTE lockdown, recovery challenges, expire RPC)

---

## Security audit (isolated DB)

Verified via SQL on `tdg-story-02c-db`:

- RLS **enabled** on all `christmas_story_*` tables (including recovery challenges).
- `anon` table privileges on story tables: **none**.
- `christmas_story_fulfill_payment` / `transition_order` / `expire_checkout` / `assert_transition`: **EXECUTE denied** to `anon`/`authenticated`; allowed for `service_role`.
- SECURITY DEFINER functions require `auth.role() = service_role`.
- Storage buckets `christmas-story-source` / `christmas-story-generated` created **private**; no public read policies.
- Recipient + recovery secrets stored as **SHA-256 only**.

---

## Isolated DB E2E evidence

Harness: `scripts/christmas-story-02c-db-e2e.mjs`

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

---

## Stripe TEST payment flow

| Requirement | Status |
| --- | --- |
| Hosted customer-facing Checkout URL | Implemented (`checkoutUrl`, no `ui_mode=custom`) |
| Server-authoritative $57 | `amount_cents=5700` enforced; client mismatch rejected |
| Success / cancel / expire / fail | `syncCheckoutStatus` + `christmas_story_expire_checkout`; cancel via `?checkout=cancel` |
| Webhook signature + idempotency | Existing TEST webhook + `processed_stripe_events` |
| Never PAID on session create | Confirmed in DB E2E + edge comments/tests |
| LIVE kill-switch | `STORY_OFFER.checkoutEnabled=false`; server requires `CHRISTMAS_STORY_CHECKOUT_ENABLED` |
| Santa Call payments | Untouched |

**Blocker — live Stripe TEST card charge:** no `STRIPE_TEST_SECRET_KEY` / `STRIPE_TEST_WEBHOOK_SECRET` available in this environment. Hosted session creation against Stripe API and browser card entry were **not** executed. Kill-switch remains OFF (`false`).

---

## Buyer experience (02C)

- Order page loads server order with buyer token; denied requests do **not** invent local success.
- Guest email recovery: `requestBuyerRecovery` / `redeemBuyerRecovery` with hash-at-rest challenges; staging may return token when `CHRISTMAS_STORY_RECOVERY_RETURN_TOKEN=true` (email provider not wired).
- Buyer preview audited separately; does not mark OPENED (DB E2E).
- Approve / send / schedule remain server-authoritative when API enabled.
- Truthful banners for `CHECKOUT_PENDING`, failed/cancelled, disabled local mock.
- Codex premium UI contracts preserved (additive wiring only).

---

## Browser / mobile Chrome QA

Not run in this agent session (no Stripe TEST credentials; no long-lived Edge stack after local Supabase migration failure). Contract tests + isolated DB E2E cover authorization boundaries.

---

## Test / build evidence

```text
vitest:
  mission02c.test.ts              9 passed
  mission02b.test.ts              9 passed
  christmasStory.test.ts          8 passed
  santa-call/santaCall.test.ts   14 passed
  santa/santaVideo.test.ts       14 passed
  commercialOffers.test.ts       12 passed
  TOTAL                            66 passed

tsc -p tsconfig.app.json --noEmit → exit 0
npm run build → success (exit 0)
isolated DB E2E → all checks passed
```

---

## Files touched (02C delta over #381)

- `supabase/migrations/20261123120000_christmas_story_02c_hardening.sql`
- `supabase/functions/christmas-story/index.ts` (recovery hash-at-rest alignment)
- `scripts/christmas-story-02c-db-e2e.mjs`
- `src/features/christmas-story/mission02c.test.ts`
- `docs/christmas-story/MISSION_02C_REPORT.md`

(Frontend hosted checkout + recovery UX already present on integration baseline `addcfd60`; 02C hardens schema + proves DB/security E2E.)

---

## Preserved PRs / branches

- PR #379 Codex UI — not modified  
- PR #380 Mission 02B — not modified  
- PR #381 integration 02A+02B — baseline only  
- Santa Call commerce — not modified  
- `main` / production — not deployed  

---

## Blockers

1. **No Stripe TEST secrets** in agent environment → cannot complete real card charge / signed webhook HTTP E2E.
2. **Full local Supabase stack** (`supabase start`) fails resetting on unrelated `christmas_packages.compare_at_cents` type error → Edge Function HTTP E2E deferred; DB RPC path verified in isolation.
3. **Email provider** not wired for recovery delivery (staging token return flag only).
4. FFmpeg worker + manual licensed song admin remain Mission **02D**.

---

## Next mission recommendation — 02D

1. VPS FFmpeg memory-film worker consuming `christmas_story_jobs`.  
2. Admin UI for manual licensed-song attach + commercial rights checklist.  
3. Premium demonstration media pack.  
4. Wire Stripe TEST secrets into isolated staging and run full hosted-checkout + webhook HTTP E2E.  
5. Keep LIVE kill-switch OFF until authorized.
