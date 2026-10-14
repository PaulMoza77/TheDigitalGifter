# Memories V1 — Architecture & Deployment Plan

**Status:** Implementation  
**Product:** Memories by The Digital Gifter  
**URL:** `https://thedigitalgifter.com/memories`  
**Scope:** Validation funnel (landing → upload → email → plans → Stripe subscription). **No AI generation engine.**

## Verified infrastructure (Phase 0)

| Item | Value |
| --- | --- |
| Repository | `/workspace` → `github.com/PaulMoza77/TheDigitalGifter` |
| Base branch | `main` @ `15d938c3` |
| Feature branch | `cursor/memories-v1-833a` |
| Production host | Mozas VPS (`MOZAS_SSH_HOST`, user `mozas`) |
| Edge proxy | Caddy → Docker `thedigitalgifter:8080` |
| App runtime | Docker Compose (`deploy/docker-compose.yml`) |
| Database / Auth / Storage | **Contabo self-hosted Supabase** via Mozas tunnel (`supabase.thedigitalgifter.com` → `127.0.0.1:19000` / `172.18.0.1:19001` → Contabo Kong `:8000`). Cloud project `kjlsocejpmnzhhduyumy` is **not** the production PostgREST target for Memories writes. |
| Checkout / webhooks | Supabase Edge primary; Mozas origin fallback for funnel APIs |
| Deploy | `bash scripts/deploy-vps.sh` (atomic image + rollback to `:previous`) |
| Backups | `scripts/run-tdg-backup-now.sh` → R2 |
| Contabo SQL apply | When `SUPABASE_DB_PASSWORD` / Contabo SSH are unavailable: `scripts/apply-memories-migration-via-pgmeta.py` over Mozas `POST http://127.0.0.1:19000/pg/query` (service role), then `NOTIFY pgrst, 'reload schema'` |

## Design principles

1. **Parallel domain** — `memories_*` tables, routes, Edge functions. Do not alter Christmas/pet pricing or pipelines.
2. **Reuse patterns** — Christmas V2 session/draft/analytics; Stripe webhook signature + `processed_stripe_events`; Resend transactional email; AdminRoute.
3. **Commercial gate** — `MEMORIES_COMMERCIAL_MODE`:
   - `waitlist` (default): no charging; capture interest + uploads.
   - `test`: Stripe test Prices only.
   - `paid_early_access`: live recurring prices only after founder approval of terms + Price IDs.
4. **Sale authority** — Paid status only from verified Stripe webhooks, never from success-page redirect.
5. **First verified sale** — Live mode + non-zero paid invoice/subscription → `MEMORIES_FIRST_SALE_VERIFIED` milestone row + admin + ops email. Does **not** start AI product work.

## Funnel routes

```
/memories              → landing
/memories/create       → upload + email + consent
/memories/plans        → monthly plan selection
/memories/success      → confirmation / waitlist status
/admin/memories        → metrics, customers, orders, first-sale
```

## Data model (Supabase)

- `memories_funnel_sessions` — client session + attribution
- `memories_customers` — email-normalized customer
- `memories_uploads` — private storage refs (`memories-source-photos` bucket)
- `memories_orders` — order lifecycle + plan
- `memories_subscriptions` — Stripe subscription sync
- `memories_funnel_events` — first-party analytics
- `memories_waitlist` — prelaunch captures
- `memories_email_deliveries` — transactional send ledger
- `memories_milestones` — first-sale flag

RLS: deny anon direct access; service role + admin RPCs only. Uploads private; signed URLs only.

## Stripe

- Mode: `subscription`
- Metadata: `product_family=memories`, `product_type=memories_subscription`, `plan_key`, `order_id`
- Events: `checkout.session.completed`, `customer.subscription.*`, `invoice.paid`, `invoice.payment_failed`, `charge.refunded`
- Env: `MEMORIES_STRIPE_PRICE_STARTER|PLUS|LEGACY`, `MEMORIES_COMMERCIAL_MODE`, `MEMORIES_ENABLED`
- Billing portal via Stripe Customer Portal session
- Do **not** create live Prices from this PR without founder approval

## Plans (centralized config)

| Key | Display | Price | Notes |
| --- | --- | --- | --- |
| starter | Memories Starter | $9/mo | Provisional entitlements |
| plus | Memories Plus | $19/mo | Visual “Most Popular” only |
| legacy | Memories Legacy | $49/mo | Provisional |

## APIs

| Path | Role |
| --- | --- |
| Edge `memories-funnel` + origin `/api/memories-funnel` | session, upload URL, email, plan, checkout, portal, cancel, status |
| Edge `memories-funnel-event` + origin `/api/memories-funnel-event` | analytics ingest |
| `stripe-webhook` → `_shared/memories/stripeFulfill.ts` | payment/subscription sync |

## Deployment gates

1. Lint + unit/integration tests green  
2. Migration applied to **verified TDG Supabase project only**  
3. Stripe test E2E (no live charges)  
4. `MEMORIES_COMMERCIAL_MODE=waitlist` in production until founder approval  
5. Deploy via `deploy-vps.sh`; verify `/memories` + Christmas health  
6. Rollback: previous Docker image via established script  

## Explicit non-goals (V1)

AI animation, voice cloning, lip-sync, conversational AI, deceased-person impersonation.
