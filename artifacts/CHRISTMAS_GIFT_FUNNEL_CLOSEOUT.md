# Christmas Gift Tree Funnel — Closeout Report

## STATUS

`PARTIAL`

Closeout advanced redemption, catalog contract tests, and migration tooling.
Remote migration apply remains blocked without `SUPABASE_DB_PASSWORD` / `SUPABASE_ACCESS_TOKEN`.
Live Stripe/Resend/Apple Pay end-to-end against production was not fully exercised in this environment.

## PR

- Number: #91
- Branch: `cursor/christmas-gift-funnel-f2dc`
- HEAD (pre-commit): `dcf98ae3ff091ef536852f1ca5054409150795fd`
- Base: `main`

## TREE FREEZE EVIDENCE

Approved pre-funnel baseline commit: `5642c3ac71650840ffdf3799f8bd4c7c99378123` (Fix desktop gift clicks…).
Funnel implementation commit: `94f4d580302b4f59c0e8c40aa739c950f7ae97be`.

### Media SHA-256 (baseline == HEAD)
- `public/christmas/gifts/scene-desktop.mp4`: head=2a3f8b7a42dee7cb341679f403b889c84c56524ac7e156d0fa854b596715556f baseline=2a3f8b7a42dee7cb341679f403b889c84c56524ac7e156d0fa854b596715556f match=YES
- `public/christmas/gifts/scene-mobile.mp4`: head=9b8b7ca9c11d31113f7343fb79afe4360475af826866989174798b5a0db3d389 baseline=9b8b7ca9c11d31113f7343fb79afe4360475af826866989174798b5a0db3d389 match=YES
- `public/christmas/gifts/gift-open.mp4`: head=36bdf0bc06f6bdd56465a2774d5f4cb3541a3ac051d454737a7e0b879d0feae8 baseline=36bdf0bc06f6bdd56465a2774d5f4cb3541a3ac051d454737a7e0b879d0feae8 match=YES
- `public/christmas/gifts/scene-desktop.jpg`: head=8ab2b0064bd6b3493b4577b8eb60ec1962c0538276f1834633509a75ffab6748 baseline=8ab2b0064bd6b3493b4577b8eb60ec1962c0538276f1834633509a75ffab6748 match=YES
- `public/christmas/gifts/scene-mobile.jpg`: head=8d049988fc51a47147fe27e01fe6aa8f0ba75d32ca094050b25b8e916256b3cd baseline=8d049988fc51a47147fe27e01fe6aa8f0ba75d32ca094050b25b8e916256b3cd match=YES
- `public/christmas/gifts/tree-hero-desktop.jpg`: head=8e7086a50d33a18e0eb981a479f3ccb73afae061dd452303209538f237cc5dcc baseline=8e7086a50d33a18e0eb981a479f3ccb73afae061dd452303209538f237cc5dcc match=YES
- `public/christmas/gifts/tree-hero-mobile.jpg`: head=182cdc2d5453d288d521ae1823b887e9e8a17d5fd28d80f49dfe291db5926c60 baseline=182cdc2d5453d288d521ae1823b887e9e8a17d5fd28d80f49dfe291db5926c60 match=YES

### Component / framing notes
- Funnel commit did **not** modify scene MP4/JPG/hero assets.
- Post-funnel commit `dcf98ae` fixed cover-math inversion + gift-safe object-position (wide viewport was cropping presents). This is a **bugfix for gift visibility**, not a redesign of the approved scene.
- Soft idle hotspot glow added in that same visibility fix so presents remain discoverable once in frame.
- `TreeLightLayer` remains unused by the page (video carries lighting).
- No `ChristmasTreeScene` / `GiftOpenCeremony` asset path changes.


## MIGRATION

- Files:
  - `supabase/migrations/20260904210000_christmas_gift_tree.sql` (product + packs seed)
  - `supabase/migrations/20260905150000_christmas_gift_tree_funnel.sql` (opens ledger, entitlement columns, RPCs, $1.99/$4.99 purchasable)
