# Christmas V2 — Offline E2E Smoke & Release Checklist

**PR:** https://github.com/PaulMoza77/TheDigitalGifter/pull/353  
**Branch:** `cursor/christmas-v2-eur-p0-7cbb`  
**Offline QA HEAD:** `0c419e6e` (start this turn: `6504a33f`)  
**Hard stop:** no merge, production deploy, DB write, live Stripe charge, paid Higgsfield, secrets/DNS/Caddy/Docker changes, or customer messages from agents.

---

## 1. Offer contract (code-verified)

| Pack | Price | Images | Clips |
|------|-------|--------|-------|
| Starter | €7 (`700` cents) | 3 | 0 |
| Magic | €17 (`1700`) | 5 | 1 |
| Ultimate | €27 (`2700`) | 10 | 3 |

Canonical files (must stay byte-identical): `src/features/christmas-v2/offers.ts`, `api/_lib/christmas/offers.ts`, `supabase/functions/_shared/christmas/offers.ts`.

Upsells = **pack upgrades only** (starter→magic/ultimate, magic→ultimate). **Golden Frame / regenerate** live on the legacy portrait ResultPage — **not** Christmas V2.

---

## 2. Offline smoke commands

```bash
npm ci
npx vitest run src/features/christmas-v2 src/lib/platformSecurity.test.ts src/hooks
npx tsc -b --pretty false
npm run build
npm run test:christmas-v2-funnel-e2e
npm run test:platform-customer-e2e   # optional platform auth/pricing
```

Optional SQL (needs disposable Postgres — never production):

```bash
# scripts/christmas-v2-iso-sql-assertions.sql
# scripts/christmas-v2-iso-mock-e2e.sql
# scripts/christmas-v2-iso-meta-cost-assertions.sql
# scripts/platform-security-iso-assertions.sql
```

Fixture UI (no payment / no AI): `/christmas-ai-photos/order?fixture=1&demo=results|generating|upsell|error&pack=starter|magic|ultimate`

---

## 3. Merge ordering (authorized human only)

1. **Keep Contabo / Edge / public gateway unchanged.**
2. Restore Contabo owner access + Edge/Postgres health (see #358 evidence) — **BLOCKED** until ops.
3. Merge / apply **#356** security hotfix first  
   - Migration: `20261012130000_hotfix_admin_role_escalation.sql`  
   - Prefer #356 over #353’s `20261012120000_platform_security_admin_and_rls.sql` if both present; do **not** double-apply conflicting `is_admin()` definitions without review.  
   - `useAdminAuth` overlap: both ignore `profiles.role` — keep admin_users-only.
4. Optional **#357** skeleton resilience (menu/auth when Supabase down) — compatible; merge independently.
5. Then **#353** Christmas V2:  
   - `20261011140000_christmas_v2_eur_offers_and_finalize.sql`  
   - `20261011180000_christmas_v2_meta_purchase_and_cost_ledger.sql`  
   - Skip or reconcile `20261012120000_*` if #356 already landed equivalent `is_admin()` + christmas_v2 RLS.
6. Deploy Edge functions (`christmas-funnel`, `christmas-generate`, `christmas-generate-video`, `stripe-webhook` Christmas path) + VPS Node routes — **no** gateway/Caddy edits.
7. Frontend static deploy after canaries.

---

## 4. Production-only gates (founder / ops)

| Gate | Status until authorized |
|------|-------------------------|
| Apply admin security migration (#356 preferred) | **BLOCKED** |
| Stripe test-mode matrix (success/fail/cancel/duplicate webhook/refund) | **BLOCKED** — secrets unset in agent env |
| Stripe live canary €7 | **BLOCKED** |
| VAT / `automatic_tax` / tax ID collection | **BLOCKED** — founder decision |
| Meta CAPI live (`CHRISTMAS_META_CAPI_LIVE` or test event code) | **BLOCKED** |
| Higgsfield canary ≤1 Soul + 1 Kling | **BLOCKED** — paid spend approval |
| Contabo / Edge recovery | **BLOCKED** — see #358 |
| GDPR retention purge job for CV2 source photos | **OPEN** — policy text exists; automated purge not implemented |
| Refund policy vs one-time EUR packs wording | **OPEN** — founder review |

Do **not** invent compliance approval for VAT, GDPR retention, or refunds.

---

## 5. Security non-goals for this PR

- Do **not** reintroduce `profiles.role` into `is_admin()` or `useAdminAuth`.
- Do **not** overwrite #356 / #357 / #358 branches.
- christmas_v2 RLS: admin read via `admin_users` only after migration apply.

---

## 6. GO / NO-GO

**Offline QA / code-complete:** proceed when Vitest + tsc + build + funnel E2E pass.  
**Production GO:** **NO-GO** until Contabo security + Edge recovery + #356 apply + Stripe/Meta/HF/VAT gates clear under separate authorization.
