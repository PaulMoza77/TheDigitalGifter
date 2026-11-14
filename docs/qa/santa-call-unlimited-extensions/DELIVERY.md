# Santa Call — Unlimited Paid Extensions + Stripe Fix + Recovery Email

**Branch:** `fix/santa-call-unlimited-extensions`  
**Date:** 2026-11-14  
**Status:** **STAGING READY / PRODUCTION NO-GO** (awaiting owner approval after deploy + TEST verification)

No LIVE test charges. No Resend send executed. No refunds. Initial 59 RON price unchanged. Stripe Price IDs unchanged.

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

## 9. GO / NO-GO checklist

| Item | Status |
|---|---|
| Root cause identified | GO |
| Code fix on branch | GO |
| Unlimited model + idempotency | GO (code + mock) |
| Unit + mock QA | GO |
| Migration applied on Contabo/prod DB | **NO-GO** until deploy |
| `christmas-santa-call` edge function redeployed | **NO-GO** until deploy |
| Stripe TEST extension create with Basil verified | **NO-GO** until staging |
| Frontend room/landing deployed | **NO-GO** until deploy |
| LIVE FAQ “o singură dată” reconciled | **NO-GO** until landing merge |
| Recovery email sent | **NO-GO** — needs explicit owner approval after LIVE link verify |
| LIVE smoke payment | Owner decision only |

### Verdict: **PRODUCTION NO-GO**

Safe to merge to staging and run Stripe TEST. Not safe to claim PRODUCTION GO without deploy evidence + TEST extension session create success.

---

## 10. Rollback

1. Redeploy previous `christmas-santa-call` edge bundle.
2. Do **not** drop columns; optional: re-apply prior function bodies from `20261024180000` / `20261024190000` if needed.
3. Frontend: revert branch deploy.
4. Email: no send occurred — nothing to recall.
5. Paid extensions already granted (if any after partial deploy) remain customer-owned — do not revoke without refund policy decision.

---

## 11. Deploy sequence (after approval)

1. Apply `20261114120000_santa_call_unlimited_paid_extensions.sql`.
2. Deploy `christmas-santa-call` + shared modules.
3. Stripe TEST: force awaiting → create_extension_checkout → confirm Basil session → webhook → +300s → repeat 2–3×.
4. Deploy frontend.
5. Verify LIVE extension session create (unpaid open session OK; no need to complete card until owner wants smoke).
6. Owner approves → reissue token for order `6a84a13f-…` → send one Resend recovery email → record `provider_message_id`.