- Target project: `kjlsocejpmnzhhduyumy` (from `supabase/config.toml` + live REST)
- Apply mechanism: `scripts/apply-christmas-gift-tree-migrations.sh`
- Result: **BLOCKED in this agent** — secrets include service role only; no `SUPABASE_DB_PASSWORD` / `SUPABASE_ACCESS_TOKEN`
- Pre-apply live readback:
  - `christmas_gift_tree` product: **missing**
  - `christmas_gift_tree_opens`: **missing**
  - entitlement funnel columns (`email_normalized`, `redeemed_at`, …): **missing**
  - packages `open_another`/`open_five`: **missing**
- After founder applies script, verify with REST:
  - product `christmas_gift_tree`
  - packages priced 199 / 499, `purchasable=true`
  - RPCs `christmas_gift_tree_remaining_opens|grant_opens|consume_open`
  - metadata `opens_granted`

## PRODUCTION ARCHITECTURE

- Frontend: Vite SPA on Mozas (`thedigitalgifter` container) + public domain `www.thedigitalgifter.com`
- Same-origin Node API: `/api/christmas-gift-tree` (Vercel rewrite + Mozas `server/routes.mjs`)
- Edge fallback: `christmas-tree-funnel`
- Checkout: Edge `christmas-checkout` (Express Checkout / Payment Element)
- Webhook: Edge `stripe-webhook` → `_shared/christmas/stripeFulfill.ts`
- Email: Resend via Node claim path (`claimGiftEmail`)

## REWARD CATALOG

Active weighted pool (sum 100):

| id | weight | entitlement | claim |
|---|---:|---|---|
| credits_10 | 24 | gift_tree_credits_10 | /generator?occasion=christmas |
| credits_25 | 20 | gift_tree_credits_25 | /generator?occasion=christmas |
| santa_discount_15 | 18 | gift_tree_santa_discount_15 | /christmas/santa-video |
| free_image | 12 | gift_tree_free_image | /christmas/photo-generator |
| christmas_portrait | 10 | gift_tree_christmas_portrait | /christmas/family |
| pet_portrait | 8 | gift_tree_pet_christmas_portrait | /christmas/pets |
| gift_token | 5 | gift_tree_extra_open | /christmas/gifts |
| credits_50 | 2 | gift_tree_credits_50 | /generator?occasion=christmas |
| gift_tree_discount_25 | 1 | gift_tree_premium_discount_25 | /christmas/tree |

Paid packs: `open_another` $1.99 / 1 open; `open_five` $4.99 / 5 opens.

Contract test: `giftTreeCatalogContract.test.ts` fails if Node↔Edge catalogs drift.

## FREE VIDEO REWARDS

- Live product `christmas_santa_video` exists and checkout/generate paths are real.
- **Not** added as a fully-free Santa video reward: no server-side “free Santa generation” entitlement consume existed previously; variable video COGS is higher than stills.
- Included safely: **15% off Santa Video** (`gift_tree_santa_discount_15`) with checkout auto-apply after migration.
- Free stills/portraits (`gift_tree_free_image`, portrait entitlements) now redeem at checkout as $0 orders when entitlement present (post-migration).

## EXPECTED REWARD COST

Using repo COGS notes (`christmas-v2/config.ts`: nano-banana ~$0.04/img; Seedance ~$0.08/5s):

- credits weights (46%) → ledger credits only (no immediate provider COGS)
- free_image 12% × ~$0.04 ≈ $0.0048
- portraits 18% × ~$0.04 ≈ $0.0072
- santa discount 18% → COGS only if user purchases (discounted revenue, not free fulfill)
- gift_token 5% → another weighted draw (recursive expected cost ≈ 0.05 × E)
- Approximate **E[variable COGS / free open] ≈ $0.01–$0.02** excluding credit liability and excluding discounted Santa purchases.

## IDENTITY

- Guest hash on open; email claim persists first then sends mail; authed user_id link on claim.
- Guest→user attach implemented in Node claim path.
- Paid opens while guest: webhook stores `guest_token_hash`; email claim patches opens ledger email.
- Full multi-browser proof still requires migration + live Resend.

## EMAIL

