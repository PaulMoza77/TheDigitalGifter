# Remaining — GA4 / GSC / Clarity / Bing (owner)

Frozen as of final handover. No agent may invent dashboard metrics without these credentials.

## Single owner login pass

1. **Google Analytics** — property for Measurement ID `G-YF2GRM2TL4`.
2. **Google Search Console** — property `https://www.thedigitalgifter.com/` (plus domain property if present).
3. **Microsoft Clarity** — project `y3y98n4wks`.
4. **Bing Webmaster Tools** — claim/verify site; IndexNow already returned HTTP `202` for commercial URLs (2026-11-24) — complete UI ownership.

## Read-only Admin Growth wiring

Follow `GA4_GSC_SERVICE_ACCOUNT.md`:

- Service account Viewer on GA4  
- Restricted/Full read on GSC  
- Secrets only on Contabo — never commit  
- Restart edge / analytics sync  
- Confirm `/admin/christmas` Growth cells leave Unavailable  

Until then: Stripe/DB + first-party `christmas_funnel_events` remain commercial/traffic SoT for Admin.
