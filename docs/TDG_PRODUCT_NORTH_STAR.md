# TDG Product North Star · Christmas 2026 to Evergreen Planner

**Status:** canonical product target
**Launch product:** Christmas 2026
**Architecture principle:** Christmas is the first occasion, not the permanent domain model.

## Commercial target
Immediate product: a paid interactive Christmas planning system, not a PDF or disconnected tools.
Launch offer: **Christmas 2026 Founding Pass · $17 one-time**.
Commercial price ladder to test as depth/proof/urgency improve: **$17 → $27 → $37 → $47 → $57**.
Evergreen destination: membership usable for birthdays, Thanksgiving, Easter, Valentine's, anniversaries, dinner parties and recurring meal/gift planning. Working target: **$6.99/month / $59/year**, subject to validation.

## Product promise
The user gives the Planner people, dates, budget, meals, preferences and constraints. The product creates one connected command center and keeps the plan synchronized.

Example: 12 people, $1,500 total budget, six gifts left, Romanian-American dinner Dec 24 at 7 PM.

## Six standalone products

### 1. AI Occasion Planner / Christmas Planner · value target ~$19
Onboarding/profile; countdown/dates; calendar/timeline; tasks/priorities; total/category budgets; Today recommendations; sprint/rescue/last-minute modes; hosting/travel where relevant.

### 2. Gift Planner + Gift Finder · value target ~$19
Recipients, interests and per-person budgets; gift recommendations; wishlist; gift lifecycle from idea to given; save real products to recipient; delivery awareness; budget integration.

### 3. Gift Shopping + Price Compare · value target ~$9–15
“I know what I want” search; exact-product matching where reliable using model/GTIN/UPC/provider identifiers; offers from supported major retailers/providers; compare price, merchant, condition and delivery when supplied; affiliate attribution; Add to Gift Plan. Never fabricate retailer availability or prices.

### 4. Recipes + Meal Planner · value target ~$19
Target 1,500 high-quality global recipes first, expandable toward 3,000+; Christmas/winter/Thanksgiving first; country/culture/course/diet/allergen/difficulty/cost/time metadata; structured ingredients/instructions; serving scaler; menus by occasion/date; AI-assisted planning from guests, budget, diet and time.

### 5. Smart Grocery Planner · value target ~$9
One list from selected recipes/meals; scaled quantities; duplicate ingredient aggregation; safe unit normalization; aisle grouping; check-off/already-have; manual items; cost hooks where data exists.

### 6. Christmas Studio · value target ~$15–30
Personalized Christmas photos; Santa/personalized video; cards/messages; credits/generation entitlements; contextual Planner cross-sells.

Combined standalone perceived value target: roughly **$90–110+**, before cross-module automation.

## The multiplier: one connected Copilot
Premium value comes from modules acting as one system.
- “Add my aunt to dinner; now we are 11.” → meal/grocery implications update.
- “I bought Dad's gift for $120.” → gift status and budget update.
- “Find a cheaper version.” → supported providers return comparable offers.
- “I only have three hours to cook.” → meal/prep recommendations adapt.
- “I have $300 left for gifts.” → recommendations respect remaining budget.

AI writes must be controlled and previewable/reversible where appropriate. AI must never invent live price/availability data.

## Gift commerce / affiliate contract
Gift Finder and Planner Gift Concierge share recommendation/provider infrastructure. Preserve provider, external product ID, title/image, merchant/marketplace, current provider price/currency, condition, delivery window when supplied, affiliate URL and checked timestamp.

Price Compare is not a hard-coded Amazon/eBay/third-store promise. It compares supported major providers with reliable current offers.

Gift cards can become a last-minute module only through providers/programs that explicitly permit affiliate/distribution use.

## Recipes / grocery architecture
Long-term model must support concepts equivalent to occasions, recipes, recipe ingredients, meal plans, meal plan items, grocery lists and grocery items. Christmas is an occasion; Thanksgiving and later occasions reuse the engine.

Do not scrape and republish copyrighted recipe text/images. Published content must be original, licensed/open or otherwise permitted.

## Monetization
Immediate: **Christmas 2026 Founding Pass · $17 one-time**.
Free acquisition can include selected recipes, Gift Finder previews and Planner teaser/results.
Seasonal: test $27 / $37 / $47 / $57 as capability and urgency increase.
Evergreen: target **$6.99/month / $59/year** for multi-occasion recurring utility and member benefits/credits where economics support them.

## Required $17 launch scope
Founding Pass is not ready until these work end-to-end:
1. Planner + calendar/tasks + budget.
2. Gift Planner + Gift Finder.
3. Real affiliate products + reliable provider integration.
4. Recipes + Meal Planner.
5. Smart Grocery List generated from recipes/meals.
6. Christmas Studio integration/cross-sell.
7. Paid checkout → entitlement → account access.
8. Funnel analytics from acquisition through payment/core activation.
9. Mobile-first production QA on VPS.

Price comparison and gift-card commerce enhance the offer. Price Compare becomes launch-required once advertised as part of the paid offer.

## Readiness scorecard
When asked “how much is left?”, report against this North Star, not file/test counts. For each: **DONE / PARTIAL / MISSING / BLOCKED**.
Planner shell/onboarding; calendar/tasks; budget; gifts/recipients; Gift Finder; live affiliate shopping; price comparison; recipes catalog; meal planning; grocery generation; Studio integration; Copilot/cross-module automation; commerce/paywall/entitlements; analytics/admin reporting; SEO/acquisition; mobile production QA; VPS-only deployment hygiene.

A passing unit test does not make an area DONE. DONE means the intended user flow works in production or has production-equivalent evidence.

## Non-negotiables
- Production is **VPS-only**. Node handlers run on the Mozas origin. Do not add another frontend host.
- Prices are server-authoritative; never trust client checkout amounts.
- Live product price/availability/delivery comes from providers and carries freshness metadata.
- Affiliate relationships are disclosed.
- No real-money E2E until nearly launch-ready; then run 1–3 controlled real transactions.
- Build Christmas first, but preserve later occasion reuse.
- Do not expand beyond the six core products until they and the paid path are excellent.
