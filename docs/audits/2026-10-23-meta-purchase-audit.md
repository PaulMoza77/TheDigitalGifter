# Meta Ads purchase readiness — 2026-10-23

**Decision: NO-GO. These statuses describe production, not the unshipped patch.**

1. **Meta Pixel: FAIL.** Production HTML and desktop/mobile browser requests initialize dataset `1581639566935542`; the requested dataset is `1673980440655322`.
2. **PageView: BLOCKED.** Production HTML queues PageView and SPA code handles pathname changes, but browser capture saw configuration requests only, no `facebook.com/tr` event receipt. Requested-dataset delivery and Events Manager acknowledgement are unverified.
3. **ViewContent: FAIL.** Photo-generator page analytics sends internal events; no Meta ViewContent dispatch exists on that route in the inspected production source.
4. **InitiateCheckout: FAIL.** Photo-generator hosted pack checkout has no Meta dispatch. The alternate V2 embedded screen uses the shared pet helper, which hardcodes USD and a pet SKU, despite the current EUR Christmas packs.
5. **Purchase: FAIL.** Pack confirmation polling emits `christmas_v2_purchase` internally, not Meta Purchase. The older portrait helper is a different order flow and does not cover the pack order confirmation.
6. **CAPI: NOT CONFIGURED.** Both production origin and Supabase Edge report no META_CAPI_ACCESS_TOKEN. Pet CAPI implementation exists in source; Christmas pack fulfillment has no corresponding CAPI sender. No token was created or installed.
7. **Deduplication: BLOCKED.** No paid transaction was performed. Existing portrait tracking uses session storage only. The proposed pack helper uses a stable order event ID and persistent browser storage; this is covered by local tests, not verified against Meta.
8. **Stripe TEST checkout: BLOCKED.** Origin and Edge both report LIVE Stripe secrets. No isolated TEST application/database and TEST webhook were established. No charge, checkout session, test order, or customer data mutation was performed.
9. **Mobile funnel: BLOCKED.** At 390×844, homepage and photo-generator render without horizontal overflow or uncaught page exceptions. CTA reaches `?step=upload` with one file input. Upload transfer, generation, payment, persistence, email and downloads remain untested.
10. **Production readiness: NO-GO.** Purchase and payment funnel are not verified end to end.

## Actual evidence and scope

- Public production was inspected with HTTP fetches and Playwright Chrome (desktop 1440×1000; mobile emulation 390×844).
- With no consent, both routes had no fbq and no Facebook requests. After acceptance, both loaded `fbevents.js` and `/signals/config/1581639566935542`. This proves script/config loading, not event receipt.
- Console capture showed existing nested-anchor React errors in the footer. Some Google Analytics requests were aborted. No successful Meta event receipt was observed; neither Pixel Helper nor Events Manager was available.
- Fresh consent after load on **photo-generator** did load fbq. The delayed-loader bug is specifically on **/christmas**, whose source enables defer: it previously registered a load listener even when load had already occurred. Local regression tests verify its correction.
- Production image: `mozas/thedigitalgifter:generations-eur-20261022`. Origin checkout flag false; Edge checkout flag true. The frontend prefers Edge, so the origin flag alone does not mean public checkout is disabled. Both environments use LIVE Stripe; Edge reports a configured webhook secret. Neither has a Pixel environment override or CAPI token.
- Read-only remote SHA-256 checks matched local pre-patch source for:
  - `src/features/christmas-v2/api.ts`: `b538985d5584a278088c8b46fe26f3c720fd76409093e4380f37c5f45f95d412`
  - `src/features/christmas-v2/ChristmasV2FunnelPage.tsx`: `b3c22bb55a60abaf01543372dd203135091ae3a1bcb157bf74d331bf47be9ccf`
  - `api/christmas-funnel.ts`: `6d14334db6f4e09c0770dbb2e505d9a51e8b3d0168e4c6060cd615e81dfa04e8`
- Production HTML references patched asset names absent from a normal local build. Runtime source matches the three checked files, but complete deployment reproducibility is not established. The workspace contains existing uncommitted product/pricing work; the draft PR excludes that work and must not be used to redeploy an older full release.
- There were **no staging tests, Stripe TEST transactions, Events Manager confirmations, Event Match Quality measurements, or real sales**.

## Proposed remediation (unshipped)

- Align browser initializer, shared constant and CAPI fallback with the explicitly supplied Pixel ID. Confirm account ownership before rollout; do not add a second initializer.
- Correct consent-after-load on /christmas; cancel delayed loading after rejection; send Meta consent revoke/grant when preferences change.
- Add Christmas-specific ViewContent and checkout events without the pet SKU/USD assumption. Checkout comes from successful server checkout creation, with server amount/currency.
- Add Meta Purchase from the server order polling response only when paidAt is valid, status is paid/fulfillment, amount is positive and currency is present. Failed/canceled/unpaid orders do not qualify. Node and Edge summaries expose stored currency and paidAt. The helper does not derive payment from a return URL.
- Persist order deduplication across reloads/return visits, reuse `christmas_purchase_{orderId}`, and skip emission when storage is unavailable. Meta deduplication across browser/server is not claimed; there is no configured Christmas CAPI.
- Default checkout attribution to the existing captured attribution, covering the hosted photo-generator call that omitted it. Existing convention: `utm_source=facebook&utm_medium=paid_social&utm_campaign=tdg_living_memory_us&utm_content=grandma_family_video`.
- Price definitions, LIVE keys, order data and campaigns are unchanged. No deployment occurred.

## Validation

- Isolated PR worktree: 13 targeted tests passed; `npm run lint` passed (TypeScript project build plus Vite production build).
- Existing working copy plus the minimal patch: 25 focused tests passed across five files (Meta helper, consent loader, shared Pixel, Christmas config, photo-generator integration contract).
- Standalone ESLint encountered pre-existing unnecessary assertions and missing `convex/tsconfig.json` in the test-file parser configuration. It is not claimed clean. The repository's documented lint command is `tsc -b --pretty false && vite build`.
- Build warnings concern existing Tailwind configuration and large chunks.

## Remaining launch gates

1. Provide authorized Meta account access; verify the campaign's selected data source is `1673980440655322`, domain/data-source permissions, Test Events receipt, Purchase value/currency, and browser/server event matching where applicable.
2. Establish an isolated Stripe TEST deployment/database with TEST publishable and secret keys, TEST webhook signing secret, and an email delivery sink. Do not substitute TEST credentials into the LIVE service.
3. Use a non-customer sample image to verify upload, generation/error handling, displayed/charged totals, successful TEST payment, webhook retry, failed/canceled/abandoned payments, database persistence, email and downloadable delivery. Refresh/reopen confirmation and verify one Purchase.
4. Review consent revocation and automatic Meta page URL collection on token-bearing order routes before rollout. Custom event data excludes tokens/email/photos, but this audit does not prove automatic PageView URL redaction.
5. Reconcile the PR with the actual production release's currently uncommitted pack changes. Repeat focused tests/build and mobile/desktop TEST funnel on that exact candidate.
6. Obtain the owner's explicit production deployment approval. Keep the campaign off until all gates pass.

## Rollback

No production change needs rollback now. If subsequently approved and deployed, restore the previous frontend artifact and previous Edge function bundle together; the added response fields require no migration. Alternatively revert this PR's single remediation commit and rebuild the same reviewed release. Do not restore old product pricing from the PR base or change Stripe LIVE keys. Keep advertising off until the reverted/new candidate has been verified.
