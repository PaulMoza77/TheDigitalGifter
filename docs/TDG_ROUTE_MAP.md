# TheDigitalGifter production route map (Vercel → Mozas VPS)

Supabase stays external for auth, database, storage, and Edge Functions.
Checkout, Stripe webhooks, paid generation, and Replicate webhooks stay on Supabase.
Prices, providers, and product design are unchanged.

| Route / capability | After migration | Notes |
| --- | --- | --- |
| `/`, marketing pages, `/pet/*`, `/christmas-ai-photos`, `/account/*`, `/admin/*`, `/funnel/*`, `/blog/*`, `/:pageType/:slug` | Mozas origin (Caddy → `thedigitalgifter:8080`) | SPA. Refresh serves `index.html` except `/api/*`. |
| `/auth/callback` | Mozas origin (SPA) | OAuth still uses Supabase Auth. Add verify host to Supabase redirect allow-list if testing Google on the verify URL. |
| `/api/pet/funnel-event` | Mozas Node origin | Same-origin V1 analytics. Needs `SUPABASE_SERVICE_ROLE_KEY` on the VPS to persist events. |
| `/api/pet-v2/funnel-event` | Mozas Node origin | Same-origin V2 analytics. Same service-role requirement. |
| `/api/pet-v3/funnel-event` | Mozas Node origin | Same-origin V3 analytics. Same service-role requirement. |
| `/api/pet-v3/internal-test-status` | Mozas Node origin | Returns 503 without service role. |
| `/api/pet-provider-status` | Mozas Node origin (Edge fallback remains) | Checkout stays open if Replicate token is absent on VPS (`probe_token_absent`). |
| `/api/christmas-funnel` | Mozas Node origin (Edge remains primary in the browser) | Same-origin Vercel-compat fallback if Edge is down. |
| `/api/christmas-v2/funnel-event` | **Supabase Edge** primary; Mozas origin fallback | |
| `/api/pet-v2/preview` | **Supabase Edge** `pet-v2-preview` | Vercel handler is live-disabled / unused. |
| `/api/christmas-generate*` | **Supabase Edge** | Server-side only. |
| `/api/pet-analytics-cron` | **Supabase Edge** `pet-analytics-sync` | Cron Vercel shim is unused. Schedule Edge directly. |
| `/sitemap.xml` | Mozas Node origin | Static URLs always; SEO/blog URLs when service role is present. |
| `/robots.txt` | Mozas static `dist` | |
| `/.well-known/apple-developer-merchantid-domain-association` | Mozas static / env | Must not be HTML. |
| `/api/*` unknown | Mozas origin **404 JSON** | Never `index.html`. |
| `create-checkout`, `create-checkout-session`, `pet-funnel` | **Supabase Edge** | Browser calls Edge. |
| Stripe webhook | **Supabase Edge** `stripe-webhook` | Signature + idempotency stay there. |
| Replicate webhook | **Supabase Edge** `pet-replicate-webhook` | |
| Paid image/video generation | **Supabase Edge** | `pet-generate`, `pet-generate-video`, Christmas generate. |
| Mobile / other consumers | Unchanged if they use public domain + Supabase | No VPS-only private API was added. |

Pre-cutover verify host: `tdg-verify.mozas-prod-01` via
`curl --resolve tdg-verify.mozas-prod-01:80:$MOZAS_SSH_HOST http://tdg-verify.mozas-prod-01/`.

Public `thedigitalgifter.com` / `www` stay on Vercel until you change DNS.
Caddy already matches those Host headers on `:80` via `--resolve` / after cutover.
HTTPS for those names is applied only with `TDG_HTTPS_APPLY=yes bash scripts/apply-tdg-https.sh`.
