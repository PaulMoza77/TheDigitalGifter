# TDG Higgsfield fulfillment audit — 24 October 2026

**Verdict: NOT READY.** No paid provider calls or customer emails were authorized or performed. Real generation is **BLOCKED by the owner's explicit denial of costs**. This supersedes any interpretation of the RC's “READY FOR CONTROLLED DEPLOY” as end-to-end product readiness.

## Versions and evidence limits

Read-only production inspection now finds origin image `mozas/thedigitalgifter:home-occasions-20261024T070221Z`, digest `sha256:d6dd03090c8d57329031115ab0cd47208fe33c03194fb5e0ee40d5cee1b4c059`. It differs from the image inspected on 23 October. Targeted origin and active Edge source were captured again. Hashes: `2026-10-24-higgsfield-production-hashes.json`.

PR #374 remains draft at `1b0f9651`; separate PR #375 contains video fixes. The existing combined local candidate is `release/christmas-374-375-rc` at `7ff132ef`. This audit does not merge either PR, deploy anything, apply SQL, or overwrite the dirty primary checkout. Earlier uncommitted edits in a vanished temporary checkout are not claimed preserved. Existing fixes in #375/RC were inspected instead of reconstructing stale fixes.

## Complete Christmas style inventory

The companion JSON/CSV enumerate **32 enabled portrait styles and all 19 pack scenes**, with exact production names and identifiers, prompt quality assessment, selection persistence and source mapping. These are configuration/code results, not 51 generated outputs. Every row's current production video outcome is **FAIL**.

- All 32 portrait styles have still-image prompts. None has a dedicated video prompt resolved by the current pack checkout. Only `cozy_fireplace`, `winter_wonderland`, `classic_christmas` map to scene keys; the other 29 select default pack scenes. Even the mapped three lose their original style ID. Source: `src/features/christmas/useChristmasPortraitFunnel.ts`, `startPackCheckout`.
- Still prompt/display mismatches include Luxury Christmas → vintage, Christmas Morning → movie street/porch, Snowy Cabin → North Pole, Elegant White Christmas → golden evening, Christmas Market → workshop. A nonempty prompt does not establish quality.
- Production video worker uses the same generic Christmas motion for every scene. It preserves faces/clothes/background in text, asks for breathing and fairy lights/snow/fire, and says no aggressive camera moves. It omits explicit duration in the prompt, a precise camera lock, style-specific motion and sufficient subject-count/anatomy constraints. Prompt quality **FAIL** for all 19 production scenes.
- The integrated RC improves all 19 known scenes: distinct scene motion, five seconds, exact faces/ages/body proportions, stable lighting, nearly locked camera/micro push-in, no cuts/orbits, no morphing/extra people/limbs/text. **PASS for textual prompt design of those 19 keys**, after reading their motion content; output/style fidelity remains **BLOCKED**. Unknown keys still get a generic fallback. It does not repair the 32-style checkout mapping, so style-to-purchase verification remains **FAIL**.

Scope limitation: Santa and Pet are separate customer-visible products, not Christmas pack scene variants. `classic_santa` is the only enabled Santa template; its other five keys are reserved. Santa uses a separate generated Santa reference, not the purchaser's portrait, and its five-second silent motion/greeting mood is not proof of a delivered spoken personalized message. Pet exposes 12 scene IDs (`royal-portrait`, `luxury-ceo`, `astronaut`, `formula-racer`, `spa-bathtub`, `newspaper`, `cinema-boss`, `renaissance`, `beach-vacation`, `head-chef`, `original-superhero`, `christmas-portrait`); its inspected worker invokes Replicate with a generic motion prompt. **BLOCKED for a site-wide “every style uses Higgsfield” claim**; these separate pipelines are not certified by the Christmas inventory. Do not advertise site-wide success.

## API and generation

**Configuration: PASS for presence only / BLOCKED for validity and model acceptance.** Active Edge has HF_CREDENTIALS, RESEND_API_KEY and CHRISTMAS_EMAIL_FROM present; secret values were not printed or changed. Code selects `kling-video/v3.0/pro/image-to-video`, body `image_url`, resolved `prompt`, `duration:5`, `sound:"off"`. Availability to this account, credit balance, accepted parameters, real job ID and provider output are unverified. No POST was sent.

**Real generation, playable output, selected-style fidelity and original-subject preservation: BLOCKED.** The owner explicitly declined costs. No mock is accepted as proof. Existing RC evidence has a video download HTTP 200 of **24 bytes**, `model_name:mock`; it is a marker, not a playable movie.

**Retries/timeouts: FAIL for readiness.** Production submission retries POST three times after arbitrary errors, including ambiguous timeouts, without a provider idempotency guarantee. Polling is bounded by attempts but per-fetch time adds to elapsed duration; timeout is not cancellation. Production root worker lacks atomic per-video claims and recovery safeguards. RC still updates a video to generating by ID without a status-conditioned atomic claim, so concurrent invocations can submit duplicate billed jobs. Neither downloaded bytes nor codec/duration are validated before labeling storage `video/mp4`. Provider error/recovery behavior has not been executed against Higgsfield.

## Payment → generation → account → email

**Production workflow: FAIL.** Active checkout imports the pinned V2 bundle, while public `christmas-generate-video` queries `christmas_orders`, `christmas_order_scenes`, `christmas_order_videos`. Actual packs are in `christmas_v2_*`. The active photo generator queries V2 scenes but calls commerce `christmas_finalize_generation_if_done`. These concrete schema mismatches break the promised chain. A `paid_at` check exists, but is insufficient evidence of a working paid pack flow.

