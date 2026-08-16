# Launch checklist

**Verdict: NO-GO.** Do not merge PR #1 or PR #2. Do not enable production checkout. Do not deploy production.

Production GitHub environments (`Production`, `Production – the-digital-gifter`, `Production – the-digital-gifter-d5vu`) have **no protection rules**. `origin/main` `vercel.json` has **no** `ignoreCommand`. Merging PR #1 into `main` can publish the current site. A separate draft PR from `main` adds the production deploy skip (`ENABLE_PRODUCTION_DEPLOY=1` required). Merge **that** gate before PR #1.

## Must stay off

- [x] `productTruth.flags.checkoutEnabled` default `false` in git
- [x] `.env.example` `CHECKOUT_ENABLED=false`
- [ ] Vercel **Production** env: `CHECKOUT_ENABLED` unset/false, no `VITE_CHECKOUT_ENABLED`, no `ALLOW_STAGING_CHECKOUT`, no `sk_live_` on Preview
- [ ] `ENABLE_PRODUCTION_DEPLOY` unset on Production until an explicit go-live

## Release sequencing (before any product merge)

1. Merge **only** the production deploy-gate PR into `main` (draft until reviewed). Confirm a production Vercel build is skipped without `ENABLE_PRODUCTION_DEPLOY=1`.
2. Enable GitHub environment protection on `Production*` (required reviewers). Enable Vercel Deployment Protection for Production.
3. Do **not** merge PR #1 until step 1–2 are done. PR #1 still lacks `ignoreCommand`.
4. Keep PR #2 draft until staging E2E is PASS.
5. Enable production checkout only after one live €4.99 charge **and** refund on production keys, separately approved.

## Staging environment (Preview + Stripe test only)

Create these by hand. This agent could not: wrong Vercel team (`pdf-s` vs `tdg6`), production Supabase **INACTIVE**, no Stripe/Replicate/Resend secrets.

### Supabase

- [ ] New project `TheDigitalGifter-staging` (do **not** restore `aqpqgmrxptknezmqwqex`)
- [ ] Apply migrations **in order**: `20260813` → `20260814` → `20260815` → `20260816` → `20260817` → `20260818` → `20260819`
- [ ] Vault secrets `fulfillment_project_url`, `fulfillment_scheduler_bearer` (staging URL + staging service role)
- [ ] `select public.ensure_fulfillment_schedules();`
- [ ] `select public.fulfillment_schedule_status();` → `process-fulfillment-jobs` `* * * * *`, `purge-expired-media` `15 * * * *`
- [ ] `SUPABASE_DB_URL=... npm run verify:schedules` (live, not static)
- [ ] Buckets `customer-uploads` and `generated-results` **private**
- [ ] Confirm anon cannot `select` `generations`; authenticated cannot insert another user's `user_id`

### Edge Functions (staging project)

Deploy: `create-upload-url`, `confirm-upload`, `get-upload-preview`, `create-checkout-session`, `stripe-webhook`, `fulfill-paid-order`, `process-fulfillment-jobs`, `get-signed-result`, `redeem-result-access`, `request-included-regeneration`, `purge-expired-media`.

### Vercel Preview (team `tdg6` only)

Set on **Preview**, never Production:

- `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` → staging
- `VITE_CHECKOUT_ENABLED=true`
- `VITE_STRIPE_TEST_MODE=true`
- `CHECKOUT_ENABLED=true`
- `ALLOW_STAGING_CHECKOUT=true`
- `STRIPE_SECRET_KEY=sk_test_...`
- `STRIPE_WEBHOOK_SECRET=whsec_...`
- `STRIPE_PRICE_ID_STILL_IMAGE` (test price €4.99)
- `ACCESS_TOKEN_SECRET` and `FULFILLMENT_SECRET` (distinct)
- `SITE_URL` / `ALLOWED_APP_ORIGINS` → the protected preview origin
- `RESEND_API_KEY`, `RESULT_EMAIL_FROM`
- `REPLICATE_API_TOKEN` only after spend approval

Also set the same server secrets on the staging Edge Function vault.

### Stripe test

- [ ] Webhook endpoint → staging `stripe-webhook`
- [ ] Events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `charge.refunded`, `refund.created`
- [ ] Cards: `4242` success, `4000 0000 0000 0002` decline, cancel URL, expire session

## E2E sign-off (all must be live PASS)

Copy results into `docs/STAGING_E2E_REPORT.md`. Do not mark unit tests as live.

- [ ] JPEG/PNG upload
- [ ] Fake MIME and >10 MB rejected
- [ ] Stripe test pay success
- [ ] Decline / cancel / expire
- [ ] Duplicate webhook → one generation
- [ ] Refresh result page → no second generation
- [ ] Included regen once; concurrent regen one winner
- [ ] Job fail / retry / stale reclaim
- [ ] Resend success, failure, retry
- [ ] Guest token; signed-in owner; `session_id` insufficient
- [ ] Refund before, during, after fulfillment; no result email
- [ ] Signed URL + cleanup
- [ ] Cookie banner desktop + mobile screenshots

## After staging PASS

- [ ] Recalculate `docs/UNIT_ECONOMICS.md` from real Stripe + Replicate invoices
- [ ] One approved live €4.99 + refund (separate written approval, production keys)
- [ ] Then consider `GO FOR CONTROLLED LIVE TEST`
