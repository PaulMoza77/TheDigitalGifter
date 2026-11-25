# The Digital Gifter — Final Handover & Development Freeze

**Freeze date:** 2026-11-25  
**Accepted release:** `purchase-tracking-20261124T234104Z`  
**Status:**

| Surface | State |
| --- | --- |
| Santa Call | **LIVE** |
| TDG Web Development | **CLOSED** (exceptions below only) |
| Organic Growth | **ACTIVE** — monitoring pending analytics access |
| Christmas Story | **OWNER ACCEPTANCE / LAUNCH PENDING** (checkout **OFF**) |
| Abandoned checkout commercial send | **OFF** until explicit owner approval |

Do not run general audits or ship new product features without a new owner mission.

---

## 1. Production identity

| Field | Value |
| --- | --- |
| Live image tag | `mozas/thedigitalgifter:purchase-tracking-20261124T234104Z` |
| Image digest | `sha256:566034c8edf2e427c77629899049c0c1c1e74f98fd85bc88ae55283808d21216` |
| Git commit (source of truth after freeze commit) | See `git rev-parse HEAD` on `release/christmas-2026-organic-closeout` |
| Rollback image | `mozas/thedigitalgifter:previous` → prior verified `organic-closeout-phase2b-20261124` (`sha256:22d06744…`) |
| Health | Container **healthy**; public site `https://www.thedigitalgifter.com/` |
| Contabo edge | `tdg-supabase-edge-functions` healthy |
| Story worker | `tdg-christmas-story-worker.service` **active** (song + film) |

### Rollback (Mozas only)

```bash
# On mozas-prod-01 — do not touch other projects
cd /opt/mozas/projects/thedigitalgifter
# Pin TDG_RELEASE=previous (or organic-closeout-phase2b-20261124) in secrets/app.env
docker compose --project-directory repo -f docker-compose.yml --env-file secrets/app.env up -d thedigitalgifter
```

---

## 2. CHRISTMAS_STORY_AUTOMATE_SONG — edge runtime check

| Location | Value |
| --- | --- |
| Contabo `/opt/supabase/tdg/.env` | `CHRISTMAS_STORY_AUTOMATE_SONG=true` (file only) |
| Edge container `printenv` | **UNSET** — **not injected** into Deno runtime |

**Implication:** `enqueueGeneration` keeps song jobs on the safe default path (`awaiting_manual` / non-automated) until the flag is wired through docker-compose into `tdg-supabase-edge-functions` **and** the owner accepts automated licensed instrumental enqueue.

**Freeze rule:** Do **not** inject this flag during freeze. Do **not** enable an unconfigured personalized-vocal music provider. Contabo song/film workers remain available for already-queued / QA jobs (`licensed_fma` + FFmpeg).

Checkout remains gated by `isStoryCheckoutEnabled()` / client `STORY_OFFER.checkoutEnabled = false`. Prices prepared: **149 RON** / **$34.99**.

---

## 3. Verified delivery & samples (no further commercial send)

| Check | Result |
| --- | --- |
| Resend domain `send.thedigitalgifter.com` | Verified |
| Story delivery (authorized inbox) | PASS — message ids `01a20fcf-ebb7-7315-ad92-1996d970171e`, `01a20fcf-eec9-7847-af79-704c4d188ade` |
| Sample 1 | https://www.thedigitalgifter.com/gift/db131abffc72a0e67304533dfe8214a05cca25fcc222e5c7d71ad217601d91cb |
| Sample 2 | https://www.thedigitalgifter.com/gift/ca4aeb35bb693635e01b2a1715545a07ea78abe8c2752937e34b0cd01e46084f |
| Abandoned QA test | Delivered earlier; commercial cohort **28** ready; **send_allowed=false** |

---

## 4. Remaining — Analytics access (owner)

See also: `docs/qa/organic-closeout/GA4_GSC_SERVICE_ACCOUNT.md`

1. Sign in to **Google Analytics** property for `G-YF2GRM2TL4`.
2. Sign in to **Search Console** for `https://www.thedigitalgifter.com/` (and domain property if used).
3. Sign in to **Microsoft Clarity** project `y3y98n4wks`; export/read-only path for Admin if required.
4. Sign in to **Bing Webmaster Tools**; site already IndexNow-submitted (`202` on 2026-11-24) — complete ownership verification in UI.
5. Create read-only service account; grant GA4 Viewer + GSC Restricted/Full; store JSON **only** on Contabo (never git).
6. Set `GA4_PROPERTY_ID` + `GA4_SERVICE_ACCOUNT_JSON` (and Clarity export vars if used); restart edge/analytics sync.
7. Confirm `/admin/christmas` Growth cells leave “Unavailable”.
8. Optional: Cloudflare UI confirmation that Resend nested SPF/MX/DKIM match dig (domain already verified via API).

**Organic Growth remains ACTIVE** with first-party funnel + Stripe/DB SoT until the above lands.

---

## 5. Remaining — Christmas Story personalized vocals & commercial launch

1. Choose/configure an **authorized** personalized song provider (API keys, rights, cost model). Do not treat CC0 instrumental QA as the final commercial vocal master.
2. Wire provider into song worker; update rights docs (`scripts/christmas-story-prod/MUSIC_RIGHTS.md`).
3. Only then consider injecting `CHRISTMAS_STORY_AUTOMATE_SONG=true` into **edge** compose env.
4. Re-run two full automated samples; measure full COGS (AI + music API + compute + storage + retry).
5. Confirm `markSent` → Resend recipient email in production path for non-allowlist customers (policy + unsubscribe classification).
6. Mobile playback / download QA on real devices.
7. Owner validates quality + pricing (**149 RON** / **$34.99**).
8. Explicit owner authorization to set Story checkout **LIVE** (flip server kill-switch + client flag in a dedicated release).
9. Abandoned checkout: separate explicit approval for commercial send to the 28 (or refreshed cohort).

---

## 6. What this freeze accepts (no re-audit)

- Purchase tracking idempotency (frontend + server funnel) on Mozas release above  
- Resend DNS verified + inbox delivery PASS  
- SEO/GEO/cross-sell/commerce metrics reconciliation as shipped  
- Contabo FFmpeg + licensed instrumental workers  
- IndexNow key hosted; commercial URL notify `202`  
- Santa Call CRO instrumentation (`santa_checkout_error`, `preview_seen`) — no redesign  

---

## 7. Explicit non-actions during freeze

- No new SEO pages, products, redesigns, staging, Cloud agents, or extra monitors  
- No LIVE Story checkout  
- No commercial abandoned-checkout emails  
- No unauthorized Stripe charges  
- No changes to other Mozas projects (CasaHub, Flavours, TheMozas, VoloCar, etc.)
