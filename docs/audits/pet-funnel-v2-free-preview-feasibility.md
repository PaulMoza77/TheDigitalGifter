# Pet Funnel V2 — Free Personalized Preview Feasibility

**Status:** Preview-only prototype. Not production. Do not merge as a replacement for `/pet/dog`.  
**Routes:** `/pet/dog-v2` · `/pet/cat-v2` · `/pet/other-v2`  
**Production V1:** untouched (`/pet/dog`, `/pet/cat`, `/pet/other`, `$27`, Stripe, 12+2 generation)

---

## 1. Existing architecture reused

| Piece | Reused? | How |
| --- | --- | --- |
| V1 landing / create / checkout pages | No (read-only) | V2 has its own screens |
| Photo validation (JPEG/PNG/WebP, 15 MB) | Yes | Same rules, plus explicit HEIC failure |
| Demo scene stills (`/pet/{species}/scenes/*.webp`) | Yes | Landing examples only |
| Funnel attribution (UTMs, fbclid, campaign/adset/ad) | Yes | Same first-touch capture; **new session id** |
| Device type inference | Yes | Shared helper |
| Replicate + Flux Kontext Pro | Yes, isolated call | One royal-portrait prediction; **not** `pet-generate` |
| `touch_edge_rate_limit` | Yes | IP / session / image-hash caps |
| Stripe / `pet-funnel` checkout | **No** | Prototype stops before payment |
| `pet_orders` / paid generation / QC | **No** | Untouched |
| V1 `pet_funnel_events` | **No** | Separate `pet_v2_funnel_events` table + `/api/pet-v2/funnel-event` |

V2 cannot accidentally replace V1: different routes, storage keys, session keys, event names, ingest API, and no write path into `pet_funnel_events`.

---

## 2. Preview generation implementation

Exactly **one** scene: `royal-portrait`.

- **Provider:** Replicate  
- **Model:** `black-forest-labs/flux-kontext-pro`  
- **Tariff in repo:** `$0.04` per successful output (`src/features/pet/aiCost.ts`, `KONTEXT_PRO_UNIT_COST_USD`)  
- **Pricing source:** `ai_model_pricing` (project tariff snapshot — not a live Replicate invoice scrape)  
- **Live switch:** `PET_V2_PREVIEW_LIVE=true` **and** `REPLICATE_API_TOKEN`  
- **Default:** live generation is **off**. The client then composites the visitor’s own photo into a framed “royal” preview with a PREVIEW watermark. That is honest local UX, **not** the conversion hypothesis.

When live is on:

1. Client resizes to max 768px JPEG  
2. `POST /api/pet-v2/preview`  
3. One Kontext Pro prediction (identity-lock + royal-portrait edit only)  
4. Result is downscaled and watermarked in the browser  
5. HD original is not persisted to the client  
6. One extra regeneration allowed (max 2 / session)

Paid 12-portrait + 2-clip generation is not invoked.

---

## 3. Cost per free preview

| Quantity | Generation cost |
| --- | --- |
| 1 preview | **$0.04** |
| 1 session worst case (preview + 1 regen) | **$0.08** |
| 100 previews | **$4.00** |
| 1,000 previews | **$40.00** |

Uncertain: Replicate list price could change; we use the **repo tariff**, not a live billing API. Video models are not used for the free preview.

Stripe fees, ads, refunds, and support are **excluded** (same disclaimer as V1 AI cost reporting).

---

## 4. Estimated economics (generation only)

Assume 1,000 unique free previews. Prototype **copy** is $19; production remains **$27**. Do not test both a funnel change and a price cut in the same experiment.

### At $19 test copy

| Conversion | Purchases | Revenue | Gen cost | Gross after AI |
| --- | ---: | ---: | ---: | ---: |
| 1% | 10 | $190 | $40 | **$150** |
| 2% | 20 | $380 | $40 | **$340** |
| 5% | 50 | $950 | $40 | **$910** |
| 10% | 100 | $1,900 | $40 | **$1,860** |

Example from the brief, using **actual** project numbers:

> 100 previews × $0.04 = $4  
> 2 purchases = $38 revenue at $19  
> generation cost = $4  
> gross before ads = $34

### At production $27 (recommended test price)

| Conversion | Purchases | Revenue | Gen cost | Gross after AI |
| --- | ---: | ---: | ---: | ---: |
| 1% | 10 | $270 | $40 | **$230** |
| 2% | 20 | $540 | $40 | **$500** |
| 5% | 50 | $1,350 | $40 | **$1,310** |
| 10% | 100 | $2,700 | $40 | **$2,660** |

If a buyer converts, the **paid pack** is still ~$0.73 AI (12×$0.04 + 2×$0.125) on top of the free preview. That is small vs $27.

**Critical:** 1% conversion at $19 after ads is probably unprofitable. Meta pet CPMs are unknown in this task. Free preview economics are acceptable **only if** V2 conversion is materially higher than V1 *and* CPA stays below ~$15–20. The $0.04 unit cost is not the hard part. Ads are.

**Cheaper alternative if abuse appears:** skip Replicate on the free step; show a high-quality framed overlay of *their* photo (mock mode) and generate for real only after payment. That tests “see your pet” weakly and should not be used as the Meta conversion test.

---

## 5. Latency