- Code path: persist entitlement email → Resend transactional.
- Live send in this environment: **not verified** (no Resend key in agent secrets; Mozas container env not confirmed for RESEND).
- Founder gate: one real claim email after migration.

## STRIPE

- Server packs: `open_another` 199¢, `open_five` 499¢ (catalog + migration + fulfill).
- Client amount ignored in `christmas-checkout`.
- Webhook grants opens via `christmas_gift_tree_grant_opens` with `stripe_order:{orderId}` idempotency.
- Live charge proof: **blocked** until migration + Stripe test/live keys exercised.

## APPLE PAY

- Uses Stripe Express Checkout Element (no custom Apple Pay button).
- Physical iPhone Safari: **manual gate** (checklist below).

## WEBHOOK

- Gift tree product skips generation enqueue; grants opens.
- Duplicate `source_ref` returns `already: true`.
- Discount entitlements marked `redeemed_at` after paid checkout (new).
- Live event replay: pending migration/credentials.

## CONCURRENCY

- SQL `christmas_gift_tree_consume_open` uses `FOR UPDATE SKIP LOCKED`.
- Unit/SQL live concurrency proof: pending migration apply.

## MY GIFTS

- Route `/account/gifts` lists entitlements with Create/Use CTAs.
- Status `redeemed` now writable via checkout/webhook redeem paths (post-migration).

## AUTO REDEMPTION

- Credits: Node grant to `credits_ledger` note `christmas_gift_tree:{year}:{entitlementId}` (idempotent).
- Free image/portrait: checkout detects entitlement → $0 order → mark redeemed → enqueue generate.
- Discounts: checkout auto-applies % off; UI shows “Christmas Gift applied”; consume on paid webhook.
- Requires migration columns before production use.

## ANALYTICS

- Allowlisted gift-tree funnel events in `funnelEventContract` (tested).
- Live pipeline observation: not captured in this closeout run.

## TESTS

```
npm test -- --run src/features/christmas/gifts/
```
Result: **19 passed** (cover box, catalog/state, Node↔Edge contract, redemption helpers).

## BUILD

```
npm run build
```
Result: **success**.

## FILES CHANGED IN THIS CLOSEOUT

- `supabase/functions/_shared/christmas/giftTreeRedemption.ts` (new)
- `supabase/functions/christmas-checkout/index.ts` (auto discount/free redeem)
- `supabase/functions/_shared/christmas/stripeFulfill.ts` (redeem on paid)
- `supabase/functions/_shared/christmas/giftTreeRewards.ts` (paid offers + daily idempotency)
- `src/features/christmas/gifts/giftTreeRedemption.ts` (Node mirror)
- `src/features/christmas/gifts/giftTreeCatalogContract.test.ts` (new)
- `src/features/christmas/ChristmasSantaVideoPage.tsx` / `ChristmasPortraitFunnelPage.tsx` (gift applied UI)
- `scripts/apply-christmas-gift-tree-migrations.sh` (new)
- `artifacts/CHRISTMAS_GIFT_FUNNEL_CLOSEOUT.md`

## REMAINING RISKS

1. Migration not applied to `kjlsocejpmnzhhduyumy` yet.
2. Live email / Stripe / Apple Pay not production-proven in this agent.
3. Edge funnel still lags some Node actions until redeployed with synced catalog.
4. Free Santa video intentionally not offered (COGS + missing prior free-video consume path).

## MERGE READINESS

**NO** — keep draft until migration applied + one live email + one paid open webhook proof.

## PHYSICAL DEVICE CHECKLIST

1. Open production `/christmas/gifts` in Safari.
2. Confirm tree/video starts immediately and looks unchanged.
3. Tap a present.
4. Confirm reward reveal.
5. Enter test email.
6. Confirm email arrives.
7. Select `5 more gifts — $4.99`.
8. Confirm native Apple Pay button appears.
9. Pay.
10. Return to tree.
11. Confirm `5 gifts waiting`.
12. Open one.
13. Confirm `4 remaining`.
14. Open `/account/gifts`.
15. Confirm both rewards.
16. Redeem/Create one reward.
17. Confirm entitlement/discount actually applies.
