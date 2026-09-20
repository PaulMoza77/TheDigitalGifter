# TDG North Star — implementation audit

Baseline: main after Founding Pass product work. DONE requires a working intended flow, not merely a file or unit test.

| Area | State | Evidence / gap |
|---|---|---|
| Planner shell/onboarding | PARTIAL | Profile, onboarding, account routes, and Founding Pass landing exist. Production mobile acceptance still required. |
| Calendar/tasks | PARTIAL | christmas_events + planner tasks and UI exist; production mobile acceptance remains. |
| Budget | PARTIAL | Gift actual prices update Engine spend; Copilot can preview marking a gift ordered with amount. Cross-module auto-reconciliation is not a full accounting system. |
| Gifts/recipients | PARTIAL | Recipient → Concierge → products → Add to Gift Plan → status/budget. Live provider shopping remains credential-gated. |
| Gift Finder | PARTIAL | Recommendation flow exists and feeds Planner; paid/free product UX still needs production acceptance. |
| Live affiliate shopping | BLOCKED | Official eBay adapter, OAuth, mapping, cache/privacy/tests exist. Gated by credentials + explicit production access. |
| Price comparison | PARTIAL | Exact-identity grouping/UI ships. Does not advertise compare for one provider. Second official provider still absent, so no live multi-retailer compare. |
| Recipes catalog | PARTIAL | Explorer (search, filters, detail, servings, save, menu, grocery) works against the original TDG seed. 1,500 licensed/original recipes are not in the catalog. |
| Meal planning | PARTIAL | Eve/Day/custom sittings, guest count, times, completeness, servings → grocery. Catalog depth and production UX acceptance remain. |
| Grocery generation | PARTIAL | Derived list, merge, incompatible units, aisle grouping, have/bought, manual extras, no duplicate persisted rows. Needs production data after migration. |
| Studio integration | PARTIAL | Contextual cues from gifts/cards/memories (not a spammy dashboard). Credits/economics not fully wired. |
| Copilot | PARTIAL | Deterministic Engine answers plus preview/confirm apply for validated writes. No live model; commerce facts still must come from providers. |
| Commerce/paywall/entitlements | PARTIAL | $17 Founding Pass is server-authoritative in seed + migration. Kill switches remain off. Real-money E2E not run. |
| Analytics/admin reporting | PARTIAL | Funnel steps expanded; Planner North Star admin panel computes visitors/starts/preview/checkout/purchase/conversion/revenue/AOV/UTM/device/activation/drop-off. Production verification remaining. |
| SEO/acquisition | PARTIAL | Canonical/hreflang/sitemap/index checks pass in smoke (155 routes, 0 failures). Search Console verification remaining. |
| Mobile production QA | MISSING | Requires physical/mobile production acceptance. |
| VPS-only hygiene | PARTIAL | `@vercel/node` / `@vercel/functions` removed; Node API types + origin adapter. Historical Vercel mentions remain in docs/history. VPS deploy of `068c76f` succeeded (`TDG_VPS_DEPLOY_OK`); GitHub Vercel status checks are not the production gate. |

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
- Live affiliate / second official provider credentials and production access cannot be invented in code.
- 1,500 quality recipes require a lawful content acquisition/generation/QA pipeline, not copied web recipes.
- Real-money checkout validation waits until launch candidate by product decision.
- Physical-device production QA requires an actual device/session.

## Launch-critical remaining implementation
1. Production mobile QA of Planner + Founding Pass value moment.
2. Keep checkout killed until launch QA, then 1–3 real charges (Founding Pass migration is applied in production Supabase).
3. Seed/ingest and QA a lawful 1,500-recipe catalog.
4. Enable eBay after credentials; add a second official provider before advertising Price Compare.
5. Production analytics verification and Search Console.
