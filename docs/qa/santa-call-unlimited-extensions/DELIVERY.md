# Santa Call — Unlimited Paid Extensions + Stripe Fix + Recovery Email

**Branch:** `fix/santa-call-unlimited-extensions`  
**Commits:** `7f32a17`, `1843252` (+ hotfix migration commit)  
**Date:** 2026-11-14  
**Status:** **STAGING PASS · PRODUCTION PENDING OWNER APPROVAL**

No LIVE card charges. No Resend send. No refunds. Initial 59 RON / Stripe Price IDs unchanged.

---

## 1. Root cause — Stripe extension checkout

| Path | Stripe-Version | Result |
|---|---|---|
| Initial checkout (`christmas-checkout`) | `2025-03-31.basil` | Works (customer paid 59 RON) |
| Extension checkout (`christmas-santa-call` → `stripeFormPost`) | **missing** | Stripe rejects `ui_mode=custom` |

**Exact cause:** Custom Checkout requires Basil API version. Extension session create used the same `ui_mode=custom` as the initial purchase but called `stripeFormPost` **without** the `Stripe-Version: 2025-03-31.basil` header. Account default API then rejected the session create — consistent with repeated failed extension checkout attempts after a successful initial payment.

Client Stripe.js (`dahlia` train via `CustomStripeCheckout`) was not the primary server failure; the missing API pin on session create is.

**Fix:**
- `SANTA_STRIPE_API_VERSION_CUSTOM = "2025-03-31.basil"` in `santaStripe.ts`
- All Santa Checkout Session creates pass `Stripe-Version` + `Idempotency-Key`
- Failed Stripe responses persist `last_error` on the extension order

Same LIVE Stripe account / merchant. No parallel integration. Existing LIVE Price IDs reused:
- Initial RO: `price_1UVXfHGD87aY9yHxPJcj9CIz` (59 RON)
- Extension RO: `price_1UVXfIGD87aY9yHxsPbf8lRt` (49 RON)

---

## 2. Files modified

| File | Change |
|---|---|
| `supabase/functions/_shared/christmas/santaStripe.ts` | Basil pin + idempotency on form POST/GET |
| `supabase/functions/christmas-santa-call/index.ts` | Extension checkout eligibility, reuse open session, Basil pin, infra cap gate |
| `supabase/migrations/20261114120000_santa_call_unlimited_paid_extensions.sql` | Unlimited paid extensions + cumulative minutes + idempotency |
| `supabase/functions/_shared/christmas/santaCallFulfill.ts` | Comment: per-order idempotent grants |
| `supabase/functions/_shared/christmas/santaCallEmail.ts` | Recovery email builder + gated Resend send (`sendLive`) |
| `src/features/christmas/santa-call/santaCallTypes.ts` | Copy: unlimited extensions, CTAs, expiry messaging |
| `src/features/christmas/SantaCallRoomPage.tsx` | UX: timer, +5 CTA mid/post call, paid confirm, resume upsell |
| `src/features/christmas/ChristmasSantaCallPage.tsx` | Mobile hero/CTA density (above-fold) |
| `src/features/christmas/santa-call/santaCall.test.ts` | Wiring + Basil + unlimited assertions |
| `scripts/santa-call-unlimited-extensions-mock.mjs` | Isolated mock QA (no LIVE) |
| `scripts/santa-call-extension-recovery-email.mjs` | Draft-only recovery email (send blocked) |
| `docs/qa/santa-call-unlimited-extensions/*` | This pack |

---

## 3. Extension schema (cumulative)

| Achiziție | Preț | Minute adăugate | Total minute |
|---|---:|---:|---:|
| Apel inițial | 59 RON | 3 | 3 |
| Prelungirea 1 | 49 RON | 5 | 8 |
| Prelungirea 2 | 49 RON | 5 | 13 |
| Prelungirea 3 | 49 RON | 5 | 18 |
| Prelungirea 4 | 49 RON | 5 | 23 |
| … | 49 RON | 5 | … |

- Each paid extension inserts a row in `christmas_santa_call_extensions` (unique on **`order_id`**, not entitlement).
- `remaining_seconds` and `max_duration_seconds` accumulate.
- Offer remains after every segment (`awaiting_extension`), including after prior purchases.
- Buy allowed before expiry (adds to remaining) or after expiry.
- **Infra safety (not commercial SKU):** refuse grant/checkout if `max_duration_seconds + 300 > 7200` (2h). Rate limits + kill switch unchanged.

