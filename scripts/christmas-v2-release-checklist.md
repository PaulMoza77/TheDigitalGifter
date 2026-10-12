# Christmas V2 — Offline E2E Smoke & Release Checklist

**PR:** https://github.com/PaulMoza77/TheDigitalGifter/pull/353  
**Branch:** `cursor/christmas-v2-eur-p0-7cbb`  
**Offline QA HEAD:** _(updated on each release-prep commit)_  
**Security PR:** https://github.com/PaulMoza77/TheDigitalGifter/pull/356  
**Self-host audit:** https://github.com/PaulMoza77/TheDigitalGifter/pull/358  

**Hard stop:** no merge, production deploy, DB write, live Stripe charge, paid Higgsfield, secrets/DNS/Caddy/Docker changes, Contabo password recovery, or customer messages from agents.

---

## 1. Offer contract (code-verified)

| Pack | Price | Images | Clips |
|------|-------|--------|-------|
| Starter | €7 (`700` cents) | 3 | 0 |
| Magic | €17 (`1700`) | 5 | 1 |
| Ultimate | €27 (`2700`) | 10 | 3 |

Canonical files (must stay byte-identical): `src/features/christmas-v2/offers.ts`, `api/_lib/christmas/offers.ts`, `supabase/functions/_shared/christmas/offers.ts`.

Upsells = **pack upgrades only**. **Golden Frame / regenerate** = legacy ResultPage only — **not** Christmas V2.

---

## 2. Offline evidence (latest pass)

| Check | Result | Evidence |
|-------|--------|----------|
| Vitest `src/features/christmas-v2` + `platformSecurity` | **PASS** | 84+ tests (re-run after release-prep commits) |
| `tsc -b` / `vite build` | **PASS** | prior turn + targeted re-run after UX fixes |
| Funnel E2E Chromium | **PASS** | viewports include desktop-1440, mobile-390, mobile-375 |
| Funnel E2E Firefox | **PASS** | |
| Funnel E2E WebKit | **PASS** after host libs | Prior FAIL was **environment** (missing `libwayland-server`, `libavif`, etc.), **not** a Safari product defect. Repro after deps: brand visible ~1s; full `CV2_E2E_BROWSERS=webkit` **ok:true**. |
| Fixture UI | **PASS** | `?fixture=1` banner — not production AI/payment evidence |
| Live Stripe / paid HF / Meta live | **BLOCKED** | secrets unset / spend approval |

Artifacts: `/opt/cursor/artifacts/christmas-v2-qa/`, `/opt/cursor/artifacts/christmas-v2-funnel-e2e/`.

### Safari / WebKit verdict

**ENV limitation (resolved for offline QA), not a product Safari rendering defect.**  
`cv2-brand` lives in `ChristmasV2Shell` and renders once the lazy route hydrates. Earlier WebKit timeouts coincided with missing MiniBrowser shared libraries under `PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS`. After installing host deps, WebKit funnel E2E passes. No CSS/JS Safari-only bug found requiring a product fix.

---

## 3. GDPR / refunds / VAT — founder decision checklist

Do **not** invent compliance approval. Mark decisions before production GO.

### Refunds — OPEN / BLOCKED (live matrix)

- [ ] Approve Refund Policy wording for **one-time EUR packs** (current page is credits-centric: `/refunds`)
- [ ] On Stripe refund of a paid V2 order: mark `refunded`? revoke downloads? stop generation?
- [ ] Partial refunds for `partial_failure` / total `failed` — policy vs support-only?
- [x] CV2 UI links to `/refunds` + support (shell footer + results) — code shipped offline
- [ ] Stripe refund webhook → `christmas_v2_orders` (today planner/commerce path only) — **OPEN** product gap
- [ ] Stripe test refund matrix — **BLOCKED** (secrets)

### Customer data deletion / GDPR retention — OPEN

- [ ] Retention TTL for paid source photos (`christmas-source-photos`) and generated media (`christmas-generated`)?
- [ ] Automated purge for unpaid abandoned uploads?
- [ ] Extend `delete-my-account` to `christmas_v2_*` + order-id storage paths (today covers legacy `christmas_orders` / userId prefix only)?
- [ ] Guest/token-only order erasure path (email/token)?
- [ ] Privacy Policy CV2-specific retention language before GO?
- [x] Privacy link in CV2 footer — code shipped offline

### Failed generation / email — PASS mechanics / OPEN ops