**Combined RC orchestration: PASS only for existing isolated mock evidence; BLOCKED for real fulfillment.** Prior committed evidence records authorized Volocar Stripe TEST Magic payment EUR 17, livemode false, paid webhook, 5 mock photos, 1 mock marker video and local email sink after its completed_at. Starter/Magic/Ultimate create-order job counts were 0/1/3. This does not prove provider fulfillment, playback or delivery to an authenticated customer. Production migration required by RC has not been applied by this audit.

**Private storage: PASS for configuration; BLOCKED for actual generated video.** Current buckets `christmas-source-photos` and `christmas-generated` are private; generated bucket allows video/mp4. This is not a playback/expiry/access-control test. Signed download lifetime in code is one hour. No real video storage object, expiry wait or two-customer negative request is proved here.

**Account delivery: FAIL for UI completeness / BLOCKED for runtime isolation.** `ChristmasGenerations.tsx` receives videos but renders only photo thumbnails and an Open results link. Production results show only videos with URLs, hiding failures; the RC adds results playback/download/status improvements, but account library still lacks video rendering. Polling still stops when photo progress reaches 100% and any photo exists, even if entitled videos are pending. Refresh/relogin persistence, mobile playback/download, customer A vs B isolation and signed URL renewal/expiry need runtime verification. Order polling uses a bearer public token; possessing that URL grants access, so email/customer identity checks alone cannot prove isolation against leaked links.

**Email notification: BLOCKED for actual provider/inbox delivery; FAIL for durable retry readiness.** Resend configuration exists and idempotency key is order+kind; a sent row suppresses sequential repeats. No authorized inbox was supplied and no external email sent. The renderer's result link contains the public bearer token. Consent-gated Meta SDK/Clarity can run on that token-bearing page; sanitizing custom data does not sanitize the SDK's automatic document URL. Token privacy needs network verification and prevention, not a PASS. Concurrent send claims and durable retry scheduling are not demonstrated. RC can send a partial-results email after terminal video failure, even with zero successful videos; this differs from the requested notification only once the purchased video is ready. Duplicate webhook suppression in Stripe TEST does not prove concurrent completion-email deduplication or provider failure recovery.

## Packages

**PASS for current production configuration and displayed pack definitions:** Starter €7, 3 photos/0 videos; Magic €17, 5/1; Ultimate €27, 10/3. JSON values in the freshly captured production `config.ts` match. No price, product, LIVE credential or checkout was changed. Old COGS estimates retain stale counts/model assumptions and must not be treated as entitlements or verified Higgsfield costs. Real Magic/Ultimate production delivery remains unproved.

## Exact release blockers

1. Preserve every selected portrait style in the order and resolve its matching server-owned image/video prompts; eliminate ignored/default style selection.
2. Reconcile and review #374 + #375/RC against the newly observed production release; fix V2 worker/finalizer routing and review required SQL. No deployment approval is implied.
3. Make paid video claims atomic, prevent duplicate submissions on ambiguous failures, recover persisted request IDs and validate actual video bytes/duration before success.
4. Keep polling through video completion; render successful/pending/failed videos in the authenticated library and verify playback/download on mobile.
5. Prove customer isolation, persistent account association, private object retrieval, signed-link expiry/renewal and protection of bearer tokens from tracking.
6. Gate purchased-video completion email on actual successful readiness; implement/prove durable safe retries and concurrent deduplication, using an authorized test inbox only.
7. Real Higgsfield generation and visual fidelity remain BLOCKED by the no-cost instruction. An owner-run paid test is still required after technical blockers are repaired.
8. No site-wide claim until the separate Santa/Pet pipelines are audited or explicitly excluded from the promise.

No production writes, LIVE payments, campaign publication, merge or deployment were performed in this continuation. Audit artifacts alone are being added to draft PR #374; existing RC code remains separate and reviewable.

## Validation performed in this continuation

- Fresh TypeScript project build on integrated RC `7ff132ef`: **PASS** (`tsc -b --pretty false`, exit 0; no diagnostics). Rechecked after installing lockfile dependencies into isolated audit worktree. No package lock change.
- Fresh targeted Vitest: **BLOCKED**. The runner produced no startup/results for over 120 seconds; stopped. Earlier direct npm build attempt also failed with `tsc: command not found` because the original dependency symlink pointed to a removed worktree. Dependencies were installed locally using `npm ci --ignore-scripts`; a direct TypeScript invocation then completed. Both Node 26 and bundled Node 24 attempts to start Vite/Vitest stalled. This is a local tooling blocker, not a reported test assertion failure or a PASS.
- Fresh Vite production build: **BLOCKED** at startup; no successful new production artifact. Previous RC report's 32 passing tests/build remains historical evidence only.
- Prior audit run, before the temporary worktree disappeared: 57 tests across 6 files passed with explicit local public Supabase configuration; TypeScript/Vite passed. That run predates the new production image and RC integration and cannot validate this release.
- Audit JSON: 51 complete rows; CSV has the same rows. Captured production hashes recorded. Canvas transpilation syntax check: no diagnostics; live viewer rendering is unverified.
- `git diff --check`: PASS for the audit update. This continuation changes audit documents only; no application source or environment credentials.
