# TDG launch remediation — 2026-10-23

**Verdict: NO-GO.** PR #374 contains the reconciled candidate and isolated test harness. Production, LIVE secrets and the campaign were not changed. The owner explicitly confirmed **Pixel 1673980440653322** and authorized the **Volocar Stripe sandbox for TDG tests** during this session.

## Exact remaining blockers

1. **Meta receipt remains unverified.** Authenticated Events Manager for **TheDigitalGifter (1877103439548293)** lists **TheDigitalGifter Pixel 1673980440653322**, with 0 events for September 25–October 22 and no integrations. The original requested ID `1673980440655322` was a mismatch; the owner corrected it. I opened Test events → Website, entered the isolated local candidate URL, clicked Test Events and accepted consent in the opened browser. No received events appeared. Pixel dispatch tests below are not proof of Meta receipt. Manual follow-up: keep this exact dataset’s Test Events open, verify its Website integration/domain permissions and browser blocking, then run the candidate on an approved isolated preview URL (or repair local test receipt) and confirm PageView/ViewContent/InitiateCheckout/Purchase, EUR 7 and the stable order event ID. Do not activate the campaign. Any hosted preview deployment requires owner approval under the current instruction.
2. **Real AI provider generation is unverified.** The payment/webhook test used the existing mock generation branch. It validates storage, finalization and downloads, not actual image/video generation. Validate provider success/error paths with an authorized demo image on the isolated environment. Magic/Ultimate video outputs are not covered by the successful Starter test.
3. **Real transactional email transport is unverified.** The actual email renderer and database persistence ran and the message was captured locally. No Resend request or real inbox delivery occurred. Provide an authorized provider test sink/inbox, keep customer addresses unavailable and verify delivered contents and links.
4. **Final release/privacy checks and approval remain.** Review automatic Pixel URL collection on token-bearing order routes, verify referenced media on a build of the reconciled candidate, and obtain explicit merge/deployment approval. No public/staging or production deployment occurred. Full served-asset equivalence is not claimed: production has manually suffixed historical bundles/media. No GO until these gates pass.

## Exact production reconciliation

- Captured running `/app/src`, `/app/api`, `/app/server`, release build config, Edge source and schema/function definitions. Image: `mozas/thedigitalgifter:generations-eur-20261022`, digest `sha256:a356458bb89178d25b883f4b38fdbe71c99fe1e4db590341b2477d480c7db76f` at inspection.
- Imported existing uncommitted production changes and their missing source dependencies into PR #374, then retained remediation overrides. `scripts/meta-audit/release-manifest.json` records captured source hashes. The larger diff includes existing production UI/library changes so the PR cannot revert to its outdated pre-release base. These are reconciliation changes, not new product proposals.
- Frontend pack config, origin pack constants, photo-generator checkout hook and experience match the captured running source **byte for byte**. Prices remain **EUR 7 / 17 / 27**. Displayed entitlements remain Starter **3 photos / 0 videos**, Magic **5 / 1**, Ultimate **10 / 3**. No prices, products, checkout mode or LIVE Stripe credential changed.
- Actual Edge checkout is an import wrapper for `_christmas_v2_6d533ec7a8cac492`. Preserved that deployed bundle and its differing historical SKUs. Added server currency to new/reused checkout responses; retained its existing paidAt/currency order fields.
- Production payment RPC already rejects unpaid status and amount/currency mismatch. Reconciled its existing definition into a migration and verified that migration **only locally**. No production SQL mutation occurred.
- Fixed a verified V2 delivery bug: the active generator used `christmas_v2_*` tables but called commerce `christmas_finalize_generation_if_done`. Live SQL inspection proves that function queries different tables. Candidate calls `christmas_v2_finalize_generation_if_done`; local mock completion passes.
- Fixed StrictMode initial PageView/ViewContent duplication observed in the browser tests. Purchase persists order deduplication; valid server paidAt/status/amount/currency are required.
- Existing remote `stripe-webhook-test` was not used: its `isolation=tdg_e2e` branch can obtain the production service client. Local testing has a separate Supabase project/database, storage, functions and email capture. No production customer rows were imported.
- Both production payment servers retain LIVE credentials. CAPI remains unconfigured; no token was invented or installed.

## Verified evidence

Detailed machine-readable evidence: `2026-10-23-meta-remediation-evidence.json`. Scope is explicit for every result.

### Actual authorized Stripe TEST payment and webhook

- User authorized sandbox account `acct_1R7edvGD87aY9yHx`; launcher verifies the account ID and refuses LIVE keys. Starter demo PNG (2,578,414 bytes) uploaded through signed local storage, confirmed, then actual deployed Edge checkout code created `cs_test_a1mmLpRYCa9cwzoBnd3hJPtSNLGxUJjm1jP3tHi9koXQkxTOp13mDWw1JE`.
- Completed hosted Checkout using Stripe’s standard TEST Visa, EUR selected, synthetic name/email only. Stripe API confirms **livemode:false, status:complete, payment_status:paid, amount_total:700, currency:eur**. No real funds moved.
- Actual Stripe event **`evt_1UTorZGD87aY9yHxxN405RZ2`, checkout.session.completed**, arrived through the TEST Stripe CLI listener at the local production webhook implementation. Local DB records `fulfilled`; order **`ec8c6930-2ac7-4435-a2b8-54f39f4affd0`** persisted paidAt, charged_amount_cents 700 and currency EUR, then completed mock fulfillment.
- Replaying that actual Stripe event with the local listener signature returned HTTP 200 `already_processed`. Exactly one generation job and one `starter_ready` email row exist for this order. This is an actual TEST payment/first webhook plus locally re-signed replay; not a claim of Stripe Dashboard resend.
- All specified UTMs persisted in actual Checkout Session metadata: facebook / paid_social / tdg_living_memory_us / grandma_family_video.