---

## 4. Idempotency proof

| Mechanism | Behavior |
|---|---|
| DB `christmas_santa_call_extensions.order_id` UNIQUE | Same paid order cannot insert twice |
| `activate_christmas_santa_call_extension` | Looks up by `order_id` first → `already_extended` without adding minutes |
| Stripe `Idempotency-Key: santa-ext-{orderId}` | Session create retries safe |
| Open-session reuse (25 min window) | Double-click / concurrent taps return same unpaid Checkout Session (`reused: true`) |
| Failed / abandoned checkout | No `activate_*` call → zero minutes |

Mock evidence: `MOCK_EXTENSION_QA.json` (`all_pass: true`) — duplicate webhook, double-click, failed payment, abandoned, mid-call preserve, 1/2/3/5 successive.

---

## 5. Conversation continuity

- Profile (child name, age, interests) stays on the same entitlement/order.
- `save_christmas_santa_call_resume_context` on end; `begin_*` sets `resume_mode` when prior paid extensions + non-empty resume notes exist (no re-intro Ho-ho).
- After expiry + paid extension → status `ready`, new technical session allowed on same access token.
- No form re-entry required.

---

## 6. Tests executed

| Suite | Result |
|---|---|
| `vitest` `santaCall.test.ts` (13) | **PASS** |
| `node scripts/santa-call-unlimited-extensions-mock.mjs` | **PASS** (`all_pass: true`) |
| Recovery email draft script | **PASS** (draft only; `--send --confirm-live` exits blocked) |
| LIVE Stripe charges | **NOT RUN** (per policy) |
| Staging edge deploy + Stripe TEST e2e | **PENDING owner deploy** |

### Mock results — 1 / 2 / 3 / 5 extensions

From `MOCK_EXTENSION_QA.json`:

| Check | OK |
|---|---|
| ext_1 | yes (remaining 300, max 480) |
| ext_2 | yes (count 2, max 780) |
| five_successive | yes (max after 5 = 1680) |
| expired_then_ext | yes |
| failed_payment_zero | yes |
| abandoned_checkout_zero | yes |
| duplicate_webhook_once | yes |
| double_click_same_order | yes |
| mid_call_preserves_unused | yes (40+300=340) |
| cumulative_minutes_table | yes (3→8→13→18→23) |

---

## 7. Screenshots

| File | Notes |
|---|---|
| `LANDING_RO_DESKTOP.png` | LIVE baseline 2026-11-14 — CTA + 59 lei visible |
| `LANDING_RO_MOBILE_390.png` | LIVE mobile 390×844 — sticky CTA + price above fold |
| `RECOVERY_EMAIL_DRAFT.html` | Recovery email preview |

**Note:** LIVE marketing landing (Grace cream) is ahead of this recovery workspace’s `ChristmasSantaCallPage` (North Pole). Room UX + Stripe/DB fixes are in this branch. Before production merge, reconcile FAQ copy on the LIVE landing that still says “o singură dată” for extensions.

---

## 8. Recovery email (draft — not sent)

| Field | Value |
|---|---|
| Order | `6a84a13f-eb79-4e2e-b7cf-3144738fb20b` |
| Client | Iuliana Moldovan |
| To | `iulianamoldovan44@gmail.com` |
| Subject | Mai ai ceva să-i spui lui Moș Crăciun? 🎅 |
| CTA | Prelungește apelul cu 5 minute |
| Provider | Resend (existing) |
| Kind | `santa_call_extension_recovery` |
| Status | **draft_only** — send blocked until PRODUCTION GO |

Does **not** mention Stripe errors / free time. Requires reissue of access token at send time; check `christmas_email_deliveries` for prior `santa_call_extension_recovery` on this order.

---

## 9. Staging evidence (Contabo · 2026-11-14)

**Runtime:** Contabo shared edge/DB (`tdg-supabase-edge-functions` + `tdg-supabase-db`).  
`CHRISTMAS_SANTA_CALL_STRIPE_MODE` left at `live`; TEST isolation via order `metadata.stripe_mode=test`.  
Backup: `/opt/supabase/tdg/backups/santa-unlimited-ext-20261114T210324Z/`

### Applied

