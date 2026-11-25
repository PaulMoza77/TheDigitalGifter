# GA4 / Search Console — minimal read-only service account

Owner action required. Do **not** put keys in the browser, git, or frontend logs.

## Why admin still shows Unavailable for GA4/GSC

Contabo `/opt/supabase/tdg/.env` has Resend + Stripe. It does **not** yet have:

- `GA4_PROPERTY_ID`
- `GA4_SERVICE_ACCOUNT_JSON` (or email + private key pair)

Measurement ID `G-YF2GRM2TL4` alone cannot power the Data API.

## Minimal setup (owner)

1. Google Cloud project → create service account `tdg-analytics-readonly`.
2. Role: none at project level beyond what is required to create the key.
3. Download JSON key once; store only on Contabo as `GA4_SERVICE_ACCOUNT_JSON` (single-line escaped JSON) or split email/key vars already supported by `supabase/functions/_shared/pet/ga4Data.ts`.
4. GA4 Admin → Property access → add SA email as **Viewer**.
5. Copy numeric property id into `GA4_PROPERTY_ID` (digits only, no `properties/` prefix required — code strips it).
6. Search Console → Users → add SA email as **Full** or **Restricted** read for `https://www.thedigitalgifter.com/` (and domain property if used).
7. Restart Contabo edge / analytics sync job (`pet-analytics-sync`) after env update.
8. Clarity remains separate (`CLARITY_*` export job) — leave Unavailable until export credentials exist.

## Approval checklist for owner

- [ ] Create SA + download JSON
- [ ] Grant GA4 Viewer
- [ ] Grant GSC access
- [ ] Paste into Contabo env (never commit)
- [ ] Confirm `/admin/christmas` Growth cells leave “Unavailable”
