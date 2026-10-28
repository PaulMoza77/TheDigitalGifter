# Santa V3 — Real Customer Email + Link/Button QA

**Date:** 2026-10-28  
**Verdict for email CTA / delivery plumbing:** **GO for email path**  
**Overall commercial / Meta Ads:** still **NO-GO** (prior LIVE card + iPhone mic blockers unchanged)

## 1. Email actually sent

**YES** — exactly one production-template send to `rentalcarsoradea@gmail.com`  
Type: isolated **noncommercial email-preview entitlement** (banner labeled; not a fabricated LIVE Stripe charge)

## 2. Resend message ID

`01a18360-2a08-79e0-8ef9-621a3c3de77e`

- API: `email_sent=true`
- DB `christmas_email_deliveries`: `santa_call_ready | sent | 2026-10-28 16:38:00.059+00 | attempt_count=1`
- Duplicate fulfill → `already_sent` (same message id); delivery row count remains **1**

## 3. Exact subject and sender

| Field | Value |
|---|---|
| Subject | `🎅 Apelul cu Moș Crăciun este pregătit!` |
| From | `Christmas <christmas@send.thedigitalgifter.com>` |
| Reply-To | `support@thedigitalgifter.com` |
| To | `rentalcarsoradea@gmail.com` |
| Child | Grace |
| Amount | 59,00 RON |
| Duration | 3 minute / 180s |
| Timestamp (UTC) | 2026-10-28T16:38:00Z |

**Inbox receipt:** not claimed (no mailbox integration / owner confirmation yet).

## 4. Screenshots (rendered HTML preview)

Production template HTML rendered for desktop + iPhone 13 viewport (token redacted in committed preview):

- `artifacts/santa-call-benchmark/SANTA_V3_EMAIL_DESKTOP.png`
- `artifacts/santa-call-benchmark/SANTA_V3_EMAIL_MOBILE.png`
- `artifacts/santa-call-benchmark/SANTA_V3_EMAIL_RENDER_PREVIEW.html`

Notes: diacritics OK, CTA visible, no horizontal overflow in preview, plain-text fallback URL under button, no external image dependency for CTA.  
Actual iPhone Gmail / Apple Mail / Gmail desktop inboxes were **not** opened in this run.

## 5. Complete link / button audit

| Link | Destination | Result |
|---|---|---|
| Brand | `https://www.thedigitalgifter.com` | **PASS** HTTPS 200 |
| Primary CTA | `https://www.thedigitalgifter.com/santa/call/<token>?lang=ro` | **PASS** (see §6) |
| Support | `https://www.thedigitalgifter.com/support` | **PASS** HTTPS 200 |
| Privacy | `https://www.thedigitalgifter.com/privacy` | **PASS** HTTPS 200 |
| Terms | `https://www.thedigitalgifter.com/terms` | **PASS** HTTPS 200 |
| localhost / staging / Stripe TEST / QA tokens in URLs | none found | **PASS** |
| TEST QA overlay (`/_qa/santa-qa`) | not used | **PASS** |

## 6. Primary CTA destination + entitlement

Order `8ba8aa96-2a8c-4050-bb9e-ba6d49bb1105` · entitlement `65fc2259-95b8-43f7-8dc6-39ff00a13a09`

| Check | Result |
|---|---|
| Domain `thedigitalgifter.com` + HTTPS | **PASS** |
| Path `/santa/call/:token` (not landing) | **PASS** |
| HTTP shell 200 via commercial bridge (`/_qa/santa-live` assets; **not** santa-qa TEST) | **PASS** |
| Public `resolve` → `ok:true`, `status:ready`, child `Grace`, `remaining_seconds:180` | **PASS** |
| `active_session:false`, sessions count `0` (timer not started / not consumed) | **PASS** |
| No sensitive customer PII in public URL (opaque token only) | **PASS** |

## 7. Automatic post-purchase email trigger

| Requirement | Status |
|---|---|
| Trigger after server fulfill on paid order | **PASS** (fulfill → `sendSantaCallReadyEmail`) |
| Entitlement created before/with email | **PASS** |
| Idempotency key + DB unique `(order_id,kind)` + `already_sent` guard | **PASS** |
| Email failure does not unwind paid entitlement | **PASS** (activate first; email errors logged) |
| Extension fulfill does **not** send initial confirmation | **PASS** (extension path has no ready-email send) |
| Durable outbox retry worker for transient Resend failures | **PARTIAL** — `queued/failed/sent` + `attempt_count` recorded; **no background retry worker** yet |

## 8. Remaining blockers before commercial GO

1. Owner confirms this email arrived in Gmail inbox  
2. Controlled LIVE card smoke (exact amount confirmation) still outstanding  
3. Real iPhone Safari mic/audio pass still outstanding  
4. Optional hardening: durable email retry worker for failed Resend deliveries  
5. Meta Ads still **NO-GO** pending separate approval + LIVE purchase evidence  

## Safety notes

- No LIVE card charged  
- No Meta campaigns  
- Preview order clearly labeled noncommercial (`email_preview_test`, banner in email)  
- No other recipients  