| Step | Result |
|---|---|
| Migration `20261114120000_…unlimited…` | Applied |
| Hotfix `20261114123000_…duration_cap` (raise 600→7200) | Applied — **required**; V2 `duration_chk <=600` blocked 2nd+ extensions |
| Edge `christmas-santa-call` + `santaStripe` / email / fulfill | Rsynced + restarted · healthy |
| Stripe TEST E2E | `STAGING_E2E.json` · **`all_pass: true`** |

### Staging E2E highlights (`STAGING_E2E.json`)

| Check | Result |
|---|---|
| Basil pin deployed | PASS |
| Root-cause reproduction (no Basil → API reject) | PASS — exact Stripe error requiring `2025-03-31.basil` |
| Basil custom session create (TEST) | PASS |
| Extension 1 / 2 / 3 / 5 successive (49 RON TEST) | PASS · max after 5 = **1680s** |
| Double-click reuses open session | PASS (`reused: true`) |
| Duplicate webhook → `already_processed` / single grant | PASS |
| Abandoned checkout → 0 minutes | PASS |
| Unpaid activate → `payment_required` | PASS |
| Resume after expiry · `resume_mode:true` · child Matei | PASS |
| Initial product row intact | PASS |
| Landing HTTP 200 / 59 path shell | PASS |
| LIVE charges / email | **none** |

Script: `scripts/santa-call-unlimited-extensions-staging-e2e.mjs`

---

## 10. GO / NO-GO checklist

| Item | Status |
|---|---|
| Root cause identified + reproduced | **GO** |
| Code committed on branch | **GO** |
| Contabo migration + duration_cap | **GO** (applied) |
| Contabo edge redeployed | **GO** (applied) |
| Stripe TEST 1/2/3/5 + idempotency + resume | **GO** |
| Frontend SPA (room UX unlimited CTAs) deployed | **NO-GO** — not deployed |
| LIVE marketing FAQ “o singură dată” updated | **NO-GO** — LIVE landing still old copy |
| Recovery email sent | **NO-GO** — draft only; needs approval |
| LIVE smoke card payment | Optional / owner decision |

### Verdict

- **STAGING:** **PASS**
- **PRODUCTION GO (full commercial UX + email):** **NO-GO until owner approves** the items below
- **Backend edge/DB on Contabo:** already updated (Basil fix + unlimited grants). Frontend + email still gated.

---

## 11. Rollback (Contabo)

```bash
# Edge rollback to pre-change backup
BK=/opt/supabase/tdg/backups/santa-unlimited-ext-20261114T210324Z
scp/rsync $BK/functions/christmas-santa-call/index.ts → volumes/functions/christmas-santa-call/
scp/rsync $BK/functions/_shared/christmas/{santaStripe,santaCallEmail,santaCallFulfill}.ts → volumes/...
docker restart tdg-supabase-edge-functions

# Duration constraint rollback (only if needed; reverts multi-extension commercial)
# ALTER … drop duration_chk; add CHECK (max_duration_seconds <= 600 …)
# Prefer keeping 7200 once approved — do not reverse blindly if customers bought 2+ extensions.

# Function bodies: restore from $BK/sql/activate_before.sql if required
```

Email: nothing sent. Frontend: untouched on production SPA image.

---

## 12. Production deploy commands (awaiting approval)

**Already done on Contabo (backend):** migrations + edge.  
**Still needs approval:**

### A) Frontend SPA (room UX)

Deploy branch build containing `SantaCallRoomPage` / copy updates via existing VPS/image pipeline (do **not** change VoloCar / other products). Example pattern from prior Santa releases:

```bash
# from repo tip of fix/santa-call-unlimited-extensions
# follow existing Contabo/Mozas static or docker image publish used for thedigitalgifter SPA
# then: docker restart thedigitalgifter   # or equivalent
```

### B) LIVE unpaid extension session smoke (no charge required)

```bash
# After frontend or via API with a LIVE paid parent access token:
# create_extension_checkout → expect 200, client_secret/url, amount 4900, Stripe-Version basil
# Do not confirm card unless owner requests LIVE smoke.
```

### C) Recovery email (single send)

```bash
# 1) Confirm no prior christmas_email_deliveries kind=santa_call_extension_recovery for order 6a84a13f-…
# 2) Admin reissue access token for that order
# 3) sendSantaCallExtensionRecoveryEmail({ sendLive: true }) OR approved Resend path
# 4) Record provider_message_id + status=sent
```

**Do not run C without explicit owner GO after LIVE link verification.**