### Actual declined, canceled and abandoned TEST checkout

- Separate order **`02c2895f-8da9-4639-a17b-56f8c42e2628`**, actual TEST session `cs_test_a196Dc3u1523fV8ye7kQ6jCnUmC83iYgUfIBgL9QywaRaPR9m7CPbiTQ0o`.
- Stripe’s documented declined TEST card displays a rejection. Stripe API reports **card_declined / generic_decline**, PaymentIntent `requires_payment_method`, session unpaid. Followed the browser cancel link to the local `?checkout=canceled` route, then expired the TEST session to model abandonment.
- Session is **expired/unpaid**; local order remains **awaiting_payment**, paidAt null. Desktop/mobile intercepted Pixel checks on this actual unpaid order produce **zero Purchase calls**, including refresh.

### Local browser events / consent / mobile

- Desktop 1440×1000 and mobile emulation 390×844: zero page exceptions, no horizontal overflow at upload; file input accepts the demo image.
- Before consent: fbq undefined and no captured events. After consent: init for owner-confirmed **1673980440653322**, exactly one initial PageView and ViewContent. Checkout dispatch once with value 7/currency EUR. Actual TEST paid order emits one Purchase using `christmas_purchase_{orderId}`; refresh emits none. Browser/Meta traffic is intercepted in these automated checks, so this verifies dispatch only.
- Consent-loader tests verify late acceptance on an already-loaded /christmas page and rejection during the deferred loading interval. Negative payment/currency/amount tests reject emission.
- Authenticated Chrome Test Events attempt was separate from the automated local capture and produced no verified receipt. Existing nested-anchor React console warnings and browser-extension warnings were observed; no uncaught page exceptions in automated desktop/mobile checks.

### Local delivery and email scope

- Real TEST payment triggers the existing generation mock branch. Three demo-copy result objects persist, V2 finalizer marks the order complete, and all three signed download URLs return **HTTP 200**, 2,578,414 bytes each. These are demo copies, not AI-generated product evidence.
- The actual email renderer reads the purchased order, renders the Starter ready email and local order link, and persists one `starter_ready` sent row **to the local capture transport** for `stripe-e2e@example.invalid`. No real customer or external inbox contacted.
- Before the actual payment test, separate local synthetic fixtures also proved HTTP 400 for unpaid/mismatched amount/mismatched currency; a locally signed webhook rejected a bad signature and deduplicated retries. Those fixture results remain distinctly labeled.

### Checks

- **35 tests passed across 9 files.** Meta helpers, consent, production reconciliation, pack config, photo-generator/hook behavior, navigation and slider regression tests.
- **TypeScript + Vite production build passed** via `npm run lint`; 155 Christmas SEO shells generated. Existing Tailwind/chunk-size warnings remain.
- Targeted standalone ESLint on App and the Meta helper passed. Prior broader ESLint/test-parser issues are not claimed fixed.
- Local migration compilation and staged diff whitespace checks passed. New harness/pinned bundle scan found no Stripe secret, webhook secret or LIVE publishable key literal.

## Gate statuses

1. Meta Pixel: **BLOCKED** — correct ID confirmed/configured in candidate; production still uses 1581639566935542 and no new deployment is authorized.
2. PageView: **BLOCKED** — local dispatch passes; Meta receipt absent.
3. ViewContent: **BLOCKED** — local dispatch passes; Meta receipt absent.
4. InitiateCheckout: **BLOCKED** — real TEST initiation + local dispatch pass; Meta receipt absent.
5. Purchase: **BLOCKED** — actual TEST payment + paid-order dispatch/reload checks pass; Meta receipt absent.
6. CAPI: **NOT CONFIGURED** — unchanged, optional; no false server receipt claim.
7. Deduplication: **PASS in isolated local/Stripe TEST scope** — one actual webhook event processed, replay ignored, one job/email, one browser Purchase and none on refresh. Browser/server Meta dedup is not applicable without CAPI.
8. Stripe TEST checkout: **PASS for Starter hosted flow** — actual paid EUR 7 session and real CLI webhook verified; actual decline/cancel/expiry remain unpaid.
9. Mobile funnel: **BLOCKED for full readiness** — responsive upload and browser event checks pass; actual payment was desktop, real provider/video output not verified.
10. Production readiness: **NO-GO**.

## Review, operation and rollback

PR #374 remains draft. Local harness docs: `scripts/meta-audit/README.md`; setup uses only `tdg-isolated-stripe` and loopback ports 583xx/584xx. Its captured SQL is schema-only and local-only, including a deliberately denying local `is_admin()` helper; it must never be applied to production. No credentials or local token-bearing artifacts are committed.

Review the captured production baseline separately from tracking and V2 finalizer fixes. No production rollback is needed. For a later explicitly approved release, record current frontend image/Edge bundles, deploy only the reviewed reconciled candidate and revert to those exact artifacts if needed. Preserve existing prices, product definitions, LIVE secrets and customer data. Keep the campaign unpublished until all blockers pass.