| Item | Status |
|------|--------|
| Finalize `complete` / `partial_failure` / `failed` | **PASS** |
| Defer email until entitled videos finish | **PASS** |
| Scene/video attempt limits + no double paid submit | **PASS** |
| Customer copy for partial/total failure | **PASS** (results outcome UI) |
| Dedicated `partial_failure` email kind | **OPEN** (schema exists; senders use `*_ready`) |
| Resend failure retry worker | **OPEN** |

### VAT / tax — BLOCKED (founder)

Checkout shows “Tax · Not calculated here” + `cv2-tax-blocked-note`. No `automatic_tax` / `tax_id_collection` on CV2 Checkout Sessions.

1. Enable Stripe Tax (`automatic_tax`) for Christmas V2?
2. Collect tax IDs (`tax_id_collection`)?
3. Are €7 / €17 / €27 **tax-inclusive**, **exclusive**, or **pre-tax list** prices?
4. Seller of record / taxable jurisdiction for Digital Gifter EUR digital goods?
5. Post-config display: “incl. VAT” / “excl. VAT” / “tax calculated at checkout”?
6. Remove BLOCKED note only after decision is recorded?
7. Any EU OSS / reverse-charge handling required before live GO?

---

## 4. #353 ↔ #356 integration (exact sequence)

### Compatibility facts

| Surface | #353 | #356 | Conflict? |
|---------|------|------|-----------|
| `useAdminAuth.ts` | admin_users only; ignores `profiles.role` | same intent | **Compatible** — keep admin_users-only |
| `is_admin()` | `20261012120000_platform_security_admin_and_rls.sql` | `20261012130000_hotfix_admin_role_escalation.sql` | Same core rewrite; #356 adds **column privilege revokes** + fuller trigger |
| christmas_v2 RLS | in #353 security migration | **not** in #356 (hotfix is standalone) | Apply #356 first, then CV2 EUR/Meta migrations + ensure RLS from #353 or extracted follow-up |
| profiles.role escalation | **not** reintroduced on #353 | hotfix removes trust | **PASS** — do not restore OR-branch |

### Safe integration sequence (human authorized)

1. Keep Contabo / Edge / public gateway unchanged (#358 audit only).
2. Restore Contabo owner access + Edge/Postgres health — **BLOCKED** until ops (no agent Contabo password recovery).
3. Merge/apply **#356** first (`20261012130000_hotfix_admin_role_escalation.sql`).
4. When applying #353 migrations:
   - Apply `20261011140000_christmas_v2_eur_offers_and_finalize.sql`
   - Apply `20261011180000_christmas_v2_meta_purchase_and_cost_ledger.sql`
   - For `20261012120000_platform_security_admin_and_rls.sql`: **skip `is_admin()` / role-trigger sections already applied by #356**; keep **christmas_v2 RLS** portion (or land RLS via a trimmed follow-up migration). Do **not** double-apply conflicting definitions without review.
5. Optional #357 skeleton resilience — independent.
6. Deploy Edge (`christmas-funnel`, `christmas-generate`, `christmas-generate-video`, `stripe-webhook` Christmas path) + VPS Node routes — **no** Caddy/DNS/Docker gateway edits.
7. Frontend deploy after Stripe/Meta/HF/VAT canaries.

---

## 5. Offline smoke commands

```bash
npm ci
npx vitest run src/features/christmas-v2 src/lib/platformSecurity.test.ts
npx tsc -b --pretty false
npm run build
PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1 CV2_E2E_BROWSERS=chromium,firefox,webkit npm run test:christmas-v2-funnel-e2e
```

Fixture UI: `/christmas-ai-photos/order?fixture=1&demo=results|generating|upsell|error&pack=starter|magic|ultimate`

---

## 6. Live-only remaining blockers

1. Contabo/Edge recovery (#358) — ops  
2. #356 apply + RLS reconcile  
3. Stripe test-mode matrix (incl. refunds) then €7 live canary  
4. Founder VAT decisions + checkout tax config  
5. Meta CAPI live / test event  
6. Authorized ≤1 Soul + 1 Kling canary  
7. GDPR purge + `delete-my-account` CV2 coverage + refund policy pack wording  

---

## 7. GO / NO-GO

**Offline code + QA:** **GO** (WebKit env caveat cleared with host deps).  
**Production:** **NO-GO** until Contabo security + Edge recovery + #356 apply + Stripe/Meta/HF/VAT/GDPR founder gates under separate authorization.