| Step | Expected | Evidence |
| --- | --- | --- |
| Upload + client resize | < 1s on 4G after picker | 768px JPEG |
| Mock preview | instant | Canvas composite |
| Live Kontext Pro | typically 8–20s, timeout ~36s | Not measured from TDG production telemetry in this task; Replicate poll loop is 24 × 1.5s |
| Full paid pack (V1, not V2) | minutes after payment | Existing copy |

No fake countdown. Status copy is “usually under 30 seconds” and is labeled as typical, not guaranteed.

---

## 6. Abuse risks and recommended limits

Free Replicate **will** be abused if advertised.

| Control | Prototype | Recommended if ads are attached |
| --- | --- | --- |
| Browser session | 1 preview + 1 regen (2 max) | Keep |
| IP / day | 5 via `touch_edge_rate_limit` | Keep; drop to 3 if scrape starts |
| Image hash / day | 2 (allows regen) | Keep |
| CAPTCHA | Off | Add only after abuse |
| Email / account before preview | Off (by design) | Stay off for the test |
| Live flag | Default off | Preview deploy only; **do not** set `PET_V2_PREVIEW_LIVE` on production |

Device identifiers beyond session storage are not used (privacy). CAPTCHA is deferred.

---

## 7. Technical risks

1. **iPhone HEIC.** V1 and V2 reject HEIC. iOS often converts to JPEG in the picker; if it does not, the visitor sees an explicit error. This can kill mobile conversion.  
2. **Preview ≠ paid pack quality.** Same model, one scene. If royal-portrait likeness is weak, the “wow” moment fails and may *reduce* conversion vs V1.  
3. **Vercel timeout.** Live poll is 60s maxDuration on `api/pet-v2/preview.ts` only.  
4. **Confounded experiment** if $19 copy and preview funnel launch together.  
5. **Accidental production traffic.** Routes are unlinked from `/dogs` and sitemap. Still discoverable by URL.  
6. **Personality.** V1 mood adjectives do not justify a required step. V2 omits it.  

---

## 8. What production wiring remains

Do **not** do these until Paul explicitly greenlights a paid test:

1. Set `PET_V2_PREVIEW_LIVE=true` on a **preview** deployment, never production, until rate limits are watched.  
2. Apply migration `20260824180000_pet_v2_preview_funnel.sql`.  
3. Create a **separate** Stripe Price/SKU if testing $19. Do not mutate the $27 product.  
4. Point V2 checkout at that isolated price; reuse upload + `pet-generate` only **after** payment.  
5. Fire `v2_purchase` only from Stripe webhook on that isolated SKU. Prototype never fires it.  
6. Add Meta standard events only after first-party V2 cohorts are trusted.  
7. Decide ads: new campaign to `/pet/dog-v2`, not the current `/pet/dog` ads.

---

## 9. Event map (V2 only)

| Event | When it fires |
| --- | --- |
| `v2_landing_view` | `/pet/{species}-v2` mount |
| `v2_upload_started` | File picker returns a file |
| `v2_upload_completed` | File passes validation |
| `v2_upload_failed` | Validation/HEIC failure |
| `v2_preview_generation_started` | User taps **Create my free preview** |
| `v2_preview_generation_completed` | Preview image ready |
| `v2_preview_generation_failed` | Live/mock generation error |
| `v2_preview_viewed` | Personalized preview screen shown |
| `v2_preview_regenerated` | User taps **Try one more preview** |
| `v2_offer_viewed` | Offer / checkout-handoff screen shown |
| `v2_unlock_clicked` | **Unlock the full collection** |
| `v2_begin_checkout` | Prototype Stripe handoff button (no charge) |
| `v2_purchase` | **Not fired** in this prototype |

All events carry funnel session id, UTMs, fbclid-present flag, campaign/adset/ad ids, device type, pathname (`/pet/dog-v2` only), timestamps. They go to `/api/pet-v2/funnel-event`, **never** `/api/pet/funnel-event`.

---

## 10. Funnel diagram

```
Ad
 ↓
Landing   /pet/dog-v2  (upload is the first action)
 ↓
Upload    one photo, no name / email / personality
 ↓
Free personalized preview   (1× royal-portrait)
 ↓
Offer     $19 TEST COPY — production still $27
 ↓
Checkout  prototype handoff — no live Stripe
 ↓
Purchase  not implemented (would unlock current 12+2 product)
```

---

## 11. Before / after

### V1 (live)

Name → Photo → Email → Personality → Review → **$27** → Result

### V2 (prototype)

Photo → Preview → Offer → Email/payment (handoff only) → Result (not wired)

Moved after preview: pet name, email, personality.  
**Personality recommendation:** delete from the purchase path. Scene prompts already define the world; personality only adds a mood sentence while identity-lock forbids changing the face.

---

## 12. Performance (paid social is mobile)

- No hero video above the fold (LCP is a still + CTA).  
- Example clips are not autoplayed on V2 landing.  
- Upload CTA is the first screen action.  
- Images use existing compressed webp demo assets.  
- JS: V2 is a separate feature folder; V1 routes stay eager as before.  
- Safari/iPhone: HEIC called out; `playsInline` not needed because V2 landing has no hero video.

---

## 13. Recommendation

**Modify first. Do not ship paid traffic yet.**

The $0.04 preview cost is fine. The hypothesis (preview before pay) is worth testing. This build is not ready for Meta spend until live generation is verified on a private URL, HEIC drop-off is measured, and the test keeps **$27** so the funnel — not the price — is the variable.
