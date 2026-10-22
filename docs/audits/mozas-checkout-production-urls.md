# MOZAS / TDG production checkout URL discovery

Read-only inventory from `main` code. **No product behavior change.**

## What is *not* a checkout host

- There is **no Next.js App Router** (`app/**/page.tsx` does not exist). Public UI is a **Vite + React Router** SPA (`src/App.tsx`).
- There is **no** `NEXT_PUBLIC_*` site URL. Browser origin is `window.location.origin`. Server fallbacks use **`SITE_URL`**, then **`PUBLIC_APP_URL`**, then **`https://www.thedigitalgifter.com`**.
- **`checkout.thedigitalgifter.com` is not a checkout hostname.** It appears only as a **placeholder email domain** (`pending+…@checkout.thedigitalgifter.com`) so Stripe can get an email before the buyer types one. DNS for that name is unused by routing.
- Production public origin in code is **`https://www.thedigitalgifter.com`** (apex `thedigitalgifter.com` is treated as the same product, often redirected to `www`).

## Confirmed SPA checkout *entry* routes

| Product | Browser path(s) | Payment UI |
| --- | --- | --- |
| Pet V1 | `/pet/dog`, `/pet/cat`, `/pet/other` → `/pet/create` → **`/pet/checkout`** | Custom Checkout; cancel → `/pet/checkout` |
| Pet V2 | `/pet/dog-v2`, `/pet/cat-v2`, `/pet/other-v2` | Embedded on the funnel page |
| Pet V3 | `/pet/cat-v3` | Embedded on the funnel page |
| Pet V4 | `/pet/dog-v4`, `/pet/cat-v4`, `/pet/other-v4` | Embedded on the funnel page |
| Christmas V2 | **`/christmas-ai-photos`** | Embedded; cancel → `?checkout=canceled` |
| Christmas portraits / Santa / gift tree | `/christmas/photo-generator`, `/christmas/family`, `/christmas/couples`, `/christmas/kids`, `/christmas/pets`, `/christmas/dogs`, `/christmas/cats`, `/christmas/santa-video`, `/christmas/tree-gifts` | `christmas-checkout` Custom Checkout |
| Credits / landing | `/` pricing CTA, `PricingModal` | Hosted Stripe Checkout (`session.url`) |
| Legacy occasion funnel | `/funnel/payment` | Hosted Stripe Checkout |

## Confirmed payment *success / return* URLs (from session create)

Canonical production origin: `https://www.thedigitalgifter.com` (or `SITE_URL` if set on Edge).

| Flow | Stripe field | URL pattern |
| --- | --- | --- |
| Pet (V1 custom, V2 hosted, V3/V4 custom) | `return_url` and/or `success_url` | `{origin}/pet/order?token={publicToken}&session_id={CHECKOUT_SESSION_ID}` |
| Pet upsell | `success_url` | `{origin}/pet/order?token=…&upsell=success&upsell_id={id}` |
| Pet V1 cancel | `cancel_url` | `{origin}/pet/checkout` |
| Christmas V2 pack | `return_url` / `success_url` | `{origin}/christmas-ai-photos/order?token=…&session_id={CHECKOUT_SESSION_ID}` |
| Christmas V2 pack cancel | `cancel_url` | `{origin}/christmas-ai-photos?checkout=canceled` |
| Christmas V2 upsell | same order page | `{origin}/christmas-ai-photos/order?token={childToken}&session_id={CHECKOUT_SESSION_ID}` |
| Christmas portraits | `return_url` | `{origin}{source_route}?checkout=success&session_id={CHECKOUT_SESSION_ID}&token=…` |
| Santa video | `return_url` | `{origin}/christmas/santa-video?checkout=success&…` |
| Gift tree chances | `return_url` | `{origin}/christmas/tree-gifts?gift_chances=1&package=…` |
| Credits / landing | `success_url` | `{origin}/account/dashboard?checkout=success` (cancel: `/?checkout=cancelled`) |
| Legacy funnel | `success_url` | `{origin}/funnel/result?session_id={CHECKOUT_SESSION_ID}` (default cancel: `/funnel/payment`) |

Pet **server** `createStripeCheckout` **does not trust** a tokenless client `successUrl`. Source of truth is `siteOrigin()` + `/pet/order?token=…`.

## Stripe Checkout Session creation (Edge, not Mozas)

Sessions are created against `https://api.stripe.com/v1/checkout/sessions` from **Supabase Edge Functions**. The Mozas VPS only serves the SPA + same-origin analytics/SEO APIs.

| Function | Browser call | Role |
| --- | --- | --- |
| `pet-funnel` | `{VITE_SUPABASE_URL}/functions/v1/pet-funnel` `action=createStripeCheckout` | Pet V1–V4 + upsells |
| `christmas-funnel` | `{VITE_SUPABASE_URL}/functions/v1/christmas-funnel` (fallback `POST /api/christmas-funnel` on Mozas) | Christmas V2 packs |
| `christmas-checkout` | `{VITE_SUPABASE_URL}/functions/v1/christmas-checkout` | Portrait / Santa / gift-tree SKUs |
| `create-checkout-session` | `{VITE_SUPABASE_URL}/functions/v1/create-checkout-session` | Credits / subscriptions / legacy funnel |
| `create-checkout` | thin proxy → `create-checkout-session` | `handleCheckout` credit packs |

Linked project id in `supabase/config.toml`: `kjlsocejpmnzhhduyumy`. The live `{VITE_SUPABASE_URL}` is **not** hardcoded; it is injected at build (Vercel / `/opt/mozas/projects/thedigitalgifter/secrets/app.env`). Typical Edge URL shape:

`https://<project-ref>.supabase.co/functions/v1/<name>`

## Webhooks (stay on Supabase)

| Endpoint | JWT | Purpose |
| --- | --- | --- |
| `{VITE_SUPABASE_URL}/functions/v1/stripe-webhook` | `verify_jwt = false`; requires `STRIPE_WEBHOOK_SECRET` | `checkout.session.completed` / related; pet + Christmas + credits fulfill |
| `{VITE_SUPABASE_URL}/functions/v1/pet-replicate-webhook` | `verify_jwt = false` | Replicate generation, **not** Stripe |

There is **no** Stripe webhook on Mozas `/api/*`. `docs/TDG_ROUTE_MAP.md` matches this.

## Env / config paths

| Name | Where | Used for |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | `.env.example`, Vite client | Edge function base URL |
| `VITE_SUPABASE_ANON_KEY` | same | `apikey` / Bearer for Edge |
| `SITE_URL` / `PUBLIC_APP_URL` | Supabase Edge secrets (and Mozas Node `process.env` for Christmas fallback) | Allowed success/cancel origin + defaults |
| `PUBLIC_SITE_URL` | `api/christmas-gift-tree.ts` only | Gift-tree public origin fallback |
| `STRIPE_SECRET_KEY` / `STRIPE_PUBLISHABLE_KEY` | Edge secrets | Session create + Elements |
| `STRIPE_WEBHOOK_SECRET` | Edge secret | `stripe-webhook` |
| `CHRISTMAS_CHECKOUT_ENABLED` | Edge | Must be `true` for `christmas-checkout` |

`.env.example` documents Apple Pay on **`www.thedigitalgifter.com`**, not a checkout subdomain.

## Mozas adapter implication

Point Stripe Dashboard success/cancel allowlists and Apple Pay domains at **`www.thedigitalgifter.com`** (and apex if used). Do **not** configure `checkout.thedigitalgifter.com` as the checkout origin.
