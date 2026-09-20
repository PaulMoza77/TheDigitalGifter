# TDG North Star — implementation audit

Baseline: main after North Star merge. This document is evidence-oriented: DONE requires a working intended flow, not merely a file or unit test.

| Area | State | Evidence / gap |
|---|---|---|
| Planner shell/onboarding | PARTIAL | Profile, onboarding and account routes exist; final acquisition-to-account UX still needs production mobile acceptance. |
| Calendar/tasks | PARTIAL | christmas_events + planner tasks and UI exist; final polish/production acceptance remains. |
| Budget | PARTIAL | Budget entries/profile total and gift intelligence exist; cross-module automatic spend reconciliation is incomplete. |
| Gifts/recipients | PARTIAL | Recipient/gift lifecycle and Gift Concierge are substantial; production provider flow is not fully enabled. |
| Gift Finder | PARTIAL | Recommendation flow exists and feeds Planner; final paid/free product UX needs acceptance. |
| Live affiliate shopping | BLOCKED | Official eBay adapter, OAuth, marketplace mapping, cache/privacy/tests exist. Feature is gated by credentials + explicit production access. |
| Price comparison | PARTIAL | Exact-product comparison foundation added in this branch. Multi-provider offers/identifiers are still required before UI can truthfully compare retailers. |
| Recipes catalog | PARTIAL | Recipe schema/UI/intelligence exists; high-quality 1,500-recipe licensed/original catalog is missing. |
| Meal planning | PARTIAL | Meals/dishes/recipe linking/serving intelligence exist; final product UX/catalog depth missing. |
| Grocery generation | PARTIAL | Ingredient parsing, serving scaling, aggregation and persisted grocery items exist; normalization and production UX need acceptance. |
| Studio integration | PARTIAL | Christmas products/routes and cross-sell seams exist; unified Planner contextual cross-sell not complete. |
| Copilot | PARTIAL | Snapshot/insights/actions exist; current documented Copilot is intentionally local/no model calls and is not the final cross-module agent. |
| Commerce/paywall/entitlements | PARTIAL | Server-authoritative catalog, packages, checkout gates and user_entitlements exist; $17 Founding Pass configuration + real E2E intentionally pending near launch. |
| Analytics/admin reporting | PARTIAL | Rich event taxonomy exists; one coherent North-Star funnel dashboard and production verification remain. |
| SEO/acquisition | PARTIAL | Christmas/Gift Finder/SEO surfaces exist; final indexability/canonical/hreflang/Search Console verification remains. |
| Mobile production QA | MISSING | Requires physical/mobile production acceptance after final UI/flows. |
| VPS-only hygiene | PARTIAL | Deployment cleanup is PR #253; runtime @vercel compatibility must be migrated separately, not blindly deleted. |

## Confirmed architecture worth preserving
- Server-authoritative Christmas catalog/checkout and entitlement bridge.
- Gift Concierge consumes a provider-normalized AffiliateProduct contract.
- eBay integration uses official APIs, not retailer scraping.
- Food intelligence already parses/scales/aggregates recipe ingredients.
- Existing christmas_* tables can ship Christmas while new domain seams become occasion-aware incrementally.

## External blockers / operator actions
- Affiliate provider credentials and production access cannot be invented in code.
- A second/third official commerce provider is required for meaningful cross-retailer Price Compare.
- 1,500 quality recipes require a lawful content acquisition/generation/QA pipeline, not copied web recipes.
- Real-money checkout validation waits until launch candidate by product decision.
- Physical-device production QA requires an actual device/session.

## Launch-critical remaining implementation
1. Final Planner mobile UX and paid value moment.
2. Configure $17 Founding Pass in authoritative catalog/admin and validate entitlement mapping.
3. Finish Recipes explorer/menu builder/grocery UX using existing intelligence.
4. Seed/ingest and QA recipe catalog.
5. Enable eBay after production credentials/access; add at least one additional official provider before advertising Price Compare.
6. Connect Studio cross-sells to Planner context.
7. Complete admin funnel dashboard and recovery analytics.
8. Final SEO + VPS runtime cleanup + production smoke.
9. Then 1–3 controlled real-money E2E tests.
