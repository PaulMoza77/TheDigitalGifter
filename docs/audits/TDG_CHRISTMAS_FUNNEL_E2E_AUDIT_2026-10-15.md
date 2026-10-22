# Christmas AI Portrait Funnel · E2E Audit

**Date:** 2026-10-15  
**Repo:** `PaulMoza77/TheDigitalGifter`  
**Audit branch:** `cursor/christmas-funnel-audit-54fb`  
**Base / inspected HEAD:** `a63672e64b7e5cf69c6e9c1c7c2fdd6425b2a0b5` (`main`)  
**Environment:** Cloud agent personal env `0292fb57-aaee-11f1-b532-320a589b8025` · build `bld-20261014-3f0eee98-7704-47da-a958-42fada748c24`  
**Supabase project:** `kjlsocejpmnzhhduyumy` (ACTIVE_HEALTHY status; API restricted by storage quota)  
**Stripe MCP account:** `acct_1R7edvGD87aY9yHx` (**livemode only** — no sandbox/test account available in this session)  
**Scope:** Paid Christmas AI portrait purchase + delivery (`christmas_photo` / family / couple / pet)

**Safety:** No real customer charges. No secrets exposed. No production deploy. No production schema apply without approval. Migration + Edge code fixes landed on the audit branch only.

---

## Verdict: **NO-GO** for live purchase launch

Code path is largely wired; live end-to-end purchase/delivery cannot be proven and several production blockers remain.

**Unblock follow-up (same branch):** see `docs/audits/TDG_CHRISTMAS_UNBLOCK_ACTIONS_2026-10-15.md` — storage root cause (1.13 GB / 1 GB free), exact Resend DNS records, Stripe TEST prerequisites, portrait refund implementation, deployment plan.

---

## Stage results

| # | Stage | Code / automated | Live / production | Evidence |
| --- | --- | --- | --- | --- |
| 0 | Repo / branch / SHA / env | **PASS** | **PASS** | Remote `PaulMoza77/TheDigitalGifter`; `main` = `a63672e6`; branch `cursor/christmas-funnel-audit-54fb`; prod routes 200 |
| 1 | Product selection | **PASS** | **PASS** | Routes `/christmas/photo-generator`, `/family`, `/couples`, `/pets` HTTP 200; packages `purchasable=true` @ 499; `xmas_portrait` offer `web_checkout_enabled=true` |
| 2 | Image upload | **PASS** | **BLOCKED** | Code: signed upload → `christmas-source` via `christmas-photo-funnel`. Live Edge POST returns storage-quota restriction |
| 3 | AI generation (post-pay) | **PASS** | **BLOCKED** | Code: `christmas-photo-generate` paid gate + claim RPC. Prior synthetic proofs in docs; live invoke blocked by quota |
| 4 | Order creation | **PASS** | **BLOCKED** | Created inside `christmas-checkout`; live function restricted |
| 5 | Stripe checkout (sandbox) | **PASS** (code) | **BLOCKED** | Kill switch `CHRISTMAS_CHECKOUT_ENABLED`; Stripe MCP has **livemode only** — refused live charge tests |
| 6 | Webhook verify + fulfill | **PASS** (code) | **PARTIAL** | Live endpoints enabled to Supabase webhook URLs; events cover checkout completed/async; **no refund events** on TDG endpoints |
| 7 | Supabase persistence | **PASS** | **PARTIAL** | Tables present (`christmas_orders` 65 rows, assets 13, jobs 7). Edge runtime blocked by `exceed_storage_size_quota` |
| 8 | Resend domain / DNS / sender | **FAIL** | **FAIL** | `send.thedigitalgifter.com` Resend status **failed**; DNS for DKIM/SPF/MX on `send.*` empty. Only `volocar.eu` verified |
| 9 | Transactional email delivery | **PASS** (code fix) | **BLOCKED** / **FAIL** | Was fire-and-forget with no ledger (`christmas_email_deliveries` = 0; paid orders `delivery_email_sent_at` null). Branch adds `portrait_ready` ledger + Resend idempotency |
| 10 | Correct recipient / links / download | **PASS** (code) | **BLOCKED** | Recovery `?token=` + ~15m signed URL; not re-proven live under quota |
| 11 | Retries / idempotency | **PASS** (code + tests) | **BLOCKED** | Checkout `Idempotency-Key`, `processed_stripe_events`, claim RPC; branch re-enqueues on `already_paid` when fulfillment incomplete |
| 12 | Refunds / failures | **FAIL** (portrait) | **BLOCKED** | Portrait refunds not implemented (planner-only). TDG Stripe webhooks do not subscribe to `charge.refunded` |
| 13 | Admin visibility | **PASS** | **PARTIAL** | `/admin/christmas/orders` 200; reads orders + email deliveries; portrait email ledger was empty historically |

### Automated tests (this branch)

```
vitest: christmasPhotoGenerator, christmasFoundation, christmasPortraitVerticals,
        commercialOffers, christmasWiring
→ 5 files · 69 tests · PASS
```

---

## Production blockers (must clear before GO)

1. **Supabase storage quota exceeded** — Edge Functions return project restriction (`exceed_storage_size_quota`). Upload/checkout/generate cannot run.
2. **Resend sending domain failed** — `send.thedigitalgifter.com` DNS missing/failed; cannot reliably deliver transactional email from that domain.
3. **No Stripe test/sandbox account in session** — cannot run controlled Checkout + webhook proof without livemode charges (explicitly refused).
4. **Portrait refund path missing** + TDG webhook endpoints lack refund events.
5. **Migration not applied** — `20261015193000_christmas_portrait_email_kind.sql` must be applied before portrait email ledger writes succeed.
6. **Deploy gate** — Edge function updates (`christmas-photo-generate`, shared fulfill/email) not deployed (by design; needs approval).

---

## Safe code fixes on branch (not deployed)

| Change | Why |
| --- | --- |
| `portraitEmail.ts` + generate wiring | Ledger, status, Resend `Idempotency-Key`, `delivery_email_sent_at` |
| Migration `portrait_ready` kind | Allow ledger rows under existing check constraint |
| `stripeFulfill` `already_paid` re-enqueue | Recover when first enqueue failed and fulfillment still incomplete |
| Planner/V2 Resend Idempotency-Key | Align transactional sends with Resend best practice |
| Contract tests | Lock email ledger + replay + refund-gap expectations |

---

## Separation note

- **Code tests:** green on branch (contract/unit).  
- **Live production verification:** incomplete / blocked as tabled above. Do not treat historical synthetic fulfill/generate proofs as current live GO evidence while storage quota and Resend DNS remain failed.
