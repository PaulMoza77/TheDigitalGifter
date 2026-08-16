# Staging E2E report

**Verdict: NO-GO** for a controlled live test.

**Source commit:** `b22b32f` (PR #2 HEAD) plus this staging branch `cursor/staging-e2e-b22b32f` (`d600613`).  
**Related drafts:** [PR #2](https://github.com/PaulMoza77/TheDigitalGifter/pull/2) (fulfillment), [PR #3](https://github.com/PaulMoza77/TheDigitalGifter/pull/3) (this staging branch), [PR #4](https://github.com/PaulMoza77/TheDigitalGifter/pull/4) (production deploy gate from `main`). PR #1 stays draft.  
**Date:** 2026-08-15  
**Checkout in production:** still **OFF** (`productTruth.flags.checkoutEnabled = false`, `CHECKOUT_ENABLED=false`).  
**PR #1 and PR #2:** remain **draft**. Nothing was merged. Production was not deployed. No live Stripe charge and no Replicate call were made.

This file records what was actually executed. Unit and PGlite tests are labeled as such. They are **not** live staging tests.

## Access verification

| System | Status | Evidence | Smallest manual action |
| --- | --- | --- | --- |
| Staging Supabase | **BLOCKED** | CLI is logged in. Project `TheDigitalGifter` (`aqpqgmrxptknezmqwqex`, eu-central-1) is **INACTIVE**. No isolated staging project exists. This agent did **not** restore or write to that project (likely production). | Create a **new** project named `TheDigitalGifter-staging` in org `TheMozas's Org`. Do **not** restore `aqpqgmrxptknezmqwqex`. Paste the staging project ref, anon key, service role, and DB URL into Vercel **Preview** env only. |
| Vercel Preview settings | **BLOCKED** (partially observed) | GitHub deployments exist for SSO-protected previews (`tdg6`). Latest `b22b32f` preview: `https://the-digital-gifter-l1rx8c2wj-tdg6.vercel.app` returned **HTTP 302 to Vercel SSO**. This CLI is logged into team `pdf-s` / project `pdf-site` only — not `tdg6`. GitHub Preview environments have **no protection rules**. | From an account on team `tdg6`: `vercel link` this repo, add Preview-only env vars listed in `docs/LAUNCH_CHECKLIST.md`, keep Production `CHECKOUT_ENABLED` unset/false, and add Vercel SSO + GitHub environment reviewers. |
| Stripe test mode | **BLOCKED** | No `STRIPE_SECRET_KEY`, Stripe CLI, or Dashboard session in this environment. | Create a Stripe **test** account/keys (`sk_test_…`, `whsec_…`). Set them only on Vercel Preview and the staging Edge Function secrets. Never put `sk_live_` on Preview. |
| Replicate | **BLOCKED** | `REPLICATE_API_TOKEN` is missing. No call was made. | Add a staging Replicate token as a Preview/Edge secret. Before the first paid prediction, approve a spend cap (recommended **USD 1.00** for the matrix below). |
| Resend | **BLOCKED** | `RESEND_API_KEY` is missing. No email was sent. | Add a staging Resend key and a verified `RESULT_EMAIL_FROM`. Use a tester inbox you control, not customer addresses. |

Local env files: only `.env.example` is present. No `.env`, `.env.local`, or Vercel link for TheDigitalGifter.

## Configuration (requested vs done)

| Step | Status | Notes |
| --- | --- | --- |
| Isolated staging branch | **PASS** | `cursor/staging-e2e-b22b32f` from `b22b32f`. Checkout can turn on only for non-production Vercel env + `VITE_CHECKOUT_ENABLED=true` + `VITE_STRIPE_TEST_MODE=true`. Server also requires `ALLOW_STAGING_CHECKOUT=true` and `sk_test_`. Production builds stay off. |
| Apply `20260813`–`20260819` | **BLOCKED** | No staging database. Migrations were **not** applied live. |
| Vault + cron | **BLOCKED** | No staging Vault. `npm run verify:schedules` is **static only** (passed on `b22b32f`). Live `SUPABASE_DB_URL` check skipped. |
| Deploy Edge Functions | **BLOCKED** | No staging project. Functions were not deployed. |
| Staging-only secrets | **BLOCKED** | Cannot write Vercel/Supabase secrets from this CLI (wrong Vercel team; no staging Supabase). |
| Stripe test webhook | **BLOCKED** | No Stripe access. |
| Private buckets / RLS / signed URLs | **NOT TESTED** live | PGlite RLS tests on `b22b32f` **PASS** (unit/embedded Postgres). Live buckets were not inspected. |

## E2E matrix

Legend: **PASS** = executed with real evidence. **FAIL** = executed and failed. **BLOCKED** = could not run. **NOT TESTED** = not attempted. Unit/PGlite results are in a separate column and are **not** live.

| Case | Live staging | Prior automated evidence (not live) |
| --- | --- | --- |
| Valid JPEG/PNG upload | **BLOCKED** | Unit: `validateImageUpload` accepts JPEG/PNG magic bytes (**PASS** locally) |
| Fake MIME rejected | **BLOCKED** | Unit: renamed text file rejected (**PASS** locally) |
| File over 10 MB rejected | **BLOCKED** | Unit: oversized file rejected (**PASS** locally) |
| Successful Stripe **test** payment | **BLOCKED** | — |
| Declined card | **BLOCKED** | — |
| Canceled checkout | **BLOCKED** | — |
| Expired checkout | **BLOCKED** | Unit: expiry confirmed only on HTTP 2xx + `status=expired` (**PASS** locally) |
| Duplicate webhook | **BLOCKED** | PGlite: duplicate `claim_mvp_order_paid` does not enqueue a second job (**PASS** locally) |
| Exactly one initial generation | **BLOCKED** | State machine + paid-claim SQL (**PASS** locally) |
| Result-page refresh does not generate again | **BLOCKED** | Claim/skip already-complete path exists in code; **NOT TESTED** live |
| Included regeneration works once | **BLOCKED** | PGlite sequential claim (**PASS** locally) |
| Two concurrent regenerations, one winner | **BLOCKED** | CI `postgres:16` concurrent test **PASS** on PR #2 Actions; skipped locally (no Postgres server) |
| Fulfillment failure, retry, stale-job recovery | **BLOCKED** | PGlite requeue + stale reclaim (**PASS** locally) |
| Email success / failure / retry | **BLOCKED** | Unit: `result_emailed_at` stamped only after Resend success (**PASS** locally) |
| Guest token and authenticated ownership | **BLOCKED** | Unit: `authorizeOrderAccess` (**PASS** locally) |
| Session ID alone cannot access a result | **BLOCKED** | Static: `get-signed-result` ignores `session_id` (**PASS** via `verify:edge`) |
| Refund before / during / after fulfillment | **BLOCKED** | PGlite: refund vs active job leaves order `refunded`, no result email (**PASS** locally) |
| Refunded/canceled never overwritten, no result email | **BLOCKED** | Same PGlite test (**PASS** locally) |
| Signed result access and media cleanup | **BLOCKED** | Unit cleanup pager + static purge checks (**PASS** locally) |
| Cookie consent desktop | **BLOCKED** | Preview is Vercel SSO. Banner code exists (`CookieBanner`). No screenshot. |
| Cookie consent mobile | **BLOCKED** | Same. |

### Live IDs and telemetry

| Field | Value |
| --- | --- |
| Stripe payment/session/event IDs | **none** (not run) |
| Order / generation / job transitions | **none** (not run) |
| Replicate predictions | **0** |
| Duration / MIME / dimensions | **n/a** |
| Email result | **n/a** |
| Retry/duplicate live behavior | **n/a** |
| Cleanup / cron live status | **n/a** |
| Screenshots | **none** (SSO blocked preview) |

## Paid-call hold

Stripe **test** payments were allowed. They were **not** executed (no keys).

**Replicate / live Stripe:** not started. If staging is configured later, stop and approve before the first paid Replicate prediction.

Recommended cap for the full matrix: **USD 1.00** (about 8–20 `google/nano-banana` images at ~$0.039 each, including retries). Do not exceed the approved amount.

## Checks that did run (not staging)

On `b22b32f` (PR #2): `npm run typecheck`, `npm test` (62), `npm run verify:edge` (36 Deno files), `npm run verify:schedules` (static), `npm run build`, `git diff --check origin/cursor/product-truth-cleanup-0c35...HEAD`, GitHub Actions `ci` **success**.

This staging branch adds checkout-gate unit tests and the Preview-only runtime gate. Production checkout remains false until Preview env flags are set **and** `VITE_VERCEL_ENV !== "production"`.
